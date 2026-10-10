import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { demoState } from '../src/scene/demo';
import { TableCards } from '../src/scene/tableCards';

test('carta mantém a orientação após o pouso em todos os assentos', () => {
  for (let index = 0; index < 10; index++) {
    const state = demoState();
    const entry = state.table[0];
    if (!entry) assert.fail('Carta da demonstração ausente');
    state.table = [entry];
    state.kicker = null;
    const angle = (index * Math.PI * 2) / 10;
    const world = new THREE.Group();
    const mesh = Object.assign(new THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>(), {
      card: entry.card,
      faceDown: false,
      target: new THREE.Vector3(),
      targetRotation: 0,
      index: 0,
      details: { card: entry.card, playerName: entry.playerName },
      destroy: () => undefined,
    });
    mesh.quaternion.setFromEuler(new THREE.Euler(1.2, angle, 0, 'YXZ'));
    mesh.position.set(0, 2, 2);
    world.add(mesh);
    const cards = new TableCards(world);
    cards.releaseFromHand(mesh, new THREE.Vector3(1, 1.68, 0));
    cards.sync(
      state,
      new Map([
        [
          entry.playerId,
          {
            position: new THREE.Vector3(Math.sin(angle) * 3.35, 0, Math.cos(angle) * 3.35),
            rotation: angle + Math.PI,
          },
        ],
      ]),
    );
    cards.animate(1, 1, null);
    const settled = mesh.quaternion.clone();
    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    assert.ok(settled.angleTo(expected) < 0.000001, 'a carta continua orientada para seu dono');
    for (let frame = 0; frame < 120; frame++) {
      cards.animate(1 / 60, 0.11, null);
      assert.ok(mesh.quaternion.angleTo(settled) < 0.000001, 'a carta pousada não pode voltar a girar');
    }
  }
});
