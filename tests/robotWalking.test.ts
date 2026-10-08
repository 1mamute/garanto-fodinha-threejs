import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { CameraRig } from '../src/scene/cameraRig';
import { Robot } from '../src/scene/robot';
import { RobotWalking } from '../src/scene/robotWalking';

function fixture(): { robot: Robot; rig: CameraRig; walking: RobotWalking } {
  const robot = new Robot('#648bc1', 'standing');
  robot.group.rotation.y = Math.PI;
  const rig = new CameraRig();
  rig.pitch = 0;
  return { robot, rig, walking: new RobotWalking(robot, rig.spectatorPosition) };
}

function step(state: ReturnType<typeof fixture>, deltaSeconds = 1 / 60): void {
  state.rig.update(deltaSeconds, 1, {
    mode: 'third',
    observer: true,
    seat: null,
    inspected: null,
  });
  state.walking.update({
    position: state.rig.spectatorPosition,
    yaw: state.rig.yaw,
    pitch: state.rig.pitch,
    deltaSeconds,
  });
}

function headOrientation(robot: Robot): THREE.Quaternion {
  const head = robot.group.getObjectByName('head');
  assert.ok(head);
  return head.getWorldQuaternion(new THREE.Quaternion());
}

test('o corpo vira suavemente para o deslocamento sem arrastar o olhar', () => {
  const state = fixture();
  state.rig.keys.add('KeyD');
  step(state);
  assert.ok(state.robot.group.rotation.y < Math.PI);
  assert.ok(state.robot.group.rotation.y > Math.PI / 2);
  const expectedLook = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
  assert.ok(headOrientation(state.robot).angleTo(expectedLook) < 1e-7);
  for (let i = 0; i < 60; i++) step(state);
  assert.ok(Math.abs(state.robot.group.rotation.y - Math.PI / 2) < 0.001);
  assert.ok(headOrientation(state.robot).angleTo(expectedLook) < 1e-7);
});

test('diagonais e joystick orientam o corpo pela mesma direção real', () => {
  const keyboard = fixture();
  const touch = fixture();
  keyboard.rig.keys.add('KeyW');
  keyboard.rig.keys.add('KeyD');
  touch.rig.joystick.x = Math.SQRT1_2;
  touch.rig.joystick.y = -Math.SQRT1_2;
  for (let i = 0; i < 30; i++) {
    step(keyboard);
    step(touch);
  }
  assert.ok(Math.abs(keyboard.robot.group.rotation.y - Math.PI * 0.75) < 0.01);
  assert.ok(Math.abs(keyboard.robot.group.rotation.y - touch.robot.group.rotation.y) < 1e-10);
});

test('orbitar parado muda só a cabeça e preserva o corpo', () => {
  const state = fixture();
  state.rig.yaw = 0.8;
  state.rig.pitch = 0.4;
  for (let i = 0; i < 60; i++) step(state);
  assert.equal(state.robot.group.rotation.y, Math.PI);
  const expectedLook = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, Math.PI + 0.8, 0, 'YXZ'));
  assert.ok(headOrientation(state.robot).angleTo(expectedLook) < 1e-6);
  assert.equal(state.robot.group.position.y, 0);
});

test('parar suaviza os passos e movimentos bloqueados não iniciam caminhada', () => {
  const state = fixture();
  state.rig.keys.add('KeyD');
  for (let i = 0; i < 12; i++) step(state);
  const movingHeight = state.robot.group.position.y;
  assert.ok(movingHeight > 0);
  state.rig.keys.clear();
  step(state);
  assert.ok(state.robot.group.position.y > 0);
  assert.ok(state.robot.group.position.y < movingHeight);
  for (let i = 0; i < 120; i++) step(state);
  assert.ok(state.robot.group.position.y < 1e-8);
  state.rig.spectatorPosition.set(0, 2, 11.99);
  const blocked = new RobotWalking(state.robot, state.rig.spectatorPosition);
  state.rig.keys.add('KeyS');
  state.rig.update(0.05, 1, { mode: 'third', observer: true, seat: null, inspected: null });
  blocked.update({ position: state.rig.spectatorPosition, yaw: 0, pitch: 0, deltaSeconds: 0.05 });
  assert.equal(state.robot.group.position.y, 0);
  assert.equal(state.robot.group.rotation.z, 0);
});

test('a rotação usa o arco curto e mantém a suavidade em diferentes taxas de quadros', () => {
  const slow = fixture();
  const fast = fixture();
  for (const state of [slow, fast]) {
    state.robot.group.rotation.y = Math.PI - 0.1;
    state.rig.yaw = 0.2;
    state.rig.keys.add('KeyW');
  }
  step(slow, 1 / 30);
  assert.ok(slow.robot.group.rotation.y > Math.PI - 0.1);
  step(fast, 1 / 60);
  step(fast, 1 / 60);
  assert.ok(Math.abs(slow.robot.group.rotation.y - fast.robot.group.rotation.y) < 1e-10);
  assert.ok(headOrientation(slow.robot).angleTo(headOrientation(fast.robot)) < 1e-7);
});
