const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

/** Slow, salted hash for room passwords. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const params = {
    name: 'PBKDF2',
    salt: encoder.encode(salt),
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256',
  };
  return toHex(await crypto.subtle.deriveBits(params, key, 256));
}

/** Session tokens are long random strings, so a fast hash is enough to avoid storing them in clear. */
export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}

export function newSessionToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/** Six uppercase hex characters, short enough to read out loud. */
export function newRoomCode(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
}
