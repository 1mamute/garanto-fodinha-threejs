/** Card ranks from weakest to strongest (the Brazilian "truco" deck: no 8, 9 or 10). */
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
/** Suits from weakest to strongest; the suit breaks ties between equal ranks. */
export const SUITS = ['♦', '♠', '♥', '♣'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  /** Rank followed by suit, e.g. `"K♥"`. Unique inside a deck. */
  id: string;
  rank: Rank;
  suit: Suit;
}

/**
 * Game flow:
 * lobby → bet → play ⇄ trick → score → (bet | vote | finished)
 * `vote` happens when the deck cannot deal the next round; `finished` when one or no player is left.
 */
export type Phase = 'lobby' | 'bet' | 'play' | 'trick' | 'score' | 'vote' | 'finished';
export const PHASES: readonly Phase[] = ['lobby', 'bet', 'play', 'trick', 'score', 'vote', 'finished'];

/** Whether the number of cards per player grows or shrinks between rounds. */
export type Progression = 'up' | 'down';
/** Answer to "the deck ran out": restart from one card, or start counting down. */
export type VoteChoice = 'reset' | 'down';

export interface TableEntry {
  playerId: string;
  playerName: string;
  card: Card;
}

export interface CollectedTrick {
  /** Every card of the trick; the winning card is always the last entry. */
  entries: TableEntry[];
  winningCardId: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  /** Took a chair in the lobby. Only seated players are dealt in. */
  seated: boolean;
  ready: boolean;
  lives: number;
  hand: Card[];
  /** Tricks this player promised to win this round; `null` until they bid. */
  bid: number | null;
  /** Tricks won so far this round. */
  won: number;
  tricks: CollectedTrick[];
  eliminated: boolean;
  /** Joined while a match was running; watches until the next match. */
  spectator: boolean;
  /** When the connection dropped, or `null` while connected. */
  disconnectedAt: number | null;
  /** The reconnection window ran out and the player was already penalised for it. */
  expired: boolean;
}

export interface RoundResult {
  id: string;
  name: string;
  bid: number;
  won: number;
  lost: number;
  lives: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
}

export interface GameSettings {
  lives: number;
  capacity: number;
}

export interface GameState {
  /** Bumped on every change; peers use it to discard stale copies from the same host. */
  version: number;
  phase: Phase;
  /** Seating order. Seated players are shuffled to the front when a match starts. */
  players: Player[];
  settings: GameSettings;
  round: number;
  cardsPerPlayer: number;
  mode: Progression;
  dealer: string;
  turn: string | null;
  /** The face-up card whose next rank becomes the trump ("manilha") this round. */
  kicker: Card | null;
  table: TableEntry[];
  votes: Record<string, VoteChoice>;
  voteEndsAt: number | null;
  history: { round: number; results: RoundResult[] }[];
  chat: ChatMessage[];
  winner: string | null;
  trickWinner: string | null;
  /** Clocks freeze while a living player is reconnecting. */
  paused: boolean;
  pausedAt: number | null;
  /** When the current `trick` or `score` screen moves on automatically. */
  dueAt: number | null;
  lastEvent: string;
}

export type Action =
  | { type: 'chat'; text: string }
  | { type: 'color'; color: string }
  | { type: 'seat' }
  | { type: 'ready' }
  | { type: 'bots'; count: number }
  | { type: 'start' }
  | { type: 'rematch' }
  | { type: 'bid'; value: number }
  | { type: 'play'; cardId: string }
  | { type: 'reorder'; ids: string[] }
  | { type: 'vote'; value: VoteChoice };

export type ActionType = Action['type'];

/** A room member as reported by the signaling server. */
export interface PresenceMember {
  id: string;
  name: string;
  connected: boolean;
  disconnectedAt?: number | null;
  /** Left on purpose; never comes back to this match. */
  retired?: boolean;
}

/** Injected clock and dice so the rules stay deterministic in tests. */
export type RandomSource = () => number;

export interface Clock {
  /** Current time in milliseconds. */
  now: number;
  random: RandomSource;
}
