import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Group, Vector3 } from 'three';
import { CameraRig } from '../src/scene/cameraRig';
import { Robot } from '../src/scene/robot';
import { ROBOT_DIMENSIONS } from '../src/scene/robotDimensions';

test('o robô em pé mantém as proporções do sentado e a câmera coincide com seus olhos', () => {
  const seated = new Robot('#c38e67', 'seated');
  const standing = new Robot('#c38e67', 'standing');
  const seatedHead = seated.group.getObjectByName('head');
  const standingHead = standing.group.getObjectByName('head');
  assert.ok(seatedHead && standingHead);
  assert.ok(Math.abs(standingHead.position.y - seatedHead.position.y - ROBOT_DIMENSIONS.thighLength) < 1e-8);
  for (const robot of [seated, standing]) {
    const bounds = new Box3().setFromObject(robot.group);
    assert.ok(Math.abs(bounds.min.y) < 1e-7, 'os pés continuam apoiados no chão');
  }
  const eye = standingHead.children.find(child => child instanceof Group);
  assert.ok(eye);
  standing.group.updateMatrixWorld(true);
  const eyePosition = eye.getWorldPosition(new Vector3());
  const rig = new CameraRig();
  rig.update(0, 1, { mode: 'first', observer: true, seat: null, inspected: null });
  assert.equal(rig.camera.position.y, eyePosition.y);
  rig.update(0, 1, { mode: 'third', observer: true, seat: null, inspected: null });
  rig.update(0, 0.01, { mode: 'first', observer: true, seat: null, inspected: null });
  assert.equal(rig.camera.position.y, eyePosition.y);
});
