// Run in the dev server's page: import('/tests/browser.integration.ts').then(module => module.run()).
// Uses real WebRTC DataChannels and the local Cloudflare service, without rendering extra scenes.
import { findPlayer, legalBids, type GameState } from '../src/game';
import { api } from '../src/net/api';
import { Session } from '../src/net/session';
import type { RoomIdentity } from '../src/shared/protocol';

const SESSION_KEY = 'garanto-session';

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function until(predicate: () => unknown, description: string, timeoutMs = 12_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(100);
  }
  throw new Error(`Timeout: ${description}`);
}

function stateOf(session: Session): GameState {
  check(session.state, 'sessão sem estado');
  return session.state;
}

interface Harness {
  clients: Session[];
  errors: string[];
  client(): Session;
}

function createHarness(): Harness {
  const harness: Harness = {
    clients: [],
    errors: [],
    client() {
      const instance = new Session({
        onState: () => undefined,
        onStatus: () => undefined,
        onPose: () => undefined,
        onError: message => harness.errors.push(message),
      });
      harness.clients.push(instance);
      return instance;
    },
  };
  return harness;
}

async function seatEveryone(host: Session, players: Session[]): Promise<void> {
  for (const player of players) {
    player.action({ type: 'seat' });
    await until(() => findPlayer(stateOf(host), player.memberId)?.seated, 'confirmar assento');
    player.action({ type: 'ready' });
    await until(() => findPlayer(stateOf(host), player.memberId)?.ready, 'confirmar pronto');
  }
}

export async function run(): Promise<{ passed: string[]; phase: string; version: number }> {
  const savedSession = sessionStorage.getItem(SESSION_KEY);
  const harness = createHarness();
  const checks: string[] = [];
  try {
    const [first, second, third] = [harness.client(), harness.client(), harness.client()];
    const firstIdentity = await api<RoomIdentity>('/rooms', {
      name: 'Integração WebRTC',
      playerName: 'A',
      capacity: 3,
      lives: 5,
      password: 'amigos',
    });
    const join = (playerName: string): Promise<RoomIdentity> =>
      api<RoomIdentity>(`/rooms/${firstIdentity.roomId}/join`, { playerName, password: 'amigos' });
    const secondIdentity = await join('B');
    const thirdIdentity = await join('C');
    await first.online(firstIdentity, 'A');
    await second.online(secondIdentity, 'B');
    await third.online(thirdIdentity, 'C');
    await until(
      () => second.state?.players.length === 3 && third.state?.players.length === 3 && !first.migratingUntil,
      'três jogadores sincronizados',
    );
    check(first.peers.get(secondIdentity.memberId)?.isOpen, 'A/B deve usar canal P2P');
    checks.push('3 navegadores lógicos conectados por WebRTC');

    await seatEveryone(first, [first, second, third]);
    first.action({ type: 'start' });
    await until(() => second.state?.phase === 'bet' && third.state?.phase === 'bet', 'início da partida');
    checks.push('assentos, pronto e partida sincronizados');

    const turn = stateOf(first).turn;
    const actor = [first, second, third].find(session => session.memberId === turn);
    check(turn && actor, 'alguém deve estar na vez');
    actor.action({ type: 'bid', value: legalBids(stateOf(first), turn)[0] ?? 0 });
    await until(
      () =>
        findPlayer(second.state ?? stateOf(first), turn)?.bid !== null &&
        findPlayer(stateOf(third), turn)?.bid !== null,
      'aposta replicada',
    );
    second.action({ type: 'chat', text: '<script>teste</script>' });
    await until(
      () => stateOf(third).chat.some(message => message.text === '<script>teste</script>'),
      'chat P2P',
    );
    checks.push('aposta e chat transmitidos pelo host');

    const before = structuredClone(stateOf(second));
    const oldEpoch = second.epoch;
    // Abrupt interruption: close every connection without the explicit leave message.
    first.dispose(false);
    await until(
      () =>
        second.isHost &&
        second.epoch > oldEpoch &&
        !second.migratingUntil &&
        third.peers.get(secondIdentity.memberId)?.isOpen,
      'migração de host',
    );
    const migrated = stateOf(second);
    check(migrated.round === before.round, 'migração preserva rodada');
    check(findPlayer(migrated, turn)?.bid === findPlayer(before, turn)?.bid, 'migração preserva aposta');
    check(migrated.paused, 'queda de jogador vivo pausa partida');
    checks.push('migração preserva cartas/apostas e pausa a mesa');

    const returned = harness.client();
    await returned.online(firstIdentity, 'A');
    await until(
      () => returned.state && !stateOf(second).paused && !returned.state.paused,
      'reconexão do antigo host',
    );
    check(!returned.isHost && second.isHost, 'antigo host retorna como jogador');
    checks.push('antigo host reconecta e partida retoma');

    check(harness.errors.length === 0, `erros de conexão: ${harness.errors.join('; ')}`);
    return { passed: checks, phase: stateOf(second).phase, version: stateOf(second).version };
  } finally {
    for (const session of harness.clients) session.dispose();
    if (savedSession) sessionStorage.setItem(SESSION_KEY, savedSession);
    else sessionStorage.removeItem(SESSION_KEY);
  }
}
