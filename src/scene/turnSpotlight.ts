import * as THREE from 'three';
import { canvasTexture, disposeMaterials, material, mesh } from './primitives';
import { TURN_INDICATOR } from '../config/turnIndicatorSettings';

const appliedSettings = new WeakMap<THREE.Group, string>();

/** A visible beam makes the turn readable without relying on bloom or extra shadow passes. */
export function buildTurnSpotlight(world: THREE.Group): THREE.Group {
  const spotlight = new THREE.Group();
  spotlight.name = 'turn-spotlight';
  world.add(spotlight);
  updateTurnSpotlight(spotlight);
  spotlight.visible = false;
  return spotlight;
}

/** Replace only the cue's resources, preserving its seat, visibility and the running scene. */
export function updateTurnSpotlight(spotlight: THREE.Group): void {
  const signature = JSON.stringify(TURN_INDICATOR);
  if (appliedSettings.get(spotlight) === signature) return;
  spotlight.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BufferGeometry;
      geometry.dispose();
      disposeMaterials(object);
    } else if (object instanceof THREE.SpotLight) object.dispose();
  });
  spotlight.clear();
  populateSpotlight(spotlight);
  appliedSettings.set(spotlight, signature);
}

function populateSpotlight(spotlight: THREE.Group): void {
  const settings = TURN_INDICATOR;
  const halo = material(settings.color, {
    emissive: settings.color,
    emissiveIntensity: settings.haloEmissiveIntensity,
  });
  mesh(new THREE.TorusGeometry(settings.haloRadius, settings.haloThickness, 8, 32), halo, spotlight, [
    0,
    settings.haloHeight,
    0,
  ]).rotation.x = Math.PI / 2;
  const light = new THREE.SpotLight(
    settings.color,
    settings.lightIntensity,
    settings.lightDistance,
    settings.lightAngle,
    settings.lightPenumbra,
  );
  light.position.y = settings.lightHeight;
  light.target.position.y = settings.lightTargetHeight;
  spotlight.add(light, light.target);
  if (settings.beam.enabled) buildBeam(spotlight);
}

function buildBeam(spotlight: THREE.Group): void {
  const { beam, lightHeight, lightAngle } = TURN_INDICATOR;
  const height = Math.max(0.01, lightHeight - beam.bottomHeight);
  const radius = Math.tan(lightAngle) * height * beam.radiusScale;
  const surface = new THREE.MeshBasicMaterial({
    color: beam.color,
    map: beamTexture(),
    opacity: beam.opacity,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  // An open frustum retains the silhouette while depth testing lets robots occlude its far side.
  const cone = mesh(
    new THREE.CylinderGeometry(beam.sourceRadius, radius, height, 32, 1, true),
    surface,
    spotlight,
    [0, beam.bottomHeight + height / 2, 0],
  );
  cone.name = 'turn-light-beam';
  buildLightPool(spotlight, radius);
  const source = new THREE.MeshBasicMaterial({
    color: new THREE.Color(beam.color).multiplyScalar(beam.sourceRadiance),
    side: THREE.DoubleSide,
  });
  mesh(new THREE.CircleGeometry(beam.sourceRadius, 24), source, spotlight, [0, lightHeight, 0]).rotation.x =
    Math.PI / 2;
}

function beamTexture(): THREE.CanvasTexture {
  return canvasTexture(16, 128, context => {
    const gradient = context.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#ffffffe6');
    gradient.addColorStop(0.35, '#ffffff99');
    gradient.addColorStop(1, '#ffffff40');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 128);
  });
}

function buildLightPool(spotlight: THREE.Group, radius: number): void {
  const { beam } = TURN_INDICATOR;
  const texture = canvasTexture(128, 128, context => {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffffcc');
    gradient.addColorStop(0.65, '#ffffff99');
    gradient.addColorStop(1, '#ffffff00');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  });
  const surface = new THREE.MeshBasicMaterial({
    color: beam.color,
    map: texture,
    transparent: true,
    opacity: beam.poolOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), surface, spotlight, [
    0,
    beam.bottomHeight,
    0,
  ]).rotation.x = -Math.PI / 2;
}
