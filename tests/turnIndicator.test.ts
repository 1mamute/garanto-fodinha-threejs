import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { turnMarkerPosition } from '../src/scene/turnIndicator';
import { TURN_INDICATOR } from '../src/scene/turnIndicatorSettings';
import { activeTurn } from '../src/shared/activeTurn';
import { startedMatch } from './helpers';

test('seta acompanha o robô visível em retrato e paisagem sem alterar a posição da cadeira', () => {
  for (const aspect of [390 / 844, 16 / 9]) {
    const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
    camera.position.y = TURN_INDICATOR.markerHeight;
    const seat = new Vector3(0.1, 0, -5);
    const original = seat.clone();
    const position = turnMarkerPosition({ camera, seat, aspect });
    const projected = seat.clone().setY(TURN_INDICATOR.markerHeight).project(camera);
    assert.equal(position.offscreen, false);
    assert.ok(Math.abs(position.left - (1 + projected.x) * 50) < 0.001);
    assert.equal(position.top, 50);
    assert.equal(position.angle, Math.PI / 2);
    assert.ok(seat.equals(original));
  }
});

test('seta mantém esquerda e direita atrás da câmera e fica dentro da tela', () => {
  for (const aspect of [390 / 844, 16 / 9]) {
    const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
    camera.position.y = TURN_INDICATOR.markerHeight;
    for (const depth of [-1, 1]) {
      for (const side of [-10, 10]) {
        const position = turnMarkerPosition({ camera, seat: new Vector3(side, 0, depth), aspect });
        assert.equal(position.offscreen, true);
        assert.equal(Math.sign(position.left - 50), Math.sign(side));
        assert.ok(position.left >= 17 && position.left <= 83);
        assert.ok(position.top >= 17 && position.top <= 83);
      }
    }
    const behind = turnMarkerPosition({ camera, seat: new Vector3(0, 0, 5), aspect });
    assert.equal(behind.offscreen, true);
    assert.equal(behind.left, 50);
    assert.ok(behind.top > 50);
  }
});

test('marcadores só apontam jogadores ativos na aposta e na jogada, nunca durante pausas', () => {
  const game = { ...startedMatch(), turn: 'human' };
  assert.equal(activeTurn(game)?.id, 'human');
  assert.equal(activeTurn({ ...game, phase: 'play' })?.id, 'human');
  assert.equal(activeTurn({ ...game, paused: true }), null);
  assert.equal(activeTurn({ ...game, phase: 'trick' }), null);
  assert.equal(activeTurn({ ...game, phase: 'lobby' }), null);
  assert.equal(activeTurn({ ...game, turn: null }), null);
  for (const flags of [{ eliminated: true }, { spectator: true }, { seated: false }]) {
    const players = game.players.map(player => (player.id === 'human' ? { ...player, ...flags } : player));
    assert.equal(activeTurn({ ...game, players }), null);
  }
});
