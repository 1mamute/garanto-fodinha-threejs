import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CameraRig } from '../src/scene/cameraRig';
import type { InspectionCameraMode } from '../src/scene/types';

function advance(rig: CameraRig, mode: InspectionCameraMode, seconds = 0.05): void {
  rig.update(seconds, 1, { mode, observer: true, seat: null, inspected: null });
}

test('terceira pessoa anda como o observador em primeira pessoa', () => {
  const first = new CameraRig();
  const third = new CameraRig();
  for (const rig of [first, third]) {
    rig.yaw = 0.6;
    rig.keys.add('KeyW');
    rig.keys.add('KeyD');
  }
  advance(first, 'first');
  advance(third, 'third');
  assert.deepEqual(third.spectatorPosition.toArray(), first.spectatorPosition.toArray());
});

test('joystick e teclado caminham na mesma direção e velocidade', () => {
  const keyboard = new CameraRig();
  const touch = new CameraRig();
  keyboard.yaw = 0.8;
  touch.yaw = keyboard.yaw;
  keyboard.keys.add('KeyW');
  keyboard.keys.add('KeyD');
  touch.joystick.x = Math.SQRT1_2;
  touch.joystick.y = -Math.SQRT1_2;
  advance(keyboard, 'first');
  advance(touch, 'first');
  assert.ok(keyboard.spectatorPosition.distanceTo(touch.spectatorPosition) < 1e-10);
});

test('andar na diagonal mantém a mesma velocidade', () => {
  const straight = new CameraRig();
  const diagonal = new CameraRig();
  const start = straight.spectatorPosition.clone();
  straight.keys.add('KeyW');
  diagonal.keys.add('KeyW');
  diagonal.keys.add('KeyD');
  advance(straight, 'first');
  advance(diagonal, 'third');
  assert.ok(
    Math.abs(straight.spectatorPosition.distanceTo(start) - diagonal.spectatorPosition.distanceTo(start)) <
      1e-10,
  );
});

test('as duas perspectivas preservam os limites de caminhada do observador', () => {
  for (const mode of ['first', 'third'] as const) {
    const rig = new CameraRig();
    rig.spectatorPosition.set(0, 2, 3.01);
    rig.keys.add('KeyW');
    advance(rig, mode);
    assert.equal(rig.spectatorPosition.z, 3.01);
    rig.spectatorPosition.set(0, 2, 10.49);
    rig.keys.clear();
    rig.keys.add('KeyS');
    advance(rig, mode);
    assert.ok(Math.hypot(rig.spectatorPosition.x, rig.spectatorPosition.z) > 10.5);
    rig.spectatorPosition.set(0, 2, 11.99);
    advance(rig, mode);
    assert.equal(rig.spectatorPosition.z, 11.99);
  }
});

test('orbitar e aproximar a câmera não desloca o personagem', () => {
  const rig = new CameraRig();
  const start = rig.spectatorPosition.clone();
  advance(rig, 'third');
  const cameraStart = rig.camera.position.clone();
  rig.yaw = Math.PI / 2;
  rig.addPitch(-0.4);
  rig.addOrbitZoom(-2);
  advance(rig, 'third');
  assert.deepEqual(rig.spectatorPosition.toArray(), start.toArray());
  assert.ok(rig.camera.position.distanceTo(cameraStart) > 1);
  assert.ok(Math.abs(rig.camera.quaternion.length() - 1) < 1e-10);
  rig.addOrbitZoom(-100);
  assert.ok(rig.orbitDistance > 0);
});
