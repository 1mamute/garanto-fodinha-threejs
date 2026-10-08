import assert from 'node:assert/strict';
import test from 'node:test';
import { fullBucket, SOCKET_BUCKET, takeToken, type Bucket } from '../worker/tokenBucket';

/** Sends `count` messages at the same instant; returns how many got through. */
function burst(bucket: Bucket, count: number, now: number): { accepted: number; bucket: Bucket } {
  let current = bucket;
  let accepted = 0;
  for (let message = 0; message < count; message++) {
    const next = takeToken(current, now);
    if (!next) break;
    current = next;
    accepted++;
  }
  return { accepted, bucket: current };
}

test('o burst de sinalização de um host com nove pares cabe no balde', () => {
  // An offer plus ~12 ICE candidates for each of nine peers, all within the same millisecond.
  const signalingBurst = 9 * 13;
  assert.equal(burst(fullBucket(0), signalingBurst, 0).accepted, signalingBurst);
});

test('o balde esvazia com flood e reabastece com o tempo', () => {
  const flooded = burst(fullBucket(0), SOCKET_BUCKET.capacity + 50, 0);
  assert.equal(flooded.accepted, SOCKET_BUCKET.capacity);
  assert.equal(takeToken(flooded.bucket, 0), null);
  // One second later the bucket holds `perSecond` new tokens, never more than its capacity.
  assert.equal(burst(flooded.bucket, 1000, 1000).accepted, SOCKET_BUCKET.perSecond);
  assert.equal(burst(flooded.bucket, 1000, 60_000).accepted, SOCKET_BUCKET.capacity);
});
