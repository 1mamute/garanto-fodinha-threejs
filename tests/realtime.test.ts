import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer, createState } from '../src/game';
import { parseEnvelope, sanitizePose, type PeerMessage, type Pose } from '../src/net/messages';
import { RealtimeSession, type RealtimeContext } from '../src/net/realtime';
import {
  sanitizeCardFrame,
  sanitizeRelease,
  type CardFrame,
  type CardTransform,
} from '../src/net/sceneMessages';

const transform: CardTransform = {
  id: 'A♣',
  position: [1, 2, 3],
  rotation: [0, 0, 0, 1],
  scale: [0.6, 0.6, 0.6],
};

function harness(isHost = true) {
  const state = createState(createPlayer('host', 'Host'));
  state.players.push(createPlayer('guest', 'Convidado'), createPlayer('other', 'Outro'));
  const context: RealtimeContext = {
    state,
    memberId: isHost ? 'host' : 'guest',
    hostId: 'host',
    isHost,
    closed: false,
  };
  const poses: { id: string; pose: Pose }[] = [];
  const cards: CardFrame[] = [];
  const sent: { id: string; message: PeerMessage; reliable: boolean }[] = [];
  const broadcasts: { message: PeerMessage; exceptId: string | undefined }[] = [];
  const realtime = new RealtimeSession({
    context: () => context,
    onPose: (id, pose) => poses.push({ id, pose }),
    onCards: frame => cards.push(frame),
    send: (id, message, reliable = false) => sent.push({ id, message, reliable }),
    broadcast: (message, exceptId) => broadcasts.push({ message, exceptId }),
  });
  return { realtime, context, poses, cards, sent, broadcasts, state };
}

test('movimentos validam números, limites, cartas e época antes de entrar na cena', () => {
  assert.equal(sanitizePose({ yaw: NaN, pitch: 0 }), null);
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, position: [Infinity, 0, 0] }), null);
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, position: [1000, 0, 0] }), null);
  assert.equal(sanitizePose({ yaw: 0, pitch: 0, heldCard: { ...transform, rotation: [0, 0, 0, 0] } }), null);
  assert.equal(parseEnvelope(JSON.stringify({ type: 'pose', epoch: -1 })), null);
  assert.equal(parseEnvelope(JSON.stringify({ type: 'pose', epoch: 1.5 })), null);
  assert.deepEqual(sanitizePose({ yaw: 0, pitch: 0, reaching: true, heldCard: transform }), {
    yaw: 0,
    pitch: 0,
    reaching: true,
    heldCard: transform,
  });
  assert.equal(sanitizeCardFrame({ version: 0, cards: [transform, transform] }), null);
  assert.equal(sanitizeRelease({ transform, landing: [0, 1.68, 0], velocity: [999, 0, 0] }), null);
});

test('host autentica quem move a cabeça, anda e arrasta sem aceitar identidade forjada', () => {
  const { realtime, poses, broadcasts, state } = harness();
  const guest = state.players.find(player => player.id === 'guest');
  if (!guest) assert.fail('Convidado ausente');
  guest.hand = [{ id: 'A♣', rank: 'A', suit: '♣' }];
  const pose: Pose = { yaw: 0.4, pitch: -0.3, position: [2, 3.16, 6], reaching: true, heldCard: transform };
  realtime.receive('guest', { type: 'pose', epoch: 1, sequence: 2, id: 'host', pose });
  assert.deepEqual(poses, [{ id: 'guest', pose }]);
  assert.equal(broadcasts[0]?.exceptId, 'guest');
  realtime.receive('guest', { type: 'pose', epoch: 1, sequence: 1, pose: { yaw: -1, pitch: 0 } });
  assert.equal(poses.length, 1, 'pacote atrasado não desfaz o movimento');
  realtime.receive('intruder', { type: 'pose', epoch: 1, sequence: 3, pose });
  assert.equal(poses.length, 1, 'remetente desconhecido é ignorado');
  guest.seated = true;
  guest.spectator = false;
  realtime.receive('guest', { type: 'pose', epoch: 1, sequence: 3, pose });
  assert.equal(poses.at(-1)?.pose.position, undefined, 'jogador sentado não teletransporta a cadeira');
  guest.hand = [];
  realtime.receive('guest', { type: 'pose', epoch: 1, sequence: 4, pose });
  assert.equal(poses.at(-1)?.pose.heldCard, null, 'carta fora da mão não pode ser arrastada');
});

test('cartas do host aguardam a versão das regras e rejeitam visitantes e pacotes antigos', () => {
  const { realtime, context, cards, state } = harness(false);
  const frame = { version: state.version + 1, cards: [transform] };
  realtime.receive('other', { type: 'cards', epoch: 1, sequence: 1, frame });
  assert.equal(cards.length, 0);
  realtime.receive('host', { type: 'cards', epoch: 1, sequence: 2, frame });
  assert.equal(cards.length, 0, 'canal de movimento pode chegar antes das regras');
  context.state = { ...state, version: frame.version };
  realtime.syncState();
  assert.deepEqual(cards, [frame]);
  realtime.receive('host', { type: 'cards', epoch: 1, sequence: 1, frame: { ...frame, cards: [] } });
  assert.equal(cards.length, 1);
  realtime.resetEpoch();
  realtime.receive('host', { type: 'cards', epoch: 2, sequence: 1, frame });
  assert.equal(cards.length, 2, 'novo host pode reiniciar a sequência');
});

test('reconexão recebe poses e cartas atuais pelo canal confiável', () => {
  const { realtime, sent, state, context } = harness();
  realtime.sendPose({ yaw: 0.3, pitch: -0.2, squint: 0.8 });
  realtime.sendCards({ version: state.version, cards: [transform] });
  realtime.replay('guest');
  assert.deepEqual(
    sent.map(item => [item.id, item.message.type, item.reliable]),
    [
      ['guest', 'pose', true],
      ['guest', 'cards', true],
    ],
  );
  context.closed = true;
  realtime.sendPose({ yaw: 0.9, pitch: 0 });
  realtime.replay('other');
  const replayed = sent.findLast(item => item.message.type === 'pose');
  assert.equal(replayed?.message.type === 'pose' && (replayed.message.pose as Pose).yaw, 0.3);
});

test('lançamento físico só usa carta que pertence ao jogador', () => {
  const { realtime, state } = harness();
  const player = state.players[0];
  if (!player) assert.fail('Host ausente');
  const release = { transform, landing: [0, 1.68, 0], velocity: [1, 0, 2] };
  assert.equal(realtime.releaseFor('host', release), null);
  player.hand = [{ id: 'A♣', rank: 'A', suit: '♣' }];
  assert.deepEqual(realtime.releaseFor('host', release), release);
});
