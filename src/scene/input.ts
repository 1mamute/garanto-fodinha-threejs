/**
 * Pointer and keyboard input on the 3D canvas.
 *
 * First-person walking uses pointer lock on desktop and touch drags on mobile.
 * Seated players: dragging empty space looks around; dragging a card of your hand up plays it,
 * sideways reorders it. Top view: clicking (or hovering/holding for 2 s) a card inspects it,
 * the wheel or a pinch zooms.
 */
import type { CameraRig } from './cameraRig';
import type { Vector3 } from 'three';
import type { CardMesh } from './cards';
import { CardDrag } from './cardDrag';
import { SEATED_CAMERA } from './cameraSettings';
import { MouseLook } from './mouseLook';
import type { InspectionCameraMode, Pose } from './types';

const DRAG_THRESHOLD_PX = 7;
const LOOK_SPEED = 0.004;
/** Horizontal drag distance that moves a card one slot in the hand. */
const SLOT_WIDTH_PX = 35;
const HOLD_TO_INSPECT_MS = 2000;
const WHEEL_ZOOM = 0.008;
const PINCH_ZOOM = 0.025;
const POINTER_YAW = 0.65;
const POINTER_PITCH = 0.4;

/** What the input handler needs from the scene. */
export interface InputTarget {
  readonly mode: InspectionCameraMode;
  readonly inspected: CardMesh | null;
  readonly rig: CameraRig;
  /** First-person walking, in contrast to playing cards at a seat. */
  readonly freeLook: boolean;
  /** First card under the pointer; `hand` searches the first-person hand instead of the table. */
  pick(clientX: number, clientY: number, hand: boolean): CardMesh | undefined;
  inspect(card: CardMesh): void;
  clearInspection(): void;
  toggleMode(): void;
  /** A first-person hand card is being dragged (or was released). */
  reach(reaching: boolean): void;
  dropHandCard(card: CardMesh, tablePoint: Vector3 | null, slotShift: number): void;
  /** Called after any drag ends so state updates held back during it can be applied. */
  afterDrag(): void;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  card: CardMesh | undefined;
  startedAt: number;
}

export class SceneInput {
  drag: Drag | null = null;
  private hover: { card: CardMesh; since: number } | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance: number | null = null;
  private readonly pointerLook = { yaw: 0, pitch: 0 };
  private readonly mouseLook: MouseLook;
  private readonly cardDrag: CardDrag;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly target: InputTarget,
  ) {
    this.cardDrag = new CardDrag(target.rig.camera, canvas);
    this.mouseLook = new MouseLook({
      canvas,
      rig: target.rig,
      enabled: () => target.freeLook,
      onUnlock: () => {
        target.rig.keys.clear();
        this.resetPointerLook();
      },
    });
    canvas.addEventListener('pointerdown', event => {
      this.press(event);
    });
    canvas.addEventListener('pointermove', event => {
      this.move(event);
    });
    canvas.addEventListener('pointerup', event => {
      this.release(event);
    });
    canvas.addEventListener('pointercancel', event => {
      this.release(event);
    });
    canvas.addEventListener('pointerleave', () => {
      this.resetPointerLook();
    });
    window.addEventListener(
      'wheel',
      event => {
        // Pointer lock captures motion, but wheel events can still land on an overlaid panel.
        const captured = this.mouseLook.active && this.mouseLook.enabled;
        if (event.composedPath().includes(canvas) || captured) this.wheel(event);
      },
      { passive: false },
    );
    window.addEventListener('keydown', event => {
      this.keyDown(event);
    });
    window.addEventListener('keyup', event => target.rig.keys.delete(event.code));
    window.addEventListener('blur', () => {
      target.rig.keys.clear();
      target.rig.joystick.x = 0;
      target.rig.joystick.y = 0;
      this.drag = null;
      this.pointers.clear();
      target.reach(false);
      target.afterDrag();
      this.resetPointerLook();
    });
  }

  get draggedHandCard(): CardMesh | null {
    return this.target.mode === 'first' ? (this.drag?.card ?? null) : null;
  }

  /** Cursor gaze is independent of camera dragging and follows the same network pose. */
  get pose(): Pose {
    return {
      yaw: this.target.rig.yaw + this.pointerLook.yaw,
      pitch: this.target.rig.pitch + this.pointerLook.pitch,
      squint: this.target.mode === 'first' ? this.target.rig.squint : 0,
    };
  }

  private resetPointerLook(): void {
    this.pointerLook.yaw = 0;
    this.pointerLook.pitch = 0;
  }

  private updatePointerLook(event: PointerEvent): void {
    if (this.mouseLook.enabled) return;
    if (event.pointerType !== 'mouse') return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    this.pointerLook.yaw = -x * POINTER_YAW;
    this.pointerLook.pitch = -y * POINTER_PITCH;
  }

  /** Inspects a card after the pointer rested on it, or held it down, long enough. */
  checkLongPress(now: number): void {
    this.mouseLook.sync();
    if (this.hover && now - this.hover.since > HOLD_TO_INSPECT_MS) this.target.inspect(this.hover.card);
    const drag = this.drag;
    if (
      this.target.mode === 'top' &&
      drag?.card &&
      !drag.moved &&
      now - drag.startedAt > HOLD_TO_INSPECT_MS
    ) {
      this.target.inspect(drag.card);
    }
  }

  clearHover(): void {
    this.hover = null;
  }

  private press(event: PointerEvent): void {
    if (this.drag?.card && this.drag.pointerId !== event.pointerId) return;
    if (this.mouseLook.press(event)) return;
    const { target } = this;
    target.rig.cancelLookReturn();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    const card = target.pick(event.clientX, event.clientY, target.mode === 'first');
    const { clientX, clientY } = event;
    this.drag = {
      pointerId: event.pointerId,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      moved: false,
      card,
      startedAt: performance.now(),
    };
    if (card && target.mode === 'first') {
      this.cardDrag.begin(card, clientX, clientY);
      target.reach(true);
    }
    // Clicking beside the inspected card closes it.
    if (target.inspected && !target.pick(clientX, clientY, false)) target.clearInspection();
  }

  private move(event: PointerEvent): void {
    if (this.mouseLook.active) return;
    this.updatePointerLook(event);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2 && !this.drag?.card) {
      this.pinch();
      return;
    }
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) {
      // A mouse moving without a button pressed.
      this.pointers.delete(event.pointerId);
      this.updateHover(event);
      return;
    }
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > DRAG_THRESHOLD_PX)
      drag.moved = true;
    if (this.target.mode === 'first' || this.target.mode === 'third') this.dragFirstPerson(drag, event);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  }

  private dragFirstPerson(drag: Drag, event: PointerEvent): void {
    const { rig } = this.target;
    if (!drag.card) {
      rig.yaw -= (event.clientX - drag.lastX) * LOOK_SPEED;
      rig.addPitch(-(event.clientY - drag.lastY) * LOOK_SPEED);
      return;
    }
    this.cardDrag.move(drag.card, event.clientX, event.clientY);
    this.target.reach(true);
  }

  private pinch(): void {
    const [first, second] = [...this.pointers.values()];
    if (!first || !second) return;
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (this.pinchDistance !== null) this.target.rig.addZoom(-(distance - this.pinchDistance) * PINCH_ZOOM);
    this.pinchDistance = distance;
    this.hover = null;
  }

  private updateHover(event: PointerEvent): void {
    if (this.target.mode !== 'top' || this.target.inspected) return;
    const card = this.target.pick(event.clientX, event.clientY, false);
    if (card !== this.hover?.card) this.hover = card ? { card, since: performance.now() } : null;
    this.canvas.style.cursor = card ? 'zoom-in' : 'grab';
  }

  private release(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.pinchDistance = null;
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) return;
    this.drag = null;
    if (event.type !== 'pointercancel') this.finishDrag(drag, event);
    this.returnSeatedLook(drag);
    this.target.reach(false);
    this.target.afterDrag();
  }

  private returnSeatedLook(drag: Drag): void {
    if (!SEATED_CAMERA.returnOnLookRelease || drag.card) return;
    if (this.target.mode !== 'first' || this.target.freeLook) return;
    this.target.rig.returnOrientation();
    this.resetPointerLook();
  }

  private finishDrag(drag: Drag, event: PointerEvent): void {
    const { target } = this;
    if (!drag.card) return;
    if (target.mode === 'top' && !drag.moved) target.inspect(drag.card);
    if (target.mode === 'first' && drag.moved) {
      const slotShift = Math.round((event.clientX - drag.startX) / SLOT_WIDTH_PX);
      // The hand overlaps the felt in screen space; lateral motion must still reorder its cards.
      const tablePoint =
        drag.startY - event.clientY > DRAG_THRESHOLD_PX
          ? this.cardDrag.tablePoint(event.clientX, event.clientY)
          : null;
      target.dropHandCard(drag.card, tablePoint, slotShift);
    }
  }

  private wheel(event: WheelEvent): void {
    if (this.target.mode === 'first') {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      this.target.rig.addFirstPersonZoom(delta);
      return;
    }
    if (this.target.mode === 'third') {
      event.preventDefault();
      this.target.rig.addOrbitZoom(event.deltaY * WHEEL_ZOOM);
      return;
    }
    if (this.target.mode !== 'top') return;
    event.preventDefault();
    this.target.rig.addZoom(event.deltaY * WHEEL_ZOOM);
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') this.target.clearInspection();
    // Typing in the chat or a form must not move the camera.
    if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) this.target.toggleMode();
    }
    this.target.rig.keys.add(event.code);
  }
}
