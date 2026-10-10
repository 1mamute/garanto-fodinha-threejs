import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { CardThrow } from '../src/scene/cardThrow';

test('carta pousa no ponto escolhido e depois se acomoda à frente do jogador', () => {
  const card = new THREE.Object3D();
  card.position.set(0, 2, 2.5);
  card.rotation.set(1.2, 0.5, 0.1);
  card.scale.setScalar(0.4);
  const landing = new THREE.Vector3(-1.8, 1.68, -0.5);
  const target = new THREE.Vector3(0, 1.68, 1.45);
  const animation = new CardThrow(card, landing);
  assert.equal(animation.animate(card, 0.28, target, Math.PI), false);
  assert.ok(card.position.distanceTo(landing) < 0.000001);
  assert.ok(card.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 0.000001);
  animation.animate(card, 0.18, target, Math.PI);
  assert.ok(card.position.distanceTo(target) < landing.distanceTo(target));
  assert.equal(card.position.y, target.y);
  assert.equal(animation.animate(card, 0.18, target, Math.PI), true);
  assert.ok(card.position.distanceTo(target) < 0.000001);
  assert.ok(
    card.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)) <
      0.000001,
  );
});

test('trajetória da carta é equivalente em diferentes taxas de quadros', () => {
  const target = new THREE.Vector3(0, 1.68, 1.45);
  const positions = [30, 60, 120].map(rate => {
    const card = new THREE.Object3D();
    card.position.set(0, 2, 2.5);
    const animation = new CardThrow(card, new THREE.Vector3(1.5, 1.68, -1));
    for (let index = 0; index < rate / 2; index++) animation.animate(card, 1 / rate, target, 0);
    return card.position;
  });
  const first = positions[0];
  if (!first) assert.fail('Trajetória ausente');
  for (const position of positions) assert.ok(position.distanceTo(first) < 0.000001);
});
