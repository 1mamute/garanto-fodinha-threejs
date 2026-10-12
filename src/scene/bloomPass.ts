import { Vector2 } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { POST_PROCESSING } from './postProcessingSettings';

/** Gentle bloom of HDR light sources; place before OutputPass while input is linear. */
export class BloomPass extends UnrealBloomPass {
  constructor() {
    const settings = POST_PROCESSING.bloom;
    super(new Vector2(2, 2), settings.strength, settings.radius, settings.threshold);
    this.enabled = settings.enabled;
  }

  override setSize(width: number, height: number): void {
    const scale = POST_PROCESSING.bloom.resolutionScale;
    // UnrealBloomPass halves its input size before extracting highlights. Compensate
    // so the configured fraction describes the largest bloom texture itself.
    const bloomWidth = Math.max(2, Math.round(width * scale) * 2);
    const bloomHeight = Math.max(2, Math.round(height * scale) * 2);
    this.resolution.set(bloomWidth, bloomHeight);
    super.setSize(bloomWidth, bloomHeight);
  }

  override dispose(): void {
    super.dispose();
    // Three's pass disposes the blur/composite materials, but omits this filter.
    this.materialHighPassFilter.dispose();
  }
}
