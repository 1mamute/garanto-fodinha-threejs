/** Frame pacing and a conservative, one-way resolution fallback for slower GPUs. */
export class RenderBudget {
  private lastFrame = -1;
  private sampleStart = -1;
  private frames = 0;
  private scale = 1;

  constructor(readonly mobile: boolean) {}

  takeFrame(time: number, hidden: boolean): number {
    if (hidden) {
      this.lastFrame = this.sampleStart = -1;
      this.frames = 0;
      return 0;
    }
    const elapsed = this.lastFrame < 0 ? 1 / 60 : time - this.lastFrame;
    // Small tolerance avoids alternating 30 and 20 fps on a 60 Hz display.
    if (this.mobile && elapsed < 1 / 30 - 0.002 && this.lastFrame >= 0) return 0;
    this.lastFrame = time;
    this.sample(time);
    return Math.min(elapsed, 0.05);
  }

  pixelRatio(deviceRatio: number): number {
    return Math.min(deviceRatio, this.mobile ? 1 : 1.5) * this.scale;
  }

  private sample(time: number): void {
    if (this.sampleStart < 0) this.sampleStart = time;
    this.frames++;
    const elapsed = time - this.sampleStart;
    if (elapsed < 3) return;
    const minimumFps = this.mobile ? 25 : 42;
    if (this.frames / elapsed < minimumFps) this.scale = Math.max(0.7, this.scale - 0.15);
    this.frames = 0;
    this.sampleStart = time;
  }
}

export function isMobileRenderer(): boolean {
  return innerWidth < 700 || matchMedia('(pointer:coarse)').matches;
}
