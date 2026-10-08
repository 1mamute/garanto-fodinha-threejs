import { DurableObject } from 'cloudflare:workers';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256));
}
const tokenHash = async token => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
const publicRoom = r => ({ id: r.id, name: r.name, locked: !!r.password, capacity: r.settings.capacity,
  count: r.members.filter(m => !m.retired && !m.spectator).length + (r.botCount ?? 0), phase: r.phase, createdAt: r.createdAt });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return env.LOBBY.getByName('directory').fetch(request);
    return env.ASSETS.fetch(request);
  },
};

// Only room metadata and signaling live here. Cards and gameplay travel over WebRTC.
export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx; this.env = env; this.rooms = {};
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.list({ prefix: 'room:' });
      this.rooms = Object.fromEntries([...stored.values()].map(room => [room.id, room]));
      const legacy = await ctx.storage.get('rooms');
      if (legacy) {
        Object.assign(this.rooms, legacy);
        for (const room of Object.values(legacy)) await this.save(room);
        await ctx.storage.delete('rooms');
      }
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async save(room) { await this.ctx.storage.put(`room:${room.id}`, room); }
  sockets(roomId) { return this.ctx.getWebSockets(roomId); }
  connected(roomId, memberId) {
    return this.sockets(roomId).some(ws => ws.readyState === 1 && ws.deserializeAttachment()?.memberId === memberId);
  }
  roster(room) {
    return { type: 'roster', room: { ...publicRoom(room), settings: room.settings }, hostId: room.hostId, epoch: room.epoch,
      members: room.members.map(m => ({ id: m.id, name: m.name, retired: m.retired,
        connected: !m.retired && this.connected(room.id, m.id), disconnectedAt: m.disconnectedAt })) };
  }
  broadcast(room, payload) {
    const message = JSON.stringify(payload);
    for (const ws of this.sockets(room.id)) { try { ws.send(message); } catch { /* stale socket */ } }
  }
  elect(room) {
    if (!this.connected(room.id, room.hostId)) {
      const next = room.members.find(m => !m.retired && this.connected(room.id, m.id));
      if (next && next.id !== room.hostId) { room.hostId = next.id; room.epoch++; }
    }
  }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    try {
      if (request.method === 'GET' && path === '/api/rooms') {
        const rooms = Object.values(this.rooms).filter(r => this.sockets(r.id).length);
        return json(rooms.map(publicRoom));
      }
      if (request.method === 'GET' && path === '/api/ice') {
        const auth = request.headers.get('Authorization')?.replace(/^Bearer /, '');
        if (!auth || !await this.authenticate(auth)) return json({ error: 'Entre numa sala para obter conexão.' }, 401);
        const iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];
        if (this.env.TURN_KEY_ID && this.env.TURN_API_TOKEN) {
          const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${this.env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
            method: 'POST', headers: { Authorization: `Bearer ${this.env.TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ttl: 86400 }),
          });
          if (!response.ok) return json({ error: 'Não foi possível obter a conexão de retransmissão.' }, 502);
          const data = await response.json();
          iceServers.push(...data.iceServers);
        }
        return json({ iceServers, turnConfigured: !!this.env.TURN_API_TOKEN });
      }
      if (request.method === 'POST' && (path === '/api/rooms' || /^\/api\/rooms\/[A-Z0-9]+\/join$/.test(path))) {
        if (Number(request.headers.get('Content-Length')) > 4096) return json({ error: 'Solicitação muito grande.' }, 413);
        const raw = await request.text();
        if (raw.length > 4096) return json({ error: 'Solicitação muito grande.' }, 413);
        const input = JSON.parse(raw);
        const name = text(input.playerName, 24);
        if (!name) return json({ error: 'Escolha um nome para seu robô.' }, 400);
        let room;
        if (path === '/api/rooms') {
          const capacity = Number(input.capacity ?? 6), lives = Number(input.lives ?? 5);
          if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10 || !Number.isInteger(lives) || lives < 1 || lives > 20)
            return json({ error: 'Configuração da mesa inválida.' }, 400);
          const rooms = Object.values(this.rooms);
          if (rooms.filter(r => this.sockets(r.id).length).length >= 100) return json({ error: 'Muitas salas abertas. Tente novamente depois.' }, 429);
          let id;
          do { id = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase(); } while (this.rooms[id]);
          const salt = crypto.randomUUID(), password = text(input.password, 64);
          room = { id, name: text(input.name, 40) || 'Mesa dos amigos', settings: { capacity, lives },
            salt, password: password ? await passwordHash(password, salt) : null,
            members: [], hostId: null, epoch: 1, phase: 'lobby', createdAt: Date.now(), updatedAt: Date.now() };
          this.rooms[id] = room;
        } else {
          room = this.rooms[path.split('/')[3]];
          if (!room || (!this.sockets(room.id).length && Date.now() - room.updatedAt > 24 * 3600_000)) return json({ error: 'Sala não encontrada.' }, 404);
          // Rate-limit password attempts per IP before expensive derivation.
          const rateKey = `attempt:${request.headers.get('CF-Connecting-IP') ?? 'local'}:${room.id}`;
          const attempt = await this.ctx.storage.get(rateKey);
          if (attempt && attempt.until > Date.now() && attempt.count >= 10) return json({ error: 'Muitas tentativas. Aguarde um minuto.' }, 429);
          await this.ctx.storage.put(rateKey, { count: attempt?.until > Date.now() ? attempt.count + 1 : 1, until: Date.now() + 60_000 });
          if (room.password && room.password !== await passwordHash(text(input.password, 64), room.salt)) return json({ error: 'Senha incorreta.' }, 403);
          const limit = room.phase === 'lobby' ? room.settings.capacity : room.settings.capacity + 12;
          if (room.members.filter(m => !m.retired).length + (room.phase === 'lobby' ? room.botCount ?? 0 : 0) >= limit) return json({ error: 'Sala cheia.' }, 409);
        }
        const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        const member = { id: crypto.randomUUID(), name, tokenHash: await tokenHash(token), disconnectedAt: Date.now(), retired: false };
        room.members.push(member); room.hostId ??= member.id; room.updatedAt = Date.now();
        await this.save(room); await this.ctx.storage.setAlarm(Date.now() + 60_000);
        return json({ roomId: room.id, memberId: member.id, token, settings: room.settings }, 201);
      }
      if (request.method === 'GET' && path === '/api/connect') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket obrigatório.' }, 426);
        const auth = await this.authenticate(url.searchParams.get('token'));
        if (!auth) return json({ error: 'Sessão inválida. Entre novamente na sala.' }, 401);
        const { room, member } = auth;
        for (const old of this.sockets(room.id)) {
          if (old.deserializeAttachment()?.memberId === member.id) old.close(4001, 'Sessão substituída');
        }
        const pair = new WebSocketPair(), [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server, [room.id]);
        server.serializeAttachment({ roomId: room.id, memberId: member.id, window: Date.now(), count: 0 });
        member.disconnectedAt = null; room.updatedAt = Date.now(); this.elect(room);
        await this.save(room); this.broadcast(room, this.roster(room));
        return new Response(null, { status: 101, webSocket: client });
      }
      return json({ error: 'Endpoint não encontrado.' }, 404);
    } catch { return json({ error: 'Não foi possível processar a solicitação.' }, 400); }
  }
  async authenticate(token) {
    if (!token || token.length > 150) return null;
    const hash = await tokenHash(token);
    for (const room of Object.values(this.rooms)) {
      const member = room.members.find(m => m.tokenHash === hash && !m.retired);
      if (member) return { room, member };
    }
    return null;
  }
  async webSocketMessage(ws, raw) {
    const meta = ws.deserializeAttachment(), room = this.rooms[meta?.roomId];
    if (!room || typeof raw !== 'string' || raw.length > 32_768) return;
    const now = Date.now();
    if (now - meta.window > 1000) { meta.window = now; meta.count = 0; }
    if (++meta.count > 60) { ws.close(4008, 'Muitas mensagens'); return; }
    ws.serializeAttachment(meta);
    try {
      const message = JSON.parse(raw);
      if (message.type === 'signal') {
        const target = this.sockets(room.id).find(socket => socket.deserializeAttachment()?.memberId === message.to && socket.readyState === 1);
        if (target && (meta.memberId === room.hostId || message.to === room.hostId) && message.epoch === room.epoch)
          target.send(JSON.stringify({ type: 'signal', from: meta.memberId, data: message.data, epoch: room.epoch }));
      } else if (message.type === 'status' && meta.memberId === room.hostId) {
        if (['lobby', 'bet', 'play', 'trick', 'score', 'vote', 'finished'].includes(message.phase)) room.phase = message.phase;
        if (Number.isInteger(message.botCount) && message.botCount >= 0 && message.botCount <= 9) room.botCount = message.botCount;
        if (Array.isArray(message.spectatorIds)) room.members.forEach(m => { m.spectator = message.spectatorIds.includes(m.id); });
        room.updatedAt = now; await this.save(room);
      } else if (message.type === 'leave') {
        const member = room.members.find(m => m.id === meta.memberId);
        member.disconnectedAt = now - 180_000;
        member.retired = true; ws.close(1000, 'Saiu da sala');
        this.elect(room); await this.save(room); this.broadcast(room, this.roster(room));
      }
    } catch { /* Ignore malformed signaling without exposing internal data. */ }
  }
  async disconnected(ws) {
    const meta = ws.deserializeAttachment(), room = this.rooms[meta?.roomId];
    if (!room) return;
    const member = room.members.find(m => m.id === meta.memberId);
    if (member && !this.connected(room.id, member.id)) member.disconnectedAt ??= Date.now();
    this.elect(room); await this.save(room); this.broadcast(room, this.roster(room));
  }
  async webSocketClose(ws, code, reason) {
    // 1005/1006 describe a missing/abrupt close and must never be sent on the wire.
    const replyCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
    try { ws.close(replyCode, reason); } finally { await this.disconnected(ws); }
  }
  async webSocketError(ws) { ws.close(1011, 'Conexão interrompida'); await this.disconnected(ws); }
  async alarm() {
    const now = Date.now();
    for (const [id, room] of Object.entries(this.rooms)) {
      if (!this.sockets(id).length && now - room.updatedAt > 24 * 3600_000) {
        delete this.rooms[id]; await this.ctx.storage.delete(`room:${id}`); continue;
      }
      if (room.phase === 'lobby') {
        const members = room.members.filter(m => m.disconnectedAt === null || now - m.disconnectedAt < 180_000 || this.connected(id, m.id));
        if (members.length !== room.members.length) { room.members = members; await this.save(room); }
      }
    }
    const keys = await this.ctx.storage.list({ prefix: 'attempt:' });
    for (const [key, value] of keys) if (value.until < now) await this.ctx.storage.delete(key);
    if (Object.keys(this.rooms).length) await this.ctx.storage.setAlarm(now + 60_000);
  }
}
