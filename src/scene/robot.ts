import { ROBOT_ANIMATION } from '../config/robotAnimationSettings';
import { watchSettings } from '../config/hotSettings';
import { ROBOT_LOOK } from '../config/robotAnimationSettings';
/** The little robots sitting around the table, and their idle/play/death animations. */
import * as THREE from 'three';
import type { Pose } from './types';
import { ROBOT_DIMENSIONS } from '../config/robotSettings';
import { buildGripper, robotArm, robotBody, robotHead, robotLeg, robotPaint } from './robotParts';

/** Seconds since the page loaded; animation start times use the same clock. */
export function nowSeconds(): number {
  return performance.now() / 1000;
}

export class Robot {
  readonly group = new THREE.Group();
  /** Holds the robot's small fan of cards. */
  readonly hand = new THREE.Group();
  private body: THREE.Mesh;
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
    this.body = robotBody(this.group, paint);
    this.body.position.y = this.postureHeight;
    this.buildHead(paint);
    this.buildLegs(paint);
    this.buildArms(paint);
    // The card fan and clamp share a mount, so idle motion cannot separate the grip.
    this.hand.position.set(-0.3, 1.92 + this.postureHeight, 0.63);
    this.hand.rotation.x = 0.95;
    if (posture === 'seated') buildGripper(this.hand);
    this.group.add(this.hand);
    watchSettings(this, (robot, category) => {
      if (category === 'robotSettings') robot.rebuildDimensions();
    });
  }

  private rebuildDimensions(): void {
    const paint = robotPaint(this.color);
    this.body.removeFromParent();
    this.body = robotBody(this.group, paint);
    this.body.position.y = this.postureHeight;
    this.head.position.y = ROBOT_DIMENSIONS.headHeight + this.postureHeight;
    for (const eye of this.eyes) eye.position.y = ROBOT_DIMENSIONS.eyeOffset;
    for (const leg of this.legs) leg.removeFromParent();
    this.legs.length = 0;
    this.buildLegs(paint);
    this.leftArm.position.y = ROBOT_DIMENSIONS.shoulderHeight + this.postureHeight;
    this.rightArm.position.y = ROBOT_DIMENSIONS.shoulderHeight + this.postureHeight;
    this.hand.position.y = 1.92 + this.postureHeight;
  }

  private get postureHeight(): number {
    return this.posture === 'standing' ? ROBOT_DIMENSIONS.standingOffset : 0;
  }

  /** Keep the body grounded in first person, with camera-mounted hands for seated play. */
  setFirstPerson(firstPerson: boolean): void {
    this.group.visible = true;
    this.head.visible = !firstPerson;
    this.hand.visible = !firstPerson;
    const showArms = !firstPerson || this.posture === 'standing';
    this.leftArm.visible = showArms;
    this.rightArm.visible = showArms;
  }

  private buildHead(paint: THREE.Material): void {
    this.head.position.y = ROBOT_DIMENSIONS.headHeight + this.postureHeight;
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
      leg.position.set(x, ROBOT_DIMENSIONS.seatedHipHeight + this.postureHeight, 0);
      this.group.add(leg);
      this.legs.push(leg);
      robotLeg(leg, paint, standing);
    }
  }

  private buildArms(paint: THREE.Material): void {
    this.group.add(this.leftArm, this.rightArm);
    const standing = this.posture === 'standing';
    const { shoulderHeight } = ROBOT_DIMENSIONS;
    this.leftArm.position.set(-0.46, shoulderHeight + this.postureHeight, 0.06);
    this.rightArm.position.set(0.46, shoulderHeight + this.postureHeight, 0.06);
    robotArm(this.leftArm, paint, -1, standing);
    robotArm(this.rightArm, paint, 1, standing);
  }
  /** Standing locomotion has its own pose; seated play/death animations stay independent. */
  animateWalking(phase: number, amount: number, worldLook: THREE.Quaternion): void {
    const stride = Math.sin(phase) * amount;
    this.legs.forEach((leg, index) => {
      leg.rotation.x = stride * (index === 0 ? ROBOT_ANIMATION.legSwing : -ROBOT_ANIMATION.legSwing);
    });
    this.leftArm.rotation.x = -stride * ROBOT_ANIMATION.armSwing;
    this.rightArm.rotation.x = stride * ROBOT_ANIMATION.armSwing;
    this.group.position.y = (1 - Math.cos(phase * 2)) * amount * ROBOT_ANIMATION.walkingBob;
    this.group.rotation.z = stride * ROBOT_ANIMATION.walkingSway;
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
    const idleYaw =
      Math.sin(time * ROBOT_ANIMATION.idleYawFrequency + group.position.x) * ROBOT_ANIMATION.idleYawAmplitude;
    this.animateHead(pose ?? { yaw: idleYaw, pitch: 0 }, blend);
    // Breathing.
    this.body.scale.x =
      1 +
      Math.sin(time * ROBOT_ANIMATION.breathingFrequency + group.position.x) *
        ROBOT_ANIMATION.breathingAmplitude;
    // Swing the right arm for ~1 s after playing a card.
    const swing = Math.sin(Math.max(0, 1 - (time - this.playedAt) / ROBOT_ANIMATION.playSeconds) * Math.PI);
    const reach = pose?.reaching ? 1 : 0;
    this.rightArm.rotation.x = THREE.MathUtils.lerp(
      this.rightArm.rotation.x,
      -swing * ROBOT_ANIMATION.playArmPitch - reach * ROBOT_ANIMATION.reachArmPitch,
      blend,
    );
    this.rightArm.rotation.z = THREE.MathUtils.lerp(
      this.rightArm.rotation.z,
      -swing * ROBOT_ANIMATION.playArmRoll - reach * ROBOT_ANIMATION.reachArmRoll,
      blend,
    );
    // Keep the pelvis on the cushion and the feet on the floor throughout idle/play.
    group.position.y = 0;
    this.animateSquint(pose?.squint ?? 0, blend);
    this.animateDeath(time);
  }

  animateSquint(amount: number, blend: number): void {
    const squint = this.diedAt === null ? THREE.MathUtils.clamp(amount, 0, 1) : 0;
    for (const eye of this.eyes) {
      eye.scale.y = THREE.MathUtils.lerp(eye.scale.y, 1 - squint * ROBOT_ANIMATION.squintHeight, blend);
      eye.scale.x = THREE.MathUtils.lerp(eye.scale.x, 1 + squint * ROBOT_ANIMATION.squintWidth, blend);
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
    const yaw = fullTurn
      ? normalizedYaw
      : THREE.MathUtils.clamp(normalizedYaw, -ROBOT_LOOK.MAX_HEAD_YAW, ROBOT_LOOK.MAX_HEAD_YAW);
    const pitch = THREE.MathUtils.clamp(pose.pitch, -ROBOT_LOOK.MAX_HEAD_PITCH, ROBOT_LOOK.MAX_HEAD_PITCH);
    const difference = yaw - head.rotation.y;
    // Unwrap behind the robot so crossing +/- PI continues the turn instead of reversing it.
    const turn = fullTurn ? Math.atan2(Math.sin(difference), Math.cos(difference)) : difference;
    head.rotation.y += turn * blend;
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -pitch, blend);
    for (const eye of this.eyes) {
      // Rotate around each eyeball's centre so pupils stay attached to its curved surface.
      // Full-turn tracking aligns the eyes with the head, avoiding sideways pupils at the back.
      eye.rotation.y = THREE.MathUtils.lerp(
        eye.rotation.y,
        fullTurn ? 0 : yaw * ROBOT_ANIMATION.eyeYawGain,
        blend,
      );
      eye.rotation.x = THREE.MathUtils.lerp(eye.rotation.x, -pitch * ROBOT_ANIMATION.eyePitchGain, blend);
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
    const progress = THREE.MathUtils.clamp((time - this.diedAt) / ROBOT_ANIMATION.deathSeconds, 0, 1);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, ROBOT_ANIMATION.deathPitch, progress);
    head.rotation.z = progress * ROBOT_ANIMATION.deathRoll;
    for (const eye of this.eyes) eye.scale.y = 1 - progress * ROBOT_ANIMATION.deathEyeClosure;
  }
}
