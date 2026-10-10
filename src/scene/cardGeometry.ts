import * as THREE from 'three';

const WIDTH = 0.35;
const HEIGHT = 0.49;
// Real playing-card stock is about 0.3 mm thick for a 63 mm wide card.
const THICKNESS = 0.0017;
const CORNER_RADIUS = 0.017;
export const CARD_SIZE = { width: WIDTH, height: THICKNESS, depth: HEIGHT } as const;

/** One shared, thin rounded card; four segments per corner keep the mesh inexpensive. */
export function createCardGeometry(): THREE.BufferGeometry {
  const halfWidth = WIDTH / 2;
  const halfHeight = HEIGHT / 2;
  const radius = CORNER_RADIUS;
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
    depth: THICKNESS,
    bevelEnabled: false,
    curveSegments: 4,
    steps: 1,
  });
  geometry.translate(0, 0, -THICKNESS / 2);
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
      positions.getX(index) / WIDTH + 0.5,
      0.5 + (positions.getZ(index) / HEIGHT) * (normalY > 0 ? -1 : 1),
    );
    if (material === previousMaterial) continue;
    if (index > groupStart) geometry.addGroup(groupStart, index - groupStart, previousMaterial);
    groupStart = index;
    previousMaterial = material;
  }
  geometry.addGroup(groupStart, positions.count - groupStart, previousMaterial);
}
