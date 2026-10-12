import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TurnNotice, tableTurnPrompt, turnPrompt } from '../src/ui/turnNotice';
import type { SoundKind } from '../src/ui/feedback';
import { startedMatch } from './helpers';

test('avisa uma vez por turno e distingue palpite de jogada', () => {
  const page = { title: 'Garanto', hidden: false };
  let sounds = 0;
  const notice = new TurnNotice(page, () => sounds++);
  const game = { ...startedMatch(), turn: 'human' };
  notice.update(game, 'human', true);
  notice.update({ ...game, version: game.version + 1, lastEvent: 'Nova mensagem' }, 'human', true);
  assert.equal(sounds, 1);
  notice.update({ ...game, phase: 'play' }, 'human', true);
  assert.equal(sounds, 2);
  notice.update({ ...game, turn: 'outro' }, 'human', true);
  notice.update(game, 'human', true);
  assert.equal(sounds, 3);
});

test('identifica a vez dos outros e usa um som discreto sem repetir em atualizações', () => {
  const sounds: SoundKind[] = [];
  const notice = new TurnNotice({ title: 'Garanto', hidden: false }, kind => {
    sounds.push(kind);
  });
  const game = { ...startedMatch(), turn: 'human' };
  const other = game.players.find(player => player.id !== 'human');
  assert.ok(other);
  const otherTurn = { ...game, turn: other.id };
  notice.update(game, 'human', true);
  notice.update(otherTurn, 'human', true);
  notice.update({ ...otherTurn, version: otherTurn.version + 1 }, 'human', true);
  assert.deepEqual(sounds, ['turn', 'turnOther']);
  assert.equal(tableTurnPrompt(otherTurn, 'human'), `Vez de ${other.name} · dar o palpite`);
  assert.equal(
    tableTurnPrompt({ ...otherTurn, phase: 'play' }, 'human'),
    `Vez de ${other.name} · jogar uma carta`,
  );
  assert.equal(tableTurnPrompt({ ...otherTurn, paused: true }, 'human'), null);
});

test('mostra o aviso na aba oculta e restaura o título ao voltar, pausar ou sair', () => {
  const page = { title: 'Título original', hidden: true };
  const notice = new TurnNotice(page, () => undefined);
  const game = { ...startedMatch(), turn: 'human' };
  notice.update(game, 'human', false);
  assert.equal(page.title, 'Sua vez · faça seu palpite — Garanto');
  page.hidden = false;
  notice.refreshTitle();
  assert.equal(page.title, 'Título original');
  page.hidden = true;
  notice.refreshTitle();
  assert.equal(page.title, 'Sua vez · faça seu palpite — Garanto');
  notice.update({ ...game, paused: true }, 'human', false);
  assert.equal(page.title, 'Título original');
  notice.update({ ...game, phase: 'play' }, 'human', false);
  assert.equal(page.title, 'Sua vez · jogue uma carta — Garanto');
  notice.update(null, '', false);
  assert.equal(page.title, 'Título original');
});

test('respeita som desativado e não avisa espectadores nem fases sem ação', () => {
  let sounds = 0;
  const notice = new TurnNotice({ title: 'Garanto', hidden: false }, () => sounds++);
  const game = { ...startedMatch(), turn: 'human' };
  notice.update(game, 'human', false);
  notice.update(game, 'human', true);
  assert.equal(sounds, 0);
  assert.equal(turnPrompt({ ...game, phase: 'trick' }, 'human'), null);
  assert.equal(turnPrompt(game, 'ausente'), null);
  for (const flags of [{ eliminated: true }, { spectator: true }, { seated: false }]) {
    const players = game.players.map(player => (player.id === 'human' ? { ...player, ...flags } : player));
    assert.equal(turnPrompt({ ...game, players }, 'human'), null);
  }
});
