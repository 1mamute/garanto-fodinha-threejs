import { findPlayer, type GameState } from '../game';
import { playSound } from './feedback';

export function turnPrompt(game: GameState | null, playerId: string): string | null {
  if (!game || game.paused || game.turn !== playerId) return null;
  const player = findPlayer(game, playerId);
  if (!player?.seated || player.eliminated || player.spectator) return null;
  if (game.phase === 'bet') return 'Sua vez · faça seu palpite';
  if (game.phase === 'play') return 'Sua vez · jogue uma carta';
  return null;
}

interface PageTitle {
  title: string;
  readonly hidden: boolean;
}

/** State updates such as chat and reordering must not repeat the turn sound. */
export class TurnNotice {
  private prompt: string | null = null;
  private readonly originalTitle: string;

  constructor(
    private readonly page: PageTitle = document,
    private readonly notify: () => void = () => {
      playSound('turn');
    },
  ) {
    this.originalTitle = page.title;
  }

  update(game: GameState | null, playerId: string, soundEnabled: boolean): void {
    const prompt = turnPrompt(game, playerId);
    const changed = prompt !== this.prompt;
    this.prompt = prompt;
    this.refreshTitle();
    if (prompt && changed && soundEnabled) this.notify();
  }

  refreshTitle(): void {
    this.page.title = this.page.hidden && this.prompt ? `${this.prompt} — Garanto` : this.originalTitle;
  }
}
