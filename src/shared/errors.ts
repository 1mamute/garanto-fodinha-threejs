/** Text of anything thrown, for showing to the player. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
