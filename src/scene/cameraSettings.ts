/** Magnification relative to the normal first-person view; 1 disables zoom. */
export const FIRST_PERSON_CAMERA = {
  fieldOfView: 55,
  maxZoom: 2.5,
  wheelSensitivity: 0.0015,
} as const;

/** Set to false to keep the seated player's last look direction after releasing a drag. */
export const SEATED_CAMERA = {
  returnOnLookRelease: true,
  returnDurationSeconds: 1.2,
};

/** Inclination from vertical: 0 looks straight down; positive angles face the table from the seat. */
export const TABLE_CAMERA = {
  angleDegrees: 15,
  maxAngleDegrees: 45,
  returnDurationSeconds: 1.2,
};
