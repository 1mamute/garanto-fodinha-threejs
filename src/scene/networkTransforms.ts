import * as THREE from 'three';
import type { CardTransform } from '../net/sceneMessages';

export function captureTransform(object: THREE.Object3D, id: string): CardTransform {
  return {
    id,
    position: object.getWorldPosition(new THREE.Vector3()).toArray(),
    rotation: object.getWorldQuaternion(new THREE.Quaternion()).toArray(),
    scale: object.getWorldScale(new THREE.Vector3()).toArray(),
  };
}

export function transformMatrix(transform: CardTransform): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(transform.position),
    new THREE.Quaternion().fromArray(transform.rotation),
    new THREE.Vector3().fromArray(transform.scale),
  );
}

export function followTransform(object: THREE.Object3D, transform: CardTransform, blend: number): void {
  const matrix = transformMatrix(transform);
  if (object.parent) {
    object.parent.updateWorldMatrix(true, false);
    matrix.premultiply(object.parent.matrixWorld.clone().invert());
  }
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, rotation, scale);
  object.position.lerp(position, blend);
  object.quaternion.slerp(rotation, blend);
  object.scale.lerp(scale, blend);
}
