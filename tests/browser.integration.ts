// Run in the dev server's page: import('/tests/browser.integration.ts').then(module => module.run()).
// Uses real WebRTC DataChannels and the local Cloudflare service, without rendering extra scenes.
import { findPlayer, legalBids, type GameState } from '../src/game';
import { api } from '../src/net/api';
import { Session } from '../src/net/session';
import type { Pose } from '../src/net/messages';
import type { CardFrame, CardRelease } from '../src/net/sceneMessages';
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
  poses: Map<Session, Map<string, Pose>>;
  cards: Map<Session, CardFrame>;
  releases: Map<Session, CardRelease>;
  client(): Session;
}

function createHarness(): Harness {
  const harness: Harness = {
    clients: [],
    errors: [],
    poses: new Map(),
    cards: new Map(),
    releases: new Map(),
    client() {
      const instance = new Session({
        onState: () => undefined,
        onStatus: () => undefined,
        onPose: (id, pose) => harness.poses.get(instance)?.set(id, pose),
        onCards: frame => harness.cards.set(instance, frame),
        onCardRelease: release => harness.releases.set(instance, release),
        onError: message => harness.errors.push(message),
      });
      harness.clients.push(instance);
      harness.poses.set(instance, new Map());
      return instance;
    },
  };
  return harness;
}

async function verifyMotion(harness: Harness): Promise<void> {
  const [host, guest, other] = harness.clients;
  check(host && guest && other, 'três clientes necessários');
  await until(() => [...host.peers.values()].every(peer => peer.isRealtimeOpen), 'canal de movimento aberto');
  guest.sendPose({ yaw: 0.7, pitch: -0.2, squint: 0.8, position: [2, 3.16, 5] });
  host.sendPose({ yaw: -0.4, pitch: 0.1, position: [-2, 3.16, 6] });
  await until(
    () => harness.poses.get(other)?.get(guest.memberId)?.yaw === 0.7,
    'cabeça e caminhada de convidado',
  );
  await until(() => harness.poses.get(guest)?.get(host.memberId)?.yaw === -0.4, 'cabeça e caminhada do host');
  check(harness.poses.get(other)?.get(guest.memberId)?.position?.[0] === 2, 'posição transmitida');
  check(harness.poses.get(other)?.get(guest.memberId)?.squint === 0.8, 'zoom transmitido');
}

async function playNetworkCard(harness: Harness): Promise<void> {
  const [host, guest, other] = harness.clients;
  check(host && guest && other, 'três clientes necessários');
  while (stateOf(host).phase === 'bet') {
    const turn = stateOf(host).turn;
    const actor = harness.clients.find(client => client.memberId === turn);
    check(turn && actor, 'jogador da aposta');
    actor.action({ type: 'bid', value: legalBids(stateOf(host), turn)[0] ?? 0 });
    await until(() => stateOf(host).turn !== turn || stateOf(host).phase !== 'bet', 'aposta confirmada');
  }
  const turn = stateOf(host).turn;
  const actor = harness.clients.find(client => client.memberId === turn);
  const card = findPlayer(stateOf(host), turn)?.hand[0];
  check(actor && card, 'carta jogável');
  const release: CardRelease = {
    transform: { id: card.id, position: [1, 2.2, 2], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    landing: [0.5, 1.68, 1],
    velocity: [1, 0, -2],
  };
  actor.sendPose({ yaw: 0.4, pitch: -0.5, reaching: true, heldCard: release.transform });
  const viewer = actor === other ? guest : other;
  await until(
    () => harness.poses.get(viewer)?.get(actor.memberId)?.heldCard?.id === card.id,
    'braço e carta arrastada',
  );
  actor.action({ type: 'play', cardId: card.id }, release);
  await until(
    () => guest.state?.table[0]?.card.id === card.id && other.state?.table[0]?.card.id === card.id,
    'carta jogada',
  );
  check(harness.releases.get(viewer)?.velocity[2] === -2, 'impulso de lançamento transmitido');
  const frame: CardFrame = { version: stateOf(host).version, cards: [release.transform] };
  host.sendCards(frame);
  await until(
    () =>
      harness.cards.get(guest)?.version === frame.version &&
      harness.cards.get(other)?.version === frame.version,
    'física do host replicada',
  );
  actor.sendPose({ yaw: 0.4, pitch: -0.5, reaching: false, heldCard: null });
  await until(
    () => harness.poses.get(viewer)?.get(actor.memberId)?.heldCard === null,
    'soltar braço e carta',
  );
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
    await verifyMotion(harness);
    checks.push('cabeça, zoom e caminhada em tempo real nos três clientes');

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
    await playNetworkCard(harness);
    checks.push('braços, arraste, lançamento e física das cartas sincronizados');

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
    check(migrated.table[0]?.card.id === before.table[0]?.card.id, 'migração preserva carta jogada');
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
    await until(() => harness.poses.get(returned)?.has(second.memberId), 'pose atual recebida ao reconectar');
    checks.push('antigo host reconecta e partida retoma');
    third.sendPose({ yaw: 0.9, pitch: 0.2 });
    await until(
      () => harness.poses.get(returned)?.get(third.memberId)?.yaw === 0.9,
      'movimentos após migração',
    );
    const frame: CardFrame = { version: stateOf(second).version, cards: [] };
    second.sendCards(frame);
    await until(() => harness.cards.get(returned)?.version === frame.version, 'cartas após migração');
    checks.push('movimentos e cartas retomam após a troca de host');

    check(harness.errors.length === 0, `erros de conexão: ${harness.errors.join('; ')}`);
    return { passed: checks, phase: stateOf(second).phase, version: stateOf(second).version };
  } finally {
    for (const session of harness.clients) session.dispose();
    if (savedSession) sessionStorage.setItem(SESSION_KEY, savedSession);
    else sessionStorage.removeItem(SESSION_KEY);
  }
}
