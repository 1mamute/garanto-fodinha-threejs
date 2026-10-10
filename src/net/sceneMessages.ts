/** Compact visual state; rule state continues to travel on the reliable channel. */
export type VectorTuple = [number, number, number];
export type RotationTuple = [number, number, number, number];

export interface CardTransform {
  id: string;
  position: VectorTuple;
  rotation: RotationTuple;
  scale: VectorTuple;
}

export interface CardFrame {
  version: number;
  cards: CardTransform[];
}

export interface CardRelease {
  transform: CardTransform;
  landing: VectorTuple;
  velocity: VectorTuple;
}

const WORLD_LIMIT = 16;
const SPEED_LIMIT = 20;
const MAX_CARDS = 40;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function vectorTuple(value: unknown, limit = WORLD_LIMIT): VectorTuple | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every(component => finite(component) && Math.abs(component) <= limit)) return null;
  return value as VectorTuple;
}

function rotationTuple(value: unknown): RotationTuple | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) return null;
  const rotation = value as RotationTuple;
  const length = Math.hypot(...rotation);
  if (length < 0.9 || length > 1.1) return null;
  return rotation.map(component => component / length) as RotationTuple;
}

export function sanitizeTransform(value: unknown): CardTransform | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const position = vectorTuple(raw.position);
  const rotation = rotationTuple(raw.rotation);
  const scale = vectorTuple(raw.scale, 2);
  if (typeof raw.id !== 'string' || raw.id.length > 16 || !position || !rotation || !scale) return null;
  if (scale.some(component => component <= 0)) return null;
  return { id: raw.id, position, rotation, scale };
}

export function sanitizeCardFrame(value: unknown): CardFrame | null {
  if (typeof value !== 'object' || value === null) return null;
  const { version, cards } = value as Record<string, unknown>;
  if (!Number.isSafeInteger(version) || typeof version !== 'number' || version < 0) return null;
  if (!Array.isArray(cards) || cards.length > MAX_CARDS) return null;
  const clean = cards.map(sanitizeTransform);
  if (clean.some(card => card === null)) return null;
  const valid = clean.filter((card): card is CardTransform => card !== null);
  if (new Set(valid.map(card => card.id)).size !== valid.length) return null;
  return { version, cards: valid };
}

export function sanitizeRelease(value: unknown): CardRelease | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const transform = sanitizeTransform(raw.transform);
  const landing = vectorTuple(raw.landing);
  const velocity = vectorTuple(raw.velocity, SPEED_LIMIT);
  if (!transform || !landing || !velocity) return null;
  return { transform, landing, velocity };
}
