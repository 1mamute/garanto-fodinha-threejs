import type { GameState } from '../game';
import type { Session } from '../net/session';
import type { SavedSession } from '../net/storage';
import type { CameraMode, CardInspection } from '../scene/types';
import type { PublicRoom } from '../shared/protocol';

export type Modal =
  | { type: 'create' }
  | { type: 'join'; room?: string }
  | { type: 'practice' }
  | { type: 'help' }
  | { type: 'leave' };

/** Everything the interface renders from. Views read it; controllers in `app.ts` change it. */
export interface UiState {
  screen: 'home' | 'rooms';
  modal: Modal | null;
  cameraMode: CameraMode;
  session: Session | null;
  game: GameState | null;
  connectionStatus: string;
  selectedCardId: string | null;
  rooms: PublicRoom[];
  roomsError: string;
  roomsLoading: boolean;
  /** A create/join request is in flight. */
  busy: boolean;
  chatOpen: boolean;
  chatDraft: string;
  inspection: CardInspection | null;
  /** Spectators can peek at one player's hand. */
  watchedPlayerId: string | null;
  soundEnabled: boolean;
  playerName: string;
  savedSession: SavedSession | null;
}
