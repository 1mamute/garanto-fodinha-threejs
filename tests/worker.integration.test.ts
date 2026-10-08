// Runs against `npm run dev:cloudflare`: GARANTO_INTEGRATION_URL=http://localhost:8787 npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicRoom, RoomIdentity, ServerMessage } from '../src/shared/protocol';

const baseUrl = process.env.GARANTO_INTEGRATION_URL ?? '';

type RosterMessage = Extract<ServerMessage, { type: 'roster' }>;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function post(path: string, body: object): Promise<{ status: number; data: RoomIdentity }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()) as RoomIdentity };
}

interface Connection {
  socket: WebSocket;
  messages: ServerMessage[];
}

async function connect(identity: RoomIdentity): Promise<Connection> {
  const url = `${baseUrl.replace(/^http/, 'ws')}/api/connect?token=${encodeURIComponent(identity.token)}`;
  const socket = new WebSocket(url);
  const messages: ServerMessage[] = [];
  socket.addEventListener('message', event => {
    const data = String(event.data);
    if (data !== 'pong') messages.push(JSON.parse(data) as ServerMessage);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
    setTimeout(() => {
      reject(new Error('WebSocket não conectou'));
    }, 5000).unref();
  });
  return { socket, messages };
}

async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (predicate()) return;
    await wait(50);
  }
  assert.fail('Evento esperado não chegou.');
}

function lastRoster(connection: Connection): RosterMessage | undefined {
  return connection.messages.filter((message): message is RosterMessage => message.type === 'roster').at(-1);
}

function receivedSignal(connection: Connection, marker: string): boolean {
  return connection.messages.some(
    message => message.type === 'signal' && (message.data as { test?: string } | null)?.test === marker,
  );
}

test(
  'Cloudflare local: senha, diretório, isolamento de sinalização e transferência de host',
  { skip: !baseUrl, timeout: 20_000 },
  async () => {
    assert.equal((await post('/api/rooms', { playerName: 'A', capacity: 99 })).status, 400);
    const created = await post('/api/rooms', {
      name: 'Teste de integração',
      playerName: 'Host',
      capacity: 3,
      lives: 5,
      password: 'segredo',
    });
    assert.equal(created.status, 201);
    const { roomId } = created.data;
    const wrongPassword = await post(`/api/rooms/${roomId}/join`, { playerName: 'B', password: 'errada' });
    assert.equal(wrongPassword.status, 403);
    const joined = await post(`/api/rooms/${roomId}/join`, { playerName: 'Convidado', password: 'segredo' });
    assert.equal(joined.status, 201);
    const another = await post('/api/rooms', { name: 'Outra mesa', playerName: 'Outro host', capacity: 2 });
    const sockets: WebSocket[] = [];
    try {
      const host = await connect(created.data);
      const guest = await connect(joined.data);
      const outsider = await connect(another.data);
      sockets.push(host.socket, guest.socket, outsider.socket);
      await until(() => lastRoster(guest) !== undefined);
      const roster = lastRoster(guest);
      assert.ok(roster);
      assert.equal(roster.hostId, created.data.memberId);
      assert.equal(roster.members.length, 2);

      const list = (await (await fetch(`${baseUrl}/api/rooms`)).json()) as PublicRoom[];
      assert.equal(list.find(room => room.id === roomId)?.locked, true);
      assert.ok(!JSON.stringify(list).includes('tokenHash'));

      assert.equal((await fetch(`${baseUrl}/api/ice`)).status, 401);
      const iceResponse = await fetch(`${baseUrl}/api/ice`, {
        headers: { Authorization: `Bearer ${joined.data.token}` },
      });
      const ice = (await iceResponse.json()) as { iceServers: unknown[] };
      assert.ok(ice.iceServers.length > 0);

      const signal = (marker: string): string =>
        JSON.stringify({
          type: 'signal',
          to: joined.data.memberId,
          epoch: roster.epoch,
          data: { test: marker },
        });
      host.socket.send(signal('valid'));
      await until(() => receivedSignal(guest, 'valid'));
      // Signals never cross rooms, even with a valid member id.
      outsider.socket.send(signal('cross-room'));
      await wait(150);
      assert.ok(!receivedSignal(guest, 'cross-room'));

      host.socket.close();
      await until(() => lastRoster(guest)?.hostId === joined.data.memberId);
      const migrated = lastRoster(guest);
      assert.equal(migrated?.epoch, roster.epoch + 1);
      assert.ok(migrated.members.find(member => member.id === created.data.memberId)?.disconnectedAt);
      guest.socket.send(JSON.stringify({ type: 'leave' }));
      outsider.socket.send(JSON.stringify({ type: 'leave' }));
    } finally {
      for (const socket of sockets) socket.close();
    }
  },
);
