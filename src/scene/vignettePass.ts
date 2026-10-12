import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { POST_PROCESSING } from './postProcessingSettings';

const MIN_SOFTNESS = 0.0001;

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float strength;
  uniform float radius;
  uniform float softness;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    // Screen-relative axes keep the vignette centered on portrait and wide views.
    // Distance is zero at the center, one at corners, and 1/sqrt(2) at edge centers.
    float distanceFromCenter = length((vUv - vec2(0.5)) * 2.0) / sqrt(2.0);
    float edgeWeight = smoothstep(radius, radius + softness, distanceFromCenter);
    gl_FragColor = vec4(texel.rgb * (1.0 - strength * edgeWeight), texel.a);
  }
`;

/** Gentle display-space darkening; insert after grading and before FXAA. */
export function createVignettePass(): ShaderPass {
  const settings = POST_PROCESSING.vignette;
  const pass = new ShaderPass({
    name: 'GarantoVignette',
    uniforms: {
      tDiffuse: { value: null },
      strength: { value: Math.max(0, Math.min(1, settings.strength)) },
      radius: { value: Math.max(0, Math.min(1, settings.radius)) },
      softness: { value: Math.max(MIN_SOFTNESS, settings.softness) },
    },
    vertexShader,
    fragmentShader,
  });
  pass.enabled = settings.enabled;
  pass.material.toneMapped = false;
  return pass;
}
