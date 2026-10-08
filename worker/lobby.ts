import { DurableObject } from 'cloudflare:workers';
import {
  CLOSE_RATE_LIMITED,
  CLOSE_REPLACED,
  PING,
  PONG,
  ROOM_PHASES,
  type ClientMessage,
  type IceConfig,
  type IceServer,
  type RoomIdentity,
  type ServerMessage,
} from '../src/shared/protocol';
import { hashPassword, hashToken, newSessionToken } from './crypto';
import { HttpError, cleanText, clientIp, json, readJsonBody } from './http';
import { countAttempt } from './rateLimit';
import { fullBucket, takeToken, type Bucket } from './tokenBucket';
import {
  MAX_OPEN_ROOMS,
  MAX_STORED_ROOMS,
  RECONNECT_MS,
  isAbandoned,
  isFull,
  newRoom,
  parseRoomSettings,
  toPublicRoom,
  type Member,
  type Room,
} from './rooms';

export interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  ASSETS: Fetcher;
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
}

/** Data attached to each hibernatable WebSocket; survives Durable Object restarts. */
interface SocketAttachment extends Bucket {
  roomId: string;
  memberId: string;
}

const ALARM_INTERVAL_MS = 60_000;
const MAX_SOCKET_MESSAGE = 32_768;
const STUN_SERVER: IceServer = { urls: 'stun:stun.cloudflare.com:3478' };
const JOIN_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/join$/;

/**
 * Single Durable Object holding the room directory and relaying WebRTC signaling.
 * Only room metadata lives here: cards and gameplay travel peer-to-peer.
 */
export class Lobby extends DurableObject<Env> {
  private rooms = new Map<string, Room>();
  /** tokenHash → room and member, so authenticating does not scan every room. */
  private sessions = new Map<string, { roomId: string; memberId: string }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => this.load());
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private async load(): Promise<void> {
    const stored = await this.ctx.storage.list<Room>({ prefix: 'room:' });
    for (const room of stored.values()) this.track(room);
    // Older deployments kept every room under a single `rooms` key.
    const legacy = await this.ctx.storage.get<Record<string, Room>>('rooms');
    if (!legacy) return;
    for (const room of Object.values(legacy)) {
      this.track(room);
      await this.save(room);
    }
    await this.ctx.storage.delete('rooms');
  }

  private track(room: Room): void {
    this.rooms.set(room.id, room);
    for (const member of room.members)
      this.sessions.set(member.tokenHash, { roomId: room.id, memberId: member.id });
  }

  private async forget(room: Room): Promise<void> {
    this.rooms.delete(room.id);
    for (const member of room.members) this.sessions.delete(member.tokenHash);
    await this.ctx.storage.delete(`room:${room.id}`);
  }

  private async save(room: Room): Promise<void> {
    await this.ctx.storage.put(`room:${room.id}`, room);
  }

  // ── Sockets ────────────────────────────────────────────────────────────────

  private sockets(roomId: string): WebSocket[] {
    return this.ctx.getWebSockets(roomId);
  }

  private attachment(socket: WebSocket): SocketAttachment | null {
    return socket.deserializeAttachment() as SocketAttachment | null;
  }

  private socketOf(roomId: string, memberId: string): WebSocket | undefined {
    return this.sockets(roomId).find(
      socket => socket.readyState === WebSocket.OPEN && this.attachment(socket)?.memberId === memberId,
    );
  }

  private isConnected(roomId: string, memberId: string | null): boolean {
    return memberId !== null && this.socketOf(roomId, memberId) !== undefined;
  }

  private roster(room: Room): ServerMessage {
    const members = room.members.map(member => ({
      id: member.id,
      name: member.name,
      retired: member.retired,
      connected: !member.retired && this.isConnected(room.id, member.id),
      disconnectedAt: member.disconnectedAt,
    }));
    const publicRoom = { ...toPublicRoom(room), settings: room.settings };
    return { type: 'roster', room: publicRoom, hostId: room.hostId ?? '', epoch: room.epoch, members };
  }

  private broadcast(room: Room, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.sockets(room.id)) {
      try {
        socket.send(payload);
      } catch {
        // The socket is closing; its close handler cleans up.
      }
    }
  }

  /** Hands the host role to the first connected member when the host is gone. */
  private electHost(room: Room): void {
    if (this.isConnected(room.id, room.hostId)) return;
    const next = room.members.find(member => !member.retired && this.isConnected(room.id, member.id));
    if (next && next.id !== room.hostId) {
      room.hostId = next.id;
      room.epoch++;
    }
  }

  private async publish(room: Room): Promise<void> {
    this.electHost(room);
    await this.save(room);
    this.broadcast(room, this.roster(room));
  }

  // ── HTTP ───────────────────────────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    try {
      return await this.route(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      return json({ error: 'Não foi possível processar a solicitação.' }, 400);
    }
  }

  private route(request: Request): Promise<Response> | Response {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /api/rooms') return this.listRooms();
    if (route === 'GET /api/ice') return this.iceServers(request);
    if (route === 'POST /api/rooms') return this.createRoom(request);
    if (route === 'GET /api/connect') return this.openSocket(request, url);
    const joinMatch = request.method === 'POST' ? JOIN_PATH.exec(url.pathname) : null;
    if (joinMatch?.[1]) return this.joinRoom(request, joinMatch[1]);
    throw new HttpError(404, 'Endpoint não encontrado.');
  }

  private listRooms(): Response {
    const open = [...this.rooms.values()].filter(room => this.sockets(room.id).length > 0);
    return json(open.map(toPublicRoom));
  }

  private async iceServers(request: Request): Promise<Response> {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
    if (!(await this.authenticate(token))) throw new HttpError(401, 'Entre numa sala para obter conexão.');
    const { TURN_KEY_ID: keyId, TURN_API_TOKEN: apiToken } = this.env;
    const config: IceConfig = { iceServers: [STUN_SERVER], turnConfigured: Boolean(keyId && apiToken) };
    if (keyId && apiToken) config.iceServers.push(...(await fetchTurnServers(keyId, apiToken)));
    return json(config);
  }

  private async createRoom(request: Request): Promise<Response> {
    const input = await readJsonBody(request);
    const playerName = requirePlayerName(input);
    const settings = parseRoomSettings(input);
    await this.checkRoomQuota(request);
    const salt = crypto.randomUUID();
    const password = cleanText(input.password, 64);
    const room = newRoom({
      existingIds: new Set(this.rooms.keys()),
      name: input.name,
      settings,
      salt,
      password: password ? await hashPassword(password, salt) : null,
      now: Date.now(),
    });
    this.rooms.set(room.id, room);
    return this.admit(room, playerName);
  }

  private async checkRoomQuota(request: Request): Promise<void> {
    const openRooms = [...this.rooms.values()].filter(room => this.sockets(room.id).length > 0);
    if (openRooms.length >= MAX_OPEN_ROOMS || this.rooms.size >= MAX_STORED_ROOMS) {
      throw new HttpError(429, 'Muitas salas abertas. Tente novamente depois.');
    }
    const limit = { max: 5, windowMs: 10 * 60_000 };
    const allowed = await countAttempt(
      this.ctx.storage,
      `attempt:create:${clientIp(request)}`,
      limit,
      Date.now(),
    );
    if (!allowed) throw new HttpError(429, 'Muitas salas criadas. Aguarde alguns minutos.');
  }

  private async joinRoom(request: Request, roomId: string): Promise<Response> {
    const input = await readJsonBody(request);
    const playerName = requirePlayerName(input);
    const room = this.rooms.get(roomId);
    const now = Date.now();
    if (!room || (this.sockets(room.id).length === 0 && isAbandoned(room, now))) {
      throw new HttpError(404, 'Sala não encontrada.');
    }
    // Rate-limit password attempts per IP before the expensive key derivation.
    const limit = { max: 10, windowMs: 60_000 };
    const allowed = await countAttempt(
      this.ctx.storage,
      `attempt:${clientIp(request)}:${room.id}`,
      limit,
      now,
    );
    if (!allowed) throw new HttpError(429, 'Muitas tentativas. Aguarde um minuto.');
    const password = cleanText(input.password, 64);
    if (room.password && room.password !== (await hashPassword(password, room.salt))) {
      throw new HttpError(403, 'Senha incorreta.');
    }
    if (isFull(room)) throw new HttpError(409, 'Sala cheia.');
    return this.admit(room, playerName);
  }

  /** Adds a member with a fresh session token. The first member becomes host. */
  private async admit(room: Room, name: string): Promise<Response> {
    const token = newSessionToken();
    const now = Date.now();
    const member: Member = {
      id: crypto.randomUUID(),
      name,
      tokenHash: await hashToken(token),
      disconnectedAt: now,
      retired: false,
    };
    room.members.push(member);
    room.hostId ??= member.id;
    room.updatedAt = now;
    this.track(room);
    await this.save(room);
    await this.ctx.storage.setAlarm(now + ALARM_INTERVAL_MS);
    const identity: RoomIdentity = { roomId: room.id, memberId: member.id, token, settings: room.settings };
    return json(identity, 201);
  }

  private async openSocket(request: Request, url: URL): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      throw new HttpError(426, 'WebSocket obrigatório.');
    }
    const auth = await this.authenticate(url.searchParams.get('token'));
    if (!auth) throw new HttpError(401, 'Sessão inválida. Entre novamente na sala.');
    const { room, member } = auth;
    // One socket per member: a second tab replaces the first one.
    this.socketOf(room.id, member.id)?.close(CLOSE_REPLACED, 'Sessão substituída');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [room.id]);
    const attachment: SocketAttachment = { roomId: room.id, memberId: member.id, ...fullBucket(Date.now()) };
    server.serializeAttachment(attachment);
    member.disconnectedAt = null;
    room.updatedAt = Date.now();
    room.everConnected = true;
    await this.publish(room);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async authenticate(token: string | null): Promise<{ room: Room; member: Member } | null> {
    if (!token || token.length > 150) return null;
    const session = this.sessions.get(await hashToken(token));
    const room = session && this.rooms.get(session.roomId);
    const member = room?.members.find(candidate => candidate.id === session?.memberId && !candidate.retired);
    return room && member ? { room, member } : null;
  }

  // ── WebSocket events ───────────────────────────────────────────────────────

  override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const meta = this.attachment(socket);
    const room = meta && this.rooms.get(meta.roomId);
    if (!meta || !room || typeof raw !== 'string' || raw.length > MAX_SOCKET_MESSAGE) return;
    const now = Date.now();
    // Sockets opened before the token bucket existed carry no bucket yet.
    const bucket = takeToken(typeof meta.tokens === 'number' ? meta : fullBucket(now), now);
    if (!bucket) {
      socket.close(CLOSE_RATE_LIMITED, 'Muitas mensagens');
      return;
    }
    socket.serializeAttachment({ ...meta, ...bucket });
    try {
      await this.handleClientMessage(room, meta.memberId, socket, JSON.parse(raw) as ClientMessage);
    } catch {
      // Ignore malformed signaling without exposing internal data.
    }
  }

  private async handleClientMessage(room: Room, senderId: string, socket: WebSocket, message: ClientMessage) {
    switch (message.type) {
      case 'signal':
        this.relaySignal(room, senderId, message);
        return;
      case 'status':
        if (senderId === room.hostId) await this.updateStatus(room, message);
        return;
      case 'leave':
        await this.leave(room, senderId, socket);
        return;
    }
  }

  /** Signals only flow between the host and a guest of the same room and the current epoch. */
  private relaySignal(
    room: Room,
    senderId: string,
    message: Extract<ClientMessage, { type: 'signal' }>,
  ): void {
    const involvesHost = senderId === room.hostId || message.to === room.hostId;
    if (!involvesHost || message.epoch !== room.epoch) return;
    const forwarded: ServerMessage = {
      type: 'signal',
      from: senderId,
      data: message.data,
      epoch: room.epoch,
    };
    this.socketOf(room.id, message.to)?.send(JSON.stringify(forwarded));
  }

  /** The host reports the match phase so the directory can show it. */
  private async updateStatus(room: Room, message: Extract<ClientMessage, { type: 'status' }>): Promise<void> {
    if (ROOM_PHASES.includes(message.phase)) room.phase = message.phase;
    const { botCount, spectatorIds } = message;
    if (Number.isInteger(botCount) && botCount >= 0 && botCount <= 9) room.botCount = botCount;
    if (Array.isArray(spectatorIds)) {
      for (const member of room.members) member.spectator = spectatorIds.includes(member.id);
    }
    room.updatedAt = Date.now();
    await this.save(room);
  }

  private async leave(room: Room, memberId: string, socket: WebSocket): Promise<void> {
    const member = room.members.find(candidate => candidate.id === memberId);
    if (!member) return;
    // Backdate the disconnection so the reconnection window is already over.
    member.disconnectedAt = Date.now() - RECONNECT_MS;
    member.retired = true;
    socket.close(1000, 'Saiu da sala');
    await this.publish(room);
  }

  private async onDisconnect(socket: WebSocket): Promise<void> {
    const meta = this.attachment(socket);
    const room = meta && this.rooms.get(meta.roomId);
    if (!meta || !room) return;
    const member = room.members.find(candidate => candidate.id === meta.memberId);
    if (member && !this.isConnected(room.id, member.id)) member.disconnectedAt ??= Date.now();
    await this.publish(room);
  }

  override async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    // 1005/1006 describe a missing/abrupt close and must never be sent on the wire.
    const replyCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
    try {
      socket.close(replyCode, reason);
    } finally {
      await this.onDisconnect(socket);
    }
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    socket.close(1011, 'Conexão interrompida');
    await this.onDisconnect(socket);
  }

  // ── Housekeeping ───────────────────────────────────────────────────────────

  override async alarm(): Promise<void> {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      if (this.sockets(room.id).length === 0 && isAbandoned(room, now)) await this.forget(room);
      else if (room.phase === 'lobby') await this.dropLobbyLeavers(room, now);
    }
    const attempts = await this.ctx.storage.list<{ until: number }>({ prefix: 'attempt:' });
    const expired = [...attempts].filter(([, attempt]) => attempt.until < now).map(([key]) => key);
    if (expired.length) await this.ctx.storage.delete(expired);
    if (this.rooms.size) await this.ctx.storage.setAlarm(now + ALARM_INTERVAL_MS);
  }

  /** In the lobby, members who stayed away longer than the reconnection window lose their place. */
  private async dropLobbyLeavers(room: Room, now: number): Promise<void> {
    const stays = (member: Member): boolean =>
      member.disconnectedAt === null ||
      now - member.disconnectedAt < RECONNECT_MS ||
      this.isConnected(room.id, member.id);
    const remaining = room.members.filter(stays);
    if (remaining.length === room.members.length) return;
    for (const member of room.members) if (!stays(member)) this.sessions.delete(member.tokenHash);
    room.members = remaining;
    await this.save(room);
  }
}

function requirePlayerName(input: Record<string, unknown>): string {
  const name = cleanText(input.playerName, 24);
  if (!name) throw new HttpError(400, 'Escolha um nome para seu robô.');
  return name;
}

/** Short-lived TURN credentials from Cloudflare Realtime; the API token never leaves the server. */
async function fetchTurnServers(keyId: string, apiToken: string): Promise<IceServer[]> {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    },
  );
  if (!response.ok) throw new HttpError(502, 'Não foi possível obter a conexão de retransmissão.');
  const data = await response.json<{ iceServers: IceServer[] }>();
  return data.iceServers;
}
