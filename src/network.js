import { applyAction, botAction, byId, COLORS, createState, player, reconcilePresence, tick } from './game.js';

export async function api(path, body, token) {
  const response = await fetch(`/api${path}`, { method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  let data;
  try { data = await response.json(); } catch { throw new Error('Serviço de salas indisponível. Você ainda pode jogar com bots.'); }
  if (!response.ok) throw new Error(data.error || 'Não foi possível conectar.');
  return data;
}

export class Session {
  constructor({ onState, onStatus, onError, onPose }) {
    this.onState = onState; this.onStatus = onStatus; this.onError = onError; this.onPose = onPose;
    this.state = null; this.identity = null; this.hostId = null; this.epoch = 0; this.peers = new Map();
    this.members = []; this.closed = false; this.lastBot = 0; this.migratingUntil = 0; this.lastPhase = null;
    this.timer = setInterval(() => this.update(), 300);
  }
  get isHost() { return this.hostId === this.identity?.memberId; }
  get isLocal() { return !!this.identity?.local; }
  async local(name, bots = 3) {
    this.identity = { memberId: crypto.randomUUID(), local: true, settings: { lives: 5, capacity: 6 } };
    this.hostId = this.identity.memberId;
    this.state = createState(player(this.hostId, name));
    this.state = applyAction(this.state, this.hostId, { type: 'bots', count: bots });
    this.onStatus('Treino com bots'); this.onState(this.state);
  }
  async online(identity, name) {
    this.identity = identity; this.name = name;
    try { this.state = JSON.parse(sessionStorage.getItem(`garanto-state-${identity.roomId}`)); } catch { /* no local backup */ }
    sessionStorage.setItem('garanto-session', JSON.stringify({ ...identity, playerName: name }));
    try {
      const ice = await api('/ice', null, identity.token);
      this.iceServers = ice.iceServers;
      this.turnConfigured = ice.turnConfigured;
    } catch (error) {
      this.iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }]; this.onError(error.message);
    }
    this.connectSocket();
  }
  connectSocket() {
    if (this.closed) return;
    const url = new URL('/api/connect', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', this.identity.token);
    const socket = this.socket = new WebSocket(url);
    this.onStatus('Conectando à sala…');
    socket.onopen = () => { this.retry = 0; this.onStatus('Preparando conexão P2P…'); };
    socket.onmessage = async event => {
      if (event.data === 'pong') return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'roster') await this.roster(message);
        else if (message.type === 'signal' && message.epoch === this.epoch) await this.signal(message);
      } catch (error) { this.onError(`Conexão: ${error.message}`); }
    };
    socket.onerror = () => this.onStatus('Tentando reconectar à sala…');
    socket.onclose = event => {
      if (this.closed) return;
      if (event.code === 4001) { this.closed = true; this.onError('Esta sessão foi aberta em outra aba.'); return; }
      this.onStatus('Reconectando… seu lugar fica reservado por 3 minutos.');
      this.retry = Math.min((this.retry ?? 0) + 1, 6);
      this.reconnectTimer = setTimeout(() => this.connectSocket(), Math.min(8000, 1000 * this.retry));
    };
  }
  wsSend(message) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  async roster(message) {
    const changedHost = this.hostId !== message.hostId || this.epoch !== message.epoch;
    this.members = message.members; this.room = message.room;
    this.hostId = message.hostId; this.epoch = message.epoch;
    if (changedHost) {
      for (const peer of this.peers.values()) peer.pc.close();
      this.peers.clear(); this.migratingUntil = Date.now() + 2200;
      this.onStatus(this.state ? 'Transferindo controle da mesa…' : 'Preparando a mesa…');
    }
    if (this.isHost) {
      if (!this.state) this.state = createState(player(this.identity.memberId, this.name), this.room.settings);
      for (const m of this.members) {
        if (m.id !== this.hostId && m.connected && !this.peers.has(m.id)) await this.createPeer(m.id, true);
      }
      if (!changedHost && Date.now() >= this.migratingUntil) this.presence();
      this.onState(this.state);
    }
  }
  async createPeer(id, offer) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = { pc, id, channel: null, startedAt: Date.now(), lastSeen: Date.now(), candidates: [] };
    this.peers.set(id, peer);
    pc.onicecandidate = event => {
      if (event.candidate) this.wsSend({ type: 'signal', to: id, epoch: this.epoch, data: { candidate: event.candidate.toJSON() } });
    };
    pc.ondatachannel = event => this.setupChannel(peer, event.channel);
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState) && this.peers.get(id) === peer) {
        this.peers.delete(id); if (this.isHost) this.presence();
      }
    };
    if (offer) {
      this.setupChannel(peer, pc.createDataChannel('garanto', { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      this.wsSend({ type: 'signal', to: id, epoch: this.epoch, data: { description: pc.localDescription.toJSON() } });
    }
    return peer;
  }
  async signal(message) {
    if (!this.isHost && message.from !== this.hostId) return;
    const peer = this.peers.get(message.from) ?? await this.createPeer(message.from, false);
    const { description, candidate } = message.data ?? {};
    if (description) {
      await peer.pc.setRemoteDescription(description);
      for (const item of peer.candidates.splice(0)) await peer.pc.addIceCandidate(item);
      if (description.type === 'offer') {
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        this.wsSend({ type: 'signal', to: peer.id, epoch: this.epoch, data: { description: peer.pc.localDescription.toJSON() } });
      }
    } else if (candidate) {
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
      else peer.candidates.push(candidate);
    }
  }
  setupChannel(peer, channel) {
    peer.channel = channel;
    channel.onopen = () => {
      this.onStatus('Mesa conectada');
      if (this.isHost) {
        this.send(peer, { type: 'requestSnapshot' });
        if (Date.now() >= this.migratingUntil) { this.presence(); this.send(peer, { type: 'state', state: this.state }); }
      } else this.send(peer, { type: 'snapshot', state: this.state });
    };
    channel.onclose = () => {
      if (this.isHost) this.presence();
      else this.onStatus('Conexão P2P interrompida. Tentando reconectar…');
    };
    channel.onmessage = event => {
      if (typeof event.data !== 'string' || event.data.length > 131072) return;
      peer.lastSeen = Date.now();
      try {
        const m = JSON.parse(event.data);
        if (m.epoch !== this.epoch) return;
        if (m.type === 'requestSnapshot' && !this.isHost) this.send(peer, { type: 'snapshot', state: this.state });
        else if (m.type === 'snapshot' && this.isHost && m.state && Date.now() < this.migratingUntil) {
          if (!this.state || m.state.version > this.state.version) this.state = m.state;
        } else if (m.type === 'state' && !this.isHost && peer.id === this.hostId) {
          if (!this.state || m.state.version >= this.state.version) { this.state = m.state; this.backup(); this.onState(this.state); }
        } else if (m.type === 'action' && this.isHost) this.hostAction(peer.id, m.action);
        else if (m.type === 'error') this.onError(m.message);
        else if (m.type === 'pose') {
          const id = this.isHost ? peer.id : m.id;
          this.onPose(id, m.pose);
          if (this.isHost) this.broadcast({ type: 'pose', id, pose: m.pose }, peer.id);
        } else if (m.type === 'ping') this.send(peer, { type: 'pong' });
      } catch (error) { this.onError(error.message); }
    };
  }
  send(peer, message) {
    if (peer.channel?.readyState === 'open' && peer.channel.bufferedAmount < 262144)
      peer.channel.send(JSON.stringify({ ...message, epoch: this.epoch }));
  }
  broadcast(message, except) { for (const peer of this.peers.values()) if (peer.id !== except) this.send(peer, message); }
  presence() {
    if (!this.isHost || !this.state) return;
    const members = this.members.map(m => ({ ...m, connected: m.id === this.hostId || this.peers.get(m.id)?.channel?.readyState === 'open' }));
    const next = reconcilePresence(this.state, members);
    if (next !== this.state) this.commit(next);
  }
  commit(state) {
    this.state = state; this.backup(); this.broadcast({ type: 'state', state }); this.onState(state);
    const metadata = { type: 'status', phase: state.phase, botCount: state.players.filter(p => p.bot).length,
      spectatorIds: state.players.filter(p => p.spectator).map(p => p.id) };
    if (!this.isLocal && this.lastMetadata !== JSON.stringify(metadata)) {
      this.lastMetadata = JSON.stringify(metadata); this.wsSend(metadata);
    }
  }
  backup() {
    if (!this.isLocal && this.state) {
      try { sessionStorage.setItem(`garanto-state-${this.identity.roomId}`, JSON.stringify(this.state)); } catch { /* storage may be full */ }
    }
  }
  hostAction(id, action) {
    try {
      if (Date.now() < this.migratingUntil) throw new Error('A mesa está sincronizando. Aguarde um instante.');
      if (['start', 'bots', 'rematch'].includes(action.type) && id !== this.hostId) throw new Error('Somente o host pode fazer isso.');
      if (action.type === 'chat') {
        const last = this.state.chat.filter(m => m.playerId === id).at(-1);
        if (last && Date.now() - last.at < 700) throw new Error('Espere um instante antes de enviar outra mensagem.');
      }
      this.commit(applyAction(this.state, id, action));
    } catch (error) {
      if (id === this.identity.memberId) this.onError(error.message);
      else { const peer = this.peers.get(id); if (peer) this.send(peer, { type: 'error', message: error.message }); }
    }
  }
  action(action) {
    if (this.closed) return;
    if (this.isHost) {
      if (!this.isLocal && this.socket?.readyState !== WebSocket.OPEN) { this.onError('Aguarde a reconexão à sala.'); return; }
      this.hostAction(this.identity.memberId, action);
    } else {
      const peer = this.peers.get(this.hostId);
      if (peer?.channel?.readyState !== 'open') this.onError('Aguardando conexão com o host.');
      else this.send(peer, { type: 'action', action });
    }
  }
  pose(pose) {
    if (!this.identity) return;
    if (this.isHost) this.broadcast({ type: 'pose', id: this.identity.memberId, pose });
    else { const peer = this.peers.get(this.hostId); if (peer) this.send(peer, { type: 'pose', pose }); }
  }
  update() {
    if (this.closed || !this.identity) return;
    const now = Date.now();
    if (!this.isLocal && now - (this.lastPing ?? 0) > 20_000) {
      if (this.socket?.readyState === WebSocket.OPEN) this.socket.send('ping');
      this.lastPing = now;
    }
    if (this.isHost && !this.isLocal && this.socket?.readyState === WebSocket.OPEN && now - (this.lastReconnect ?? 0) > 5000) {
      this.lastReconnect = now;
      for (const m of this.members.filter(m => m.connected && m.id !== this.hostId)) {
        const peer = this.peers.get(m.id);
        if (peer && peer.channel?.readyState !== 'open' && now - peer.startedAt > 12_000) {
          peer.pc.close(); this.peers.delete(m.id);
        }
        if (!this.peers.has(m.id)) this.createPeer(m.id, true).catch(e => this.onError(e.message));
      }
    }
    if (!this.isHost || !this.state || (!this.isLocal && this.socket?.readyState !== WebSocket.OPEN)) return;
    if (this.migratingUntil) {
      if (now < this.migratingUntil) return;
      this.migratingUntil = 0; this.presence(); this.commit(this.state);
      this.onStatus('Mesa conectada');
    }
    const next = tick(this.state, now);
    if (next !== this.state) this.commit(next);
    if (now - this.lastBot > 1150) {
      const bot = this.state.players.find(p => p.bot && botAction(this.state, p.id));
      if (bot) { this.lastBot = now; this.hostAction(bot.id, botAction(this.state, bot.id)); }
    }
  }
  dispose(leave = true) {
    if (leave) this.wsSend({ type: 'leave' });
    this.closed = true; clearInterval(this.timer); clearTimeout(this.reconnectTimer);
    this.socket?.close(); for (const peer of this.peers.values()) peer.pc.close();
    sessionStorage.removeItem('garanto-session');
    if (leave && this.identity?.roomId) sessionStorage.removeItem(`garanto-state-${this.identity.roomId}`);
  }
}
