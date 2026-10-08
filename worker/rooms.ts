import type { PublicRoom, RoomPhase, RoomSettings } from '../src/shared/protocol';
import { newRoomCode } from './crypto';
import { HttpError, cleanText } from './http';

export const ROOM_IDLE_TTL_MS = 24 * 3600_000;
/** Rooms that nobody ever connected to are dropped much sooner, so spam cannot pile up. */
export const UNUSED_ROOM_TTL_MS = 10 * 60_000;
export const MAX_STORED_ROOMS = 300;
export const MAX_OPEN_ROOMS = 100;
/** Players in a running match may be joined by this many spectators beyond capacity. */
export const SPECTATOR_SLOTS = 12;
export const RECONNECT_MS = 180_000;

export interface Member {
  id: string;
  name: string;
  tokenHash: string;
  disconnectedAt: number | null;
  /** Left on purpose with the "leave" button. */
  retired: boolean;
  spectator?: boolean;
}

export interface Room {
  id: string;
  name: string;
  settings: RoomSettings;
  salt: string;
  /** PBKDF2 hash, or `null` for open rooms. */
  password: string | null;
  members: Member[];
  hostId: string | null;
  epoch: number;
  phase: RoomPhase;
  botCount?: number;
  createdAt: number;
  updatedAt: number;
  /** Someone opened a WebSocket at least once. */
  everConnected?: boolean;
}

export function toPublicRoom(room: Room): PublicRoom {
  const players = room.members.filter(member => !member.retired && !member.spectator).length;
  return {
    id: room.id,
    name: room.name,
    locked: room.password !== null,
    capacity: room.settings.capacity,
    count: players + (room.botCount ?? 0),
    phase: room.phase,
    createdAt: room.createdAt,
  };
}

export function parseRoomSettings(input: Record<string, unknown>): RoomSettings {
  const capacity = Number(input.capacity ?? 6);
  const lives = Number(input.lives ?? 5);
  const validCapacity = Number.isInteger(capacity) && capacity >= 2 && capacity <= 10;
  const validLives = Number.isInteger(lives) && lives >= 1 && lives <= 20;
  if (!validCapacity || !validLives) throw new HttpError(400, 'Configuração da mesa inválida.');
  return { capacity, lives };
}

export function newRoom(options: {
  existingIds: Set<string>;
  name: unknown;
  settings: RoomSettings;
  salt: string;
  password: string | null;
  now: number;
}): Room {
  let id = newRoomCode();
  while (options.existingIds.has(id)) id = newRoomCode();
  return {
    id,
    name: cleanText(options.name, 40) || 'Mesa dos amigos',
    settings: options.settings,
    salt: options.salt,
    password: options.password,
    members: [],
    hostId: null,
    epoch: 1,
    phase: 'lobby',
    createdAt: options.now,
    updatedAt: options.now,
  };
}

/** Whether a room without open sockets should be deleted. */
export function isAbandoned(room: Room, now: number): boolean {
  const ttl = room.everConnected ? ROOM_IDLE_TTL_MS : UNUSED_ROOM_TTL_MS;
  return now - room.updatedAt > ttl;
}

/** Lobby seats are limited by capacity (bots included); running matches also take spectators. */
export function isFull(room: Room): boolean {
  const activeMembers = room.members.filter(member => !member.retired).length;
  if (room.phase === 'lobby') return activeMembers + (room.botCount ?? 0) >= room.settings.capacity;
  return activeMembers >= room.settings.capacity + SPECTATOR_SLOTS;
}
