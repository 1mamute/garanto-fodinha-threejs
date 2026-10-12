import { CARD_SIZE } from '../config/cardAppearanceSettings';
import * as THREE from 'three';

export { CARD_SIZE } from '../config/cardAppearanceSettings';
/** One shared, thin rounded card; four segments per corner keep the mesh inexpensive. */
export function createCardGeometry(): THREE.BufferGeometry {
  const halfWidth = CARD_SIZE.width / 2;
  const halfHeight = CARD_SIZE.depth / 2;
  const radius = CARD_SIZE.cornerRadius;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: CARD_SIZE.height,
    bevelEnabled: false,
    curveSegments: 4,
    steps: 1,
  });
  geometry.translate(0, 0, -CARD_SIZE.height / 2);
  geometry.rotateX(-Math.PI / 2);
  mapSurfaces(geometry);
  return geometry;
}

function surfaceMaterial(normalY: number): number {
  if (Math.abs(normalY) < 0.5) return 0;
  return normalY > 0 ? 1 : 2;
}

function mapSurfaces(geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  geometry.clearGroups();
  let groupStart = 0;
  let previousMaterial = -1;
  for (let index = 0; index < positions.count; index++) {
    const normalY = normals.getY(index);
    const material = surfaceMaterial(normalY);
    // Front and back keep the old box's orientation, including during hand-to-table motion.
    uv.setXY(
      index,
      positions.getX(index) / CARD_SIZE.width + 0.5,
      0.5 + (positions.getZ(index) / CARD_SIZE.depth) * (normalY > 0 ? -1 : 1),
    );
    if (material === previousMaterial) continue;
    if (index > groupStart) geometry.addGroup(groupStart, index - groupStart, previousMaterial);
    groupStart = index;
    previousMaterial = material;
  }
  geometry.addGroup(groupStart, positions.count - groupStart, previousMaterial);
}
