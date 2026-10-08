/** Countdowns tick between renders by writing straight into their placeholders. */
import { RECONNECT_MS, type GameState } from '../game';

function formatMinutes(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function updateCountdowns(root: ParentNode, game: GameState | null): void {
  const now = Date.now();
  // `data-reconnect` holds the moment the player dropped; show the time left to come back.
  for (const element of root.querySelectorAll<HTMLElement>('[data-reconnect]')) {
    const remainingMs = RECONNECT_MS - (now - Number(element.dataset.reconnect));
    element.textContent = formatMinutes(Math.max(0, Math.ceil(remainingMs / 1000)));
  }
  const voteTime = root.querySelector('[data-vote-time]');
  if (!voteTime || game?.voteEndsAt === undefined || game.voteEndsAt === null) return;
  // While paused the clock is frozen at the moment of the pause.
  const reference = game.paused ? (game.pausedAt ?? now) : now;
  voteTime.textContent = `${Math.max(0, Math.ceil((game.voteEndsAt - reference) / 1000))}s para votar`;
}
