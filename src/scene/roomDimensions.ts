/** Shared dimensions keep the rendered room and walking boundary aligned. */
export const ROOM_RADIUS = 13.5;
export const FLOOR_ROTATION = Math.PI / 12;
export const WALL_LAMP_ANGLES = [Math.PI - 0.65, Math.PI + 0.65, -0.65, 0.65] as const;
const WALL_WALK_CLEARANCE = 1.5;
export const WALK_OUTER_RADIUS = ROOM_RADIUS - WALL_WALK_CLEARANCE;
