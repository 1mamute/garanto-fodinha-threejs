/** Artistic controls shared by the game and lab. Edit here, then reload the scene. */
export const POST_PROCESSING = {
  enabled: true,
  colorGrading: {
    enabled: true,
    /** Blend with the original image: 0–1. */
    strength: 0.65,
    /** Exposure offset in stops; 0 preserves the renderer's exposure. */
    exposure: 0,
    /** 1 preserves contrast/saturation. */
    contrast: 1.04,
    saturation: 0.95,
    /** Display brightness kept fixed when changing contrast: 0–1. */
    contrastPivot: 0.5,
    /** Display luminance transitions: 0–1, with end greater than start. */
    shadowRange: { start: 0, end: 0.55 },
    highlightRange: { start: 0.45, end: 1 },
    /** RGB multipliers; 1 is neutral. */
    shadows: { red: 0.96, green: 1.02, blue: 1.06 },
    highlights: { red: 1.04, green: 1.01, blue: 0.96 },
  },
  ambientOcclusion: {
    enabled: true,
    /** Occlusion blend: 0–1. */
    strength: 0.35,
    /** Sampling radius in scene units. */
    kernelRadius: 0.35,
    /** Depth differences normalized by the camera clipping range. */
    minDistance: 0.0005,
    maxDistance: 0.02,
    /** More samples improve quality and cost more GPU time. */
    kernelSize: 16,
    /** Fraction of drawing-buffer resolution: greater than 0, up to 1. */
    resolutionScale: 0.5,
    /** First-person hands/cards must not inherit the room's occlusion. */
    excludedLayer: 1,
  },
  bloom: {
    enabled: true,
    strength: 0.16,
    /** Halo spread: 0–1. */
    radius: 0.35,
    /** Linear HDR luminance cutoff; above 1 protects ordinary white surfaces. */
    threshold: 1.1,
    /** Fraction of drawing-buffer resolution: greater than 0, up to 1. */
    resolutionScale: 0.5,
    /** Linear radiance of lamp surfaces and robot-eye emission. */
    lampRadiance: 2.2,
    eyeEmission: 1,
  },
  vignette: {
    enabled: true,
    /** Maximum edge darkening: 0–1. */
    strength: 0.16,
    /** Unaffected radial center: 0 at center, 1 at corners (screen-proportional ellipse). */
    radius: 0.35,
    /** Transition width in the same radial units; larger gives a softer falloff. */
    softness: 0.6,
  },
};
