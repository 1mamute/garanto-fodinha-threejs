/** Shared, inexpensive geometry for the seated utility robots and first-person grippers. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, mesh } from './primitives';

type Coordinates = readonly [number, number, number];
interface Part {
  shape: 'box' | 'round' | 'barrel' | 'dome';
  at: Coordinates;
  scale: Coordinates;
  rotation?: Coordinates;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const ROUND = new THREE.SphereGeometry(1, 12, 8);
const BARREL = new THREE.CylinderGeometry(1, 1, 1, 16);
const DOME = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const SHAPES = { box: BOX, round: ROUND, barrel: BARREL, dome: DOME };
const paintCache = new Map<string, THREE.Material>();
const geometryCache = new Map<string, THREE.BufferGeometry>();
export const JOINT = material('#24282a', { roughness: 0.94 });
export const TRIM = material('#878777', {
  roughness: 0.72,
  metalness: 0.3,
  emissive: '#71634b',
  emissiveIntensity: 0.3,
});
export const VISOR = material('#101a1c', { roughness: 0.32, metalness: 0.2 });
export const EYE = material('#fff9e9', { emissive: '#fff9e9', emissiveIntensity: 0.25 });

function paintWear(): THREE.DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 127;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 16807) % 2147483647;
    const grain = 220 + (seed % 30);
    pixels.set([grain, grain, grain, 255], i * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const WEAR = paintWear();

export function robotPaint(color: string): THREE.Material {
  let paint = paintCache.get(color);
  if (!paint) {
    paint = material(color, { map: WEAR, roughness: 0.58, metalness: 0.12 });
    paintCache.set(color, paint);
  }
  return paint;
}

/** Merge stationary pieces into one draw call, while sharing the result across all robots. */
function geometry(key: string, parts: readonly Part[]): THREE.BufferGeometry {
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const pieces = parts.map(part => {
    const source = SHAPES[part.shape];
    const piece = source.index ? source.toNonIndexed() : source.clone();
    const transform = new THREE.Matrix4().compose(
      new THREE.Vector3(...part.at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))),
      new THREE.Vector3(...part.scale),
    );
    return piece.applyMatrix4(transform);
  });
  const result = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  geometryCache.set(key, result);
  return result;
}

export function robotBody(parent: THREE.Group, paint: THREE.Material, standing: boolean): THREE.Mesh {
  const torsoHeight = standing ? 1.25 : 1.555;
  const torsoLength = standing ? 0.57 : 1.15;
  return mesh(
    geometry(`body-${standing}`, [
      { shape: 'barrel', at: [0, torsoHeight, 0], scale: [0.45, torsoLength, 0.43] },
      { shape: 'round', at: [0, 1.01, 0], scale: [0.44, 0.155, 0.42] },
      { shape: 'dome', at: [0, standing ? 1.65 : 2.23, 0], scale: [0.43, 0.3, 0.43] },
      { shape: 'barrel', at: [0, standing ? 1.59 : 2.17, 0], scale: [0.43, 0.16, 0.43] },
    ]),
    paint,
    parent,
  );
}

export function robotHead(parent: THREE.Group, paint: THREE.Material): THREE.Group[] {
  // A domed lid over a horizontal mouth seam preserves the broad, neckless silhouette.
  mesh(
    geometry('head-shell', [
      { shape: 'barrel', at: [0, 0.155, 0], scale: [0.47, 0.23, 0.47] },
      { shape: 'dome', at: [0, 0.27, 0], scale: [0.47, 0.47, 0.47] },
    ]),
    paint,
    parent,
  );
  mesh(BARREL, JOINT, parent, [0, 0.035, 0]).scale.set(0.465, 0.018, 0.465);
  return [-0.235, 0.235].map(x => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.41, 0.405);
    parent.add(eye);
    mesh(ROUND, EYE, eye).scale.set(0.19, 0.2, 0.162);
    mesh(ROUND, VISOR, eye, [0, 0, 0.157]).scale.set(0.06, 0.066, 0.021);
    return eye;
  });
}

export function robotLeg(parent: THREE.Group, paint: THREE.Material, standing: boolean): void {
  const parts: Part[] = standing
    ? [
        { shape: 'box', at: [0, -0.36, 0], scale: [0.1, 0.57, 0.12] },
        { shape: 'round', at: [0, -0.84, 0.04], scale: [0.11, 0.085, 0.16] },
      ]
    : [
        { shape: 'box', at: [0, 0, 0.2], scale: [0.12, 0.12, 0.52] },
        { shape: 'box', at: [0, -0.41, 0.43], scale: [0.1, 0.65, 0.12] },
        { shape: 'round', at: [0, -0.825, 0.48], scale: [0.12, 0.075, 0.17] },
      ];
  mesh(geometry(standing ? 'leg-standing' : 'leg-seated', parts), paint, parent);
  mesh(ROUND, JOINT, parent, [0, standing ? -0.63 : -0.06, standing ? 0 : 0.43]).scale.set(
    0.135,
    0.135,
    0.14,
  );
}

function armJoints(side: number, standing: boolean): { elbow: THREE.Vector3; wrist: THREE.Vector3 } {
  const elbow = new THREE.Vector3(side * 0.15, standing ? -0.28 : -0.45, standing ? 0 : 0.17);
  const wrist = new THREE.Vector3(side * -0.16, -0.29, standing ? 0 : 0.59);
  if (side < 0 && !standing) wrist.set(0.16, -0.545, 0.715);
  if (side > 0 && !standing) wrist.set(-0.16, -0.36, 0.66);
  if (standing) wrist.set(side * 0.15, -0.62, 0);
  return { elbow, wrist };
}

export function robotArm(parent: THREE.Group, paint: THREE.Material, side: number, standing: boolean): void {
  const { elbow, wrist } = armJoints(side, standing);
  const parts = [limb(new THREE.Vector3(), elbow, 0.095), limb(elbow, wrist, 0.075)];
  mesh(geometry(`arm-${side}-${standing}`, parts), paint, parent);
  mesh(ROUND, paint, parent, elbow.toArray()).scale.setScalar(0.1);
  if (side > 0 || standing) {
    const gripper = new THREE.Group();
    gripper.position.copy(wrist);
    gripper.rotation.x = standing ? Math.PI / 2 : 0.7;
    parent.add(gripper);
    buildGripper(gripper);
  }
}

function limb(start: THREE.Vector3, end: THREE.Vector3, width: number): Part {
  const direction = end.clone().sub(start);
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
  );
  return {
    shape: 'barrel',
    at: start.clone().add(end).multiplyScalar(0.5).toArray(),
    scale: [width, direction.length(), width],
    rotation: [rotation.x, rotation.y, rotation.z],
  };
}

/** Clamp sits at the lower edge of a 0.6-scale card; fingers touch both card surfaces. */
export function buildGripper(parent: THREE.Group): void {
  mesh(
    geometry('gripper', [
      { shape: 'box', at: [0, -0.025, 0.215], scale: [0.17, 0.11, 0.12] },
      { shape: 'box', at: [-0.055, -0.014, 0.13], scale: [0.045, 0.025, 0.09] },
      { shape: 'box', at: [0.055, -0.014, 0.13], scale: [0.045, 0.025, 0.09] },
      { shape: 'box', at: [0, 0.014, 0.14], scale: [0.07, 0.025, 0.09] },
    ]),
    TRIM,
    parent,
  );
  mesh(BOX, JOINT, parent, [0, -0.035, 0.3]).scale.set(0.105, 0.1, 0.11);
}
