const UNAVAILABLE = 'Serviço de salas indisponível. Você ainda pode jogar com bots.';

/**
 * Calls the room service. Sends a POST when `body` is given, a GET otherwise.
 * Throws an `Error` whose message can be shown to the player.
 */
export async function api<T>(path: string, body?: object, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method: body ? 'POST' : 'GET', headers };
  if (body) init.body = JSON.stringify(body);
  const response = await fetch(`/api${path}`, init);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (!response.ok) throw new Error(errorMessage(data));
  return data as T;
}

function errorMessage(data: unknown): string {
  const message = (data as { error?: unknown } | null)?.error;
  return typeof message === 'string' && message ? message : 'Não foi possível conectar.';
}
