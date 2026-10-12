import { PLAYER_SPAWN } from '../config/playerSettings';
import * as THREE from 'three';
import { ROBOT_DIMENSIONS } from '../config/robotSettings';

// Fixed angular spacing keeps existing spawn slots stable when the roster grows.
const SPAWN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function playerSpawn(slot: number): THREE.Vector3 {
  const angle = slot * SPAWN_ANGLE;
  return new THREE.Vector3(
    Math.sin(angle) * PLAYER_SPAWN.SPAWN_RADIUS,
    ROBOT_DIMENSIONS.eyeHeight,
    Math.cos(angle) * PLAYER_SPAWN.SPAWN_RADIUS,
  );
}
