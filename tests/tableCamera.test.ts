import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Raycaster, Vector2, Vector3, Plane } from 'three';
import { CameraRig } from '../src/scene/cameraRig';
import { TABLE_CAMERA } from '../src/scene/cameraSettings';
import { TABLE_RADIUS } from '../src/scene/roomDimensions';
import { TABLE_VIEW_HEIGHT } from '../src/scene/tableCamera';

const top = { mode: 'top', observer: true, seat: null, inspected: null } as const;

function focus(rig: CameraRig): Vector3 {
  rig.camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(), rig.camera);
  const point = raycaster.ray.intersectPlane(
    new Plane(new Vector3(0, 1, 0), -TABLE_VIEW_HEIGHT),
    new Vector3(),
  );
  if (!point) assert.fail('A câmera deve apontar para a mesa');
  return point;
}

test('a inclinação configurável mantém o centro e respeita os limites de ângulo', () => {
  const rig = new CameraRig();
  assert.equal(rig.tableCamera.angleDegrees, TABLE_CAMERA.angleDegrees);
  for (const angle of [0, 15, 30, 45]) {
    rig.tableCamera.angleDegrees = angle;
    rig.update(0, 1, top);
    const direction = rig.camera.getWorldDirection(new Vector3());
    const measured = (Math.acos(-direction.y) * 180) / Math.PI;
    assert.ok(Math.abs(measured - angle) < 1e-6);
    assert.ok(focus(rig).distanceTo(new Vector3(0, TABLE_VIEW_HEIGHT, 0)) < 1e-8);
    assert.ok(rig.camera.position.y <= 4.3);
  }
  rig.tableCamera.angleDegrees = -10;
  assert.equal(rig.tableCamera.angleDegrees, 0);
  rig.tableCamera.angleDegrees = 100;
  assert.equal(rig.tableCamera.angleDegrees, 45);
  rig.tableCamera.angleDegrees = NaN;
  assert.equal(rig.tableCamera.angleDegrees, 45);
});

test('as pilhas ficam enquadradas em todos os ângulos e orientações de tela', () => {
  for (const aspect of [390 / 844, 16 / 10]) {
    for (const angle of [0, 15, 30, 45]) {
      const rig = new CameraRig();
      rig.tableCamera.angleDegrees = angle;
      rig.resize(aspect);
      rig.update(0, 1, { ...top, tableBounds: { radius: 2.6, height: 2.2 } });
      rig.camera.updateMatrixWorld();
      for (let index = 0; index < 32; index++) {
        const bearing = (index * Math.PI * 2) / 32;
        const projected = new Vector3(Math.sin(bearing) * 2.6, 2.2, Math.cos(bearing) * 2.6).project(
          rig.camera,
        );
        assert.ok(
          Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1,
          `ângulo ${angle}°, aspecto ${aspect}`,
        );
      }
    }
  }
});

test('o arrasto acompanha a tela em qualquer assento e para na borda circular', () => {
  for (const seat of [new Vector3(0, 0, 3.35), new Vector3(3.35, 0, 0), new Vector3(-2, 0, -2)]) {
    const rig = new CameraRig();
    const context = { ...top, seat };
    rig.update(0, 1, context);
    const right = new Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion);
    rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(0.2, 0));
    rig.update(0, 1, context);
    const target = focus(rig).setY(0);
    assert.ok(target.dot(right) < 0, 'o conteúdo acompanha o gesto para a direita');
    rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(100, -0.5));
    rig.update(0, 1, context);
    assert.ok(Math.abs(focus(rig).setY(0).length() - TABLE_RADIUS) < 1e-8);
  }
});

test('soltar retorna suavemente ao centro sem alterar zoom ou inclinação', () => {
  const rig = new CameraRig();
  rig.tableCamera.angleDegrees = 30;
  rig.addZoom(-1);
  rig.update(0, 1, top);
  const zoom = rig.zoom;
  const rotation = rig.camera.quaternion.clone();
  rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(0.4, -0.3));
  rig.update(0, 1, top);
  const start = focus(rig).setY(0).length();
  assert.ok(start > 0.1);
  rig.tableCamera.release();
  rig.update(TABLE_CAMERA.returnDurationSeconds / 2, 1, top);
  assert.ok(Math.abs(focus(rig).setY(0).length() - start / 2) < 1e-8);
  rig.update(TABLE_CAMERA.returnDurationSeconds / 2, 1, top);
  assert.ok(focus(rig).setY(0).length() < 1e-8);
  assert.equal(rig.zoom, zoom);
  assert.equal(rig.tableCamera.angleDegrees, 30);
  assert.ok(rig.camera.quaternion.angleTo(rotation) < 1e-7);
});

test('o retorno independe dos quadros e pode ser interrompido por outro arrasto', () => {
  const slow = new CameraRig();
  const fast = new CameraRig();
  for (const rig of [slow, fast]) {
    rig.update(0, 1, top);
    rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(0.5, -0.2));
    rig.tableCamera.release();
  }
  for (let index = 0; index < 18; index++) slow.update(1 / 30, 1, top);
  for (let index = 0; index < 72; index++) fast.update(1 / 120, 1, top);
  assert.ok(focus(slow).distanceTo(focus(fast)) < 1e-8);
  slow.tableCamera.beginDrag();
  const stopped = focus(slow);
  slow.update(2, 1, top);
  assert.ok(focus(slow).distanceTo(stopped) < 1e-8);
});

test('trocar de perspectiva ou inspecionar descarta o deslocamento temporário', () => {
  const rig = new CameraRig();
  rig.tableCamera.angleDegrees = 30;
  for (const mode of ['first', 'third'] as const) {
    rig.update(2, 1, top);
    rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(0.5, 0));
    rig.update(0, 1, { ...top, mode });
    rig.update(2, 1, top);
    assert.ok(focus(rig).setY(0).length() < 1e-8);
  }
  const inspected = new Group();
  new Group().add(inspected);
  rig.tableCamera.pan(rig.camera, new Vector2(), new Vector2(0.5, 0));
  rig.update(0, 1, { ...top, inspected });
  rig.update(0, 1, top);
  assert.ok(focus(rig).setY(0).length() < 1e-8);
  assert.equal(rig.tableCamera.angleDegrees, 30);
});
