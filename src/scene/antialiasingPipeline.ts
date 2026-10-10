import {
  Color,
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
import type { AntialiasingMode } from './graphicsSettings';
import { TemporalHistory } from './temporalHistory';

const MSAA_SAMPLES = 4;
const SSAA_SAMPLE_LEVEL = 2;

/** Three's runtime exposes the accumulation index, but its declaration omits it. */
class RestartableTAAPass extends TAARenderPass {
  declare accumulateIndex: number;

  restart(): void {
    this.accumulateIndex = -1;
  }
}

export class AntialiasingPipeline {
  private readonly composer: EffectComposer;
  private readonly temporal: RestartableTAAPass | null;
  private readonly history = new TemporalHistory();

  constructor(options: {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    mode: Exclude<AntialiasingMode, 'off'>;
  }) {
    const { renderer, scene, camera, mode } = options;
    const size = renderer.getSize(new Vector2());
    const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType });
    if (mode === 'msaa') target.samples = Math.min(MSAA_SAMPLES, renderer.capabilities.maxSamples);
    this.composer = new EffectComposer(renderer, target);
    this.temporal = mode === 'taa' ? new RestartableTAAPass(scene, camera) : null;
    this.addScenePass(options);
    if (mode === 'smaa') this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
    // FXAA detects contrast in display space; SMAA expects linear input before OutputPass.
    if (mode === 'fxaa') this.composer.addPass(new FXAAPass());
  }

  private addScenePass(options: {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    mode: AntialiasingMode;
  }): void {
    const { renderer, scene, camera, mode } = options;
    if (this.temporal) {
      this.temporal.clearColor = renderer.getClearColor(new Color());
      this.composer.addPass(this.temporal);
    } else if (mode === 'ssaa') {
      const pass = new SSAARenderPass(scene, camera, renderer.getClearColor(new Color()));
      pass.sampleLevel = SSAA_SAMPLE_LEVEL;
      this.composer.addPass(pass);
    } else this.composer.addPass(new RenderPass(scene, camera));
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    if (this.temporal) {
      this.temporal.accumulate = this.history.stable(scene, camera);
      if (!this.temporal.accumulate) this.temporal.restart();
    }
    this.composer.render(0);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.history.reset();
  }

  dispose(): void {
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
  }
}
