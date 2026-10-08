import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { CameraRig } from '../src/scene/cameraRig';
import { dealerDirection } from '../src/scene/dealerIndicator';
import type { InspectionCameraMode } from '../src/scene/types';

function advance(rig: CameraRig, mode: InspectionCameraMode, seconds = 0.05): void {
  rig.update(seconds, 1, { mode, observer: true, seat: null, inspected: null });
}

test('a vista da mesa sobe e centraliza em um único movimento contínuo', () => {
  const rig = new CameraRig();
  advance(rig, 'first');
  const head = rig.camera.position.clone();
  rig.update(1 / 60, 0.1, { mode: 'top', observer: true, seat: null, inspected: null });
  assert.ok(rig.camera.position.y > head.y);
  assert.equal(rig.camera.position.x, head.x);
  assert.ok(rig.camera.position.z < head.z);
});

test('a vista da mesa mantém o assento embaixo e não inverte os lados', () => {
  for (const seat of [new Vector3(0, 0, 3.35), new Vector3(3.35, 0, 0), new Vector3(-2, 0, -2)]) {
    const rig = new CameraRig();
    const context = { observer: false, seat, inspected: null };
    rig.update(0.05, 1, { ...context, mode: 'first' });
    const right = new Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion);
    for (let frame = 0; frame < 120; frame++) {
      rig.update(1 / 60, 0.1, { ...context, mode: 'top' });
    }
    const topRight = new Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion);
    assert.ok(right.dot(topRight) > 0.99);
    rig.camera.updateMatrixWorld();
    const screenSeat = seat.clone().setY(1.4).project(rig.camera);
    assert.ok(screenSeat.y < 0);
  }
});

test('voltar da mesa aproxima e desce até a cabeça em um único movimento', () => {
  const rig = new CameraRig();
  advance(rig, 'top');
  const height = rig.camera.position.y;
  for (let frame = 0; frame < 27; frame++) {
    rig.update(1 / 60, 0.1, { mode: 'first', observer: true, seat: null, inspected: null });
    assert.ok(rig.camera.position.y < height);
    assert.ok(rig.camera.position.z > 0.001);
  }
  assert.ok(rig.camera.position.z < rig.spectatorPosition.z);
  for (let frame = 0; frame < 60; frame++) {
    rig.update(1 / 60, 0.1, { mode: 'first', observer: true, seat: null, inspected: null });
  }
  assert.ok(rig.camera.position.distanceTo(rig.spectatorPosition) < 1e-10);
});

test('alternar durante a subida retoma da posição atual sem saltar', () => {
  const rig = new CameraRig();
  advance(rig, 'first');
  const context = { observer: true, seat: null, inspected: null };
  for (let frame = 0; frame < 12; frame++) {
    rig.update(1 / 60, 0.1, { ...context, mode: 'top' });
  }
  const position = rig.camera.position.clone();
  const rotation = rig.camera.quaternion.clone();
  rig.update(0, 0.1, { ...context, mode: 'first' });
  assert.ok(rig.camera.position.distanceTo(position) < 1e-10);
  assert.ok(rig.camera.quaternion.angleTo(rotation) < 1e-7);
  for (let frame = 0; frame < 90; frame++) {
    rig.update(1 / 60, 0.1, { ...context, mode: 'first' });
  }
  assert.ok(rig.camera.position.distanceTo(rig.spectatorPosition) < 1e-10);
});

test('a vista padrão enquadra cartas centrais de perto e recua para incluir as pilhas', () => {
  for (const aspect of [16 / 9, 9 / 16]) {
    const rig = new CameraRig();
    rig.resize(aspect);
    advance(rig, 'top');
    const distance = rig.camera.position.y - 1.68;
    assert.ok(distance * Math.min(1, aspect) < 3.2);
    rig.update(0.05, 1, {
      mode: 'top',
      observer: true,
      inspected: null,
      seat: null,
      tableBounds: { radius: 2.6, height: 2.2 },
    });
    rig.camera.updateMatrixWorld();
    for (const edge of [new Vector3(2.6, 2.2, 0), new Vector3(0, 2.2, 2.6)]) {
      const projected = edge.project(rig.camera);
      assert.ok(Math.abs(projected.x) < 1);
      assert.ok(Math.abs(projected.y) < 1);
    }
  }
});

test('a seta do dealer acompanha a direção do assento e a orientação da câmera', () => {
  const rig = new CameraRig();
  const seat = new Vector3(0, 0, 3.35);
  rig.update(0.05, 1, { mode: 'top', observer: false, inspected: null, seat });
  assert.ok(dealerDirection(rig.camera, seat).y > 0.99);
  assert.ok(dealerDirection(rig.camera, new Vector3(3.35, 0, 0)).x > 0.99);
  const opposite = new Vector3(0, 0, -3.35);
  rig.update(0.05, 1, { mode: 'top', observer: false, inspected: null, seat: opposite });
  assert.ok(dealerDirection(rig.camera, seat).y < -0.99);
});

test('o trajeto entre cabeça e mesa independe da taxa de quadros', () => {
  const slow = new CameraRig();
  const fast = new CameraRig();
  for (const rig of [slow, fast]) advance(rig, 'first');
  const context = { mode: 'top', observer: true, seat: null, inspected: null } as const;
  for (let frame = 0; frame < 18; frame++) slow.update(1 / 30, 0.2, context);
  for (let frame = 0; frame < 72; frame++) fast.update(1 / 120, 0.05, context);
  assert.ok(slow.camera.position.distanceTo(fast.camera.position) < 1e-10);
  assert.ok(slow.camera.quaternion.angleTo(fast.camera.quaternion) < 1e-7);
});

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
