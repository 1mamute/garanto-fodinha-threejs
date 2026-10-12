import * as THREE from 'three';
import { morph } from '../ui/dom';
import { html } from '../ui/html';
import { TURN_INDICATOR } from './turnIndicatorSettings';

export interface TurnMarkerPosition {
  left: number;
  top: number;
  angle: number;
  offscreen: boolean;
}

/** Camera-space direction handles seats behind the camera without flipping left and right. */
export function turnMarkerPosition(options: {
  camera: THREE.Camera;
  seat: THREE.Vector3;
  aspect: number;
}): TurnMarkerPosition {
  const { camera, seat, aspect } = options;
  camera.updateMatrixWorld();
  const anchor = seat.clone().setY(TURN_INDICATOR.markerHeight);
  const view = anchor.clone().applyMatrix4(camera.matrixWorldInverse);
  const projected = anchor.project(camera);
  const margin = TURN_INDICATOR.screenMargin;
  const onScreen = view.z < 0 && Math.abs(projected.x) < margin && Math.abs(projected.y) < margin;
  if (onScreen) {
    return {
      left: (1 + projected.x) * 50,
      top: (1 - projected.y) * 50,
      angle: Math.PI / 2,
      offscreen: false,
    };
  }
  const direction = new THREE.Vector2(view.x / aspect, -view.y);
  // A seat directly behind the viewer has no lateral direction; point back along the bottom edge.
  if (view.z >= 0) direction.y = Math.abs(direction.y);
  if (direction.lengthSq() === 0) direction.set(0, 1);
  direction.multiplyScalar(margin / Math.max(Math.abs(direction.x), Math.abs(direction.y)));
  return {
    left: (1 + direction.x) * 50,
    top: (1 + direction.y) * 50,
    angle: Math.atan2(direction.y, direction.x * aspect),
    offscreen: true,
  };
}

/** One DOM marker follows the active seat; it never intercepts card or camera input. */
export class TurnIndicator {
  private readonly element = document.createElement('div');
  private readonly arrow: HTMLElement;
  private readonly caption: HTMLElement;
  private text = '';

  constructor() {
    this.element.className = 'turn-indicator';
    this.element.style.setProperty('--turn-color', TURN_INDICATOR.color);
    this.element.setAttribute('aria-hidden', 'true');
    morph(
      this.element,
      html`<span class="turn-indicator-caption"></span><span class="turn-indicator-arrow">➜</span>`,
    );
    const arrow = this.element.querySelector<HTMLElement>('.turn-indicator-arrow');
    const caption = this.element.querySelector<HTMLElement>('.turn-indicator-caption');
    if (!arrow || !caption) throw new Error('Turn indicator elements are missing.');
    this.arrow = arrow;
    this.caption = caption;
    this.element.hidden = true;
    document.body.append(this.element);
  }

  hide(): void {
    this.element.hidden = true;
  }

  update(options: {
    camera: THREE.PerspectiveCamera;
    seat: THREE.Vector3 | null;
    text: string;
    visible: boolean;
    /** The laboratory keeps its preview enabled even when the game's shared toggle is off. */
    enabled?: boolean;
  }): void {
    this.element.hidden = !(options.enabled ?? TURN_INDICATOR.enabled) || !options.visible || !options.seat;
    if (this.element.hidden || !options.seat) return;
    if (this.text !== options.text) {
      this.text = options.text;
      this.caption.textContent = options.text;
    }
    const position = turnMarkerPosition({
      camera: options.camera,
      seat: options.seat,
      aspect: options.camera.aspect,
    });
    this.element.classList.toggle('offscreen', position.offscreen);
    this.element.style.left = `${position.left}%`;
    this.element.style.top = `${position.top}%`;
    this.arrow.style.transform = `rotate(${position.angle}rad)`;
  }
}
