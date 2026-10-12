import { watchSettings } from '../config/hotSettings';
import { TABLE_VIEW } from '../config/cameraSettings';
import * as THREE from 'three';
import { FIRST_PERSON_CAMERA, TABLE_CAMERA } from '../config/cameraSettings';
import { ROOM_DIMENSIONS } from '../config/roomSettings';

/** Stay below the lamp's lower disc, including the near clipping plane. */

interface TableViewOptions {
  zoom: number;
  aspect: number;
  bounds: { radius: number; height: number } | undefined;
}

interface TableReturn {
  offset: THREE.Vector2;
  elapsed: number;
}

/** Top-view framing and temporary panning, shared by the game and inspection scene. */
export class TableCamera {
  private inclination = 0;
  private readonly offset = new THREE.Vector2();
  private returning: TableReturn | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_VIEW.TABLE_VIEW_HEIGHT);

  constructor() {
    this.angleDegrees = TABLE_CAMERA.angleDegrees;
    watchSettings(this, (camera, category) => {
      if (category !== 'cameraSettings') return;
      camera.angleDegrees = TABLE_CAMERA.angleDegrees;
      camera.plane.constant = -TABLE_VIEW.TABLE_VIEW_HEIGHT;
    });
  }

  get angleDegrees(): number {
    return this.inclination;
  }

  set angleDegrees(value: number) {
    if (Number.isFinite(value))
      this.inclination = THREE.MathUtils.clamp(value, 0, TABLE_CAMERA.maxAngleDegrees);
  }

  beginDrag(): void {
    this.returning = null;
  }

  /** Ground intersections keep a drag aligned with the screen at every seat, angle and zoom. */
  pan(camera: THREE.PerspectiveCamera, from: THREE.Vector2, to: THREE.Vector2): void {
    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(from, camera);
    const start = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    this.raycaster.setFromCamera(to, camera);
    const end = this.raycaster.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!start || !end) return;
    this.beginDrag();
    this.offset.x += start.x - end.x;
    this.offset.y += start.z - end.z;
    this.offset.clampLength(0, ROOM_DIMENSIONS.TABLE_RADIUS);
  }

  release(): void {
    this.returning = { offset: this.offset.clone(), elapsed: 0 };
  }

  reset(): void {
    this.offset.set(0, 0);
    this.returning = null;
  }

  update(deltaSeconds: number, active: boolean): void {
    if (!active) this.reset();
    const returning = this.returning;
    if (!returning) return;
    returning.elapsed += deltaSeconds;
    const progress = Math.min(1, returning.elapsed / Math.max(0.01, TABLE_CAMERA.returnDurationSeconds));
    this.offset.copy(returning.offset).multiplyScalar(1 - THREE.MathUtils.smootherstep(progress, 0, 1));
    if (progress === 1) this.reset();
  }

  aim(position: THREE.Vector3, target: THREE.Vector3, seatAngle: number, height: number): void {
    const distance =
      (height - TABLE_VIEW.TABLE_VIEW_HEIGHT) * Math.tan(THREE.MathUtils.degToRad(this.inclination));
    target.set(this.offset.x, TABLE_VIEW.TABLE_VIEW_HEIGHT, this.offset.y);
    position.set(
      target.x + Math.sin(seatAngle) * distance,
      height,
      target.z + Math.cos(seatAngle) * distance,
    );
  }

  layout({ zoom, aspect, bounds }: TableViewOptions): { height: number; fieldOfView: number } {
    const halfFov = THREE.MathUtils.degToRad(FIRST_PERSON_CAMERA.fieldOfView / 2);
    const cardDistance = bounds
      ? (bounds.radius + TABLE_VIEW.CARD_FRAME_MARGIN) / Math.tan(halfFov) +
        bounds.height -
        TABLE_VIEW.TABLE_VIEW_HEIGHT
      : 0;
    const initialDistance = TABLE_VIEW.DEFAULT_TABLE_ZOOM - TABLE_VIEW.TABLE_VIEW_HEIGHT;
    const zoomRatio = (zoom - TABLE_VIEW.TABLE_VIEW_HEIGHT) / initialDistance;
    const requestedDistance = (Math.max(initialDistance, cardDistance) * zoomRatio) / Math.min(1, aspect);
    const height = Math.min(TABLE_VIEW.MAX_VIEW_HEIGHT, TABLE_VIEW.TABLE_VIEW_HEIGHT + requestedDistance);
    const cardHeight = bounds?.height ?? TABLE_VIEW.TABLE_VIEW_HEIGHT;
    const baseline = (Math.tan(halfFov) * requestedDistance) / (height - cardHeight);
    const radius =
      ((bounds?.radius ?? initialDistance * Math.tan(halfFov)) + TABLE_VIEW.CARD_FRAME_MARGIN) * zoomRatio;
    const tilted = this.framingAngle({ height, cardHeight, radius, aspect });
    return { height, fieldOfView: THREE.MathUtils.radToDeg(Math.atan(Math.max(baseline, tilted))) * 2 };
  }

  private framingAngle(options: {
    height: number;
    cardHeight: number;
    radius: number;
    aspect: number;
  }): number {
    const { height, cardHeight, radius, aspect } = options;
    const angle = THREE.MathUtils.degToRad(this.inclination);
    const raised = cardHeight - TABLE_VIEW.TABLE_VIEW_HEIGHT;
    const depth = (height - TABLE_VIEW.TABLE_VIEW_HEIGHT) / Math.cos(angle) - raised * Math.cos(angle);
    // A box enclosing the footprint also fits the near edge, which grows under perspective tilt.
    const nearestDepth = depth - radius * Math.sin(angle);
    const vertical = radius * Math.cos(angle) + raised * Math.sin(angle);
    return Math.max(vertical, radius / aspect) / nearestDepth;
  }
}
