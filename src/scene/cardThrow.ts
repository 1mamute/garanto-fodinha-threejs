import * as THREE from 'three';
import { CARD_MOTION, type CardMotionSettings } from './cardMotionSettings';
import { CardReturn } from './cardReturn';

const FLIGHT_SECONDS = 0.28;
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
  private returning: CardReturn | null = null;
  private readonly settings: CardMotionSettings;

  constructor(card: THREE.Object3D, landing: THREE.Vector3, settings: Partial<CardMotionSettings> = {}) {
    this.start = card.position.clone();
    this.orientation = card.quaternion.clone();
    this.scale = card.scale.clone();
    this.landing = landing.clone();
    this.settings = { ...CARD_MOTION, ...settings };
  }

  /** Returns true once the card has reached its final position exactly. */
  animate(card: THREE.Object3D, deltaSeconds: number, target: THREE.Vector3, rotation: number): boolean {
    if (this.returning) return this.returning.animate(card, deltaSeconds, target, rotation);
    this.elapsed += deltaSeconds;
    const flight = Math.min(1, this.elapsed / FLIGHT_SECONDS);
    this.settled.setFromAxisAngle(UP, rotation);
    if (flight < 1) {
      // A direct placement keeps the face readable, without a toss, bounce or extra wrist spin.
      card.position.lerpVectors(this.start, this.landing, smoothStep(flight));
    } else card.position.copy(this.landing);
    card.quaternion.slerpQuaternions(this.orientation, this.settled, easeOut(flight));
    card.scale.lerpVectors(this.scale, FULL_SIZE, smoothStep(flight));
    const returnAt = FLIGHT_SECONDS + this.settings.slideSeconds;
    if (this.elapsed <= returnAt) return false;
    const returnStep = Math.min(deltaSeconds, this.elapsed - returnAt);
    this.returning ??= new CardReturn(card, this.settings.returnSeconds);
    return this.returning.animate(card, returnStep, target, rotation);
  }
}
