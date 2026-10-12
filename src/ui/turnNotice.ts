import type { GameState } from '../game';
import { activeTurn } from '../shared/activeTurn';
import { playSound, type SoundKind } from './feedback';

export function turnPrompt(game: GameState | null, playerId: string): string | null {
  const player = activeTurn(game);
  if (!game || player?.id !== playerId) return null;
  return game.phase === 'bet' ? 'Sua vez · faça seu palpite' : 'Sua vez · jogue uma carta';
}

export function tableTurnPrompt(game: GameState, playerId: string): string | null {
  const player = activeTurn(game);
  if (!player) return null;
  return (
    turnPrompt(game, playerId) ??
    `Vez de ${player.name} · ${game.phase === 'bet' ? 'dar o palpite' : 'jogar uma carta'}`
  );
}

interface PageTitle {
  title: string;
  readonly hidden: boolean;
}

/** State updates such as chat and reordering must not repeat the turn sound. */
export class TurnNotice {
  private prompt: string | null = null;
  private turnKey: string | null = null;
  private readonly originalTitle: string;

  constructor(
    private readonly page: PageTitle = document,
    private readonly notify: (kind: SoundKind) => void = playSound,
  ) {
    this.originalTitle = page.title;
  }

  update(game: GameState | null, playerId: string, soundEnabled: boolean): void {
    const player = activeTurn(game);
    // Round and hand size distinguish consecutive turns won by the same player.
    const key = player && game ? `${game.round}:${game.phase}:${player.id}:${player.hand.length}` : null;
    const changed = key !== this.turnKey;
    this.turnKey = key;
    this.prompt = turnPrompt(game, playerId);
    this.refreshTitle();
    if (key && changed && soundEnabled) this.notify(player?.id === playerId ? 'turn' : 'turnOther');
  }

  refreshTitle(): void {
    this.page.title = this.page.hidden && this.prompt ? `${this.prompt} — Garanto` : this.originalTitle;
  }
}
