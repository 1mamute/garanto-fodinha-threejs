import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { smoothing } from '../src/scene/primitives';
import { Robot } from '../src/scene/robot';

function headOf(robot: Robot): THREE.Object3D {
  const head = robot.group.getObjectByName('head');
  assert.ok(head);
  return head;
}

test('a cabeça acompanha um alvo no mundo sem mover o corpo, inclusive com um pai rotacionado', () => {
  const parent = new THREE.Group();
  parent.position.set(3, 0, 1);
  parent.rotation.y = 0.6;
  const robot = new Robot('#c38e67', 'standing');
  robot.group.position.set(2, 0, 5);
  robot.group.rotation.y = Math.PI;
  parent.add(robot.group);
  const head = headOf(robot);
  const target = robot.group.localToWorld(head.position.clone().add(new THREE.Vector3(1, 0.3, 2)));
  const bodyPosition = robot.group.position.clone();
  const bodyOrientation = robot.group.quaternion.clone();
  robot.lookAt(target, smoothing(1 / 60, 7));
  const firstYaw = head.rotation.y;
  assert.ok(firstYaw > 0 && firstYaw < Math.atan2(1, 2));
  for (let i = 0; i < 120; i++) robot.lookAt(target, smoothing(1 / 60, 7));
  const direction = target.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();
  const headDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(
    head.getWorldQuaternion(new THREE.Quaternion()),
  );
  assert.ok(headDirection.angleTo(direction) < 1e-6);
  assert.deepEqual(robot.group.position.toArray(), bodyPosition.toArray());
  assert.ok(robot.group.quaternion.angleTo(bodyOrientation) < 1e-7);
});

test('desligar o acompanhamento restaura suavemente a posição neutra da cabeça', () => {
  const robot = new Robot('#c38e67', 'standing');
  const head = headOf(robot);
  robot.lookAt(new THREE.Vector3(1, 2, 2), 1);
  const turned = head.rotation.y;
  const tilted = head.rotation.x;
  robot.lookAt(null, smoothing(1 / 60, 7));
  assert.ok(head.rotation.y > 0 && head.rotation.y < turned);
  assert.ok(head.rotation.x < 0 && head.rotation.x > tilted);
  for (let i = 0; i < 120; i++) robot.lookAt(null, smoothing(1 / 60, 7));
  assert.ok(head.quaternion.angleTo(new THREE.Quaternion()) < 1e-6);
});

test('alvos atrás ou acima respeitam os limites do pescoço e nunca giram o corpo', () => {
  const robot = new Robot('#c38e67', 'standing');
  const head = headOf(robot);
  robot.lookAt(new THREE.Vector3(1, 10, -2), 1);
  assert.ok(head.rotation.y > 0 && head.rotation.y < Math.PI / 2);
  assert.ok(head.rotation.x < 0 && head.rotation.x > -Math.PI / 2);
  assert.ok(robot.group.quaternion.angleTo(new THREE.Quaternion()) < 1e-7);
  robot.lookAt(head.position.clone(), 1);
  assert.ok(Number.isFinite(head.rotation.x));
  assert.ok(Number.isFinite(head.rotation.y));
});
