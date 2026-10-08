import { RECONNECT_MS } from './constants';
import { collectTrick, finishIfDecided, finishVote, prepareRound } from './round';
import { cloneState, findPlayer, isInPlay, livingPlayers, nextLivingPlayerId } from './state';
import type { GameState, Player, RandomSource } from './types';

function hasReconnectWindowRunOut(player: Player, now: number): boolean {
  if (player.bot || player.eliminated || player.expired || player.disconnectedAt === null) return false;
  return now - player.disconnectedAt >= RECONNECT_MS;
}

/** A living player timed out mid-match: they are out and the round is dealt again for the others. */
function eliminateTimedOutPlayers(state: GameState, timedOut: Player[], now: number, random: RandomSource) {
  const lostLivingPlayer = timedOut.some(isInPlay);
  for (const player of timedOut) Object.assign(player, { eliminated: true, lives: 0, hand: [] });
  if (!lostLivingPlayer || finishIfDecided(state)) return;

  // On the score screen the round was already played and scored, so carry on with the next one.
  // In any other phase the interrupted round is dealt again with the same size and dealer.
  const roundAlreadyScored = state.phase === 'score';
  if (!roundAlreadyScored && findPlayer(state, state.dealer)?.eliminated) {
    state.dealer = nextLivingPlayerId(state, state.dealer) ?? state.dealer;
  }
  prepareRound(state, now, random, roundAlreadyScored);
  if (!roundAlreadyScored) {
    state.lastEvent = 'Reconexão expirou. Rodada redistribuída, sem perda de vidas para os demais.';
  }
  const stillMissing = livingPlayers(state).some(player => player.disconnectedAt !== null);
  state.paused = stillMissing;
  state.pausedAt = stillMissing ? now : null;
}

/** Returns whether any player timed out. */
function expireDisconnectedPlayers(state: GameState, now: number, random: RandomSource): boolean {
  const timedOut = state.players.filter(player => hasReconnectWindowRunOut(player, now));
  if (!timedOut.length) return false;
  if (state.phase === 'lobby') {
    // Nothing is at stake in the lobby, so absent players simply lose their place.
    const timedOutIds = new Set(timedOut.map(player => player.id));
    state.players = state.players.filter(player => !timedOutIds.has(player.id));
    return true;
  }
  if (state.phase !== 'finished') eliminateTimedOutPlayers(state, timedOut, now, random);
  for (const player of timedOut) player.expired = true;
  return true;
}

/** Moves on from timed screens (trick, score, vote). Returns whether anything changed. */
function runDueTimers(state: GameState, now: number, random: RandomSource): boolean {
  if (state.paused) return false;
  if (state.phase === 'vote' && state.voteEndsAt !== null && now >= state.voteEndsAt) {
    finishVote(state, random);
    return true;
  }
  if (state.dueAt === null || now < state.dueAt) return false;
  if (state.phase === 'trick') collectTrick(state, now);
  else if (state.phase === 'score') prepareRound(state, now, random);
  else state.dueAt = null;
  return true;
}

/** Called by the host a few times per second. Returns `state` itself when nothing happened. */
export function tick(
  state: GameState,
  now: number = Date.now(),
  random: RandomSource = Math.random,
): GameState {
  const next = cloneState(state);
  const someoneTimedOut = expireDisconnectedPlayers(next, now, random);
  const timerFired = runDueTimers(next, now, random);
  if (!someoneTimedOut && !timerFired) return state;
  next.version++;
  return next;
}
