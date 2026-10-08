/** An error whose message is safe to show to the player. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_BODY_BYTES = 4096;

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Trims and clips user-provided text; anything that is not text becomes an empty string. */
export function cleanText(value: unknown, maxLength: number): string {
  return (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .trim()
    .slice(0, maxLength);
}

/** Reads a small JSON object body, rejecting oversized or malformed requests. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const tooLarge = new HttpError(413, 'Solicitação muito grande.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw tooLarge;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw tooLarge;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) throw new HttpError(400, 'Solicitação inválida.');
  return parsed as Record<string, unknown>;
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}
