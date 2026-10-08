/** Fans of cards held by the robots, and the player's own first-person hands. */
import * as THREE from 'three';
import type { Card } from '../game';
import { CardMesh } from './cards';
import { DARK, sphere, tube, WHITE } from './primitives';

/** How a hand fans out its cards. */
export interface FanLayout {
  scale: number;
  /** Horizontal distance between neighbouring cards. */
  spread: number;
  y: number;
  z: number;
  /** Extra turn per card away from the centre. */
  tilt: number;
}

/** Fan held by a robot across the table. */
export const ROBOT_FAN: FanLayout = { scale: 0.6, spread: 0.065, y: 0, z: 0, tilt: -0.08 };

/** Updates the cards in `group` to show `cards`, reusing meshes that are still there. */
export function syncFan(
  group: THREE.Group,
  cards: readonly Card[],
  faceDown: boolean,
  layout: FanLayout,
): void {
  const current = group.children.filter(child => child instanceof CardMesh);
  for (const mesh of current) {
    if (mesh.faceDown !== faceDown || !cards.some(card => card.id === mesh.card.id)) mesh.destroy();
  }
  const centre = (cards.length - 1) / 2;
  cards.forEach((card, index) => {
    const target = new THREE.Vector3((index - centre) * layout.spread, index * 0.002 + layout.y, layout.z);
    let mesh = group.children.find(
      (child): child is CardMesh => child instanceof CardMesh && child.card.id === card.id,
    );
    if (!mesh) {
      mesh = new CardMesh(card, faceDown);
      // New cards drop into the fan from slightly above.
      mesh.position.copy(target).setY(target.y + 0.15);
      group.add(mesh);
    }
    mesh.scale.setScalar(layout.scale);
    mesh.index = index;
    mesh.target.copy(target);
    mesh.targetRotation = (index - centre) * layout.tilt;
  });
}

/** Eases hand cards to their slots, except the one being dragged. */
export function animateFan(group: THREE.Group, blend: number, dragged: THREE.Object3D | null): void {
  for (const child of group.children) {
    if (!(child instanceof CardMesh) || child === dragged) continue;
    child.position.lerp(child.target, blend);
    child.rotation.y = THREE.MathUtils.lerp(child.rotation.y, child.targetRotation, blend);
  }
}

/** The player's own gloves and cards, attached to the camera in first-person mode. */
export class FirstPersonHands {
  readonly cards = new THREE.Group();
  private readonly leftHand = new THREE.Group();
  private readonly rightGlove = new THREE.Group();

  constructor(camera: THREE.Camera) {
    camera.add(this.leftHand, this.rightGlove);
    this.leftHand.position.set(-0.23, -0.54, -0.95);
    this.leftHand.rotation.x = 1.25;
    tube(
      this.leftHand,
      [
        [-0.3, -0.05, 0.15],
        [-0.22, 0, 0],
        [-0.08, 0.04, -0.1],
      ],
      DARK,
      0.035,
    );
    sphere(this.leftHand, WHITE, 0.09, { at: [-0.09, 0.025, -0.08] });
    this.leftHand.add(this.cards);
    this.rightGlove.position.set(0.55, -0.65, -1.05);
    sphere(this.rightGlove, WHITE, 0.1, { at: [0, 0, 0], scale: [1.2, 0.65, 1.2] });
    tube(
      this.rightGlove,
      [
        [0, -0.04, 0.1],
        [0.12, -0.15, 0.2],
        [0.25, -0.25, 0.3],
      ],
      DARK,
      0.035,
    );
  }

  set visible(visible: boolean) {
    this.leftHand.visible = visible;
    this.rightGlove.visible = visible;
  }

  show(cards: readonly Card[]): void {
    const spread = Math.min(0.085, 0.75 / Math.max(1, cards.length));
    syncFan(this.cards, cards, false, { scale: 0.65, spread, y: 0.03, z: -0.06, tilt: -0.055 });
  }

  /** The right glove reaches forward while a card is being dragged. */
  reach(reaching: boolean): void {
    this.rightGlove.position.y = reaching ? -0.5 : -0.65;
  }

  /** Narrow portrait screens shrink the hands so they stay inside the view. */
  fitTo(aspect: number): void {
    const scale = Math.min(1, aspect);
    this.leftHand.scale.setScalar(scale);
    this.leftHand.position.x = -0.23 * scale;
    this.rightGlove.scale.setScalar(scale);
    this.rightGlove.position.x = 0.55 * scale;
  }
}
