/**
 * Game state arrives from whichever peer is host, so it is untrusted input.
 * These checks make sure every field has the type the UI and the rules expect, and
 * replace values that end up in markup (colors, names) with safe ones.
 */
import { COLORS, MAX_NAME_LENGTH } from './constants';
import {
  PHASES,
  RANKS,
  SUITS,
  type Card,
  type ChatMessage,
  type CollectedTrick,
  type GameState,
  type Phase,
  type Player,
  type TableEntry,
} from './types';

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNullable =
  <T>(check: (value: unknown) => value is T) =>
  (value: unknown): value is T | null =>
    value === null || check(value);
const isArrayOf = <T>(value: unknown, check: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(check);

export function isCard(value: unknown): value is Card {
  if (!isRecord(value)) return false;
  const { id, rank, suit } = value;
  const knownRank = (RANKS as readonly unknown[]).includes(rank);
  const knownSuit = (SUITS as readonly unknown[]).includes(suit);
  return knownRank && knownSuit && id === `${String(rank)}${String(suit)}`;
}

function isTableEntry(value: unknown): value is TableEntry {
  return isRecord(value) && isString(value.playerId) && isString(value.playerName) && isCard(value.card);
}

function isCollectedTrick(value: unknown): value is CollectedTrick {
  return isRecord(value) && isString(value.winningCardId) && isArrayOf(value.entries, isTableEntry);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return [value.id, value.playerId, value.name, value.text].every(isString) && isFiniteNumber(value.at);
}

const isNullableNumber = isNullable(isFiniteNumber);
const isNullableString = isNullable(isString);

function hasPlayerShape(value: RawRecord): boolean {
  const flags = [value.bot, value.seated, value.ready, value.eliminated, value.spectator];
  return (
    isString(value.id) &&
    isString(value.name) &&
    flags.every(flag => typeof flag === 'boolean') &&
    isFiniteNumber(value.lives) &&
    isFiniteNumber(value.won) &&
    isNullableNumber(value.bid) &&
    isNullableNumber(value.disconnectedAt) &&
    isArrayOf(value.hand, isCard) &&
    isArrayOf(value.tricks, isCollectedTrick)
  );
}

function sanitizePlayer(value: unknown): Player | null {
  if (!isRecord(value) || !hasPlayerShape(value)) return null;
  const player = value as unknown as Player;
  const safeColor = (COLORS as readonly string[]).includes(player.color) ? player.color : COLORS[0];
  return {
    ...player,
    name: player.name.slice(0, MAX_NAME_LENGTH),
    color: safeColor,
    expired: value.expired === true,
  };
}

/** Scalar fields: phase, counters, ids and clocks. */
function hasValidScalars(value: RawRecord): boolean {
  return (
    PHASES.includes(value.phase as Phase) &&
    [value.version, value.round, value.cardsPerPlayer].every(isFiniteNumber) &&
    (value.mode === 'up' || value.mode === 'down') &&
    [value.dealer, value.lastEvent].every(isString) &&
    [value.turn, value.winner, value.trickWinner].every(isNullableString) &&
    [value.voteEndsAt, value.pausedAt, value.dueAt].every(isNullableNumber) &&
    typeof value.paused === 'boolean'
  );
}

function hasStateShape(value: RawRecord): boolean {
  return (
    hasValidScalars(value) &&
    isNullable(isCard)(value.kicker) &&
    isArrayOf(value.table, isTableEntry) &&
    isArrayOf(value.chat, isChatMessage) &&
    Array.isArray(value.history) &&
    isRecord(value.votes) &&
    isRecord(value.settings) &&
    Array.isArray(value.players)
  );
}

/** Returns a safe copy of a received game state, or `null` when it is malformed. */
export function sanitizeState(value: unknown): GameState | null {
  if (!isRecord(value) || !hasStateShape(value)) return null;
  const players = (value.players as unknown[]).map(sanitizePlayer);
  if (players.some(player => player === null)) return null;
  const state = value as unknown as GameState;
  const { lives, capacity } = state.settings;
  if (!isFiniteNumber(lives) || !isFiniteNumber(capacity)) return null;
  return { ...state, trickWinner: state.trickWinner ?? null, players: players as Player[] };
}
