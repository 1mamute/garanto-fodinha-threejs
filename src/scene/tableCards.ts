/**
 * Cards lying on the table: the current trick, every player's pile of won tricks and the kicker.
 *
 * Meshes are keyed by card id only. When a trick is collected, the very same mesh glides from the
 * middle of the table to the winner's pile. (Keying by "table"/"pile" used to throw the table mesh
 * away and spawn a new one at the seat, so collected cards flew in from the players instead.)
 */
import * as THREE from 'three';
import type { Card, GameState, TableEntry } from '../game';
import { CardMesh } from './cards';
import { CARD_SIZE } from './cardGeometry';
import { TABLE_TOP } from './room';
import type { CardInspection } from './types';

/** Golden angle: successive cards spiral out without overlapping much. */
const GOLDEN_ANGLE = 2.399;
const KICKER_ROTATION = -0.15;
const KICKER_CLEARANCE_RADIUS = 0.8;

/** Where a seated robot is, as far as card placement is concerned. */
export interface Seat {
  position: THREE.Vector3;
  rotation: number;
}

interface Placement {
  entry: TableEntry;
  position: THREE.Vector3;
  rotation: number;
  /** Cards just played start at their player's seat; everything else appears in place. */
  onTable: boolean;
  details: CardInspection;
}

function placeTrick(state: GameState, placements: Map<string, Placement>): void {
  const baseRadius = state.kicker ? KICKER_CLEARANCE_RADIUS : 0.28;
  state.table.forEach((entry, index) => {
    const angle = index * GOLDEN_ANGLE;
    const radius = baseRadius + 0.055 * index;
    const position = new THREE.Vector3(
      Math.sin(angle) * radius,
      TABLE_TOP + index * 0.006,
      Math.cos(angle) * radius,
    );
    const details = { card: entry.card, playerName: entry.playerName };
    placements.set(entry.card.id, { entry, position, rotation: angle * 0.25, onTable: true, details });
  });
}

/** Won tricks are stacked in front of the winner, up to three stacks side by side. */
function placePiles(
  state: GameState,
  seats: ReadonlyMap<string, Seat>,
  placements: Map<string, Placement>,
): void {
  for (const player of state.players) {
    const seat = seats.get(player.id);
    if (!seat) continue;
    const base = seat.position.clone().multiplyScalar(0.63);
    base.y = TABLE_TOP + 0.01;
    player.tricks.forEach((trick, trickIndex) => {
      trick.entries.forEach((entry, layer) => {
        // While the trick is being collected its cards are still listed on the table: keep them there.
        if (placements.has(entry.card.id)) return;
        const position = base.clone();
        position.y += trickIndex * 0.045 + layer * 0.009;
        position.x += ((trickIndex % 3) - 1) * 0.18;
        const details = {
          card: entry.card,
          playerName: entry.playerName,
          pileOwner: player.name,
          trickIndex: trickIndex + 1,
          pile: trick.entries,
        };
        placements.set(entry.card.id, { entry, position, rotation: seat.rotation, onTable: false, details });
      });
    });
  }
}

export class TableCards {
  readonly framingBounds = { radius: 0, height: TABLE_TOP };
  private readonly meshes = new Map<string, CardMesh>();
  private kicker: CardMesh | null = null;
  private released: CardMesh | null = null;

  constructor(private readonly world: THREE.Group) {}

  releaseFromHand(card: CardMesh): void {
    this.released = card;
  }

  /** Everything that can be clicked to inspect. */
  get pickable(): CardMesh[] {
    return this.kicker ? [...this.meshes.values(), this.kicker] : [...this.meshes.values()];
  }

  sync(state: GameState, seats: ReadonlyMap<string, Seat>): void {
    const placements = new Map<string, Placement>();
    placeTrick(state, placements);
    placePiles(state, seats, placements);
    for (const [cardId, card] of this.meshes) {
      if (placements.has(cardId)) continue;
      card.destroy();
      this.meshes.delete(cardId);
    }
    for (const [cardId, placement] of placements) {
      const card = this.meshes.get(cardId) ?? this.spawn(placement, seats);
      card.target.copy(placement.position);
      card.targetRotation = placement.rotation;
      card.details = placement.details;
    }
    this.syncKicker(state.kicker);
    this.released = null;
    this.updateFraming();
  }

  private updateFraming(): void {
    this.framingBounds.radius = 0;
    this.framingBounds.height = TABLE_TOP;
    for (const card of this.pickable) {
      const { width, depth, height } = CARD_SIZE;
      // The circumradius fits every rotation of the card, including during its animation.
      const radius = Math.hypot(card.target.x, card.target.z) + Math.hypot(width, depth) / 2;
      this.framingBounds.radius = Math.max(this.framingBounds.radius, radius);
      this.framingBounds.height = Math.max(this.framingBounds.height, card.target.y + height / 2);
    }
  }

  private spawn(placement: Placement, seats: ReadonlyMap<string, Seat>): CardMesh {
    const held = this.released?.card.id === placement.entry.card.id ? this.released : null;
    const card = held ?? new CardMesh(placement.entry.card);
    card.layers.set(0);
    const seat = placement.onTable ? seats.get(placement.entry.playerId) : undefined;
    if (held) {
      this.world.attach(card);
    } else if (seat) {
      // Thrown from the player's hand: start above their side of the table, slightly turned.
      card.position.copy(seat.position).multiplyScalar(0.7).setY(2);
      card.rotation.y = placement.rotation + 0.5;
    } else {
      card.position.copy(placement.position);
      card.rotation.y = placement.rotation;
    }
    this.world.add(card);
    this.meshes.set(placement.entry.card.id, card);
    return card;
  }

  private syncKicker(kicker: Card | null): void {
    if (this.kicker?.card.id === kicker?.id) return;
    this.kicker?.destroy();
    this.kicker = null;
    if (!kicker) return;
    const card = new CardMesh(kicker);
    card.position.set(0, TABLE_TOP, 0);
    card.target.copy(card.position);
    card.rotation.y = card.targetRotation = KICKER_ROTATION;
    card.details = { card: kicker, playerName: 'Kicker da rodada', kicker: true };
    this.world.add(card);
    this.kicker = card;
  }

  /** Eases every card towards its target; the inspected card turns to face the camera. */
  animate(deltaSeconds: number, blend: number, inspected: THREE.Object3D | null): void {
    const slide = 1 - Math.exp(-deltaSeconds * 5);
    for (const card of this.pickable) {
      card.position.lerp(card.target, slide);
      const rotation = card === inspected ? 0 : card.targetRotation;
      card.rotation.y = THREE.MathUtils.lerp(card.rotation.y, rotation, blend);
      card.rotation.x = THREE.MathUtils.lerp(card.rotation.x, 0, blend);
      card.rotation.z = THREE.MathUtils.lerp(card.rotation.z, 0, blend);
      card.scale.lerp(new THREE.Vector3(1, 1, 1), blend);
    }
  }
}
