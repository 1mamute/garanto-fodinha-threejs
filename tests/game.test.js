import test from 'node:test';
import assert from 'node:assert/strict';
import { alive, applyAction, botAction, byId, COLORS, createState, deck, legalBids, manilha, player,
  reconcilePresence, RECONNECT_MS, strength, tick } from '../src/game.js';

function rng(seed = 42) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function started(count = 4, lives = 5) {
  let s = createState(player('human', 'Humano'), { capacity: count, lives });
  s = applyAction(s, 'human', { type: 'seat' }); s = applyAction(s, 'human', { type: 'ready' });
  s = applyAction(s, 'human', { type: 'bots', count: count - 1 });
  return applyAction(s, 'human', { type: 'start' }, 100, rng());
}
function completeRound(s, random = rng()) {
  const round = s.round;
  let now = 100, guard = 0;
  while (s.round === round && s.phase !== 'finished' && guard++ < 500) {
    if (s.phase === 'vote') for (const p of alive(s)) {
      if (s.phase === 'vote') s = applyAction(s, p.id, { type: 'vote', value: 'reset' }, now, random);
    }
    else if (s.turn) s = applyAction(s, s.turn, botAction(s, s.turn, random), now, random);
    else { now = (s.dueAt ?? now) + 1; s = tick(s, now, random); }
  }
  assert.ok(guard < 500, 'rodada deve progredir'); return s;
}

test('baralho tem 40 cartas únicas, sem 8, 9, 10 ou curingas', () => {
  const cards = deck(); assert.equal(cards.length, 40); assert.equal(new Set(cards.map(c => c.id)).size, 40);
  assert.ok(cards.every(c => !['8', '9', '10'].includes(c.rank)));
});
test('manilha circular e desempate por naipe inclusive para cartas normais', () => {
  assert.equal(manilha({ rank: '3' }), '4'); assert.equal(manilha({ rank: '7' }), 'Q');
  const kicker = { rank: '5' }, cards = deck().sort((a, b) => strength(a, kicker) - strength(b, kicker));
  assert.equal(cards.at(-1).id, '6♣'); assert.equal(cards.at(-5).id, '3♣');
  assert.equal(new Set(cards.map(c => strength(c, kicker))).size, 40);
});
test('apostas e primeira vaza começam no próximo anti-horário e dealer é último', () => {
  let s = started();
  const ids = alive(s).map(p => p.id), dealerIndex = ids.indexOf(s.dealer);
  assert.equal(s.turn, ids[(dealerIndex + 1) % ids.length]);
  while (s.phase === 'bet') s = applyAction(s, s.turn, { type: 'bid', value: 0 });
  assert.equal(s.turn, ids[(dealerIndex + 1) % ids.length]);
  const order = [];
  while (s.phase === 'play') { order.push(s.turn); s = applyAction(s, s.turn, { type: 'play', cardId: byId(s, s.turn).hand[0].id }, 100); }
  assert.equal(order.at(-1), s.dealer);
});
test('última aposta não pode fechar soma e ações inválidas não alteram estado', () => {
  let s = started(3);
  s = applyAction(s, s.turn, { type: 'bid', value: 0 });
  s = applyAction(s, s.turn, { type: 'bid', value: 0 });
  assert.deepEqual(legalBids(s, s.turn), [0]);
  const before = structuredClone(s);
  assert.throws(() => applyAction(s, s.turn, { type: 'bid', value: 1 }), /não permitida/);
  assert.deepEqual(s, before);
  assert.throws(() => applyAction(s, s.dealer, { type: 'bid', value: .5 }), /não permitida/);
});
test('cor ocupada é rejeitada e cor sentada fica bloqueada', () => {
  let s = createState(player('a', 'A'));
  s.players.push(player('b', 'B', COLORS[1]));
  assert.throws(() => applyAction(s, 'a', { type: 'color', color: COLORS[1] }), /ocupada/);
  s = applyAction(s, 'a', { type: 'seat' });
  assert.throws(() => applyAction(s, 'a', { type: 'color', color: COLORS[2] }), /fixa/);
});
test('kicker fica fora da mão quando sobram cartas, e entra no baralho ao distribuir 40', () => {
  let s = started(10, 20);
  assert.ok(!alive(s).flatMap(p => p.hand).some(c => c.id === s.kicker.id));
  s.cardsPerPlayer = 3;
  s = completeRound(s);
  assert.equal(s.cardsPerPlayer, 4);
  const hands = alive(s).flatMap(p => p.hand);
  assert.equal(hands.length, 40); assert.equal(new Set(hands.map(c => c.id)).size, 40);
  assert.ok(hands.some(c => c.id === s.kicker.id));
});
test('vencedor recebe todas as cartas, com vencedora por cima; vidas seguem diferença absoluta', () => {
  let s = started(3, 5);
  while (s.phase === 'bet') s = applyAction(s, s.turn, { type: 'bid', value: 0 });
  const original = alive(s).map(p => ({ id: p.id, card: p.hand[0] }));
  const expected = original.reduce((best, p) => strength(p.card, s.kicker) > strength(best.card, s.kicker) ? p : best);
  while (s.phase === 'play') s = applyAction(s, s.turn, { type: 'play', cardId: byId(s, s.turn).hand[0].id }, 100);
  assert.equal(s.trickWinner, expected.id);
  const winner = byId(s, expected.id); assert.equal(winner.tricks[0].entries.length, 3);
  assert.equal(winner.tricks[0].entries.at(-1).card.id, expected.card.id);
  s = tick(s, s.dueAt + 1);
  assert.equal(byId(s, expected.id).lives, 4);
  assert.ok(alive(s).filter(p => p.id !== expected.id).every(p => p.lives === 5));
});
test('limite do baralho inicia votação, decrescente usa última quantidade menos um', () => {
  let s = started(10, 20); s.cardsPerPlayer = 4; s = completeRound(s);
  assert.equal(s.phase, 'vote'); assert.equal(s.cardsPerPlayer, 5);
  for (const p of alive(s)) s = applyAction(s, p.id, { type: 'vote', value: 'down' }, 200, rng());
  assert.equal(s.phase, 'bet'); assert.equal(s.cardsPerPlayer, 3); assert.equal(s.mode, 'down');
});
test('votação expira, empate é sorteado e decrescente volta automaticamente a 1', () => {
  let s = started(10, 20); s.cardsPerPlayer = 4; s = completeRound(s);
  s = tick(s, s.voteEndsAt + 1, () => 0);
  assert.equal(s.cardsPerPlayer, 1); assert.equal(s.mode, 'up');
  s.mode = 'down'; s = completeRound(s);
  assert.equal(s.cardsPerPlayer, 1); assert.equal(s.mode, 'up');
});
test('reconexão em três minutos retoma sem redistribuir e congela relógio da votação', () => {
  let s = started(3), missing = alive(s)[1].id;
  const hands = s.players.map(p => p.hand);
  const members = alive(s).map(p => ({ id: p.id, name: p.name, connected: p.id !== missing, disconnectedAt: 1000 }));
  // A real human is required: bots never disconnect.
  byId(s, missing).bot = false;
  s = reconcilePresence(s, members, 1000); assert.equal(s.paused, true);
  assert.equal(tick(s, 1000 + RECONNECT_MS - 1), s);
  members.find(m => m.id === missing).connected = true;
  s = reconcilePresence(s, members, 1000 + RECONNECT_MS - 1);
  assert.equal(s.paused, false); assert.deepEqual(s.players.map(p => p.hand), hands);
});
test('prazo expirado elimina jogador e redistribui mesma rodada sem punir demais', () => {
  let s = started(4), missing = alive(s).find(p => p.id !== 'human').id;
  byId(s, missing).bot = false;
  const before = new Map(s.players.map(p => [p.id, p.lives]));
  const members = s.players.map(p => ({ id: p.id, name: p.name, connected: p.id !== missing, disconnectedAt: 1000 }));
  s = reconcilePresence(s, members, 1000); s = tick(s, 1000 + RECONNECT_MS, rng(99));
  assert.equal(byId(s, missing).eliminated, true); assert.equal(s.round, 1); assert.equal(s.cardsPerPlayer, 1);
  assert.equal(s.paused, false); assert.equal(s.phase, 'bet'); assert.equal(s.table.length, 0);
  for (const p of alive(s)) { assert.equal(p.lives, before.get(p.id)); assert.equal(p.bid, null); }
});
test('novo participante durante partida é espectador e não pode apostar', () => {
  let s = started(2);
  s = reconcilePresence(s, [{ id: 'human', name: 'Humano', connected: true }, { id: 'late', name: 'Chegou depois', connected: true }]);
  assert.equal(byId(s, 'late').spectator, true);
  assert.throws(() => applyAction(s, 'late', { type: 'bid', value: 0 }), /Espectadores/);
});
test('vencedor lidera vaza seguinte e empate ocorre quando todos perdem a última vida', () => {
  let s = started(2, 1);
  const ids = alive(s).map(p => p.id), first = s.turn;
  // Put stronger card on first actor and set a wrong bid for both.
  byId(s, first).hand = [{ id: '3♣', rank: '3', suit: '♣' }];
  const second = ids.find(id => id !== first);
  byId(s, second).hand = [{ id: '4♦', rank: '4', suit: '♦' }];
  s.kicker = { rank: '7', suit: '♠', id: '7♠' };
  s = applyAction(s, first, { type: 'bid', value: 0 });
  s = applyAction(s, second, { type: 'bid', value: 0 });
  // For scoring the difference pattern is what matters: second bet 1 loses with 0 wins.
  byId(s, second).bid = 1;
  s = applyAction(s, first, { type: 'play', cardId: '3♣' }, 100);
  s = applyAction(s, second, { type: 'play', cardId: '4♦' }, 100);
  s = tick(s, s.dueAt + 1);
  assert.equal(s.phase, 'finished'); assert.equal(s.winner, null); assert.equal(alive(s).length, 0);

  let next = started(3, 20); next = completeRound(next);
  while (next.phase === 'bet') next = applyAction(next, next.turn, { type: 'bid', value: legalBids(next, next.turn)[0] });
  while (next.phase === 'play') next = applyAction(next, next.turn, { type: 'play', cardId: byId(next, next.turn).hand[0].id }, 200);
  const winner = next.trickWinner;
  next = tick(next, next.dueAt + 1); assert.equal(next.phase, 'play'); assert.equal(next.turn, winner);
});
test('jogador não pode jogar carta alheia ou reordenar duplicando carta', () => {
  let s = started(3);
  while (s.phase === 'bet') s = applyAction(s, s.turn, { type: 'bid', value: 0 });
  const other = alive(s).find(p => p.id !== s.turn);
  assert.throws(() => applyAction(s, s.turn, { type: 'play', cardId: other.hand[0].id }), /não está/);
  assert.throws(() => applyAction(s, s.turn, { type: 'reorder', ids: ['inventada'] }), /inválida/);
});
test('partidas completas com bots terminam e preservam invariantes em 2 a 10 lugares', () => {
  for (let count = 2; count <= 10; count++) {
    const random = rng(count); let s = started(count), guard = 0, now = 100;
    while (s.phase !== 'finished' && guard++ < 15000) {
      if (s.phase === 'vote') {
        for (const p of alive(s)) if (s.phase === 'vote') s = applyAction(s, p.id, botAction(s, p.id, random), now, random);
      } else if (s.turn) s = applyAction(s, s.turn, botAction(s, s.turn, random), now, random);
      else { now = s.dueAt + 1; s = tick(s, now, random); }
      assert.ok(s.players.every(p => p.lives >= 0));
      const activeCards = [...alive(s).flatMap(p => p.hand), ...s.table.map(e => e.card)];
      assert.equal(new Set(activeCards.map(c => c.id)).size, activeCards.length);
    }
    assert.equal(s.phase, 'finished', `${count} jogadores`); assert.ok(alive(s).length <= 1);
  }
});
