// Run through the collaborative preview: import('/tests/browser.integration.js').then(m => m.run()).
// Uses real WebRTC DataChannels and the local Cloudflare service, without rendering extra scenes.
import { Session, api } from '../src/network.js';
import { byId, legalBids } from '../src/game.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function until(predicate, description, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await wait(100); }
  throw new Error(`Timeout: ${description}`);
}
export async function run() {
  const saved = sessionStorage.getItem('garanto-session'), clients = [], checks = [], errors = [];
  function client() {
    const instance = new Session({ onState() {}, onStatus() {}, onPose() {}, onError: e => errors.push(e) });
    clients.push(instance); return instance;
  }
  try {
    const a = client(), b = client(), c = client();
    const ai = await api('/rooms', { name: 'Integração WebRTC', playerName: 'A', capacity: 3, lives: 5, password: 'amigos' });
    const bi = await api(`/rooms/${ai.roomId}/join`, { playerName: 'B', password: 'amigos' });
    const ci = await api(`/rooms/${ai.roomId}/join`, { playerName: 'C', password: 'amigos' });
    await a.online(ai, 'A'); await b.online(bi, 'B'); await c.online(ci, 'C');
    await until(() => b.state?.players.length === 3 && c.state?.players.length === 3 && !a.migratingUntil, 'três jogadores sincronizados');
    assert(a.peers.get(bi.memberId)?.channel.readyState === 'open', 'A/B deve usar canal P2P');
    checks.push('3 navegadores lógicos conectados por WebRTC');
    for (const x of [a, b, c]) {
      x.action({ type: 'seat' });
      await until(() => byId(a.state, x.identity.memberId)?.seated, 'confirmar assento');
      x.action({ type: 'ready' });
      await until(() => byId(a.state, x.identity.memberId)?.ready, 'confirmar pronto');
    }
    a.action({ type: 'start' });
    await until(() => b.state?.phase === 'bet' && c.state?.phase === 'bet', 'início da partida');
    checks.push('assentos, pronto e partida sincronizados');
    const turn = a.state.turn;
    const actor = [a, b, c].find(x => x.identity.memberId === turn);
    actor.action({ type: 'bid', value: legalBids(a.state, turn)[0] });
    await until(() => byId(b.state, turn)?.bid !== null && byId(c.state, turn)?.bid !== null, 'aposta replicada');
    b.action({ type: 'chat', text: '<script>teste</script>' });
    await until(() => c.state.chat.some(m => m.text === '<script>teste</script>'), 'chat P2P');
    checks.push('aposta e chat transmitidos pelo host');
    const before = structuredClone(b.state), oldEpoch = b.epoch;
    // Abrupt interruption, without the explicit leave protocol.
    a.closed = true; clearInterval(a.timer); a.socket.close();
    for (const peer of a.peers.values()) peer.pc.close();
    await until(() => b.isHost && b.epoch > oldEpoch && !b.migratingUntil && c.peers.get(bi.memberId)?.channel?.readyState === 'open', 'migração de host');
    assert(b.state.round === before.round, 'migração preserva rodada');
    assert(byId(b.state, turn).bid === byId(before, turn).bid, 'migração preserva aposta');
    assert(b.state.paused, 'queda de jogador vivo pausa partida');
    checks.push('migração preserva cartas/apostas e pausa a mesa');
    const returned = client(); await returned.online(ai, 'A');
    await until(() => returned.state && !b.state.paused && !returned.state.paused, 'reconexão do antigo host');
    assert(!returned.isHost && b.isHost, 'antigo host retorna como jogador');
    checks.push('antigo host reconecta e partida retoma');
    assert(errors.length === 0, `erros de conexão: ${errors.join('; ')}`);
    return { passed: checks, phase: b.state.phase, version: b.state.version };
  } finally {
    for (const x of clients) x.dispose();
    if (saved) sessionStorage.setItem('garanto-session', saved); else sessionStorage.removeItem('garanto-session');
  }
}
