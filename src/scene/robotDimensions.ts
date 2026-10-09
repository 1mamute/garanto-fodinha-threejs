const HEAD_HEIGHT = 2.23;
const EYE_OFFSET = 0.41;
const THIGH_LENGTH = 0.52;

/** Posture changes the limbs, not the robot's torso and head proportions. */
export const ROBOT_DIMENSIONS = {
  torsoHeight: 1.555,
  torsoLength: 1.15,
  headHeight: HEAD_HEIGHT,
  shoulderHeight: 2.2,
  eyeOffset: EYE_OFFSET,
  eyeForward: 0.56,
  eyeHeight: HEAD_HEIGHT + EYE_OFFSET + THIGH_LENGTH,
  thighLength: THIGH_LENGTH,
  seatedHipHeight: 0.9,
  standingOffset: THIGH_LENGTH,
} as const;
