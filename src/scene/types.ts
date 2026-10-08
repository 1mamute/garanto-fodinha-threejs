import type { Card, TableEntry } from '../game';
import type { Pose } from '../net/messages';

export type { Pose };

/** `landing` is the home screen fly-over; `first` sits in the player's robot; `top` looks down. */
export type CameraMode = 'landing' | 'first' | 'top';

/** Third person is only exposed by the development laboratory. */
export type InspectionCameraMode = CameraMode | 'third';

/** What the UI shows about a card the player is inspecting from above. */
export interface CardInspection {
  card: Card;
  playerName: string;
  kicker?: boolean;
  /** Set for cards in a collected trick pile. */
  pileOwner?: string;
  trickIndex?: number;
  pile?: TableEntry[];
}

export interface SceneCallbacks {
  onInspect(inspection: CardInspection | null): void;
  onPlay(cardId: string): void;
  onPose(pose: Pose): void;
  onMode(mode: CameraMode): void;
  onReorder(cardId: string, index: number): void;
}
