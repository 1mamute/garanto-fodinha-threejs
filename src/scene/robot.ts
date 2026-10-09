/** The little robots sitting around the table, and their idle/play/death animations. */
import * as THREE from 'three';
import type { Pose } from './types';
import { buildGripper, robotArm, robotBody, robotHead, robotLeg, robotPaint } from './robotParts';

const MAX_HEAD_YAW = 1.05;
const MAX_HEAD_PITCH = 0.65;

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
  /** When the robot sat down at the table; shared with the scene animation clock. */
  seatedAt = nowSeconds();
  diedAt: number | null = null;

  constructor(
    readonly color: string,
    private readonly posture: 'seated' | 'standing' = 'seated',
  ) {
    const paint = robotPaint(color);
    this.body = robotBody(this.group, paint, posture === 'standing');
    this.buildHead(paint);
    this.buildLegs(paint);
    this.buildArms(paint);
    // The card fan and clamp share a mount, so idle motion cannot separate the grip.
    this.hand.position.set(-0.3, 1.92, 0.63);
    this.hand.rotation.x = 0.95;
    if (posture === 'seated') buildGripper(this.hand);
    this.group.add(this.hand);
  }

  private buildHead(paint: THREE.Material): void {
    this.head.position.y = this.posture === 'standing' ? 1.65 : 2.23;
    this.head.name = 'head';
    this.head.rotation.order = 'YXZ';
    this.group.add(this.head);
    this.eyes.push(...robotHead(this.head, paint));
  }

  private buildLegs(paint: THREE.Material): void {
    const standing = this.posture === 'standing';
    for (const x of [-0.22, 0.22]) {
      const leg = new THREE.Group();
      // Chair cushion top is .855; the pelvis underside and boots meet their surfaces.
      leg.position.set(x, standing ? 0.93 : 0.9, 0);
      this.group.add(leg);
      this.legs.push(leg);
      robotLeg(leg, paint, standing);
    }
  }

  private buildArms(paint: THREE.Material): void {
    this.group.add(this.leftArm, this.rightArm);
    const standing = this.posture === 'standing';
    const shoulderHeight = standing ? 1.45 : 2.2;
    this.leftArm.position.set(-0.46, shoulderHeight, 0.06);
    this.rightArm.position.set(0.46, shoulderHeight, 0.06);
    robotArm(this.leftArm, paint, -1, standing);
    robotArm(this.rightArm, paint, 1, standing);
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
    this.body.scale.x = 1 + Math.sin(time * 2 + group.position.x) * 0.003;
    // Swing the right arm for ~1 s after playing a card.
    const swing = Math.sin(Math.max(0, 1 - (time - this.playedAt) / 1.1) * Math.PI);
    this.rightArm.rotation.x = -swing * 0.8;
    this.rightArm.rotation.z = -swing * 0.25;
    // Keep the pelvis on the cushion and the feet on the floor throughout idle/play.
    group.position.y = 0;
    this.animateSquint(pose?.squint ?? 0, blend);
    this.animateDeath(time);
  }

  private animateSquint(amount: number, blend: number): void {
    const squint = this.diedAt === null ? THREE.MathUtils.clamp(amount, 0, 1) : 0;
    for (const eye of this.eyes) {
      eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, 1 - squint * 0.72, blend);
      eye.scale.x = THREE.MathUtils.lerp(eye.scale.x, 1 + squint * 0.1, blend);
    }
  }

  /** Track a world-space target through a full horizontal turn; null restores a neutral look. */
  lookAt(target: THREE.Vector3 | null, blend: number, squint = 0): void {
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
    this.animateSquint(squint, blend);
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

  /** Elimination powers down the eyes and slumps the head, keeping the seated silhouette. */
  private animateDeath(time: number): void {
    const { group, head } = this;
    if (this.diedAt === null) {
      group.rotation.z = 0;
      head.rotation.z = 0;
      return;
    }
    const progress = THREE.MathUtils.clamp((time - this.diedAt) / 1.1, 0, 1);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, 0.48, progress);
    head.rotation.z = progress * 0.12;
    for (const eye of this.eyes) eye.scale.y = 1 - progress * 0.8;
  }
}
