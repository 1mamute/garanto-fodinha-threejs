import * as THREE from 'three';

const FLIGHT_SECONDS = 0.28;
const SLIDE_SECONDS = 0.36;
const UP = new THREE.Vector3(0, 1, 0);
const FULL_SIZE = new THREE.Vector3(1, 1, 1);

function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

/** Lands at the chosen point before settling into the player's designated slot. */
export class CardThrow {
  private elapsed = 0;
  private readonly start: THREE.Vector3;
  private readonly orientation: THREE.Quaternion;
  private readonly scale: THREE.Vector3;
  private readonly landing: THREE.Vector3;
  private readonly settled = new THREE.Quaternion();

  constructor(card: THREE.Object3D, landing: THREE.Vector3) {
    this.start = card.position.clone();
    this.orientation = card.quaternion.clone();
    this.scale = card.scale.clone();
    this.landing = landing.clone();
  }

  /** Returns true once the card has reached its final position exactly. */
  animate(card: THREE.Object3D, deltaSeconds: number, target: THREE.Vector3, rotation: number): boolean {
    this.elapsed += deltaSeconds;
    const flight = Math.min(1, this.elapsed / FLIGHT_SECONDS);
    const slide = Math.max(0, Math.min(1, (this.elapsed - FLIGHT_SECONDS) / SLIDE_SECONDS));
    this.settled.setFromAxisAngle(UP, rotation);
    if (flight < 1) {
      // A direct placement keeps the face readable, without a toss, bounce or extra wrist spin.
      card.position.lerpVectors(this.start, this.landing, smoothStep(flight));
    } else {
      card.position.lerpVectors(this.landing, target, smoothStep(slide));
    }
    card.quaternion.slerpQuaternions(this.orientation, this.settled, easeOut(flight));
    card.scale.lerpVectors(this.scale, FULL_SIZE, smoothStep(flight));
    return slide === 1;
  }
}
