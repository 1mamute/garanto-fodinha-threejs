/**
 * A player's connection to a table.
 *
 * Topology: the signaling server elects one member as host. The host runs the game rules and
 * holds the authoritative state; every guest has one WebRTC DataChannel to the host and sends
 * actions over it. When the host leaves, the server elects a new one and bumps the `epoch`;
 * the new host collects snapshots from the guests for a short grace period, keeps the newest
 * and carries on from there.
 */
import {
  applyAction,
  botAction,
  createPlayer,
  createState,
  reconcilePresence,
  sanitizeState,
  tick,
  type Action,
  type GameState,
} from '../game';
import { errorMessage } from '../shared/errors';
import type {
  IceConfig,
  PublicRoom,
  RoomIdentity,
  RoomSettings,
  RosterMember,
  ServerMessage,
} from '../shared/protocol';
import { api } from './api';
import { parseEnvelope, sanitizePose, type Envelope, type PeerMessage, type Pose } from './messages';
import { PeerLink, type PeerHandlers } from './peers';
import { SignalingSocket } from './signaling';
import { clearBackup, clearSavedSession, loadBackup, saveBackup, saveSession } from './storage';

const UPDATE_INTERVAL_MS = 300;
/** How long a new host waits for snapshots before resuming the match. */
const MIGRATION_GRACE_MS = 2_200;
const BOT_DELAY_MS = 1_150;
const PEER_RETRY_INTERVAL_MS = 5_000;
/** A connection that has not opened its channel by then is restarted. */
const PEER_CONNECT_TIMEOUT_MS = 12_000;
const CHAT_COOLDOWN_MS = 700;
const HOST_ONLY_ACTIONS = new Set<unknown>(['start', 'bots', 'rematch']);
const FALLBACK_ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export interface SessionCallbacks {
  onState(state: GameState): void;
  onStatus(status: string): void;
  onError(message: string): void;
  onPose(playerId: string, pose: Pose): void;
}

export type RoomInfo = PublicRoom & { settings: RoomSettings };

export class Session {
  state: GameState | null = null;
  room: RoomInfo | null = null;
  memberId = '';
  /** `null` for practice tables, which never talk to the server. */
  roomId: string | null = null;
  hostId: string | null = null;
  epoch = 0;
  /** While `Date.now()` is below this, a new host is still collecting snapshots. */
  migratingUntil = 0;
  closed = false;
  readonly peers = new Map<string, PeerLink>();

  private local = false;
  private playerName = '';
  /** The host epoch under which `state` was received. A new host's state always replaces older copies. */
  private stateEpoch = 0;
  private members: RosterMember[] = [];
  private iceServers: RTCIceServer[] = FALLBACK_ICE;
  private signaling: SignalingSocket | null = null;
  private lastReportedStatus = '';
  private lastBotMoveAt = 0;
  private lastPeerRetryAt = 0;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly peerHandlers: PeerHandlers = {
    onSignal: (peer, data) => {
      this.signaling?.send({ type: 'signal', to: peer.id, epoch: this.epoch, data });
    },
    onOpen: peer => {
      this.onChannelOpen(peer);
    },
    onClose: () => {
      if (this.isHost) this.syncPresence();
      else this.callbacks.onStatus('Conexão P2P interrompida. Tentando reconectar…');
    },
    onMessage: (peer, raw) => {
      this.onPeerFrame(peer, raw);
    },
    onFailed: peer => {
      if (this.peers.get(peer.id) !== peer) return;
      this.peers.delete(peer.id);
      if (this.isHost) this.syncPresence();
    },
  };

  constructor(private readonly callbacks: SessionCallbacks) {
    this.timer = setInterval(() => {
      this.update();
    }, UPDATE_INTERVAL_MS);
  }

  get isHost(): boolean {
    return this.hostId !== null && this.hostId === this.memberId;
  }

  get isLocal(): boolean {
    return this.local;
  }

  // ── Starting ───────────────────────────────────────────────────────────────

  /** A practice table: this browser is the host and there is no server. */
  startLocal(playerName: string, botCount: number): void {
    this.local = true;
    this.memberId = crypto.randomUUID();
    this.hostId = this.memberId;
    const table = createState(createPlayer(this.memberId, playerName));
    this.state = applyAction(table, this.memberId, { type: 'bots', count: botCount });
    this.callbacks.onStatus('Treino com bots');
    this.callbacks.onState(this.state);
  }

  async online(identity: RoomIdentity, playerName: string): Promise<void> {
    this.memberId = identity.memberId;
    this.roomId = identity.roomId;
    this.playerName = playerName;
    this.state = loadBackup(identity.roomId);
    saveSession(identity, playerName);
    await this.loadIceServers(identity.token);
    this.signaling = new SignalingSocket(identity.token, {
      onMessage: message => this.onServerMessage(message),
      onStatus: status => {
        this.callbacks.onStatus(status);
      },
      onError: message => {
        this.callbacks.onError(message);
      },
      onReplaced: message => {
        this.closed = true;
        this.callbacks.onError(message);
      },
    });
    this.signaling.connect();
  }

  private async loadIceServers(token: string): Promise<void> {
    try {
      const config = await api<IceConfig>('/ice', undefined, token);
      this.iceServers = config.iceServers;
    } catch (error) {
      this.callbacks.onError(errorMessage(error));
    }
  }

  // ── Signaling server ───────────────────────────────────────────────────────

  private async onServerMessage(message: ServerMessage): Promise<void> {
    if (message.type === 'roster') await this.applyRoster(message);
    else if (message.epoch === this.epoch) await this.receiveSignal(message.from, message.data);
  }

  private async applyRoster(message: Extract<ServerMessage, { type: 'roster' }>): Promise<void> {
    const hostChanged = this.hostId !== message.hostId || this.epoch !== message.epoch;
    this.members = message.members;
    this.room = message.room;
    this.hostId = message.hostId;
    this.epoch = message.epoch;
    if (hostChanged) this.startMigration();
    if (!this.isHost) return;
    this.state ??= createState(createPlayer(this.memberId, this.playerName), message.room.settings);
    await this.connectToGuests();
    if (!hostChanged && !this.isMigrating()) this.syncPresence();
    this.callbacks.onState(this.state);
  }

  /** Every connection belongs to one host epoch; a new host means new connections. */
  private startMigration(): void {
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
    this.migratingUntil = Date.now() + MIGRATION_GRACE_MS;
    this.callbacks.onStatus(this.state ? 'Transferindo controle da mesa…' : 'Preparando a mesa…');
  }

  private async connectToGuests(): Promise<void> {
    for (const member of this.members) {
      if (member.connected && member.id !== this.hostId && !this.peers.has(member.id)) {
        await this.openPeer(member.id, true);
      }
    }
  }

  private async openPeer(id: string, asOfferer: boolean): Promise<PeerLink> {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const peer = new PeerLink(id, this.iceServers, this.peerHandlers);
    this.peers.set(id, peer);
    if (asOfferer) await peer.offer();
    return peer;
  }

  private async receiveSignal(from: string, data: unknown): Promise<void> {
    // Guests only ever connect to the host.
    if (!this.isHost && from !== this.hostId) return;
    const peer = this.peers.get(from) ?? (await this.openPeer(from, false));
    await peer.receiveSignal(data);
  }

  // ── Peer messages ──────────────────────────────────────────────────────────

  private onChannelOpen(peer: PeerLink): void {
    this.callbacks.onStatus('Mesa conectada');
    if (!this.isHost) {
      this.sendTo(peer, { type: 'snapshot', state: this.state });
      return;
    }
    this.sendTo(peer, { type: 'requestSnapshot' });
    if (!this.isMigrating()) {
      this.syncPresence();
      this.sendTo(peer, { type: 'state', state: this.state });
    }
  }

  private onPeerFrame(peer: PeerLink, raw: unknown): void {
    const message = parseEnvelope(raw);
    if (message?.epoch !== this.epoch) return;
    try {
      this.handlePeerMessage(peer, message);
    } catch (error) {
      this.callbacks.onError(errorMessage(error));
    }
  }

  private handlePeerMessage(peer: PeerLink, message: Envelope): void {
    if (message.type === 'pose') this.receivePose(peer, message);
    else if (message.type === 'ping') this.sendTo(peer, { type: 'pong' });
    else if (this.isHost) this.handleGuestMessage(peer, message);
    else if (peer.id === this.hostId) this.handleHostMessage(peer, message);
  }

  /** Runs on the host, for messages sent by a guest. */
  private handleGuestMessage(peer: PeerLink, message: Envelope): void {
    if (message.type === 'action') this.hostAction(peer.id, message.action);
    else if (message.type === 'snapshot' && this.isMigrating()) this.adoptSnapshot(message.state);
  }

  /** Runs on a guest, for messages sent by the host. */
  private handleHostMessage(peer: PeerLink, message: Envelope): void {
    if (message.type === 'state') this.receiveState(message.state);
    else if (message.type === 'requestSnapshot') this.sendTo(peer, { type: 'snapshot', state: this.state });
    else if (message.type === 'error' && typeof message.message === 'string') {
      this.callbacks.onError(message.message.slice(0, 200));
    }
  }

  /** During a migration the new host keeps the most advanced copy of the game it can find. */
  private adoptSnapshot(raw: unknown): void {
    const snapshot = sanitizeState(raw);
    if (snapshot && snapshot.version > (this.state?.version ?? -1)) this.state = snapshot;
  }

  private receiveState(raw: unknown): void {
    const next = sanitizeState(raw);
    if (!next) return;
    // Versions only order states from the same host. A new host may restart from a lower
    // version than the copy we got from the previous one, and its state must still win.
    const sameHost = this.stateEpoch === this.epoch;
    if (this.state && sameHost && next.version < this.state.version) return;
    this.state = next;
    this.stateEpoch = this.epoch;
    this.backup();
    this.callbacks.onState(next);
  }

  /** Guests send their pose to the host, which forwards it to everybody else. */
  private receivePose(peer: PeerLink, message: Extract<PeerMessage, { type: 'pose' }>): void {
    const pose = sanitizePose(message.pose);
    if (!pose) return;
    if (this.isHost) {
      this.callbacks.onPose(peer.id, pose);
      this.broadcast({ type: 'pose', id: peer.id, pose }, peer.id);
    } else if (peer.id === this.hostId && typeof message.id === 'string') {
      this.callbacks.onPose(message.id, pose);
    }
  }

  private sendTo(peer: PeerLink, message: PeerMessage): void {
    peer.send(JSON.stringify({ ...message, epoch: this.epoch }));
  }

  private broadcast(message: PeerMessage, exceptId?: string): void {
    for (const peer of this.peers.values()) {
      if (peer.id !== exceptId) this.sendTo(peer, message);
    }
  }

  // ── Host duties ────────────────────────────────────────────────────────────

  private isMigrating(): boolean {
    return Date.now() < this.migratingUntil;
  }

  /** Marks players as connected or disconnected according to who has an open channel. */
  private syncPresence(): void {
    if (!this.isHost || this.local || !this.state) return;
    const members = this.members.map(member => ({
      ...member,
      connected: member.id === this.hostId || this.peers.get(member.id)?.isOpen === true,
    }));
    const next = reconcilePresence(this.state, members);
    if (next !== this.state) this.commit(next);
  }

  /** Stores a new authoritative state and sends it to every guest. */
  private commit(state: GameState): void {
    this.state = state;
    this.stateEpoch = this.epoch;
    this.backup();
    this.broadcast({ type: 'state', state });
    this.callbacks.onState(state);
    this.reportStatus(state);
  }

  /** Tells the server what the room directory should show. Sent only when it changes. */
  private reportStatus(state: GameState): void {
    if (this.local) return;
    const status = {
      type: 'status',
      phase: state.phase,
      botCount: state.players.filter(player => player.bot).length,
      spectatorIds: state.players.filter(player => player.spectator).map(player => player.id),
    } as const;
    const serialized = JSON.stringify(status);
    if (serialized === this.lastReportedStatus) return;
    this.lastReportedStatus = serialized;
    this.signaling?.send(status);
  }

  private backup(): void {
    if (this.roomId && this.state) saveBackup(this.roomId, this.state);
  }

  private hostAction(actorId: string, action: unknown): void {
    if (!this.state) return;
    try {
      this.checkHostRules(actorId, action);
      this.commit(applyAction(this.state, actorId, action));
    } catch (error) {
      this.reportActionError(actorId, errorMessage(error));
    }
  }

  /** Room-level rules the pure game rules do not know about. */
  private checkHostRules(actorId: string, action: unknown): void {
    if (this.isMigrating()) throw new Error('A mesa está sincronizando. Aguarde um instante.');
    const type = (action as { type?: unknown } | null)?.type;
    if (HOST_ONLY_ACTIONS.has(type) && actorId !== this.hostId)
      throw new Error('Somente o host pode fazer isso.');
    if (type === 'chat' && this.isChatFlood(actorId)) {
      throw new Error('Espere um instante antes de enviar outra mensagem.');
    }
  }

  private isChatFlood(actorId: string): boolean {
    const last = this.state?.chat.filter(message => message.playerId === actorId).at(-1);
    return last !== undefined && Date.now() - last.at < CHAT_COOLDOWN_MS;
  }

  private reportActionError(actorId: string, message: string): void {
    if (actorId === this.memberId) {
      this.callbacks.onError(message);
      return;
    }
    const peer = this.peers.get(actorId);
    if (peer) this.sendTo(peer, { type: 'error', message });
  }

  // ── Public actions ─────────────────────────────────────────────────────────

  action(action: Action): void {
    if (this.closed) return;
    if (this.isHost) {
      if (!this.local && !this.signaling?.isOpen) this.callbacks.onError('Aguarde a reconexão à sala.');
      else this.hostAction(this.memberId, action);
      return;
    }
    const host = this.hostId === null ? undefined : this.peers.get(this.hostId);
    if (host?.isOpen) this.sendTo(host, { type: 'action', action });
    else this.callbacks.onError('Aguardando conexão com o host.');
  }

  sendPose(pose: Pose): void {
    if (!this.memberId) return;
    if (this.isHost) {
      this.broadcast({ type: 'pose', id: this.memberId, pose });
      return;
    }
    const host = this.hostId === null ? undefined : this.peers.get(this.hostId);
    if (host) this.sendTo(host, { type: 'pose', pose });
  }

  // ── Periodic work ──────────────────────────────────────────────────────────

  private update(): void {
    if (this.closed || !this.memberId) return;
    const now = Date.now();
    this.signaling?.keepAlive(now);
    if (this.isHost && this.signaling?.isOpen) this.retryStalledPeers(now);
    if (!this.canRunTable()) return;
    if (this.migratingUntil) {
      if (now < this.migratingUntil) return;
      this.finishMigration();
    }
    if (!this.state) return;
    const next = tick(this.state, now);
    if (next !== this.state) this.commit(next);
    this.moveNextBot(now);
  }

  private canRunTable(): boolean {
    return this.isHost && (this.local || this.signaling?.isOpen === true);
  }

  private finishMigration(): void {
    this.migratingUntil = 0;
    this.syncPresence();
    // Sent even when unchanged: the guests must learn the state chosen by the new host.
    if (this.state) this.commit(this.state);
    this.callbacks.onStatus('Mesa conectada');
  }

  /** Restarts connections that never opened, and connects members that have no connection yet. */
  private retryStalledPeers(now: number): void {
    if (now - this.lastPeerRetryAt < PEER_RETRY_INTERVAL_MS) return;
    this.lastPeerRetryAt = now;
    for (const member of this.members) {
      if (!member.connected || member.id === this.hostId) continue;
      const peer = this.peers.get(member.id);
      if (peer && !peer.isOpen && now - peer.startedAt > PEER_CONNECT_TIMEOUT_MS) {
        peer.close();
        this.peers.delete(member.id);
      }
      if (!this.peers.has(member.id)) {
        this.openPeer(member.id, true).catch((error: unknown) => {
          this.callbacks.onError(errorMessage(error));
        });
      }
    }
  }

  /** Bots act one at a time, with a pause so humans can follow what happened. */
  private moveNextBot(now: number): void {
    if (!this.state || now - this.lastBotMoveAt <= BOT_DELAY_MS) return;
    for (const player of this.state.players) {
      const move = player.bot ? botAction(this.state, player.id) : null;
      if (move) {
        this.lastBotMoveAt = now;
        this.hostAction(player.id, move);
        return;
      }
    }
  }

  // ── Leaving ────────────────────────────────────────────────────────────────

  /** `leave = false` keeps the seat reserved (used when switching sessions or simulating a crash). */
  dispose(leave = true): void {
    if (leave) this.signaling?.send({ type: 'leave' });
    this.closed = true;
    clearInterval(this.timer);
    this.signaling?.close();
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
    clearSavedSession();
    if (leave && this.roomId) clearBackup(this.roomId);
  }
}
