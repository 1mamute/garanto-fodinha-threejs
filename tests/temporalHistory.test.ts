import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Scene } from 'three';
import { TemporalHistory } from '../src/scene/temporalHistory';

test('histórico temporal só acumula após um quadro sem mudanças', () => {
  const history = new TemporalHistory();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  assert.equal(history.stable(scene, camera), false);
  assert.equal(history.stable(scene, camera), true);
  history.reset();
  assert.equal(history.stable(scene, camera), false);
});

test('movimento da câmera e zoom invalidam a imagem acumulada', () => {
  const history = new TemporalHistory();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  history.stable(scene, camera);
  camera.position.x = 1;
  assert.equal(history.stable(scene, camera), false);
  assert.equal(history.stable(scene, camera), true);
  camera.fov = 30;
  camera.updateProjectionMatrix();
  assert.equal(history.stable(scene, camera), false);
});

test('animação, visibilidade e remoção de objetos invalidam o histórico', () => {
  const history = new TemporalHistory();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const parent = new Group();
  const child = new Group();
  parent.add(child);
  scene.add(parent);
  history.stable(scene, camera);
  child.scale.x = 1.1;
  assert.equal(history.stable(scene, camera), false);
  assert.equal(history.stable(scene, camera), true);
  parent.position.z = 2;
  assert.equal(history.stable(scene, camera), false);
  child.visible = false;
  assert.equal(history.stable(scene, camera), false);
  scene.remove(parent);
  assert.equal(history.stable(scene, camera), false);
});
