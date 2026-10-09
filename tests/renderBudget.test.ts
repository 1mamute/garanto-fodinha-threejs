import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RenderBudget } from '../src/scene/renderBudget';

test('celular mantém cadência de 30 quadros sem perder tempo das animações', () => {
  const budget = new RenderBudget(true);
  let rendered = 0;
  let elapsed = 0;
  for (let frame = 0; frame < 120; frame++) {
    const delta = budget.takeFrame(frame / 60, false);
    if (delta) rendered++;
    elapsed += delta;
  }
  assert.equal(rendered, 60);
  assert.ok(Math.abs(elapsed - 2) < 0.04);
  assert.equal(budget.pixelRatio(3), 1);
});

test('renderização lenta reduz resolução até o limite sem alterar regras ou relógio', () => {
  const budget = new RenderBudget(true);
  for (let frame = 0; frame < 200; frame++) budget.takeFrame(frame / 20, false);
  assert.equal(budget.pixelRatio(3), 0.7);
});

test('aba oculta pausa trabalho e retorna sem salto nem redução indevida de resolução', () => {
  const budget = new RenderBudget(false);
  budget.takeFrame(0, false);
  assert.equal(budget.takeFrame(1, true), 0);
  assert.equal(budget.takeFrame(90, false), 1 / 60);
  assert.equal(budget.pixelRatio(2), 1.5);
});
