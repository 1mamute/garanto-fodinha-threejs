/**
 * Token bucket: allows short bursts up to `capacity` messages, refilled at `perSecond`.
 * A host that (re)connects to nine peers sends an offer plus a dozen ICE candidates to each one
 * almost at once, so the burst capacity must comfortably exceed that.
 */
export interface Bucket {
  tokens: number;
  refilledAt: number;
}

export const SOCKET_BUCKET = { capacity: 300, perSecond: 60 };

export function fullBucket(now: number): Bucket {
  return { tokens: SOCKET_BUCKET.capacity, refilledAt: now };
}

/** Spends one token. Returns the updated bucket, or `null` when the bucket is empty. */
export function takeToken(bucket: Bucket, now: number): Bucket | null {
  const refill = ((now - bucket.refilledAt) / 1000) * SOCKET_BUCKET.perSecond;
  const tokens = Math.min(SOCKET_BUCKET.capacity, bucket.tokens + refill);
  return tokens >= 1 ? { tokens: tokens - 1, refilledAt: now } : null;
}
