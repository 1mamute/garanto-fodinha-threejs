/**
 * Cards lying on the table: the current trick, every player's pile of won tricks and the kicker.
 *
 * Meshes are keyed by card id only. When a trick is collected, the very same mesh glides from the
 * player's side of the table to the winner's pile. (Keying by "table"/"pile" used to throw the table mesh
 * away and spawn a new one at the seat, so collected cards flew in from the players instead.)
 */
import * as THREE from 'three';
import type { Card, GameState, TableEntry } from '../game';
import { CardMesh } from './cards';
import { CARD_SIZE } from './cardGeometry';
import { CardThrow } from './cardThrow';
import type { PhysicsCards } from './physicsCards';
import { TABLE_TOP } from './room';
import type { CardInspection } from './types';

/** Leaves the centre for the kicker and the outer edge for won tricks. */
const PLAYED_CARD_RADIUS = 1.45;
const KICKER_ROTATION = -0.15;
const UP = new THREE.Vector3(0, 1, 0);
const FULL_SIZE = new THREE.Vector3(1, 1, 1);

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

function placeTrick(
  state: GameState,
  seats: ReadonlyMap<string, Seat>,
  placements: Map<string, Placement>,
): void {
  for (const entry of state.table) {
    const seat = seats.get(entry.playerId);
    if (!seat) continue;
    const position = seat.position.clone().setY(0).setLength(PLAYED_CARD_RADIUS).setY(TABLE_TOP);
    const details = { card: entry.card, playerName: entry.playerName };
    // Robots face local +Z; a readable card points its top towards local -Z.
    const rotation = seat.rotation - Math.PI;
    placements.set(entry.card.id, { entry, position, rotation, onTable: true, details });
  }
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
    base.y = TABLE_TOP;
    const heights = new Map<number, number>();
    const sideways = new THREE.Vector3(Math.cos(seat.rotation), 0, -Math.sin(seat.rotation));
    player.tricks.forEach((trick, trickIndex) => {
      const stack = trickIndex % 3;
      const height = heights.get(stack) ?? 0;
      trick.entries.forEach((entry, layer) => {
        // While the trick is being collected its cards are still listed on the table: keep them there.
        if (placements.has(entry.card.id)) return;
        const position = base.clone();
        position.y += (height + layer) * CARD_SIZE.height;
        position.addScaledVector(sideways, (stack - 1) * (CARD_SIZE.width + 0.05));
        const details = {
          card: entry.card,
          playerName: entry.playerName,
          pileOwner: player.name,
          trickIndex: trickIndex + 1,
          pile: trick.entries,
        };
        const rotation = seat.rotation - Math.PI;
        placements.set(entry.card.id, { entry, position, rotation, onTable: false, details });
      });
      heights.set(stack, height + trick.entries.length);
    });
  }
}

export class TableCards {
  readonly framingBounds = { radius: 0, height: TABLE_TOP };
  private readonly meshes = new Map<string, CardMesh>();
  private kicker: CardMesh | null = null;
  private released: { card: CardMesh; transform: THREE.Matrix4; landing: THREE.Vector3 } | null = null;
  private readonly throws = new Map<string, CardThrow>();
  private readonly restingOrientation = new THREE.Quaternion();

  constructor(
    private readonly world: THREE.Group,
    private readonly physics?: PhysicsCards,
  ) {}

  releaseFromHand(card: CardMesh, landing: THREE.Vector3): void {
    card.updateWorldMatrix(true, false);
    this.released = { card, transform: card.matrixWorld.clone(), landing: landing.clone() };
  }

  /** Everything that can be clicked to inspect. */
  get pickable(): CardMesh[] {
    return this.kicker ? [...this.meshes.values(), this.kicker] : [...this.meshes.values()];
  }

  sync(state: GameState, seats: ReadonlyMap<string, Seat>): void {
    const placements = new Map<string, Placement>();
    placeTrick(state, seats, placements);
    placePiles(state, seats, placements);
    for (const [cardId, card] of this.meshes) {
      if (placements.has(cardId)) continue;
      this.physics?.remove(card);
      card.destroy();
      this.meshes.delete(cardId);
      this.throws.delete(cardId);
    }
    for (const [cardId, placement] of placements) {
      const card = this.meshes.get(cardId) ?? this.spawn(placement, seats);
      card.target.copy(placement.position);
      card.targetRotation = placement.rotation;
      card.details = placement.details;
    }
    this.syncKicker(state.kicker);
    // Guest actions can be acknowledged after the hand has already been restored on release.
    if (this.released && placements.has(this.released.card.card.id)) this.released = null;
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
    const released = this.released?.card.card.id === placement.entry.card.id ? this.released : null;
    const held = released?.card.parent ? released.card : null;
    const card = held ?? new CardMesh(placement.entry.card);
    card.layers.set(0);
    const seat = placement.onTable ? seats.get(placement.entry.playerId) : undefined;
    if (released) {
      // Preserve the release transform even if an asynchronous state update removed the hand mesh.
      this.world.updateWorldMatrix(true, false);
      const local = this.world.matrixWorld.clone().invert().multiply(released.transform);
      local.decompose(card.position, card.quaternion, card.scale);
    } else if (seat) {
      // Other players place the card face up without an artificial spin.
      card.position.copy(seat.position).multiplyScalar(0.7).setY(2);
      card.rotation.y = placement.rotation;
    } else {
      card.position.copy(placement.position);
      card.rotation.y = placement.rotation;
    }
    this.world.add(card);
    card.target.copy(placement.position);
    card.targetRotation = placement.rotation;
    this.startMotion(card, placement.onTable ? (released?.landing ?? placement.position) : undefined);
    this.meshes.set(placement.entry.card.id, card);
    return card;
  }

  private startMotion(card: CardMesh, landing?: THREE.Vector3): void {
    if (this.physics) this.physics.add(card, landing);
    else if (landing) this.throws.set(card.card.id, new CardThrow(card, landing));
  }

  private syncKicker(kicker: Card | null): void {
    if (this.kicker?.card.id === kicker?.id) return;
    if (this.kicker) this.physics?.remove(this.kicker);
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
    this.physics?.add(card);
  }

  /** Eases every card towards its target; the inspected card turns to face the camera. */
  animate(deltaSeconds: number, blend: number, inspected: THREE.Object3D | null): void {
    const slide = 1 - Math.exp(-deltaSeconds * 5);
    for (const card of this.pickable) {
      if (this.physics) {
        this.physics.animate(card, deltaSeconds, inspected);
        continue;
      }
      const throwing = this.throws.get(card.card.id);
      if (throwing) {
        if (throwing.animate(card, deltaSeconds, card.target, card.targetRotation)) {
          this.throws.delete(card.card.id);
        }
        continue;
      }
      card.position.lerp(card.target, slide);
      const rotation = card === inspected ? 0 : card.targetRotation;
      // Euler angles can differ by a full turn after slerp; keep the same rotation representation.
      this.restingOrientation.setFromAxisAngle(UP, rotation);
      card.quaternion.slerp(this.restingOrientation, blend);
      card.scale.lerp(FULL_SIZE, blend);
    }
  }
}
