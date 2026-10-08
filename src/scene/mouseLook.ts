/** Pointer lock for walking in first person; seated players keep their card cursor. */
import type { CameraRig } from './cameraRig';

const LOOK_SPEED = 0.004;

interface MouseLookOptions {
  canvas: HTMLCanvasElement;
  rig: CameraRig;
  enabled: () => boolean;
  onUnlock: () => void;
}

export class MouseLook {
  private readonly prompt = document.createElement('button');
  private readonly desktop = matchMedia('(pointer: fine)');
  private pending = false;

  constructor(private readonly options: MouseLookOptions) {
    this.prompt.className = 'mouse-look-prompt';
    this.prompt.textContent = 'Clique para olhar com o mouse · Esc libera o cursor';
    this.prompt.hidden = true;
    this.prompt.addEventListener('click', () => {
      this.request();
    });
    document.body.append(this.prompt);
    document.addEventListener('mousemove', event => {
      if (!this.active || !this.enabled) return;
      options.rig.yaw -= event.movementX * LOOK_SPEED;
      options.rig.addPitch(-event.movementY * LOOK_SPEED);
    });
    document.addEventListener('pointerlockchange', () => {
      this.pending = false;
      options.onUnlock();
      this.sync();
    });
    document.addEventListener('pointerlockerror', () => {
      this.failed();
    });
    window.addEventListener('blur', () => {
      this.release();
    });
    this.desktop.addEventListener('change', () => {
      this.sync();
    });
    this.sync();
  }

  get enabled(): boolean {
    return this.desktop.matches && this.options.enabled();
  }

  get active(): boolean {
    return document.pointerLockElement === this.options.canvas;
  }

  /** Browsers require a user gesture; the first click captures without starting a drag. */
  press(event: PointerEvent): boolean {
    if (event.pointerType !== 'mouse' || !this.enabled) return false;
    if (event.button === 0) this.request();
    return true;
  }

  sync(): void {
    if (!this.enabled) this.release();
    this.prompt.hidden = !this.enabled || this.active;
    this.prompt.disabled = this.pending;
  }

  release(): void {
    if (this.active) document.exitPointerLock();
  }

  private request(): void {
    if (!this.enabled || this.active || this.pending) return;
    this.pending = true;
    try {
      void Promise.resolve(this.options.canvas.requestPointerLock()).catch(() => {
        this.failed();
      });
    } catch {
      this.failed();
    }
    this.sync();
  }

  private failed(): void {
    this.pending = false;
    this.prompt.textContent = 'Clique para tentar capturar o mouse novamente';
    this.sync();
  }
}
