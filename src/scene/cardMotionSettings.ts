/** Local visual physics only: these values never affect rules or shared game clocks. */
export const CARD_MOTION = {
  /** Free simulation on the felt after landing, before returning to the player's slot. */
  slideSeconds: 1.2,
  /** Smooth return duration, also used when a trick is collected. */
  returnSeconds: 1.2,
  /** World-space pointer velocity becomes additional launch momentum. */
  dragVelocityGain: 0.45,
  maxDragSpeed: 6,
  maxLaunchSpeed: 7,
  dropSpeed: 0.6,
  impactSpeedGain: 0.35,
  friction: 0.445,
  linearDamping: 0.1,
};

export type CardMotionSettings = typeof CARD_MOTION;
