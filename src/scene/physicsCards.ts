import * as THREE from 'three';
import type { CardMesh } from './cards';
import { CARD_SIZE } from './cardGeometry';
import { TABLE_TOP } from './room';
import { GRAVITY, type PhysicsWorld } from './physicsWorld';

const UP = new THREE.Vector3(0, 1, 0);
const LAUNCH_SPEED_Y = 0.35;
const SETTLE_SECONDS = 0.65;
const CONTACT_MARGIN = 0.025;

interface Flight {
  elapsed: number;
  duration: number;
  target: THREE.Vector3;
}

/** Gravity handles a released card; guided collection keeps authoritative slots readable. */
export class PhysicsCards {
  private readonly flights = new Map<CardMesh, Flight>();
  private readonly orientation = new THREE.Quaternion();

  constructor(private readonly world: PhysicsWorld) {}

  add(card: CardMesh, landing?: THREE.Vector3): void {
    card.scale.setScalar(1);
    if (!landing) {
      this.world.addCard(card, false);
      return;
    }
    const target = this.safeLanding(landing);
    card.position.y = Math.max(card.position.y, TABLE_TOP + 0.08);
    card.quaternion.setFromAxisAngle(UP, card.targetRotation);
    this.world.addCard(card, true);
    const height = card.position.y - target.y;
    const duration = (LAUNCH_SPEED_Y + Math.sqrt(LAUNCH_SPEED_Y ** 2 + 2 * GRAVITY * height)) / GRAVITY;
    const velocity = target.clone().sub(card.position).divideScalar(duration);
    velocity.y = LAUNCH_SPEED_Y;
    this.world.setVelocity(card, velocity);
    this.flights.set(card, { elapsed: 0, duration, target: card.target.clone() });
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
    if (flight && this.isFlying(card, flight, deltaSeconds)) return;
    const slide = 1 - Math.exp(-deltaSeconds * 8);
    card.position.lerp(card.target, slide);
    this.orientation.setFromAxisAngle(UP, card === inspected ? 0 : card.targetRotation);
    card.quaternion.slerp(this.orientation, slide);
  }

  private isFlying(card: CardMesh, flight: Flight, deltaSeconds: number): boolean {
    flight.elapsed += deltaSeconds;
    // A host update collecting a trick may arrive while its final card is still in flight.
    const collecting = !flight.target.equals(card.target);
    const landed = flight.elapsed >= flight.duration && card.position.y <= TABLE_TOP + CONTACT_MARGIN;
    if (!collecting && !landed && flight.elapsed < flight.duration + SETTLE_SECONDS) return true;
    this.world.hold(card);
    this.flights.delete(card);
    return false;
  }

  remove(card: CardMesh): void {
    this.flights.delete(card);
    this.world.remove(card);
  }

  settle(card: CardMesh): void {
    this.world.hold(card);
    this.flights.delete(card);
  }

  dispose(): void {
    this.flights.clear();
  }
}
