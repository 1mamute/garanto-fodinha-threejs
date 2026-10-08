/** A fixed-window counter kept in Durable Object storage (password attempts, room creation). */
export interface Attempts {
  count: number;
  until: number;
}

export async function countAttempt(
  storage: DurableObjectStorage,
  key: string,
  limit: { max: number; windowMs: number },
  now: number,
): Promise<boolean> {
  const previous = await storage.get<Attempts>(key);
  const inWindow = previous !== undefined && previous.until > now;
  if (inWindow && previous.count >= limit.max) return false;
  const count = inWindow ? previous.count + 1 : 1;
  await storage.put(key, { count, until: inWindow ? previous.until : now + limit.windowMs });
  return true;
}
