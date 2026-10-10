import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { AntialiasingPipeline } from './antialiasingPipeline';
import { antialiasingMode, onAntialiasingChange, type AntialiasingMode } from './graphicsSettings';

/** Owns AA resources and includes the first-person overlay in every scene sample. */
export class GraphicsRenderer {
  private pipeline: AntialiasingPipeline | null = null;
  private mode = antialiasingMode();
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private drawingOverlay = false;
  private readonly unsubscribe: () => void;
  private readonly previousAfterRender: Scene['onAfterRender'];

  constructor(
    private readonly options: {
      renderer: WebGLRenderer;
      scene: Scene;
      camera: PerspectiveCamera;
      overlay?: () => void;
    },
  ) {
    this.pixelRatio = options.renderer.getPixelRatio();
    this.previousAfterRender = options.scene.onAfterRender.bind(options.scene);
    if (options.overlay) options.scene.onAfterRender = this.drawOverlay.bind(this);
    this.unsubscribe = onAntialiasingChange(mode => {
      this.mode = mode;
      this.rebuild();
    });
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.options.renderer.setSize(width, height);
    // Recreate TAA because Three's resize does not resize its retained hold buffer.
    if (!this.pipeline || this.mode === 'taa') this.rebuild();
    else this.pipeline.resize(width, height, this.pixelRatio);
  }

  render(pixelRatio: number): void {
    const { renderer, scene, camera } = this.options;
    if (this.pixelRatio !== pixelRatio) {
      this.pixelRatio = pixelRatio;
      renderer.setPixelRatio(pixelRatio);
      if (this.mode === 'taa') this.rebuild();
      else this.pipeline?.resize(this.width, this.height, pixelRatio);
    }
    if (this.pipeline) this.pipeline.render(scene, camera);
    else renderer.render(scene, camera);
  }

  dispose(): void {
    this.unsubscribe();
    this.pipeline?.dispose();
    this.options.scene.onAfterRender = this.previousAfterRender;
  }

  private rebuild(): void {
    this.pipeline?.dispose();
    this.pipeline = this.createPipeline(this.mode);
    this.pipeline?.resize(this.width, this.height, this.pixelRatio);
  }

  private createPipeline(mode: AntialiasingMode): AntialiasingPipeline | null {
    return mode === 'off' ? null : new AntialiasingPipeline({ ...this.options, mode });
  }

  private drawOverlay(): void {
    if (this.drawingOverlay) return;
    this.drawingOverlay = true;
    try {
      this.options.overlay?.();
    } finally {
      this.drawingOverlay = false;
    }
  }
}
