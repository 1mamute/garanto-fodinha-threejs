import { RENDER_BUDGET } from '../config/graphicsSettings';
/** Frame pacing and a conservative, one-way resolution fallback for slower GPUs. */
export class RenderBudget {
  private lastFrame = -1;
  private sampleStart = -1;
  private frames = 0;
  private scale = 1;

  constructor(private readonly mobilePreference: boolean | (() => boolean)) {}

  get mobile(): boolean {
    return typeof this.mobilePreference === 'function' ? this.mobilePreference() : this.mobilePreference;
  }

  takeFrame(time: number, hidden: boolean): number {
    if (hidden) {
      this.lastFrame = this.sampleStart = -1;
      this.frames = 0;
      return 0;
    }
    const elapsed = this.lastFrame < 0 ? 1 / 60 : time - this.lastFrame;
    // Small tolerance avoids alternating 30 and 20 fps on a 60 Hz display.
    if (
      this.mobile &&
      elapsed < 1 / RENDER_BUDGET.mobileFps - RENDER_BUDGET.pacingToleranceSeconds &&
      this.lastFrame >= 0
    )
      return 0;
    this.lastFrame = time;
    this.sample(time);
    return Math.min(elapsed, RENDER_BUDGET.maxFrameSeconds);
  }

  pixelRatio(deviceRatio: number): number {
    return (
      Math.min(deviceRatio, this.mobile ? RENDER_BUDGET.mobilePixelRatio : RENDER_BUDGET.desktopPixelRatio) *
      this.scale
    );
  }

  private sample(time: number): void {
    if (this.sampleStart < 0) this.sampleStart = time;
    this.frames++;
    const elapsed = time - this.sampleStart;
    if (elapsed < RENDER_BUDGET.sampleSeconds) return;
    const minimumFps = this.mobile ? RENDER_BUDGET.mobileMinimumFps : RENDER_BUDGET.desktopMinimumFps;
    if (this.frames / elapsed < minimumFps)
      this.scale = Math.max(RENDER_BUDGET.minimumScale, this.scale - RENDER_BUDGET.scaleStep);
    this.frames = 0;
    this.sampleStart = time;
  }
}

export function isMobileRenderer(): boolean {
  return innerWidth < RENDER_BUDGET.narrowScreenPx || matchMedia('(pointer:coarse)').matches;
}
