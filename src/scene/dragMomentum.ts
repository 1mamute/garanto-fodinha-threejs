import { DRAG_MOMENTUM } from '../config/interactionSettings';
import * as THREE from 'three';

interface Sample {
  point: THREE.Vector3;
  time: number;
}

/** Recent world-space motion, so a pause before release loses its momentum. */
export class DragMomentum {
  private samples: Sample[] = [];

  reset(): void {
    this.samples = [];
  }

  sample(point: THREE.Vector3, time: number): void {
    if (!Number.isFinite(time) || ![point.x, point.y, point.z].every(Number.isFinite)) return;
    const previous = this.samples.at(-1);
    if (previous && time <= previous.time) return;
    this.samples = this.samples.filter(sample => time - sample.time <= DRAG_MOMENTUM.SAMPLE_WINDOW_MS);
    this.samples.push({ point: point.clone(), time });
    if (this.samples.length > DRAG_MOMENTUM.MAX_SAMPLES) this.samples.shift();
  }

  velocity(): THREE.Vector3 {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    if (!first || !last || first === last) return new THREE.Vector3();
    return last.point
      .clone()
      .sub(first.point)
      .multiplyScalar(1000 / (last.time - first.time));
  }
}
