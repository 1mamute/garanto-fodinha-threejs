import { findPlayer, type GameState, type Player } from '../game';

/** Shared by scene and interface so paused or inactive seats never receive turn markers. */
export function activeTurn(game: GameState | null): Player | null {
  if (!game || game.paused || (game.phase !== 'bet' && game.phase !== 'play')) return null;
  const player = findPlayer(game, game.turn);
  if (!player?.seated || player.eliminated || player.spectator) return null;
  return player;
}
