import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hotSettings, onSettingsChange, settingsChanged } from '../src/config/hotSettings';
import { CameraRig } from '../src/scene/cameraRig';
import { FIRST_PERSON_CAMERA, TABLE_CAMERA } from '../src/config/cameraSettings';
import { PLAYER_MOVEMENT } from '../src/config/playerSettings';
import { Robot } from '../src/scene/robot';
import { RobotWalking } from '../src/scene/robotWalking';
import { Vector3 } from 'three';

test('salvamentos consecutivos preservam referências e atualizam configurações internas', () => {
  const hot = { data: {} };
  const original = hotSettings(hot, 'lighting', { beam: { opacity: 0.1 }, enabled: true });
  const beam = original.beam;
  for (const opacity of [0.2, 0, 0.4]) {
    const current = hotSettings(hot, 'lighting', { beam: { opacity }, enabled: false });
    assert.equal(current, original);
    assert.equal(current.beam, beam);
    assert.equal(beam.opacity, opacity);
    assert.equal(original.enabled, false);
  }
});

test('alturas derivadas continuam acompanhando as dimensões depois do hot reload', () => {
  const hot = { data: {} };
  const dimensions = (height: number): { height: number; readonly eyeHeight: number } => ({
    height,
    get eyeHeight(): number {
      return this.height + 0.5;
    },
  });
  const original = hotSettings(hot, 'robot', dimensions(2));
  hotSettings(hot, 'robot', dimensions(3));
  assert.equal(original.eyeHeight, 3.5);
  original.height = 4;
  assert.equal(original.eyeHeight, 4.5);
});

test('câmera existente recebe limites e inclinação sem perder a posição do personagem', () => {
  const rig = new CameraRig();
  rig.spectatorPosition.set(2, 3, 5);
  const previous = { zoom: FIRST_PERSON_CAMERA.maxZoom, angle: TABLE_CAMERA.angleDegrees };
  try {
    FIRST_PERSON_CAMERA.maxZoom = 1;
    TABLE_CAMERA.angleDegrees = 30;
    rig.firstPersonZoom = 2;
    settingsChanged('cameraSettings');
    assert.equal(rig.maxFirstPersonZoom, 1);
    assert.equal(rig.firstPersonZoom, 1);
    assert.equal(rig.tableCamera.angleDegrees, 30);
    assert.deepEqual(rig.spectatorPosition.toArray(), [2, 3, 5]);
  } finally {
    FIRST_PERSON_CAMERA.maxZoom = previous.zoom;
    TABLE_CAMERA.angleDegrees = previous.angle;
    settingsChanged('cameraSettings');
  }
});

test('recursos descartados podem cancelar a assinatura das configurações', () => {
  const categories: string[] = [];
  const unsubscribe = onSettingsChange(category => {
    categories.push(category);
  });
  settingsChanged('primeira');
  unsubscribe();
  settingsChanged('segunda');
  assert.deepEqual(categories, ['primeira']);
});

test('velocidade zero desliga os passos sem produzir valores inválidos', () => {
  const previous = PLAYER_MOVEMENT.walkSpeed;
  const robot = new Robot('#648bc1', 'standing');
  const position = new Vector3(0, 0, 5);
  const walking = new RobotWalking(robot, position);
  try {
    PLAYER_MOVEMENT.walkSpeed = 0;
    walking.update({ position, yaw: 0, pitch: 0, deltaSeconds: 1 / 60 });
    robot.group.traverse(object => {
      assert.ok(object.position.toArray().every(Number.isFinite));
      assert.ok(object.quaternion.toArray().every(Number.isFinite));
    });
  } finally {
    PLAYER_MOVEMENT.walkSpeed = previous;
  }
});
