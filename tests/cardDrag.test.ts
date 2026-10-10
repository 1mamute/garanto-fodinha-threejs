import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { CardDrag } from '../src/scene/cardDrag';

function fixture(width: number, height: number): { camera: THREE.PerspectiveCamera; drag: CardDrag } {
  const camera = new THREE.PerspectiveCamera(62, width / height, 0.04, 60);
  camera.position.set(0, 2.25, 3.35);
  camera.lookAt(0, 1.68, 0);
  camera.updateWorldMatrix(true, false);
  const drag = new CardDrag(camera, {
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => null,
    }),
  });
  return { camera, drag };
}

test('carta segue o ponto agarrado em retrato e paisagem com mão reduzida e girada', () => {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    if (!width || !height) assert.fail('Dimensões ausentes');
    const { camera, drag } = fixture(width, height);
    const hand = new THREE.Group();
    hand.scale.setScalar(0.4);
    hand.rotation.x = 1.25;
    const card = new THREE.Object3D();
    hand.add(card);
    camera.add(hand);
    hand.position.set(0, -0.26, -0.95);
    camera.updateWorldMatrix(true, true);
    const point = card.getWorldPosition(new THREE.Vector3()).project(camera);
    const startX = ((point.x + 1) * width) / 2;
    const startY = ((1 - point.y) * height) / 2;
    drag.begin(card, startX, startY);
    drag.move(card, startX + 40, startY - 120);
    const moved = card.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(((moved.x + 1) * width) / 2 - startX - 40) < 0.001);
    assert.ok(Math.abs(((1 - moved.y) * height) / 2 - startY + 120) < 0.001);
  }
});

test('soltura aceita o feltro e rejeita parede ou fora da mesa', () => {
  const { camera, drag } = fixture(390, 844);
  const screenPoint = (point: THREE.Vector3): [number, number] => {
    point.project(camera);
    return [(point.x + 1) * 195, (1 - point.y) * 422];
  };
  assert.equal(drag.overTable(...screenPoint(new THREE.Vector3(0, 1.68, 0))), true);
  assert.equal(drag.overTable(...screenPoint(new THREE.Vector3(4, 1.68, 0))), false);
  assert.equal(drag.overTable(195, 0), false);
});

test('a mesma trajetória gera mais impulso quando arrastada mais rápido, em retrato e paisagem', () => {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    if (!width || !height) assert.fail('Dimensões ausentes');
    const speeds = [40, 100].map(duration => {
      const { camera, drag } = fixture(width, height);
      const card = new THREE.Object3D();
      camera.add(card);
      card.position.set(0, -0.2, -1);
      const pointerAt = (z: number): [number, number] => {
        const point = new THREE.Vector3(0, 1.6465, z).project(camera);
        return [((point.x + 1) * width) / 2, ((1 - point.y) * height) / 2];
      };
      const start = pointerAt(1.8);
      const middle = pointerAt(1.5);
      const end = pointerAt(1.2);
      drag.begin(card, ...start, 0);
      drag.move(card, ...middle, duration / 2);
      drag.move(card, ...end, duration);
      const velocity = drag.releaseVelocity(...end, duration + 1);
      assert.ok(velocity.z < 0, 'o impulso aponta para a mesa');
      return velocity.length();
    });
    const [fast, slow] = speeds;
    if (fast === undefined || slow === undefined) assert.fail('Velocidades ausentes');
    assert.ok(fast > slow * 2, 'o tempo do gesto determina sua força, independentemente da tela');
  }
});

test('parar antes de soltar a carta descarta o impulso antigo', () => {
  const { camera, drag } = fixture(390, 844);
  const card = new THREE.Object3D();
  camera.add(card);
  const start = new THREE.Vector3(0, 1.6465, 1.8).project(camera);
  const end = new THREE.Vector3(0, 1.6465, 1).project(camera);
  const startPoint: [number, number] = [(start.x + 1) * 195, (1 - start.y) * 422];
  const endPoint: [number, number] = [(end.x + 1) * 195, (1 - end.y) * 422];
  drag.begin(card, ...startPoint, 0);
  drag.move(card, ...endPoint, 40);
  assert.equal(drag.releaseVelocity(...endPoint, 300).length(), 0);
});
