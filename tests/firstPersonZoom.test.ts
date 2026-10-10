import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Vector3 } from 'three';
import { sanitizePose } from '../src/net/messages';
import { CameraRig } from '../src/scene/cameraRig';
import { Robot } from '../src/scene/robot';

test('observadores e eliminados podem aproximar a visão sem alterar a caminhada', () => {
  const normal = new CameraRig();
  const zoomed = new CameraRig();
  zoomed.addFirstPersonZoom(-1000);
  const context = { mode: 'first' as const, observer: true, seat: null, inspected: null };
  for (const rig of [normal, zoomed]) {
    rig.keys.add('KeyW');
    rig.update(0.05, 1, context);
  }
  assert.deepEqual(zoomed.spectatorPosition, normal.spectatorPosition);
  assert.deepEqual(zoomed.camera.position, normal.camera.position);
  assert.ok(zoomed.camera.fov < normal.camera.fov);
  assert.ok(zoomed.spectatorPosition.z < 5.5);
});

test('o zoom em primeira pessoa respeita o limite configurável e preserva a posição', () => {
  const rig = new CameraRig();
  const context = { mode: 'first' as const, observer: false, seat: new Vector3(0, 0, 3.35), inspected: null };
  rig.update(0.05, 1, context);
  const position = rig.camera.position.clone();
  const normalFov = rig.camera.fov;
  rig.maxFirstPersonZoom = 1.8;
  rig.addFirstPersonZoom(-100_000);
  rig.update(0.05, 1, context);
  assert.equal(rig.firstPersonZoom, 1.8);
  assert.ok(rig.camera.fov < normalFov);
  assert.deepEqual(rig.camera.position, position);
  rig.update(0.05, 1, { ...context, mode: 'top' });
  const unzoomed = new CameraRig();
  unzoomed.update(0.05, 1, { ...context, mode: 'top' });
  assert.equal(rig.camera.fov, unzoomed.camera.fov);
  rig.addFirstPersonZoom(100_000);
  assert.equal(rig.firstPersonZoom, 1);
  assert.equal(rig.squint, 0);
  rig.maxFirstPersonZoom = 1;
  rig.addFirstPersonZoom(-100_000);
  assert.equal(rig.firstPersonZoom, 1);
});

test('o zoom espreme os dois olhos suavemente e eles reabrem ao afastar', () => {
  const robot = new Robot('#c38e67');
  const head = robot.group.getObjectByName('head');
  assert.ok(head);
  const eyes = head.children.filter(child => child instanceof Group);
  assert.equal(eyes.length, 2);
  robot.animate(0, { yaw: 0, pitch: 0, squint: 1 }, 0.5);
  for (const eye of eyes) assert.ok(eye.scale.y < 1 && eye.scale.y > 0.28);
  robot.animate(0, { yaw: 0, pitch: 0 }, 1);
  for (const eye of eyes) assert.equal(eye.scale.y, 1);
  robot.diedAt = 0;
  robot.animate(2, { yaw: 0, pitch: 0, squint: 1 }, 1);
  for (const eye of eyes) assert.ok(Math.abs(eye.scale.y - 0.2) < 1e-8);
});

test('poses antigas continuam válidas e o aperto dos olhos recebido é limitado', () => {
  assert.deepEqual(sanitizePose({ yaw: 0, pitch: 0 }), { yaw: 0, pitch: 0 });
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, squint: 20 })?.squint, 1);
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, squint: -2 })?.squint, 0);
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, squint: NaN })?.squint, undefined);
});
