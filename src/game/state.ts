import { COLORS, DEFAULT_CAPACITY, DEFAULT_LIVES, MAX_NAME_LENGTH } from './constants';
import type { GameSettings, GameState, Player } from './types';

/** Thrown for any action the rules reject. The message is shown to the player as-is. */
export class RuleError extends Error {
  override name = 'RuleError';
}

export function cleanName(name: unknown): string {
  return (typeof name === 'string' ? name : '').trim().slice(0, MAX_NAME_LENGTH);
}

export function createPlayer(id: string, name: string, color: string = COLORS[0], bot = false): Player {
  return {
    id,
    name: cleanName(name) || 'Robô',
    color,
    bot,
    // Bots are always seated and ready; humans opt in from the lobby.
    seated: bot,
    ready: bot,
    lives: DEFAULT_LIVES,
    hand: [],
    bid: null,
    won: 0,
    tricks: [],
    eliminated: false,
    spectator: false,
    disconnectedAt: null,
    expired: false,
  };
}

export function createState(owner: Player, settings: Partial<GameSettings> = {}): GameState {
  return {
    version: 0,
    phase: 'lobby',
    players: [owner],
    settings: { lives: DEFAULT_LIVES, capacity: DEFAULT_CAPACITY, ...settings },
    round: 0,
    cardsPerPlayer: 1,
    mode: 'up',
    dealer: owner.id,
    turn: null,
    kicker: null,
    table: [],
    votes: {},
    voteEndsAt: null,
    history: [],
    chat: [],
    winner: null,
    trickWinner: null,
    paused: false,
    pausedAt: null,
    dueAt: null,
    lastEvent: 'A mesa está esperando companhia.',
  };
}

export const cloneState = (state: GameState): GameState => structuredClone(state);

/** Seated, still has lives and is not just watching. */
export function isInPlay(player: Player): boolean {
  return player.seated && !player.eliminated && !player.spectator;
}

export function livingPlayers(state: GameState): Player[] {
  return state.players.filter(isInPlay);
}

export function findPlayer(state: GameState, id: string | null | undefined): Player | undefined {
  return state.players.find(player => player.id === id);
}

/** Follows the seating order (counter-clockwise on the table) and skips players that are out. */
export function nextLivingPlayerId(state: GameState, fromId: string): string | null {
  const { players } = state;
  const start = players.findIndex(player => player.id === fromId);
  for (let step = 1; step <= players.length; step++) {
    const candidate = players[(start + step + players.length) % players.length];
    if (candidate && isInPlay(candidate)) return candidate.id;
  }
  return null;
}

export function firstFreeColor(state: GameState): string | undefined {
  return COLORS.find(color => !state.players.some(player => player.color === color));
}
