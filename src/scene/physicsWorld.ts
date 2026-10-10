import type Jolt from 'jolt-physics';
import * as THREE from 'three';
import { CARD_SIZE } from './cardGeometry';
import { CardMesh } from './cards';
import { CARD_MOTION, type CardMotionSettings } from './cardMotionSettings';
import { createPhysicsSystem, MOVING_LAYER, STATIC_LAYER } from './physicsLayers';
import { boxShape, furnitureShape, meshShape, robotMeshShape } from './physicsShapes';

export const PHYSICS_STEP = 1 / 60;
export const GRAVITY = 9.81;
const MAX_FRAME_SECONDS = 0.1;
type Motion = 'static' | 'kinematic' | 'dynamic';

interface BodyRecord {
  body: Jolt.Body;
  object: THREE.Object3D;
  motion: Motion;
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh;
}

/** Owns native bodies and the fixed simulation clock; visual physics never changes game state. */
export class PhysicsWorld {
  readonly system: Jolt.JoltInterface;
  readonly bodies: Jolt.BodyInterface;
  private readonly records = new Map<THREE.Object3D, BodyRecord>();
  private readonly position: Jolt.RVec3;
  private readonly rotation: Jolt.Quat;
  private readonly velocity: Jolt.Vec3;
  private readonly worldPosition = new THREE.Vector3();
  private readonly worldRotation = new THREE.Quaternion();
  private accumulator = 0;
  private disposed = false;

  constructor(readonly runtime: typeof Jolt) {
    this.system = createPhysicsSystem(runtime);
    this.bodies = this.system.GetPhysicsSystem().GetBodyInterface();
    this.position = new runtime.RVec3();
    this.rotation = new runtime.Quat(0, 0, 0, 1);
    this.velocity = new runtime.Vec3(0, -GRAVITY, 0);
    this.system.GetPhysicsSystem().SetGravity(this.velocity);
  }

  get bodyCount(): number {
    return this.records.size;
  }

  addSolids(root: THREE.Object3D): void {
    root.traverse(object => {
      if (!isMesh(object)) return;
      const shape = meshShape(this.runtime, object.geometry);
      if (shape) this.addBody(object, shape, 'static');
    });
  }

  addRobot(root: THREE.Object3D): void {
    root.traverse(object => {
      // The merged shells and limbs are solid; eyes, paint and held cards are details.
      if (isMesh(object) && object.geometry.type === 'BufferGeometry') {
        this.addBody(object, robotMeshShape(this.runtime, object), 'kinematic');
      }
    });
  }

  addCard(object: THREE.Object3D, dynamic: boolean, settings: CardMotionSettings = CARD_MOTION): void {
    const { width, height, depth } = CARD_SIZE;
    const scale = object.getWorldScale(new THREE.Vector3());
    const extent = new THREE.Vector3(width, height, depth).multiply(scale).multiplyScalar(0.5);
    const shape = boxShape(this.runtime, extent);
    this.addBody(object, shape, dynamic ? 'dynamic' : 'kinematic', settings);
  }

  syncHand(root: THREE.Group): void {
    for (const child of root.children) {
      if (child instanceof CardMesh && !this.records.has(child)) this.addCard(child, false);
    }
  }

  addChair(object: THREE.Group, movable = false): void {
    this.addBody(object, furnitureShape(this.runtime, object), movable ? 'dynamic' : 'static');
  }

  addBody(
    object: THREE.Object3D,
    shape: Jolt.Shape,
    motion: Motion,
    card: CardMotionSettings | false = false,
  ): void {
    this.remove(object);
    this.readTransform(object);
    const runtime = this.runtime;
    const motionTypes = {
      static: runtime.EMotionType_Static,
      kinematic: runtime.EMotionType_Kinematic,
      dynamic: runtime.EMotionType_Dynamic,
    };
    const layer = motion === 'static' ? STATIC_LAYER : MOVING_LAYER;
    const settings = new runtime.BodyCreationSettings(
      shape,
      this.position,
      this.rotation,
      motionTypes[motion],
      layer,
    );
    shape.Release();
    settings.mFriction = card ? card.friction : 0.8;
    settings.mRestitution = card ? 0.04 : 0;
    if (card) this.configureCard(settings, card);
    else if (motion === 'dynamic') {
      settings.mOverrideMassProperties = runtime.EOverrideMassProperties_CalculateInertia;
      settings.mMassPropertiesOverride.mMass = 8;
      settings.mAngularDamping = 0.5;
    }
    const body = this.bodies.CreateBody(settings);
    runtime.destroy(settings);
    this.bodies.AddBody(body.GetID(), runtime.EActivation_Activate);
    this.records.set(object, { body, object, motion });
  }

  private configureCard(settings: Jolt.BodyCreationSettings, motion: CardMotionSettings): void {
    const runtime = this.runtime;
    settings.mOverrideMassProperties = runtime.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = 0.002;
    settings.mMotionQuality = runtime.EMotionQuality_LinearCast;
    settings.mLinearDamping = motion.linearDamping;
    // Cards stay readable, while translation, gravity, friction and contact are simulated.
    settings.mAllowedDOFs =
      runtime.EAllowedDOFs_TranslationX |
      runtime.EAllowedDOFs_TranslationY |
      runtime.EAllowedDOFs_TranslationZ;
  }

  setVelocity(object: THREE.Object3D, velocity: THREE.Vector3): void {
    const record = this.records.get(object);
    if (!record) return;
    this.velocity.Set(velocity.x, velocity.y, velocity.z);
    this.bodies.SetLinearVelocity(record.body.GetID(), this.velocity);
  }

  hold(object: THREE.Object3D): void {
    const record = this.records.get(object);
    if (!record || record.motion === 'kinematic') return;
    this.bodies.SetMotionType(
      record.body.GetID(),
      this.runtime.EMotionType_Kinematic,
      this.runtime.EActivation_Activate,
    );
    record.motion = 'kinematic';
    this.setVelocity(object, new THREE.Vector3());
  }

  remove(object: THREE.Object3D): void {
    const record = this.records.get(object);
    if (!record) return;
    const bodyId = record.body.GetID();
    this.bodies.RemoveBody(bodyId);
    this.bodies.DestroyBody(bodyId);
    this.records.delete(object);
  }

  removeObject(root: THREE.Object3D): void {
    root.traverse(object => {
      this.remove(object);
    });
  }

  step(deltaSeconds: number): void {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.syncKinematics();
    this.accumulator += Math.min(MAX_FRAME_SECONDS, deltaSeconds);
    while (this.accumulator + Number.EPSILON >= PHYSICS_STEP) {
      this.system.Step(PHYSICS_STEP, 1);
      this.accumulator -= PHYSICS_STEP;
    }
    for (const record of this.records.values()) {
      if (record.motion === 'dynamic') this.writeTransform(record);
    }
  }

  private readTransform(object: THREE.Object3D): void {
    object.getWorldPosition(this.worldPosition);
    object.getWorldQuaternion(this.worldRotation);
    const { x, y, z } = this.worldPosition;
    this.position.Set(x, y, z);
    const rotation = this.worldRotation;
    this.rotation.Set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  private syncKinematics(): void {
    for (const record of this.records.values()) {
      if (record.motion !== 'kinematic') continue;
      if (!record.object.parent) {
        this.remove(record.object);
        continue;
      }
      this.readTransform(record.object);
      this.bodies.SetPositionAndRotationWhenChanged(
        record.body.GetID(),
        this.position,
        this.rotation,
        this.runtime.EActivation_Activate,
      );
    }
  }

  private writeTransform({ object, body }: BodyRecord): void {
    const position = body.GetPosition();
    const rotation = body.GetRotation();
    this.worldPosition.set(position.GetX(), position.GetY(), position.GetZ());
    this.worldRotation.set(rotation.GetX(), rotation.GetY(), rotation.GetZ(), rotation.GetW());
    if (object.parent) {
      object.parent.worldToLocal(this.worldPosition);
      const parentRotation = object.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.worldRotation.premultiply(parentRotation);
    }
    object.position.copy(this.worldPosition);
    object.quaternion.copy(this.worldRotation);
  }

  dispose(): void {
    if (this.disposed) return;
    for (const object of this.records.keys()) this.remove(object);
    this.runtime.destroy(this.position);
    this.runtime.destroy(this.rotation);
    this.runtime.destroy(this.velocity);
    this.runtime.destroy(this.system);
    this.disposed = true;
  }
}
