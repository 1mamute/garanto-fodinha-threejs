/**
 * Camera placement for every mode, plus spectator walking.
 *
 * Each frame picks a target position, a point to look at and an "up" direction, then eases the
 * camera towards them. The target orientation is computed from the *target* position with the
 * target up vector and the camera rotation is slerped towards it. (Lerping `camera.up` itself used
 * to pass through zero when switching between opposite up vectors, which flipped the view.)
 */
import * as THREE from 'three';
import { WALK_OUTER_RADIUS } from './roomDimensions';
import { FIRST_PERSON_CAMERA } from './cameraSettings';
import type { InspectionCameraMode } from './types';

export const MIN_PITCH = -1.2;
export const MAX_PITCH = 1.15;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;
const DEFAULT_ZOOM = 4.8;
const TABLE_HEIGHT = 1.68;
const CARD_FRAME_MARGIN = 0.12;
const EYE_HEIGHT = 3.05;
const DEFAULT_PITCH = -0.436;
const WALK_SPEED = 2.7;
/** Spectators walk in the ring between the table and the walls. */
const WALK_INNER_RADIUS = 3;
const NARROW_SCREEN_PX = 700;
const VIEW_TRANSITION_SECONDS = 1.2;

interface ViewTransition {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  elapsed: number;
}

/** What the rig needs to know about the game for this frame. */
export interface FrameContext {
  mode: InspectionCameraMode;
  /** Card being inspected from above, if any. */
  inspected: THREE.Object3D | null;
  /** Watching instead of playing: walks freely and has no robot. */
  observer: boolean;
  /** Seat position of the player's robot, if seated. */
  seat: THREE.Vector3 | null;
  /** Target card footprint, including won tricks and the kicker. */
  tableBounds?: { radius: number; height: number };
}

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FIRST_PERSON_CAMERA.fieldOfView, 1, 0.04, 60);
  firstPersonZoom = 1;
  maxFirstPersonZoom: number = FIRST_PERSON_CAMERA.maxZoom;
  /** Head turn relative to facing the table centre. */
  yaw = 0;
  pitch = DEFAULT_PITCH;
  /** Height of the top view; changed by the wheel and pinch. */
  zoom = DEFAULT_ZOOM;
  orbitDistance = 4;
  readonly spectatorPosition = new THREE.Vector3(0, 2, 5.5);
  /** Walking direction from the on-screen joystick, each axis in [-1, 1]. */
  readonly joystick = { x: 0, y: 0 };
  /** Keyboard codes currently pressed. */
  readonly keys = new Set<string>();

  private readonly positionTarget = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly upTarget = new THREE.Vector3(0, 1, 0);
  /** Invisible camera used to compute the target rotation with `lookAt`. */
  private readonly aim = new THREE.PerspectiveCamera();
  private previousMode: InspectionCameraMode | null = null;
  private transition: ViewTransition | null = null;

  resetView(): void {
    this.yaw = 0;
    this.pitch = DEFAULT_PITCH;
    this.firstPersonZoom = 1;
  }

  addFirstPersonZoom(wheelDelta: number): void {
    const maximum = Number.isFinite(this.maxFirstPersonZoom) ? Math.max(1, this.maxFirstPersonZoom) : 1;
    const multiplier = Math.exp(-wheelDelta * FIRST_PERSON_CAMERA.wheelSensitivity);
    this.firstPersonZoom = THREE.MathUtils.clamp(this.firstPersonZoom * multiplier, 1, maximum);
  }

  get squint(): number {
    const range = this.maxFirstPersonZoom - 1;
    if (!Number.isFinite(range) || range <= 0) return 0;
    return THREE.MathUtils.clamp((this.firstPersonZoom - 1) / range, 0, 1);
  }

  addPitch(delta: number): void {
    this.pitch = THREE.MathUtils.clamp(this.pitch + delta, MIN_PITCH, MAX_PITCH);
  }

  addZoom(delta: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta, MIN_ZOOM, MAX_ZOOM);
  }

  addOrbitZoom(delta: number): void {
    this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance + delta, 0.7, 8);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds: number, blend: number, context: FrameContext): void {
    const snapToFirst = context.mode === 'first' && this.previousMode !== 'first';
    this.updateFieldOfView(context.mode === 'first' && !context.inspected, snapToFirst ? 1 : blend);
    this.chooseTargets(deltaSeconds, context);
    this.aim.position.copy(this.positionTarget);
    this.aim.up.copy(this.upTarget);
    this.aim.lookAt(this.lookTarget);
    this.updateTransition(context);
    if (snapToFirst) {
      this.camera.position.copy(this.positionTarget);
      this.camera.quaternion.copy(this.aim.quaternion);
    } else if (this.transition) this.animateTransition(deltaSeconds);
    else {
      this.camera.position.lerp(this.positionTarget, blend);
      this.camera.quaternion.slerp(this.aim.quaternion, blend);
    }
    this.camera.up.copy(this.upTarget);
  }

  private updateFieldOfView(firstPerson: boolean, blend: number): void {
    const base = FIRST_PERSON_CAMERA.fieldOfView;
    const magnification = firstPerson ? this.firstPersonZoom : 1;
    const halfAngle = Math.tan(THREE.MathUtils.degToRad(base / 2)) / magnification;
    const target = THREE.MathUtils.radToDeg(Math.atan(halfAngle)) * 2;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, target, blend);
    this.camera.updateProjectionMatrix();
  }

  private updateTransition(context: FrameContext): void {
    if (context.inspected?.parent) {
      this.transition = null;
      this.previousMode = null;
      return;
    }
    const previous = this.previousMode;
    this.previousMode = context.mode;
    if (previous === context.mode) return;
    this.transition = null;
    const ascending = previous === 'first' && context.mode === 'top';
    if (ascending) {
      this.transition = {
        position: this.camera.position.clone(),
        rotation: this.camera.quaternion.clone(),
        elapsed: 0,
      };
    }
  }

  private animateTransition(deltaSeconds: number): void {
    const transition = this.transition;
    if (!transition) return;
    transition.elapsed += deltaSeconds;
    const progress = Math.min(1, transition.elapsed / VIEW_TRANSITION_SECONDS);
    // One easing curve keeps translation and rotation continuous, with gentle starts and stops.
    const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
    this.camera.position.lerpVectors(transition.position, this.positionTarget, eased);
    this.camera.quaternion.slerpQuaternions(transition.rotation, this.aim.quaternion, eased);
    if (progress === 1) this.transition = null;
  }

  private chooseTargets(deltaSeconds: number, context: FrameContext): void {
    // Angle of the player's seat around the table; views are oriented from there.
    const seatAngle = context.seat ? Math.atan2(context.seat.x, context.seat.z) : 0;
    this.upTarget.set(0, 1, 0);
    if (context.mode === 'landing') this.aimLanding();
    else if (context.inspected?.parent) this.aimInspection(context.inspected);
    else if (context.mode === 'top') this.aimTop(seatAngle, context.tableBounds);
    else if (context.mode === 'third') this.aimThirdPerson(deltaSeconds);
    else this.aimFirstPerson(deltaSeconds, seatAngle, context);
  }

  private aimThirdPerson(deltaSeconds: number): void {
    this.walk(deltaSeconds, 0);
    this.lookTarget.copy(this.spectatorPosition).setY(1.3);
    const horizontal = Math.cos(this.pitch) * this.orbitDistance;
    this.positionTarget
      .copy(this.lookTarget)
      .add(
        new THREE.Vector3(
          Math.sin(this.yaw) * horizontal,
          -Math.sin(this.pitch) * this.orbitDistance,
          Math.cos(this.yaw) * horizontal,
        ),
      );
  }

  /** Home screen: the table seen from a corner, shifted so the menu does not cover it. */
  private aimLanding(): void {
    const narrow = innerWidth < NARROW_SCREEN_PX;
    this.positionTarget.set(narrow ? 5.4 : 6.4, 3.6, narrow ? 8 : 7.8);
    this.lookTarget.set(narrow ? 0 : -1.5, 1.65, 0);
  }

  /** Close-up above an inspected card, with the card's top edge pointing up on screen. */
  private aimInspection(card: THREE.Object3D): void {
    const point = card.getWorldPosition(new THREE.Vector3());
    this.positionTarget.copy(point).add(new THREE.Vector3(0.2, 1.45, 0.45));
    this.lookTarget.copy(point);
    this.upTarget.set(0, 0, -1);
  }

  /** Straight down on the table, rotated so the player's seat is at the bottom of the screen. */
  private aimTop(seatAngle: number, bounds: FrameContext['tableBounds']): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const cardDistance = bounds
      ? (bounds.radius + CARD_FRAME_MARGIN) / Math.tan(halfFov) + bounds.height - TABLE_HEIGHT
      : 0;
    // Fit card corners in the narrower screen dimension, rather than framing the whole room.
    const distance = Math.max(this.zoom - TABLE_HEIGHT, cardDistance);
    const height = TABLE_HEIGHT + distance / Math.min(1, this.camera.aspect);
    // A tiny z offset keeps the view direction from being exactly vertical.
    this.positionTarget.set(0, height, 0.001);
    this.lookTarget.set(0, TABLE_HEIGHT, 0);
    this.upTarget.set(-Math.sin(seatAngle), 0, -Math.cos(seatAngle));
  }

  private aimFirstPerson(deltaSeconds: number, seatAngle: number, context: FrameContext): void {
    if (context.observer) {
      this.walk(deltaSeconds, seatAngle);
      this.positionTarget.copy(this.spectatorPosition);
    } else {
      this.positionTarget.copy(context.seat ?? new THREE.Vector3(0, 0, 3.35)).setY(EYE_HEIGHT);
    }
    // Facing the table centre is the seat angle turned half a circle.
    const heading = seatAngle + this.yaw + Math.PI;
    const horizontal = Math.cos(this.pitch);
    const direction = new THREE.Vector3(
      Math.sin(heading) * horizontal,
      Math.sin(this.pitch),
      Math.cos(heading) * horizontal,
    );
    this.lookTarget.copy(this.positionTarget).add(direction);
  }

  /** WASD / joystick movement for spectators, relative to where they are looking. */
  private walk(deltaSeconds: number, seatAngle: number): void {
    const pressed = (code: string): number => (this.keys.has(code) ? 1 : 0);
    const forward = pressed('KeyW') - pressed('KeyS') - this.joystick.y;
    const sideways = pressed('KeyD') - pressed('KeyA') + this.joystick.x;
    if (forward === 0 && sideways === 0) return;
    // Diagonals are not faster than straight lines.
    const step = (WALK_SPEED * deltaSeconds) / Math.max(1, Math.hypot(forward, sideways));
    const heading = seatAngle + this.yaw + Math.PI;
    const next = this.spectatorPosition.clone();
    next.x += (Math.sin(heading) * forward - Math.cos(heading) * sideways) * step;
    next.z += (Math.cos(heading) * forward + Math.sin(heading) * sideways) * step;
    const distance = Math.hypot(next.x, next.z);
    if (distance > WALK_INNER_RADIUS && distance < WALK_OUTER_RADIUS) this.spectatorPosition.copy(next);
  }
}
