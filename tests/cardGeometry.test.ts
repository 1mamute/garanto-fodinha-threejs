import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_SIZE, createCardGeometry } from '../src/scene/cardGeometry';

test('a carta arredondada preserva espessura, frente, verso e orientação da textura', () => {
  const geometry = createCardGeometry();
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  assert.equal(geometry.groups.length, 3);
  assert.deepEqual(geometry.groups.map(group => group.materialIndex).sort(), [0, 1, 2]);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    assert.ok(Math.abs(y) <= CARD_SIZE.height / 2 + 1e-8);
    assert.ok(
      Math.abs(x) < CARD_SIZE.width / 2 - 0.001 || Math.abs(z) < CARD_SIZE.depth / 2 - 0.001,
      'os vértices não ocupam os antigos cantos quadrados',
    );
    if (Math.abs(normals.getY(index)) < 0.5) continue;
    const direction = normals.getY(index) > 0 ? -1 : 1;
    assert.ok(Math.abs(uv.getX(index) - (0.5 + x / CARD_SIZE.width)) < 1e-6);
    assert.ok(Math.abs(uv.getY(index) - (0.5 + (z / CARD_SIZE.depth) * direction)) < 1e-6);
  }
  geometry.dispose();
});
