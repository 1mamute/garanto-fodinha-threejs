import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLORS,
  RECONNECT_MS,
  applyAction,
  botAction,
  cardStrength,
  canWalk,
  createDeck,
  createPlayer,
  createState,
  findPlayer,
  legalBids,
  livingPlayers,
  manilhaRank,
  reconcilePresence,
  sanitizeState,
  tick,
  type Card,
  type GameState,
  type Player,
  type PresenceMember,
} from '../src/game';
import { advanceWithBots, completeRound, seededRandom, startedMatch, voteForAll } from './helpers';

const card = (id: string): Card => {
  const found = createDeck().find(candidate => candidate.id === id);
  assert.ok(found, `unknown card ${id}`);
  return found;
};
const playerById = (state: GameState, id: string | null): Player => {
  const player = findPlayer(state, id);
  assert.ok(player, `missing player ${String(id)}`);
  return player;
};
const firstCard = (state: GameState, id: string | null): string => {
  const [first] = playerById(state, id).hand;
  assert.ok(first, 'player has no cards');
  return first.id;
};
const bidAll = (initial: GameState, value: number): GameState => {
  let state = initial;
  while (state.phase === 'bet') state = applyAction(state, state.turn ?? '', { type: 'bid', value });
  return state;
};
const playFirstCards = (initial: GameState, now = 100): GameState => {
  let state = initial;
  while (state.phase === 'play') {
    state = applyAction(
      state,
      state.turn ?? '',
      { type: 'play', cardId: firstCard(state, state.turn) },
      { now },
    );
  }
  return state;
};
/** Turns one bot into a disconnected human, since bots never disconnect. */
const disconnect = (initial: GameState, missingId: string, at: number): GameState => {
  const state = structuredClone(initial);
  playerById(state, missingId).bot = false;
  const members: PresenceMember[] = state.players.map(player => ({
    id: player.id,
    name: player.name,
    connected: player.id !== missingId,
    disconnectedAt: at,
  }));
  return reconcilePresence(state, members, at);
};

test('baralho tem 40 cartas únicas, sem 8, 9, 10 ou curingas', () => {
  const cards = createDeck();
  assert.equal(cards.length, 40);
  assert.equal(new Set(cards.map(item => item.id)).size, 40);
  assert.ok(cards.every(item => !['8', '9', '10'].includes(item.rank)));
});

test('manilha circular e desempate por naipe inclusive para cartas normais', () => {
  assert.equal(manilhaRank(card('3♦')), '4');
  assert.equal(manilhaRank(card('7♦')), 'Q');
  const kicker = card('5♦');
  const sorted = createDeck().sort(
    (first, second) => cardStrength(first, kicker) - cardStrength(second, kicker),
  );
  assert.equal(sorted.at(-1)?.id, '6♣');
  assert.equal(sorted.at(-5)?.id, '3♣');
  assert.equal(new Set(sorted.map(item => cardStrength(item, kicker))).size, 40);
});

test('apostas e primeira vaza começam no próximo anti-horário e dealer é último', () => {
  let state = startedMatch();
  const ids = livingPlayers(state).map(player => player.id);
  const afterDealer = ids[(ids.indexOf(state.dealer) + 1) % ids.length];
  assert.equal(state.turn, afterDealer);
  state = bidAll(state, 0);
  assert.equal(state.turn, afterDealer);
  const order: (string | null)[] = [];
  while (state.phase === 'play') {
    order.push(state.turn);
    state = applyAction(
      state,
      state.turn ?? '',
      { type: 'play', cardId: firstCard(state, state.turn) },
      { now: 100 },
    );
  }
  assert.equal(order.at(-1), state.dealer);
});

test('última aposta não pode fechar soma e ações inválidas não alteram estado', () => {
  let state = startedMatch(3);
  state = applyAction(state, state.turn ?? '', { type: 'bid', value: 0 });
  state = applyAction(state, state.turn ?? '', { type: 'bid', value: 0 });
  assert.deepEqual(legalBids(state, state.turn ?? ''), [0]);
  const before = structuredClone(state);
  assert.throws(() => applyAction(state, state.turn ?? '', { type: 'bid', value: 1 }), /não permitida/);
  assert.deepEqual(state, before);
  assert.throws(() => applyAction(state, state.dealer, { type: 'bid', value: 0.5 }), /não permitida/);
  assert.throws(() => applyAction(state, state.dealer, { type: 'hack' }), /desconhecida/);
});

test('entrada na sala senta automaticamente e aguarda confirmação de pronto', () => {
  const original = createState(createPlayer('host', 'Host'));
  const state = reconcilePresence(
    original,
    [
      { id: 'host', name: 'Host', connected: true },
      { id: 'guest', name: 'Convidado', connected: true },
    ],
    100,
  );
  assert.equal(original.players.length, 1, 'a entrada não altera o estado anterior');
  assert.equal(state.version, original.version + 1);
  assert.ok(state.players.every(player => player.seated && !player.ready && !canWalk(player)));
  assert.equal(livingPlayers(state).length, 2);
  assert.throws(() => applyAction(state, 'host', { type: 'start' }), /prontos/);
  const readyHost = applyAction(state, 'host', { type: 'ready' });
  const readyEveryone = applyAction(readyHost, 'guest', { type: 'ready' });
  assert.equal(
    applyAction(readyEveryone, 'host', { type: 'start' }, { now: 100, random: seededRandom() }).phase,
    'bet',
  );
  assert.equal(
    reconcilePresence(
      state,
      [
        { id: 'host', name: 'Host', connected: true },
        { id: 'guest', name: 'Convidado', connected: true },
      ],
      100,
    ),
    state,
    'presença inalterada preserva o objeto',
  );
});

test('cor ocupada é rejeitada e cor fica bloqueada enquanto o jogador está pronto', () => {
  let state = createState(createPlayer('a', 'A'));
  state.players.push(createPlayer('b', 'B', COLORS[1]));
  assert.throws(() => applyAction(state, 'a', { type: 'color', color: COLORS[1] }), /ocupada/);
  state = applyAction(state, 'a', { type: 'color', color: COLORS[2] });
  assert.equal(playerById(state, 'a').color, COLORS[2]);
  state = applyAction(state, 'a', { type: 'ready' });
  assert.throws(() => applyAction(state, 'a', { type: 'color', color: COLORS[2] }), /fixa/);
  state = applyAction(state, 'a', { type: 'ready' });
  state = applyAction(state, 'a', { type: 'color', color: COLORS[0] });
  assert.equal(playerById(state, 'a').color, COLORS[0]);
});

test('kicker fica fora da mão quando sobram cartas, e entra no baralho ao distribuir 40', () => {
  let state = startedMatch(10, 20);
  const kickerId = state.kicker?.id;
  assert.ok(!livingPlayers(state).some(player => player.hand.some(item => item.id === kickerId)));
  state.cardsPerPlayer = 3;
  state = completeRound(state);
  assert.equal(state.cardsPerPlayer, 4);
  const hands = livingPlayers(state).flatMap(player => player.hand);
  assert.equal(hands.length, 40);
  assert.equal(new Set(hands.map(item => item.id)).size, 40);
  assert.ok(hands.some(item => item.id === state.kicker?.id));
});

test('vencedor recebe todas as cartas, com vencedora por cima; vidas seguem diferença absoluta', () => {
  let state = bidAll(startedMatch(3, 5), 0);
  const firstCards = livingPlayers(state).map(player => ({
    id: player.id,
    card: player.hand[0] ?? assert.fail('mão vazia'),
  }));
  const expected = firstCards.reduce((best, entry) =>
    cardStrength(entry.card, state.kicker) > cardStrength(best.card, state.kicker) ? entry : best,
  );
  state = playFirstCards(state);
  assert.equal(state.trickWinner, expected.id);
  const [trick] = playerById(state, expected.id).tricks;
  assert.equal(trick?.entries.length, 3);
  assert.equal(trick.entries.at(-1)?.card.id, expected.card.id);
  state = tick(state, (state.dueAt ?? 0) + 1);
  assert.equal(playerById(state, expected.id).lives, 4);
  assert.ok(livingPlayers(state).every(player => player.id === expected.id || player.lives === 5));
});

test('limite do baralho inicia votação, decrescente usa última quantidade menos um', () => {
  let state = startedMatch(10, 20);
  state.cardsPerPlayer = 4;
  state = completeRound(state);
  assert.equal(state.phase, 'vote');
  assert.equal(state.cardsPerPlayer, 5);
  state = voteForAll(state, 'down', 200, seededRandom());
  assert.equal(state.phase, 'bet');
  assert.equal(state.cardsPerPlayer, 3);
  assert.equal(state.mode, 'down');
});

test('votação expira, empate é sorteado e decrescente volta automaticamente a 1', () => {
  let state = startedMatch(10, 20);
  state.cardsPerPlayer = 4;
  state = completeRound(state);
  state = tick(state, (state.voteEndsAt ?? 0) + 1, () => 0);
  assert.equal(state.cardsPerPlayer, 1);
  assert.equal(state.mode, 'up');
  state.mode = 'down';
  state = completeRound(state);
  assert.equal(state.cardsPerPlayer, 1);
  assert.equal(state.mode, 'up');
});

test('reconexão em três minutos retoma sem redistribuir e congela relógio da votação', () => {
  const started = startedMatch(3);
  const missingId = livingPlayers(started)[1]?.id ?? '';
  let state = disconnect(started, missingId, 1000);
  const hands = state.players.map(player => player.hand);
  assert.equal(state.paused, true);
  assert.equal(tick(state, 1000 + RECONNECT_MS - 1), state);
  const members = state.players.map(player => ({ id: player.id, name: player.name, connected: true }));
  state = reconcilePresence(state, members, 1000 + RECONNECT_MS - 1);
  assert.equal(state.paused, false);
  assert.deepEqual(
    state.players.map(player => player.hand),
    hands,
  );
});

test('prazo expirado elimina jogador e redistribui mesma rodada sem punir demais', () => {
  const started = startedMatch(4);
  const missingId = livingPlayers(started).find(player => player.id !== 'human')?.id ?? '';
  const livesBefore = new Map(started.players.map(player => [player.id, player.lives]));
  let state = disconnect(started, missingId, 1000);
  state = tick(state, 1000 + RECONNECT_MS, seededRandom(99));
  assert.equal(playerById(state, missingId).eliminated, true);
  assert.equal(state.round, 1);
  assert.equal(state.cardsPerPlayer, 1);
  assert.equal(state.paused, false);
  assert.equal(state.phase, 'bet');
  assert.equal(state.table.length, 0);
  for (const player of livingPlayers(state)) {
    assert.equal(player.lives, livesBefore.get(player.id));
    assert.equal(player.bid, null);
  }
});

test('prazo expirado na tela de placar avança para a próxima rodada em vez de repetir', () => {
  let state = startedMatch(4, 20);
  const random = seededRandom(7);
  let now = 100;
  while (state.phase !== 'score') [state, now] = advanceWithBots(state, now, random);
  const scoredRound = state.round;
  const missingId = livingPlayers(state).find(player => player.id !== 'human')?.id ?? '';
  state = disconnect(state, missingId, now);
  state = tick(state, now + RECONNECT_MS, random);
  assert.equal(playerById(state, missingId).eliminated, true);
  assert.equal(state.round, scoredRound + 1);
  assert.equal(state.cardsPerPlayer, 2);
  assert.equal(state.phase, 'bet');
});

test('novo participante durante partida fica sentado como espectador sem andar nem apostar', () => {
  let state = startedMatch(2);
  state = reconcilePresence(state, [
    { id: 'human', name: 'Humano', connected: true },
    { id: 'late', name: 'Chegou depois', connected: true },
  ]);
  assert.equal(playerById(state, 'late').spectator, true);
  assert.equal(playerById(state, 'late').seated, true);
  assert.equal(canWalk(playerById(state, 'late')), false);
  assert.throws(() => applyAction(state, 'late', { type: 'bid', value: 0 }), /Espectadores/);
});

test('caminhada só é liberada após eliminação e volta a ser bloqueada na revanche', () => {
  let state = startedMatch(2, 1);
  assert.equal(canWalk(undefined), false);
  assert.equal(canWalk(playerById(state, 'human')), false);
  let now = 100;
  const random = seededRandom(3);
  while (state.phase !== 'finished') [state, now] = advanceWithBots(state, now, random);
  for (const player of state.players) assert.equal(canWalk(player), player.eliminated);
  assert.ok(state.players.some(canWalk), 'a partida elimina pelo menos um jogador');
  state = applyAction(state, 'human', { type: 'rematch' });
  assert.ok(state.players.every(player => player.seated && !canWalk(player)));
});

test('revanche mantém espectadores sentados e respeita a capacidade da partida', () => {
  let state = startedMatch(2, 1);
  state = reconcilePresence(
    state,
    [
      { id: 'human', name: 'Humano', connected: true },
      { id: 'late', name: 'Chegou depois', connected: true },
    ],
    100,
  );
  let now = 100;
  const random = seededRandom(3);
  while (state.phase !== 'finished') [state, now] = advanceWithBots(state, now, random);
  state = applyAction(state, 'human', { type: 'rematch' });
  assert.equal(playerById(state, 'late').spectator, true);
  assert.equal(playerById(state, 'late').seated, true);
  assert.throws(() => applyAction(state, 'late', { type: 'ready' }), /vaga/);
  state = applyAction(state, 'human', { type: 'ready' });
  state = applyAction(state, 'human', { type: 'start' }, { now, random });
  assert.equal(livingPlayers(state).length, state.settings.capacity);
  assert.equal(playerById(state, 'late').hand.length, 0);
  state.phase = 'finished';
  state = applyAction(state, 'human', { type: 'rematch' });
  state = applyAction(state, 'human', { type: 'bots', count: 0 });
  assert.equal(playerById(state, 'late').spectator, false, 'remover bots libera vaga para o espectador');
  state = applyAction(state, 'human', { type: 'ready' });
  state = applyAction(state, 'late', { type: 'ready' });
  state = applyAction(state, 'human', { type: 'start' }, { now, random });
  assert.equal(livingPlayers(state).length, 2);
});

test('empate ocorre quando todos perdem a última vida', () => {
  let state = startedMatch(2, 1);
  const first = state.turn ?? '';
  const second = livingPlayers(state).find(player => player.id !== first)?.id ?? '';
  playerById(state, first).hand = [card('3♣')];
  playerById(state, second).hand = [card('4♦')];
  state.kicker = card('7♠');
  state = applyAction(state, first, { type: 'bid', value: 0 });
  state = applyAction(state, second, { type: 'bid', value: 0 });
  // Force a wrong bid for the second player too: the first one loses by winning a trick it did not bid.
  playerById(state, second).bid = 1;
  state = applyAction(state, first, { type: 'play', cardId: '3♣' }, { now: 100 });
  state = applyAction(state, second, { type: 'play', cardId: '4♦' }, { now: 100 });
  state = tick(state, (state.dueAt ?? 0) + 1);
  assert.equal(state.phase, 'finished');
  assert.equal(state.winner, null);
  assert.equal(livingPlayers(state).length, 0);
});

test('vencedor lidera a vaza seguinte', () => {
  let state = completeRound(startedMatch(3, 20));
  while (state.phase === 'bet') {
    const turn = state.turn ?? '';
    state = applyAction(state, turn, { type: 'bid', value: legalBids(state, turn)[0] ?? 0 });
  }
  state = playFirstCards(state, 200);
  const winner = state.trickWinner;
  state = tick(state, (state.dueAt ?? 0) + 1);
  assert.equal(state.phase, 'play');
  assert.equal(state.turn, winner);
});

test('jogador não pode jogar carta alheia ou reordenar duplicando carta', () => {
  const state = bidAll(startedMatch(3), 0);
  const turn = state.turn ?? '';
  const other = livingPlayers(state).find(player => player.id !== turn);
  assert.throws(
    () => applyAction(state, turn, { type: 'play', cardId: other?.hand[0]?.id ?? '' }),
    /não está/,
  );
  assert.throws(() => applyAction(state, turn, { type: 'reorder', ids: ['inventada'] }), /inválida/);
});

test('revanche remove quem expirou e permite iniciar nova partida', () => {
  let state = startedMatch(3, 1);
  const missingId = livingPlayers(state).find(player => player.id !== 'human')?.id ?? '';
  state = disconnect(state, missingId, 1000);
  state = tick(state, 1000 + RECONNECT_MS, seededRandom());
  const random = seededRandom(3);
  let now = 2000 + RECONNECT_MS;
  while (state.phase !== 'finished') [state, now] = advanceWithBots(state, now, random);
  state = applyAction(state, 'human', { type: 'rematch' });
  assert.equal(findPlayer(state, missingId), undefined);
  assert.ok(state.players.every(player => !player.spectator && !player.eliminated));
  state = applyAction(state, 'human', { type: 'ready' });
  state = applyAction(state, 'human', { type: 'start' }, { now, random });
  assert.equal(state.phase, 'bet');
});

test('bot eliminado não vota e não bloqueia os bots vivos', () => {
  let state = startedMatch(4, 20);
  state.cardsPerPlayer = 11;
  state = completeRound(state);
  // The next round asks for 12 cards each: 4 × 12 = 48 > 40, so the deck ran out.
  assert.equal(state.phase, 'vote');
  const [, eliminatedBot] = livingPlayers(state).filter(player => player.bot);
  assert.ok(eliminatedBot);
  playerById(state, eliminatedBot.id).eliminated = true;
  assert.equal(botAction(state, eliminatedBot.id), null);
  const votingBots = state.players.filter(player => player.bot && botAction(state, player.id));
  assert.ok(votingBots.length > 0);
  assert.ok(votingBots.every(player => !player.eliminated));
});

test('estado recebido é validado e cores inválidas são substituídas', () => {
  const state = startedMatch(3);
  const injected = '"><img src=x onerror=alert(1)>';
  const tampered = structuredClone(state);
  playerById(tampered, 'human').color = injected;
  const sanitized = sanitizeState(JSON.parse(JSON.stringify(tampered)));
  assert.ok(sanitized);
  assert.equal(playerById(sanitized, 'human').color, COLORS[0]);
  assert.equal(sanitizeState({ ...state, players: [{ id: 1 }] }), null);
  assert.equal(sanitizeState({ ...state, phase: 'hacked' }), null);
  assert.equal(sanitizeState('nope'), null);
});

test('partidas completas com bots terminam e preservam invariantes em 2 a 10 lugares', () => {
  for (let count = 2; count <= 10; count++) {
    const random = seededRandom(count);
    let state = startedMatch(count);
    let now = 100;
    for (let guard = 0; state.phase !== 'finished' && guard < 15000; guard++) {
      [state, now] = advanceWithBots(state, now, random);
      assert.ok(state.players.every(player => player.lives >= 0));
      const activeCards = [
        ...livingPlayers(state).flatMap(player => player.hand),
        ...state.table.map(entry => entry.card),
      ];
      assert.equal(new Set(activeCards.map(item => item.id)).size, activeCards.length);
    }
    assert.equal(state.phase, 'finished', `${count} jogadores`);
    assert.ok(livingPlayers(state).length <= 1);
  }
});
