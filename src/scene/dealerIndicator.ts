import * as THREE from 'three';
import { morph } from '../ui/dom';
import { html } from '../ui/html';

const SCREEN_MARGIN = 0.72;

/** Screen direction stays meaningful even when the dealer's seat is outside the close-up. */
export function dealerDirection(camera: THREE.Camera, seat: THREE.Vector3): THREE.Vector2 {
  camera.updateMatrixWorld();
  const projected = seat.clone().setY(1.68).project(camera);
  return new THREE.Vector2(projected.x, -projected.y).normalize();
}

/** An overlay outside #app, so morphing game controls cannot remove the scene's marker. */
export class DealerIndicator {
  private readonly element = document.createElement('div');
  private readonly arrow: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly chipBounds = new THREE.Sphere();
  private name = '';

  constructor() {
    this.element.className = 'dealer-indicator';
    morph(
      this.element,
      html`<span class="dealer-indicator-arrow" aria-hidden="true">➜</span><span class="dealer-indicator-caption"></span>`,
    );
    const arrow = this.element.querySelector<HTMLElement>('.dealer-indicator-arrow');
    const caption = this.element.querySelector<HTMLElement>('.dealer-indicator-caption');
    if (!arrow || !caption) throw new Error('Dealer indicator elements are missing.');
    this.arrow = arrow;
    this.caption = caption;
    this.element.hidden = true;
    document.body.append(this.element);
  }

  update(options: {
    camera: THREE.PerspectiveCamera;
    seat: THREE.Vector3 | null;
    name: string;
    visible: boolean;
    chip?: THREE.Mesh;
  }): void {
    this.element.hidden = !options.visible || !options.seat || this.chipOnScreen(options);
    if (this.element.hidden || !options.seat) return;
    if (this.name !== options.name) {
      this.name = options.name;
      morph(this.caption, html`Dealer: ${options.name}`);
    }
    const direction = dealerDirection(options.camera, options.seat);
    // Convert to pixel direction before rotating, so portrait screens do not skew the arrow.
    const horizontal = direction.x * innerWidth;
    const vertical = direction.y * innerHeight;
    const edge = SCREEN_MARGIN / Math.max(Math.abs(direction.x), Math.abs(direction.y), 1);
    this.element.style.left = `${(1 + direction.x * edge) * 50}%`;
    this.element.style.top = `${(1 + direction.y * edge) * 50}%`;
    this.arrow.style.transform = `rotate(${Math.atan2(vertical, horizontal)}rad)`;
  }

  private chipOnScreen(options: { camera: THREE.Camera; chip?: THREE.Mesh }): boolean {
    const { camera, chip } = options;
    if (!chip?.visible) return false;
    chip.updateWorldMatrix(true, false);
    if (!chip.geometry.boundingSphere) chip.geometry.computeBoundingSphere();
    const bounds = chip.geometry.boundingSphere;
    if (!bounds) return false;
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    this.chipBounds.copy(bounds).applyMatrix4(chip.matrixWorld);
    // Any part of the coin in the viewport is enough to hide the duplicate indicator.
    return this.frustum.intersectsSphere(this.chipBounds);
  }
}
