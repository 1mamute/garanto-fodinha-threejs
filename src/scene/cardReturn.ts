import * as THREE from 'three';
import { CARD_MOTION } from './cardMotionSettings';

const UP = new THREE.Vector3(0, 1, 0);

/** Starts and ends at rest; retargeting a collected card preserves its current transform. */
export class CardReturn {
  private elapsed = 0;
  private readonly start: THREE.Vector3;
  private readonly orientation: THREE.Quaternion;
  private readonly destination = new THREE.Quaternion();
  private target: THREE.Vector3 | null = null;

  constructor(
    card: THREE.Object3D,
    private readonly durationSeconds = CARD_MOTION.returnSeconds,
  ) {
    this.start = card.position.clone();
    this.orientation = card.quaternion.clone();
  }

  animate(card: THREE.Object3D, deltaSeconds: number, target: THREE.Vector3, rotation: number): boolean {
    if (this.target && !this.target.equals(target)) {
      this.start.copy(card.position);
      this.orientation.copy(card.quaternion);
      this.elapsed = 0;
    }
    this.target = target.clone();
    this.elapsed += deltaSeconds;
    const progress = this.durationSeconds <= 0 ? 1 : Math.min(1, this.elapsed / this.durationSeconds);
    const blend = progress * progress * (3 - 2 * progress);
    card.position.lerpVectors(this.start, target, blend);
    this.destination.setFromAxisAngle(UP, rotation);
    card.quaternion.slerpQuaternions(this.orientation, this.destination, blend);
    return progress === 1;
  }
}
