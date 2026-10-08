/** The little robots sitting around the table, and their idle/play/death animations. */
import * as THREE from 'three';
import type { Pose } from './types';
import { BLACK, DARK, material, mesh, sphere, WHITE } from './primitives';

const MAX_HEAD_YAW = 1.05;
const MAX_HEAD_PITCH = 0.65;
const HEAD_RADIUS = 0.47;
const TORSO_RADIUS = 0.44;
const HEAD_PIVOT_HEIGHT = 1.65;
const SHOULDER_RADIUS = 0.43;
const HEAD_SHELL_OFFSET = 0.24;

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
  private readonly eyes: THREE.Group[] = [];
  private readonly rightArm = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly lookDirection = new THREE.Vector3();
  /** When the last card was played, to swing the arm. */
  playedAt = -10;
  /** When the robot sat down at the table, for the little hop. */
  seatedAt = nowSeconds();
  diedAt: number | null = null;

  constructor(
    readonly color: string,
    private readonly posture: 'seated' | 'standing' = 'seated',
  ) {
    const paint = material(color, { roughness: 0.48 });
    this.body = mesh(
      new THREE.CylinderGeometry(TORSO_RADIUS, 0.46, 0.62, 32),
      paint,
      this.group,
      [0, 1.27, 0],
    );
    mesh(
      new THREE.SphereGeometry(0.47, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      paint,
      this.group,
      [0, 0.98, 0],
    ).scale.y = 0.8;
    mesh(new THREE.CylinderGeometry(0.475, 0.475, 0.045, 32), paint, this.group, [0, 0.98, 0]);
    mesh(new THREE.CylinderGeometry(SHOULDER_RADIUS, SHOULDER_RADIUS, 0.15, 32), paint, this.group, [
      0,
      HEAD_PIVOT_HEIGHT,
      0,
    ]);
    // A broad socket fills the raised side of the seam when the head tilts.
    mesh(
      new THREE.SphereGeometry(SHOULDER_RADIUS, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      paint,
      this.group,
      [0, HEAD_PIVOT_HEIGHT, 0],
    );
    this.buildHead(paint);
    this.buildLegs(paint);
    this.buildArms(paint);
    this.hand.position.set(-0.5, 1.35, 0.53);
    this.hand.rotation.x = 0.55;
    this.group.add(this.hand);
  }

  private buildHead(paint: THREE.Material): void {
    const head = new THREE.Group();
    // Bury the pivot in the shoulders so the shell rests directly on the torso.
    this.head.position.y = HEAD_PIVOT_HEIGHT;
    this.head.name = 'head';
    // Pitch follows the head's horizontal heading, rather than the body's sideways axis.
    this.head.rotation.order = 'YXZ';
    head.position.y = HEAD_SHELL_OFFSET;
    this.group.add(this.head);
    this.head.add(head);
    mesh(
      new THREE.SphereGeometry(HEAD_RADIUS, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      paint,
      head,
      [0, 0.03, 0],
    );
    mesh(new THREE.CylinderGeometry(HEAD_RADIUS, HEAD_RADIUS, 0.23, 32), paint, head, [0, -0.085, 0]);
    // A fixed dark underside suggests the reference's mouth seam without a talking jaw.
    mesh(
      new THREE.CylinderGeometry(HEAD_RADIUS - 0.005, HEAD_RADIUS - 0.005, 0.018, 32),
      DARK,
      head,
      [0, -0.205, 0],
    );
    for (const x of [-0.235, 0.235]) {
      const eye = new THREE.Group();
      eye.position.set(x, 0.17, 0.405);
      head.add(eye);
      sphere(eye, WHITE, 0.19, { at: [0, 0, 0], scale: [1, 1.05, 0.85] });
      sphere(eye, BLACK, 0.06, { at: [0, 0, 0.157], scale: [1, 1.1, 0.35] });
      this.eyes.push(eye);
    }
  }

  private buildLegs(paint: THREE.Material): void {
    for (const x of [-0.2, 0.2]) {
      this.buildLeg(paint, x);
    }
  }

  private buildLeg(paint: THREE.Material, x: number): void {
    const standing = this.posture === 'standing';
    const length = standing ? 0.93 : 0.51;
    const leg = new THREE.Group();
    leg.position.set(x, standing ? 0.98 : 0, 0);
    this.group.add(leg);
    this.legs.push(leg);
    mesh(new THREE.CylinderGeometry(0.13, 0.075, length, 20), paint, leg, [
      0,
      standing ? -length / 2 : 0.45,
      standing ? 0 : 0.13,
    ]).rotation.x = standing ? 0 : -0.35;
  }

  private buildArms(paint: THREE.Material): void {
    const { leftArm } = this;
    this.group.add(leftArm, this.rightArm);
    buildArm(leftArm, paint, -1, this.posture);
    buildArm(this.rightArm, paint, 1, this.posture);
    if (this.posture === 'standing') {
      for (const arm of [leftArm, this.rightArm]) {
        // Swing from the shoulder, rather than orbiting the arm around the floor.
        arm.position.y = 1.3;
        for (const child of arm.children) child.position.y -= arm.position.y;
      }
    }
  }

  /** Standing locomotion has its own pose; seated play/death animations stay independent. */
  animateWalking(phase: number, amount: number, worldLook: THREE.Quaternion): void {
    const stride = Math.sin(phase) * amount;
    this.legs.forEach((leg, index) => {
      leg.rotation.x = stride * (index === 0 ? 0.38 : -0.38);
    });
    this.leftArm.rotation.x = -stride * 0.28;
    this.rightArm.rotation.x = stride * 0.28;
    this.group.position.y = (1 - Math.cos(phase * 2)) * amount * 0.018;
    this.group.rotation.z = stride * 0.025;
    // Cancel the body's full world rotation, including walking sway, to preserve mouse aim.
    this.group.updateWorldMatrix(true, false);
    this.group.getWorldQuaternion(this.head.quaternion).invert().multiply(worldLook);
  }

  /**
   * Advances the animations. `pose` is where the player is looking; without one the head idles.
   * `blend` is the per-frame smoothing factor.
   */
  animate(time: number, pose: Pose | undefined, blend: number): void {
    const { group } = this;
    const idleYaw = Math.sin(time * 0.6 + group.position.x) * 0.13;
    this.animateHead(pose ?? { yaw: idleYaw, pitch: 0 }, blend);
    // Breathing.
    this.body.scale.y = 1 + Math.sin(time * 2 + group.position.x) * 0.012;
    // Swing the right arm for ~1 s after playing a card.
    const swing = Math.sin(Math.max(0, 1 - (time - this.playedAt) / 1.1) * Math.PI);
    this.rightArm.rotation.x = -swing * 0.8;
    this.rightArm.rotation.z = -swing * 0.25;
    // A small hop when sitting down.
    const hop = Math.max(0, 1 - (time - this.seatedAt) / 1.2);
    group.position.y = Math.sin(hop * Math.PI) * 0.35;
    this.animateDeath(time);
  }

  /** Track a world-space target through a full horizontal turn; null restores a neutral look. */
  lookAt(target: THREE.Vector3 | null, blend: number): void {
    let pose: Pose = { yaw: 0, pitch: 0 };
    if (target) {
      this.group.updateWorldMatrix(true, false);
      const direction = this.group.worldToLocal(this.lookDirection.copy(target)).sub(this.head.position);
      pose = {
        yaw: Math.atan2(direction.x, direction.z),
        pitch: Math.atan2(direction.y, Math.hypot(direction.x, direction.z)),
      };
    }
    this.animateHead(pose, blend, true);
  }

  private animateHead(pose: Pose, blend: number, fullTurn = false): void {
    const { head } = this;
    const normalizedYaw = Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw));
    const yaw = fullTurn ? normalizedYaw : THREE.MathUtils.clamp(normalizedYaw, -MAX_HEAD_YAW, MAX_HEAD_YAW);
    const pitch = THREE.MathUtils.clamp(pose.pitch, -MAX_HEAD_PITCH, MAX_HEAD_PITCH);
    const difference = yaw - head.rotation.y;
    // Unwrap behind the robot so crossing +/- PI continues the turn instead of reversing it.
    const turn = fullTurn ? Math.atan2(Math.sin(difference), Math.cos(difference)) : difference;
    head.rotation.y += turn * blend;
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -pitch, blend);
    for (const eye of this.eyes) {
      // Rotate around each eyeball's centre so pupils stay attached to its curved surface.
      // Full-turn tracking aligns the eyes with the head, avoiding sideways pupils at the back.
      eye.rotation.y = THREE.MathUtils.lerp(eye.rotation.y, fullTurn ? 0 : yaw * 0.35, blend);
      eye.rotation.x = THREE.MathUtils.lerp(eye.rotation.x, -pitch * 0.45, blend);
    }
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

function buildArm(
  arm: THREE.Group,
  paint: THREE.Material,
  side: number,
  posture: 'seated' | 'standing',
): void {
  const upper = sphere(arm, paint, 0.16, { at: [side * 0.53, 1.3, 0.06], scale: [0.8, 1.85, 0.9] });
  upper.rotation.z = side * 0.3;
  const forearm = new THREE.Group();
  const standing = posture === 'standing';
  forearm.position.set(side * 0.56, standing ? 0.99 : 1.12, standing ? 0.06 : 0.25);
  forearm.rotation.x = standing ? 0 : -1.2;
  arm.add(forearm);
  mesh(new THREE.CylinderGeometry(0.09, 0.065, 0.38, 20), paint, forearm);
  mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.065, 20), paint, forearm, [0, -0.18, 0]);
  sphere(forearm, paint, 0.1, { at: [0, -0.23, 0], scale: [1, 0.65, 1] });
}
