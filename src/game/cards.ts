import { RANKS, SUITS, type Card, type RandomSource, type Rank, type Suit } from './types';

export function createDeck(): Card[] {
  return RANKS.flatMap(rank => SUITS.map(suit => ({ id: `${rank}${suit}`, rank, suit })));
}

/** The trump rank is the one right after the kicker, wrapping from 3 back to 4. */
export function manilhaRank(kicker: Card | null): Rank | null {
  if (!kicker) return null;
  const next = (RANKS.indexOf(kicker.rank) + 1) % RANKS.length;
  return RANKS[next] ?? null;
}

/**
 * Total order of the cards for this round, so there are never ties.
 * Rank weighs four times as much as suit; trumps get a rank above every regular card.
 */
export function cardStrength(card: Card, kicker: Card | null): number {
  const trumpRankIndex = RANKS.length;
  const rankIndex = card.rank === manilhaRank(kicker) ? trumpRankIndex : RANKS.indexOf(card.rank);
  return rankIndex * SUITS.length + SUITS.indexOf(card.suit);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === '♥' || suit === '♦';
}

/** Fisher–Yates shuffle that returns a new array. */
export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
