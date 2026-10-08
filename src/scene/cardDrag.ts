import * as THREE from 'three';
import { TABLE_TOP } from './room';

const FELT_RADIUS = 2.65;

/** Keeps the grabbed point under the pointer, independently of viewport size and hand scale. */
export class CardDrag {
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane();
  private readonly point = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: Pick<HTMLCanvasElement, 'getBoundingClientRect'>,
  ) {}

  begin(card: THREE.Object3D, x: number, y: number): void {
    const centre = card.getWorldPosition(new THREE.Vector3());
    this.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), centre);
    this.setRay(x, y);
    if (this.ray.ray.intersectPlane(this.plane, this.point)) this.offset.copy(centre).sub(this.point);
  }

  move(card: THREE.Object3D, x: number, y: number): void {
    this.setRay(x, y);
    if (!card.parent || !this.ray.ray.intersectPlane(this.plane, this.point)) return;
    card.position.copy(card.parent.worldToLocal(this.point.add(this.offset)));
  }

  overTable(x: number, y: number): boolean {
    this.setRay(x, y);
    const table = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TABLE_TOP);
    const hit = this.ray.ray.intersectPlane(table, this.point);
    return Boolean(hit && Math.hypot(hit.x, hit.z) < FELT_RADIUS);
  }

  private setRay(x: number, y: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.updateWorldMatrix(true, false);
    this.ray.setFromCamera(
      new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2),
      this.camera,
    );
  }
}
