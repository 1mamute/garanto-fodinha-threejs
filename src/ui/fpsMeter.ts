import { FPS_METER } from '../config/fpsMeterSettings';
import { fpsMeterEnabled, onFpsMeterChange } from './fpsMeterPreference';

/** Counts completed scene frames, including frame pacing, rather than animation callbacks. */
export class FpsMeter {
  private readonly element = document.createElement('div');
  private readonly unsubscribe: () => void;
  private sampleStart: number | null = null;
  private frames = 0;
  private readonly resetSample = (): void => {
    this.sampleStart = null;
    this.frames = 0;
    this.element.textContent = 'FPS: —';
  };

  constructor() {
    this.element.className = 'fps-meter';
    this.element.setAttribute('aria-label', 'Quadros por segundo');
    this.element.hidden = !fpsMeterEnabled();
    this.resetSample();
    document.body.append(this.element);
    this.unsubscribe = onFpsMeterChange(enabled => {
      this.element.hidden = !enabled;
      this.resetSample();
    });
    // Discard the background interval so returning to the tab cannot skew the reading.
    document.addEventListener('visibilitychange', this.resetSample);
  }

  frame(): void {
    if (this.element.hidden || document.hidden) return;
    const now = performance.now();
    if (this.sampleStart === null) {
      this.sampleStart = now;
      return;
    }
    this.frames++;
    const elapsed = now - this.sampleStart;
    if (elapsed < FPS_METER.sampleIntervalMs) return;
    this.element.textContent = `FPS: ${Math.round((this.frames * 1000) / elapsed)}`;
    this.sampleStart = now;
    this.frames = 0;
  }

  dispose(): void {
    this.unsubscribe();
    document.removeEventListener('visibilitychange', this.resetSample);
    this.element.remove();
  }
}
