/** Small helpers to build the low-poly scene out of primitive shapes. */
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function material(
  color: THREE.ColorRepresentation,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
}

export const WOOD = material('#80553c');
export const DARK = material('#233c37');
export const WHITE = material('#fff8e8');
export const BLACK = material('#162c29');

type Coordinates = readonly [number, number, number];

export function mesh(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material | THREE.Material[],
  parent: THREE.Object3D,
  position: Coordinates = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  parent.add(result);
  return result;
}

/** Where a sphere goes and how it is squashed into an ellipsoid. */
export interface SpherePlacement {
  at: Coordinates;
  scale?: Coordinates;
}

export function sphere(
  parent: THREE.Object3D,
  surface: THREE.Material,
  radius: number,
  { at, scale = [1, 1, 1] }: SpherePlacement,
): THREE.Mesh {
  const result = mesh(new THREE.SphereGeometry(radius, 16, 12), surface, parent, at);
  result.scale.set(...scale);
  return result;
}

/** A bent limb through `points`. */
export function tube(
  parent: THREE.Object3D,
  points: Coordinates[],
  surface: THREE.Material,
  radius = 0.065,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(new THREE.TubeGeometry(curve, 12, radius, 7, false), surface, parent);
}

/** Draws on a fresh canvas and turns it into a colour-correct texture. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Frees the GPU memory of materials owned by one object, skipping shared ones. */
export function disposeMaterials(
  object: THREE.Mesh | THREE.Sprite,
  shared: readonly THREE.Material[] = [],
): void {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const surface of materials) {
    if (shared.includes(surface)) continue;
    if ('map' in surface && surface.map instanceof THREE.Texture && !surface.map.userData.cached)
      surface.map.dispose();
    surface.dispose();
  }
}

/** Frame-rate independent smoothing factor: the share of the remaining distance covered in `deltaSeconds`. */
export function smoothing(deltaSeconds: number, speed: number): number {
  return 1 - Math.exp(-deltaSeconds * speed);
}
