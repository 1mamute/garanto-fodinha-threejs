/**
 * Messages exchanged between browsers over the WebRTC DataChannel.
 * Every message carries the host epoch it was sent under; messages from another epoch are dropped.
 */

import { sanitizeTransform, vectorTuple, type CardTransform } from './sceneMessages';

/** Where a player is looking, walking and reaching. */
export interface Pose {
  yaw: number;
  pitch: number;
  /** Normalized first-person magnification, used for the robot's squint. */
  squint?: number;
  position?: [number, number, number];
  reaching?: boolean;
  heldCard?: CardTransform | null;
}

export type PeerMessage =
  /** Host → guest: "send me your copy of the game", used when the host changes. */
  | { type: 'requestSnapshot' }
  /** Guest → host: the guest's last known game state. */
  | { type: 'snapshot'; state: unknown }
  /** Host → guest: the authoritative game state. */
  | { type: 'state'; state: unknown }
  /** Guest → host: a player action, validated by the host's rules. */
  | { type: 'action'; action: unknown; release?: unknown }
  | { type: 'cardRelease'; release: unknown }
  | { type: 'cards'; frame: unknown; sequence: number }
  | { type: 'error'; message: string }
  /** `id` is only set by the host when it forwards another player's pose. */
  | { type: 'pose'; pose: unknown; id?: string; sequence: number }
  | { type: 'ping' }
  | { type: 'pong' };

export type Envelope = PeerMessage & { epoch: number };

const MESSAGE_TYPES = new Set<string>([
  'requestSnapshot',
  'snapshot',
  'state',
  'action',
  'error',
  'pose',
  'cards',
  'cardRelease',
  'ping',
  'pong',
]);
export const MAX_PEER_MESSAGE = 131_072;

/** Parses a DataChannel frame, returning `null` for anything that is not a well-formed envelope. */
export function parseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== 'string' || raw.length > MAX_PEER_MESSAGE) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { type, epoch } = value as { type?: unknown; epoch?: unknown };
  if (typeof type !== 'string' || !MESSAGE_TYPES.has(type)) return null;
  if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 0) return null;
  return value as Envelope;
}

const isAngle = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validates a pose from another player and clamps it to sane values. */
export function sanitizePose(value: unknown): Pose | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const { yaw, pitch, position, squint } = raw;
  if (!isAngle(yaw) || !isAngle(pitch)) return null;
  const pose: Pose = {
    yaw: Math.max(-Math.PI * 8, Math.min(Math.PI * 8, yaw)),
    pitch: Math.max(-1.2, Math.min(1.2, pitch)),
  };
  if (isAngle(squint)) pose.squint = Math.max(0, Math.min(1, squint));
  const location = vectorTuple(position);
  if (position !== undefined && !location) return null;
  if (location) pose.position = location;
  return addGesture(pose, raw) ? pose : null;
}

function addGesture(pose: Pose, raw: Record<string, unknown>): boolean {
  if (typeof raw.reaching === 'boolean') pose.reaching = raw.reaching;
  if (raw.heldCard === null) pose.heldCard = null;
  else if (raw.heldCard !== undefined) {
    const card = sanitizeTransform(raw.heldCard);
    if (!card) return false;
    pose.heldCard = card;
  }
  return true;
}
