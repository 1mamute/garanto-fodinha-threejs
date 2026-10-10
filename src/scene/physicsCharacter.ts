import type Jolt from 'jolt-physics';
import * as THREE from 'three';
import { MOVING_LAYER } from './physicsLayers';
import { GRAVITY, PHYSICS_STEP, type PhysicsWorld } from './physicsWorld';
import { ROBOT_DIMENSIONS } from './robotDimensions';

const CHARACTER_RADIUS = 0.55;
const CHARACTER_HEIGHT = 3.5;
const MAX_MOVE_SECONDS = 0.1;

/** A grounded capsule slides along furniture and walls instead of passing through them. */
export class PhysicsCharacter {
  private readonly character: Jolt.CharacterVirtual;
  private readonly broadPhase: Jolt.DefaultBroadPhaseLayerFilter;
  private readonly layers: Jolt.DefaultObjectLayerFilter;
  private readonly bodyFilter: Jolt.BodyFilter;
  private readonly shapeFilter: Jolt.ShapeFilter;
  private readonly position: Jolt.RVec3;
  private readonly velocity: Jolt.Vec3;
  private readonly gravity: Jolt.Vec3;
  private readonly result = new THREE.Vector3();
  private disposed = false;

  constructor(
    private readonly world: PhysicsWorld,
    start: THREE.Vector3,
  ) {
    const { runtime, system } = world;
    const settings = new runtime.CharacterVirtualSettings();
    settings.mShape = new runtime.CapsuleShape(
      (CHARACTER_HEIGHT - CHARACTER_RADIUS * 2) / 2,
      CHARACTER_RADIUS,
    );
    settings.mShapeOffset.Set(0, CHARACTER_HEIGHT / 2, 0);
    settings.mMaxSlopeAngle = Math.PI / 4;
    settings.mCharacterPadding = 0.01;
    settings.mPredictiveContactDistance = 0.03;
    settings.mMaxStrength = 80;
    this.position = new runtime.RVec3(start.x, start.y - ROBOT_DIMENSIONS.eyeHeight, start.z);
    const rotation = new runtime.Quat(0, 0, 0, 1);
    this.character = new runtime.CharacterVirtual(
      settings,
      this.position,
      rotation,
      system.GetPhysicsSystem(),
    );
    runtime.destroy(settings);
    runtime.destroy(rotation);
    this.broadPhase = new runtime.DefaultBroadPhaseLayerFilter(
      system.GetObjectVsBroadPhaseLayerFilter(),
      MOVING_LAYER,
    );
    this.layers = new runtime.DefaultObjectLayerFilter(system.GetObjectLayerPairFilter(), MOVING_LAYER);
    this.bodyFilter = new runtime.BodyFilter();
    this.shapeFilter = new runtime.ShapeFilter();
    this.velocity = new runtime.Vec3();
    this.gravity = new runtime.Vec3(0, -GRAVITY, 0);
  }

  readonly move = (from: THREE.Vector3, next: THREE.Vector3, deltaSeconds: number): THREE.Vector3 => {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return from;
    this.position.Set(from.x, from.y - ROBOT_DIMENSIONS.eyeHeight, from.z);
    this.character.SetPosition(this.position);
    const duration = Math.min(deltaSeconds, MAX_MOVE_SECONDS);
    const steps = Math.ceil(duration / PHYSICS_STEP);
    const step = duration / steps;
    const x = (next.x - from.x) / deltaSeconds;
    const z = (next.z - from.z) / deltaSeconds;
    for (let index = 0; index < steps; index++) this.advance({ x, z, step });
    const position = this.character.GetPosition();
    return this.result.set(position.GetX(), position.GetY() + ROBOT_DIMENSIONS.eyeHeight, position.GetZ());
  };

  private advance({ x, z, step }: { x: number; z: number; step: number }): void {
    const vertical = this.character.IsSupported()
      ? -0.2
      : this.character.GetLinearVelocity().GetY() - GRAVITY * step;
    this.velocity.Set(x, vertical, z);
    this.character.SetLinearVelocity(this.velocity);
    this.character.Update(
      step,
      this.gravity,
      this.broadPhase,
      this.layers,
      this.bodyFilter,
      this.shapeFilter,
      this.world.system.GetTempAllocator(),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    const runtime = this.world.runtime;
    runtime.destroy(this.character);
    runtime.destroy(this.broadPhase);
    runtime.destroy(this.layers);
    runtime.destroy(this.bodyFilter);
    runtime.destroy(this.shapeFilter);
    runtime.destroy(this.position);
    runtime.destroy(this.velocity);
    runtime.destroy(this.gravity);
    this.disposed = true;
  }
}
