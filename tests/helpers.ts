import assert from 'node:assert/strict';
import {
  applyAction,
  botAction,
  createPlayer,
  createState,
  livingPlayers,
  tick,
  type GameState,
  type RandomSource,
  type VoteChoice,
} from '../src/game';

/** Deterministic linear congruential generator, so shuffles repeat between runs. */
export function seededRandom(seed = 42): RandomSource {
  let current = seed;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 4294967296;
  };
}

/** A started match with one human ("human") and bots in every other seat. */
export function startedMatch(playerCount = 4, lives = 5): GameState {
  let state = createState(createPlayer('human', 'Humano'), { capacity: playerCount, lives });
  state = applyAction(state, 'human', { type: 'ready' });
  state = applyAction(state, 'human', { type: 'bots', count: playerCount - 1 });
  return applyAction(state, 'human', { type: 'start' }, { now: 100, random: seededRandom() });
}

/** One step of an all-bot game: vote, act on the current turn, or let the clock run. */
export function advanceWithBots(state: GameState, now: number, random: RandomSource): [GameState, number] {
  if (state.phase === 'vote') {
    let next = state;
    for (const player of livingPlayers(state)) {
      const action = botAction(next, player.id, random);
      if (next.phase === 'vote' && action) next = applyAction(next, player.id, action, { now, random });
    }
    return [next, now];
  }
  if (state.turn) {
    const action = botAction(state, state.turn, random);
    assert.ok(action, 'player on turn must have an action');
    return [applyAction(state, state.turn, action, { now, random }), now];
  }
  const later = (state.dueAt ?? state.voteEndsAt ?? now) + 1;
  return [tick(state, later, random), later];
}

export function voteForAll(
  state: GameState,
  value: VoteChoice,
  now: number,
  random: RandomSource,
): GameState {
  let next = state;
  for (const player of livingPlayers(state)) {
    if (next.phase === 'vote') next = applyAction(next, player.id, { type: 'vote', value }, { now, random });
  }
  return next;
}

/** Plays until the round number changes (or the game ends). */
export function completeRound(initial: GameState, random = seededRandom()): GameState {
  let state = initial;
  let now = 100;
  for (let guard = 0; guard < 500; guard++) {
    if (state.round !== initial.round || state.phase === 'finished') return state;
    if (state.phase === 'vote') state = voteForAll(state, 'reset', now, random);
    else [state, now] = advanceWithBots(state, now, random);
  }
  assert.fail('round must progress');
}
