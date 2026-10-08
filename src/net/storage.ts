/**
 * Per-tab persistence (sessionStorage), so a reload rejoins the same room
 * and a host that reloads still has the latest game state to offer.
 */
import { sanitizeState, type GameState } from '../game';
import type { RoomIdentity } from '../shared/protocol';

const SESSION_KEY = 'garanto-session';
const backupKey = (roomId: string): string => `garanto-state-${roomId}`;

export interface SavedSession extends RoomIdentity {
  playerName: string;
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function isSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== 'object' || value === null) return false;
  const { roomId, memberId, token, playerName, settings } = value as Record<string, unknown>;
  const textFields = [roomId, memberId, token, playerName];
  return (
    textFields.every(field => typeof field === 'string') && typeof settings === 'object' && settings !== null
  );
}

export function loadSavedSession(): SavedSession | null {
  const value = readJson(SESSION_KEY);
  return isSavedSession(value) ? value : null;
}

export function saveSession(identity: RoomIdentity, playerName: string): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...identity, playerName }));
}

export function clearSavedSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function loadBackup(roomId: string): GameState | null {
  return sanitizeState(readJson(backupKey(roomId)));
}

export function saveBackup(roomId: string, state: GameState): void {
  try {
    sessionStorage.setItem(backupKey(roomId), JSON.stringify(state));
  } catch {
    // Storage may be full; the backup is only a convenience.
  }
}

export function clearBackup(roomId: string): void {
  sessionStorage.removeItem(backupKey(roomId));
}
