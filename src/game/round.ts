import { cardStrength, createDeck, shuffle } from './cards';
import { DECK_SIZE, ROUND_HISTORY, SCORE_DISPLAY_MS, TRICK_DISPLAY_MS, VOTE_MS } from './constants';
import { findPlayer, livingPlayers, nextLivingPlayerId } from './state';
import type { GameState, RandomSource, RoundResult, TableEntry } from './types';

/**
 * Bids allowed for `playerId`. Every number from 0 to the hand size is allowed, except that the
 * last player to bid may not make the bids add up to the number of tricks: someone has to miss.
 */
export function legalBids(state: GameState, playerId: string): number[] {
  const living = livingPlayers(state);
  const stillToBid = living.filter(player => player.bid === null);
  const bidTotal = living.reduce((total, player) => total + (player.bid ?? 0), 0);
  const isLastBidder = stillToBid.length === 1 && stillToBid[0]?.id === playerId;
  const options = Array.from({ length: state.cardsPerPlayer + 1 }, (_, bid) => bid);
  return isLastBidder ? options.filter(bid => bidTotal + bid !== state.cardsPerPlayer) : options;
}

/** Ends the match when at most one player is left. Returns whether it ended. */
export function finishIfDecided(state: GameState): boolean {
  const living = livingPlayers(state);
  if (living.length > 1) return false;
  const winner = living[0];
  Object.assign(state, {
    phase: 'finished',
    turn: null,
    winner: winner?.id ?? null,
    paused: false,
    pausedAt: null,
    dueAt: null,
    lastEvent: winner ? `${winner.name} é o último robô de pé!` : 'Empate! Todo mundo caiu junto.',
  } satisfies Partial<GameState>);
  return true;
}

function dealRound(state: GameState, random: RandomSource): void {
  const living = livingPlayers(state);
  let cards = shuffle(createDeck(), random);
  state.kicker = cards.pop() ?? null;
  // When every card is needed, the kicker goes back into the deck and is dealt too.
  if (state.kicker && state.cardsPerPlayer * living.length === DECK_SIZE) {
    cards = shuffle([...cards, state.kicker], random);
  }
  for (const player of state.players) {
    Object.assign(player, { hand: [], bid: null, won: 0, tricks: [] });
  }
  for (let i = 0; i < state.cardsPerPlayer; i++) {
    for (const player of living) {
      const card = cards.pop();
      if (card) player.hand.push(card);
    }
  }
  const plural = state.cardsPerPlayer > 1 ? 's' : '';
  Object.assign(state, {
    table: [],
    votes: {},
    phase: 'bet',
    dueAt: null,
    voteEndsAt: null,
    trickWinner: null,
    turn: nextLivingPlayerId(state, state.dealer),
    lastEvent: `Rodada ${state.round}: ${state.cardsPerPlayer} carta${plural} por robô.`,
  } satisfies Partial<GameState>);
}

function advanceToNextRound(state: GameState): void {
  state.round++;
  if (state.round === 1) return;
  state.dealer = nextLivingPlayerId(state, state.dealer) ?? state.dealer;
  state.cardsPerPlayer += state.mode === 'up' ? 1 : -1;
  // Counting down ends at one card, then the game counts up again.
  if (state.cardsPerPlayer === 0) {
    state.cardsPerPlayer = 1;
    state.mode = 'up';
  }
}

/**
 * Deals the next round (`advance`) or deals the current round again (after a player timed out).
 * Starts the vote instead when the deck is too small for the requested hand size.
 */
export function prepareRound(state: GameState, now: number, random: RandomSource, advance = true): void {
  if (finishIfDecided(state)) return;
  if (advance) advanceToNextRound(state);
  if (state.cardsPerPlayer * livingPlayers(state).length <= DECK_SIZE) {
    dealRound(state, random);
    return;
  }
  // `cardsPerPlayer` keeps the attempted size; `finishVote` steps down from it.
  Object.assign(state, {
    phase: 'vote',
    turn: null,
    votes: {},
    voteEndsAt: now + VOTE_MS,
    lastEvent: 'O baralho pediu arrego. Reset ou decrescente?',
  } satisfies Partial<GameState>);
}

/** Applies the majority vote (ties decided at random) and deals. */
export function finishVote(state: GameState, random: RandomSource): void {
  const voters = livingPlayers(state);
  const resetVotes = voters.filter(player => state.votes[player.id] === 'reset').length;
  const downVotes = voters.filter(player => state.votes[player.id] === 'down').length;
  const resetWins = resetVotes === downVotes ? random() < 0.5 : resetVotes > downVotes;
  if (resetWins) {
    state.cardsPerPlayer = 1;
    state.mode = 'up';
  } else {
    // The attempted size did not fit, so the last dealt size minus one is attempted size minus two.
    state.cardsPerPlayer -= 2;
    state.mode = 'down';
  }
  if (state.cardsPerPlayer < 1) {
    state.cardsPerPlayer = 1;
    state.mode = 'up';
  }
  dealRound(state, random);
}

/** Every trick of difference between the bid and the result costs one life. */
export function scoreRound(state: GameState, now: number): void {
  const results: RoundResult[] = livingPlayers(state).map(player => {
    const bid = player.bid ?? 0;
    const lost = Math.abs(bid - player.won);
    player.lives = Math.max(0, player.lives - lost);
    player.eliminated = player.lives === 0;
    return { id: player.id, name: player.name, bid, won: player.won, lost, lives: player.lives };
  });
  state.history = [...state.history, { round: state.round, results }].slice(-ROUND_HISTORY);
  Object.assign(state, {
    lastEvent: 'Palpites na balança. Quem errou paga em vidas!',
    phase: 'score',
    turn: null,
    dueAt: now + SCORE_DISPLAY_MS,
  } satisfies Partial<GameState>);
  finishIfDecided(state);
}

/** Called once everybody played a card: gives the trick to the strongest card. */
export function resolveTrick(state: GameState, now: number): void {
  const strongest = (best: TableEntry, entry: TableEntry): TableEntry =>
    cardStrength(entry.card, state.kicker) > cardStrength(best.card, state.kicker) ? entry : best;
  const [first, ...rest] = state.table;
  if (!first) return;
  const winningEntry = rest.reduce(strongest, first);
  const winner = findPlayer(state, winningEntry.playerId);
  if (!winner) return;
  winner.won++;
  // The winning card goes last so it is drawn on top of the collected pile.
  const entries = [...state.table.filter(entry => entry !== winningEntry), winningEntry];
  winner.tricks.push({ entries: structuredClone(entries), winningCardId: winningEntry.card.id });
  Object.assign(state, {
    trickWinner: winner.id,
    phase: 'trick',
    turn: null,
    dueAt: now + TRICK_DISPLAY_MS,
    lastEvent: `${winner.name} levou a vaza com ${winningEntry.card.id}!`,
  } satisfies Partial<GameState>);
}

/** After the trick was shown: clear the table, then score or let the winner lead. */
export function collectTrick(state: GameState, now: number): void {
  state.table = [];
  if (livingPlayers(state).every(player => player.hand.length === 0)) {
    scoreRound(state, now);
    return;
  }
  state.phase = 'play';
  state.turn = state.trickWinner;
  state.dueAt = null;
}
