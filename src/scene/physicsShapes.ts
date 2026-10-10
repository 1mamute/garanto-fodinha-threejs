import type Jolt from 'jolt-physics';
import * as THREE from 'three';

const CONVEX_RADIUS = 0.002;
const RING_SEGMENTS = 64;

/** Colliders reuse mesh dimensions; flat artwork and contact shadows have no solid volume. */
export function meshShape(runtime: typeof Jolt, geometry: THREE.BufferGeometry): Jolt.Shape | null {
  if (geometry instanceof THREE.BoxGeometry) {
    const { width, height, depth } = geometry.parameters;
    return boxShape(runtime, new THREE.Vector3(width, height, depth).multiplyScalar(0.5));
  }
  if (geometry instanceof THREE.CylinderGeometry) {
    const { radiusTop, radiusBottom, height, openEnded } = geometry.parameters;
    const radius = Math.max(radiusTop, radiusBottom);
    if (openEnded) return ringShape(runtime, { radius, height, thickness: 0.15 });
    const shape = new runtime.CylinderShape(height / 2, radius, Math.min(CONVEX_RADIUS, height / 4));
    shape.AddRef();
    return shape;
  }
  if (geometry instanceof THREE.TorusGeometry) {
    const { radius, tube } = geometry.parameters;
    return ringShape(runtime, { radius, height: tube * 2, thickness: tube * 2, vertical: true });
  }
  return null;
}

export function boxShape(runtime: typeof Jolt, halfExtent: THREE.Vector3): Jolt.Shape {
  const extent = new runtime.Vec3(halfExtent.x, halfExtent.y, halfExtent.z);
  const shape = new runtime.BoxShape(
    extent,
    Math.min(CONVEX_RADIUS, halfExtent.x / 2, halfExtent.y / 2, halfExtent.z / 2),
  );
  shape.AddRef();
  runtime.destroy(extent);
  return shape;
}

export function takeShape(runtime: typeof Jolt, settings: Jolt.ShapeSettings): Jolt.Shape {
  const result = settings.Create();
  if (result.HasError()) {
    const message = result.GetError().c_str();
    runtime.destroy(settings);
    throw new Error(message);
  }
  const shape = result.Get();
  shape.AddRef();
  result.Clear();
  runtime.destroy(settings);
  return shape;
}

function ringShape(
  runtime: typeof Jolt,
  dimensions: { radius: number; height: number; thickness: number; vertical?: boolean },
): Jolt.Shape {
  const { radius, height, thickness } = dimensions;
  const compound = new runtime.StaticCompoundShapeSettings();
  const segment = boxShape(
    runtime,
    new THREE.Vector3((Math.PI * radius) / RING_SEGMENTS, height / 2, thickness / 2),
  );
  const position = new runtime.Vec3();
  const rotation = new runtime.Quat();
  for (let index = 0; index < RING_SEGMENTS; index++) {
    const angle = (index * Math.PI * 2) / RING_SEGMENTS;
    if (dimensions.vertical) {
      position.Set(Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
      rotation.Set(0, 0, -Math.sin(angle / 2), Math.cos(angle / 2));
    } else {
      position.Set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      rotation.Set(0, Math.sin(angle / 2), 0, Math.cos(angle / 2));
    }
    compound.AddShapeShape(position, rotation, segment, 0);
  }
  runtime.destroy(position);
  runtime.destroy(rotation);
  segment.Release();
  return takeShape(runtime, compound);
}

/** Each animated robot mesh is approximated by its local bounds, retaining joints and poses. */
export function robotMeshShape(runtime: typeof Jolt, mesh: THREE.Mesh): Jolt.Shape {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  if (!bounds) throw new Error('Robô sem dimensões para colisão.');
  const compound = new runtime.StaticCompoundShapeSettings();
  const center = bounds.getCenter(new THREE.Vector3());
  const halfExtent = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const shape = boxShape(runtime, halfExtent);
  const position = new runtime.Vec3(center.x, center.y, center.z);
  const rotation = new runtime.Quat(0, 0, 0, 1);
  compound.AddShapeShape(position, rotation, shape, 0);
  runtime.destroy(position);
  runtime.destroy(rotation);
  shape.Release();
  return takeShape(runtime, compound);
}

export function furnitureShape(runtime: typeof Jolt, root: THREE.Group): Jolt.Shape {
  const compound = new runtime.StaticCompoundShapeSettings();
  const position = new runtime.Vec3();
  const rotation = new runtime.Quat();
  for (const child of root.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const mesh = child as THREE.Mesh;
    const shape = meshShape(runtime, mesh.geometry);
    if (!shape) continue;
    position.Set(mesh.position.x, mesh.position.y, mesh.position.z);
    const orientation = mesh.quaternion;
    rotation.Set(orientation.x, orientation.y, orientation.z, orientation.w);
    compound.AddShapeShape(position, rotation, shape, 0);
    shape.Release();
  }
  runtime.destroy(position);
  runtime.destroy(rotation);
  return takeShape(runtime, compound);
}
