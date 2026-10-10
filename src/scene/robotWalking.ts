/** Smooth standing locomotion driven by accepted movement, independently of camera aim. */
import * as THREE from 'three';
import { smoothing } from './primitives';
import type { Robot } from './robot';

const TURN_RESPONSE = 9;
const LOOK_RESPONSE = 16;
const STRIDE_RESPONSE = 10;
const WALK_SPEED = 2.7;
const STRIDE_LENGTH = 1.7;
const MOVEMENT_EPSILON = 0.00001;

interface WalkingFrame {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  deltaSeconds: number;
  squint?: number;
}

export class RobotWalking {
  private readonly previousPosition: THREE.Vector3;
  private readonly worldLook = new THREE.Quaternion();
  private readonly lookTarget = new THREE.Quaternion();
  private readonly lookEuler = new THREE.Euler(0, Math.PI, 0, 'YXZ');
  private heading: number;
  private phase = 0;
  private amount = 0;

  constructor(
    private readonly robot: Robot,
    position: THREE.Vector3,
  ) {
    this.previousPosition = position.clone();
    this.heading = robot.group.rotation.y;
    this.worldLook.setFromEuler(this.lookEuler);
  }

  update({ position, yaw, pitch, deltaSeconds, squint = 0 }: WalkingFrame): void {
    if (deltaSeconds <= 0) return;
    const x = position.x - this.previousPosition.x;
    const z = position.z - this.previousPosition.z;
    const distance = Math.hypot(x, z);
    this.previousPosition.copy(position);
    if (distance > MOVEMENT_EPSILON) this.heading = Math.atan2(x, z);
    const { group } = this.robot;
    const angle = this.heading - group.rotation.y;
    // Take the short arc across +/- PI, with a frame-rate-independent response.
    group.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * smoothing(deltaSeconds, TURN_RESPONSE);
    group.position.copy(position).setY(0);
    const speed = distance / deltaSeconds;
    this.amount = THREE.MathUtils.lerp(
      this.amount,
      Math.min(speed / WALK_SPEED, 1),
      smoothing(deltaSeconds, STRIDE_RESPONSE),
    );
    this.phase += (distance / STRIDE_LENGTH) * Math.PI * 2;
    this.lookEuler.set(-pitch, yaw + Math.PI, 0, 'YXZ');
    this.lookTarget.setFromEuler(this.lookEuler);
    this.worldLook.slerp(this.lookTarget, smoothing(deltaSeconds, LOOK_RESPONSE));
    this.robot.animateWalking(this.phase, this.amount, this.worldLook);
    this.robot.animateSquint(squint, smoothing(deltaSeconds, LOOK_RESPONSE));
  }
}
