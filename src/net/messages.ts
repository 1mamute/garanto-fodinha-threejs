/**
 * Messages exchanged between browsers over the WebRTC DataChannel.
 * Every message carries the host epoch it was sent under; messages from another epoch are dropped.
 */

/** Where a player is looking (and walking, for spectators). Shared so robots turn their heads. */
export interface Pose {
  yaw: number;
  pitch: number;
  /** Normalized first-person magnification, used for the robot's squint. */
  squint?: number;
  position?: [number, number, number];
}

export type PeerMessage =
  /** Host → guest: "send me your copy of the game", used when the host changes. */
  | { type: 'requestSnapshot' }
  /** Guest → host: the guest's last known game state. */
  | { type: 'snapshot'; state: unknown }
  /** Host → guest: the authoritative game state. */
  | { type: 'state'; state: unknown }
  /** Guest → host: a player action, validated by the host's rules. */
  | { type: 'action'; action: unknown }
  | { type: 'error'; message: string }
  /** `id` is only set by the host when it forwards another player's pose. */
  | { type: 'pose'; pose: unknown; id?: string }
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
  if (typeof type !== 'string' || !MESSAGE_TYPES.has(type) || typeof epoch !== 'number') return null;
  return value as Envelope;
}

const isAngle = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validates a pose from another player and clamps it to sane values. */
export function sanitizePose(value: unknown): Pose | null {
  if (typeof value !== 'object' || value === null) return null;
  const { yaw, pitch, position, squint } = value as Record<string, unknown>;
  if (!isAngle(yaw) || !isAngle(pitch)) return null;
  const pose: Pose = {
    yaw: Math.max(-Math.PI * 8, Math.min(Math.PI * 8, yaw)),
    pitch: Math.max(-1.2, Math.min(1.2, pitch)),
  };
  if (isAngle(squint)) pose.squint = Math.max(0, Math.min(1, squint));
  if (Array.isArray(position) && position.length === 3 && position.every(isAngle)) {
    pose.position = position as [number, number, number];
  }
  return pose;
}
