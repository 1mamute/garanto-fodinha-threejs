import * as THREE from 'three';
import type { CardMesh } from './cards';
import { CARD_SIZE } from './cardGeometry';
import { CARD_MOTION, type CardMotionSettings } from './cardMotionSettings';
import { CardReturn } from './cardReturn';
import { TABLE_TOP } from './room';
import { GRAVITY, type PhysicsWorld } from './physicsWorld';

const UP = new THREE.Vector3(0, 1, 0);
const FLIGHT_TIMEOUT_SECONDS = 1.5;
const CONTACT_MARGIN = 0.025;

interface Flight {
  elapsed: number;
  duration: number;
  target: THREE.Vector3;
  landedAt: number | null;
}

/** Gravity handles a released card; guided collection keeps authoritative slots readable. */
export class PhysicsCards {
  private readonly flights = new Map<CardMesh, Flight>();
  private readonly returns = new Map<CardMesh, CardReturn>();
  private readonly targets = new Map<CardMesh, THREE.Vector3>();
  private readonly orientation = new THREE.Quaternion();
  private readonly settings: CardMotionSettings;

  constructor(
    private readonly world: PhysicsWorld,
    settings: Partial<CardMotionSettings> = {},
  ) {
    this.settings = { ...CARD_MOTION, ...settings };
  }

  add(card: CardMesh, landing?: THREE.Vector3, dragVelocity = new THREE.Vector3()): void {
    card.scale.setScalar(1);
    this.flights.delete(card);
    this.returns.delete(card);
    this.targets.set(card, card.target.clone());
    if (!landing) {
      this.world.addCard(card, false, this.settings);
      return;
    }
    const target = this.safeLanding(landing);
    card.position.y = Math.max(card.position.y, TABLE_TOP + 0.08);
    card.quaternion.setFromAxisAngle(UP, card.targetRotation);
    this.world.addCard(card, true, this.settings);
    const { velocity, duration } = this.launch(card.position, target, dragVelocity);
    this.world.setVelocity(card, velocity);
    this.flights.set(card, { elapsed: 0, duration, target: card.target.clone(), landedAt: null });
  }

  private launch(
    start: THREE.Vector3,
    target: THREE.Vector3,
    dragVelocity: THREE.Vector3,
  ): { velocity: THREE.Vector3; duration: number } {
    const settings = this.settings;
    const impulse = dragVelocity.clone().setY(0).clampLength(0, settings.maxDragSpeed);
    const verticalSpeed = -settings.dropSpeed - impulse.length() * settings.impactSpeedGain;
    const height = start.y - target.y;
    const duration = (verticalSpeed + Math.sqrt(verticalSpeed ** 2 + 2 * GRAVITY * height)) / GRAVITY;
    // Aim supplies a gentle placement; the player's recent gesture adds real momentum and impact.
    const velocity = target.clone().sub(start).divideScalar(duration).setY(0);
    velocity.addScaledVector(impulse, settings.dragVelocityGain).clampLength(0, settings.maxLaunchSpeed);
    velocity.y = verticalSpeed;
    return { velocity, duration };
  }

  private safeLanding(landing: THREE.Vector3): THREE.Vector3 {
    const target = landing.clone();
    // Pointer releases near the rail must leave room for the whole card on the felt.
    const maximumRadius = 2.65 - Math.hypot(CARD_SIZE.width, CARD_SIZE.depth) / 2 - 0.05;
    const radius = Math.hypot(target.x, target.z);
    if (radius > maximumRadius) target.multiplyScalar(maximumRadius / radius);
    return target.setY(TABLE_TOP);
  }

  animate(card: CardMesh, deltaSeconds: number, inspected: THREE.Object3D | null): void {
    const flight = this.flights.get(card);
    if (flight && this.isFree(card, flight, deltaSeconds)) return;
    if (!this.targets.get(card)?.equals(card.target)) this.startReturn(card);
    const returning = this.returns.get(card);
    const rotation = card === inspected ? 0 : card.targetRotation;
    if (returning) {
      if (returning.animate(card, deltaSeconds, card.target, rotation)) this.returns.delete(card);
      return;
    }
    const slide = 1 - Math.exp(-deltaSeconds * 2);
    card.position.lerp(card.target, slide);
    this.orientation.setFromAxisAngle(UP, rotation);
    card.quaternion.slerp(this.orientation, slide);
  }

  private isFree(card: CardMesh, flight: Flight, deltaSeconds: number): boolean {
    flight.elapsed += deltaSeconds;
    // A host update collecting a trick may arrive while its final card is still in flight.
    const collecting = !flight.target.equals(card.target);
    const landed = flight.elapsed >= flight.duration && card.position.y <= TABLE_TOP + CONTACT_MARGIN;
    if (landed && flight.landedAt === null) flight.landedAt = flight.elapsed;
    const waiting =
      flight.landedAt === null
        ? flight.elapsed < flight.duration + FLIGHT_TIMEOUT_SECONDS
        : flight.elapsed - flight.landedAt < this.settings.slideSeconds;
    if (!collecting && waiting) return true;
    this.startReturn(card);
    return false;
  }

  private startReturn(card: CardMesh): void {
    this.world.hold(card);
    this.flights.delete(card);
    this.targets.set(card, card.target.clone());
    this.returns.set(card, new CardReturn(card, this.settings.returnSeconds));
  }

  remove(card: CardMesh): void {
    this.flights.delete(card);
    this.returns.delete(card);
    this.targets.delete(card);
    this.world.remove(card);
  }

  settle(card: CardMesh): void {
    this.world.hold(card);
    this.flights.delete(card);
    this.returns.delete(card);
    this.targets.set(card, card.target.clone());
  }

  dispose(): void {
    this.flights.clear();
    this.returns.clear();
    this.targets.clear();
  }
}
