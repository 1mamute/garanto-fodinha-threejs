/** Fixed seated robot used to preview the turn cues, regardless of the demo's turn or phase. */
export const LAB_TURN_PREVIEW = { playerId: 'demo-2' };

/** Shared game/lab turn cues. Scene dimensions are in world units. */
export const TURN_INDICATOR = {
  enabled: true,
  color: '#e9b767',
  /** Light intensity in candela: 0 disables lighting; useful range 0–40. No shadow pass. */
  lightIntensity: 12,
  lightHeight: 5.2,
  lightTargetHeight: 1.4,
  lightDistance: 8,
  /** Cone half-angle in radians (0.15–0.6); penumbra 0–1. */
  lightAngle: 0.3,
  lightPenumbra: 0.75,
  haloRadius: 0.68,
  haloThickness: 0.045,
  haloHeight: 0.04,
  haloEmissiveIntensity: 0.55,
  /** Marker height above the floor; 3.3–3.8 keeps it near the robot's name. */
  markerHeight: 3.5,
  /** Fraction of screen half-size: 0 centres edge cues, 0.65 leaves room for controls. */
  screenMargin: 0.65,
};
