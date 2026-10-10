import type { PerspectiveCamera, Scene } from 'three';

const MATRIX_TOLERANCE = 0.000001;

/** The WebGL TAA pass has no reprojection: reuse history only for an unchanged scene. */
export class TemporalHistory {
  private previous: number[] = [];

  stable(scene: Scene, camera: PerspectiveCamera): boolean {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const current = [...camera.projectionMatrix.elements, ...camera.matrixWorld.elements];
    scene.traverse(object => {
      current.push(object.id, Number(object.visible), object.layers.mask, ...object.matrixWorld.elements);
    });
    const unchanged =
      current.length === this.previous.length &&
      current.every(
        (value, index) => Math.abs(value - (this.previous[index] ?? Infinity)) < MATRIX_TOLERANCE,
      );
    this.previous = current;
    return unchanged;
  }

  reset(): void {
    this.previous = [];
  }
}
