/** The little robots sitting around the table, and their idle/play/death animations. */
import * as THREE from 'three';
import type { Pose } from './types';
import { BLACK, DARK, material, mesh, sphere, tube, WHITE } from './primitives';

/** Seconds since the page loaded; animation start times use the same clock. */
export function nowSeconds(): number {
  return performance.now() / 1000;
}

export class Robot {
  readonly group = new THREE.Group();
  /** Holds the robot's small fan of cards. */
  readonly hand = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly head = new THREE.Group();
  private readonly eyes = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  /** When the last card was played, to swing the arm. */
  playedAt = -10;
  /** When the robot sat down at the table, for the little hop. */
  seatedAt = nowSeconds();
  diedAt: number | null = null;

  constructor(readonly color: string) {
    const paint = material(color);
    this.body = sphere(this.group, paint, 0.49, { at: [0, 1.25, 0], scale: [0.9, 1.12, 0.77] });
    mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.18, 18), paint, this.group, [0, 0.93, 0]);
    this.buildHead(paint);
    this.buildLegs();
    this.buildArms();
    this.hand.position.set(-0.5, 1.35, 0.53);
    this.hand.rotation.x = 0.55;
    this.group.add(this.hand);
  }

  private buildHead(paint: THREE.Material): void {
    const head = this.head;
    head.position.y = 1.96;
    this.group.add(head);
    sphere(head, paint, 0.51, { at: [0, 0, 0], scale: [1.12, 0.8, 0.84] });
    head.add(this.eyes);
    for (const x of [-0.2, 0.2]) {
      sphere(this.eyes, WHITE, 0.165, { at: [x, 0.015, 0.36], scale: [0.9, 1.1, 0.5] });
      sphere(this.eyes, BLACK, 0.075, { at: [x, 0.018, 0.435], scale: [0.85, 1.1, 0.38] });
    }
    // Off-center antenna and bolts give the little robots their own silhouette.
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), DARK, head, [0.25, 0.43, 0]).rotation.z = -0.35;
    sphere(head, material('#edc66e'), 0.08, { at: [0.29, 0.58, 0] });
    for (const x of [-0.54, 0.54]) sphere(head, DARK, 0.095, { at: [x, 0, 0], scale: [0.4, 1, 1] });
    mesh(new THREE.BoxGeometry(0.18, 0.035, 0.03), BLACK, head, [0, -0.22, 0.39]).rotation.z = -0.12;
  }

  private buildLegs(): void {
    for (const x of [-0.25, 0.25]) {
      mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.37, 8), DARK, this.group, [x, 0.58, 0.1]).rotation.x =
        -0.7;
      sphere(this.group, DARK, 0.17, { at: [x, 0.35, 0.25], scale: [1, 0.65, 1.5] });
    }
  }

  private buildArms(): void {
    const leftArm = new THREE.Group();
    this.group.add(leftArm, this.rightArm);
    tube(
      leftArm,
      [
        [-0.4, 1.5, 0],
        [-0.75, 1.28, 0.12],
        [-0.57, 1.28, 0.48],
      ],
      DARK,
    );
    tube(
      this.rightArm,
      [
        [0.4, 1.5, 0],
        [0.74, 1.17, 0.13],
        [0.53, 1.21, 0.55],
      ],
      DARK,
    );
    buildGlove(leftArm, -0.57);
    buildGlove(this.rightArm, 0.53);
  }

  /**
   * Advances the animations. `pose` is where the player is looking; without one the head idles.
   * `blend` is the per-frame smoothing factor.
   */
  animate(time: number, pose: Pose | undefined, blend: number): void {
    const { group, head } = this;
    const idleYaw = Math.sin(time * 0.6 + group.position.x) * 0.13;
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, pose?.yaw ?? idleYaw, blend);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -(pose?.pitch ?? 0), blend);
    this.eyes.rotation.x = -(pose?.pitch ?? 0) * 0.2;
    // Breathing.
    this.body.scale.y = 1.12 + Math.sin(time * 2 + group.position.x) * 0.025;
    // Swing the right arm for ~1 s after playing a card.
    const swing = Math.sin(Math.max(0, 1 - (time - this.playedAt) / 1.1) * Math.PI);
    this.rightArm.rotation.x = -swing * 0.8;
    this.rightArm.rotation.z = -swing * 0.25;
    // A small hop when sitting down.
    const hop = Math.max(0, 1 - (time - this.seatedAt) / 1.2);
    group.position.y = Math.sin(hop * Math.PI) * 0.35;
    this.animateDeath(time);
  }

  /** Eliminated robots tip over sideways and keep wobbling their head. */
  private animateDeath(time: number): void {
    const { group, head } = this;
    if (this.diedAt === null) {
      group.rotation.z = Math.sin(time + group.position.x) * 0.02;
      head.rotation.z = 0;
      return;
    }
    const progress = THREE.MathUtils.clamp((time - this.diedAt) / 1.1, 0, 1);
    group.rotation.z = Math.sin((progress * Math.PI) / 2) * 1.45;
    group.position.y = -0.45 * progress;
    head.rotation.z = Math.sin(time * 3) * 0.08;
  }
}

function buildGlove(arm: THREE.Group, x: number): void {
  const glove = sphere(arm, WHITE, 0.15, { at: [x, 1.28, 0.49], scale: [1.1, 0.7, 1.1] });
  glove.rotation.z = x < 0 ? -0.4 : 0.4;
  // Thumb, then three fingers.
  sphere(arm, WHITE, 0.07, { at: [x + (x < 0 ? 0.12 : -0.12), 1.29, 0.57] });
  for (let finger = 0; finger < 3; finger++)
    sphere(arm, WHITE, 0.045, { at: [x - 0.07 + finger * 0.06, 1.25, 0.62], scale: [1, 1, 1.5] });
}
