import { Vector2, Vector3 } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { POST_PROCESSING } from '../config/postProcessingSettings';

const MIN_TRANSITION_SPAN = 0.0001;

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// OutputPass has already mapped HDR radiance to display sRGB. These are artistic
// adjustments to those display values, with no second tone map or transfer.
const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float strength;
  uniform float exposure;
  uniform float contrast;
  uniform float contrastPivot;
  uniform float saturation;
  uniform vec3 shadows;
  uniform vec3 highlights;
  uniform vec2 shadowRange;
  uniform vec2 highlightRange;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 graded = texel.rgb * exp2(exposure);
    float brightness = clamp(dot(graded, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    float shadowWeight = 1.0 - smoothstep(shadowRange.x, shadowRange.y, brightness);
    float highlightWeight = smoothstep(highlightRange.x, highlightRange.y, brightness);
    graded *= mix(vec3(1.0), shadows, shadowWeight);
    graded *= mix(vec3(1.0), highlights, highlightWeight);
    graded = (graded - vec3(contrastPivot)) * contrast + vec3(contrastPivot);
    float luminance = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded = mix(vec3(luminance), graded, saturation);
    gl_FragColor = vec4(mix(texel.rgb, clamp(graded, 0.0, 1.0), strength), texel.a);
  }
`;

function transitionRange(range: { start: number; end: number }): Vector2 {
  const start = Math.max(0, Math.min(1 - MIN_TRANSITION_SPAN, range.start));
  const end = Math.max(start + MIN_TRANSITION_SPAN, Math.min(1, range.end));
  return new Vector2(start, end);
}

/** Display-space grading; insert after OutputPass and before vignette/FXAA. */
export function createColorGradingPass(): ShaderPass {
  const settings = POST_PROCESSING.colorGrading;
  const pass = new ShaderPass({
    name: 'GarantoColorGrading',
    uniforms: {
      tDiffuse: { value: null },
      strength: { value: Math.max(0, Math.min(1, settings.strength)) },
      exposure: { value: settings.exposure },
      contrast: { value: settings.contrast },
      contrastPivot: { value: Math.max(0, Math.min(1, settings.contrastPivot)) },
      saturation: { value: settings.saturation },
      shadowRange: { value: transitionRange(settings.shadowRange) },
      highlightRange: { value: transitionRange(settings.highlightRange) },
      shadows: {
        value: new Vector3(settings.shadows.red, settings.shadows.green, settings.shadows.blue),
      },
      highlights: {
        value: new Vector3(settings.highlights.red, settings.highlights.green, settings.highlights.blue),
      },
    },
    vertexShader,
    fragmentShader,
  });
  pass.enabled = settings.enabled;
  pass.material.toneMapped = false;
  return pass;
}
