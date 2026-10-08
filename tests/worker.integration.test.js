import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.GARANTO_INTEGRATION_URL;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function post(path, body) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function connect(identity) {
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/api/connect?token=${encodeURIComponent(identity.token)}`);
  const messages = [];
  socket.addEventListener('message', e => { if (e.data !== 'pong') messages.push(JSON.parse(e.data)); });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true });
    setTimeout(() => reject(new Error('WebSocket não conectou')), 5000).unref();
  });
  return { socket, messages };
}
async function until(predicate) {
  for (let i = 0; i < 80; i++) { if (predicate()) return; await wait(50); }
  assert.fail('Evento esperado não chegou.');
}

test('Cloudflare local: senha, diretório, isolamento de sinalização e transferência de host', { skip: !base, timeout: 20000 }, async () => {
  assert.equal((await post('/api/rooms', { playerName: 'A', capacity: 99 })).status, 400);
  const created = await post('/api/rooms', { name: 'Teste de integração', playerName: 'Host', capacity: 3, lives: 5, password: 'segredo' });
  assert.equal(created.status, 201);
  const roomId = created.data.roomId;
  assert.equal((await post(`/api/rooms/${roomId}/join`, { playerName: 'B', password: 'errada' })).status, 403);
  const joined = await post(`/api/rooms/${roomId}/join`, { playerName: 'Convidado', password: 'segredo' });
  assert.equal(joined.status, 201);
  const another = await post('/api/rooms', { name: 'Outra mesa', playerName: 'Outro host', capacity: 2 });
  const sockets = [];
  try {
    const host = await connect(created.data), guest = await connect(joined.data), outsider = await connect(another.data);
    sockets.push(host.socket, guest.socket, outsider.socket);
    await until(() => guest.messages.some(m => m.type === 'roster'));
    const roster = guest.messages.filter(m => m.type === 'roster').at(-1);
    assert.equal(roster.hostId, created.data.memberId); assert.equal(roster.members.length, 2);
    const list = await (await fetch(`${base}/api/rooms`)).json();
    assert.equal(list.find(r => r.id === roomId).locked, true);
    assert.ok(!JSON.stringify(list).includes('tokenHash'));
    assert.equal((await fetch(`${base}/api/ice`)).status, 401);
    const ice = await (await fetch(`${base}/api/ice`, { headers: { Authorization: `Bearer ${joined.data.token}` } })).json();
    assert.ok(ice.iceServers.length > 0);
    host.socket.send(JSON.stringify({ type: 'signal', to: joined.data.memberId, epoch: roster.epoch, data: { test: 'valid' } }));
    await until(() => guest.messages.some(m => m.type === 'signal' && m.data.test === 'valid'));
    outsider.socket.send(JSON.stringify({ type: 'signal', to: joined.data.memberId, epoch: roster.epoch, data: { test: 'cross-room' } }));
    await wait(150);
    assert.ok(!guest.messages.some(m => m.data?.test === 'cross-room'));
    host.socket.close();
    await until(() => guest.messages.some(m => m.type === 'roster' && m.hostId === joined.data.memberId));
    const migrated = guest.messages.filter(m => m.type === 'roster').at(-1);
    assert.equal(migrated.epoch, roster.epoch + 1);
    assert.ok(migrated.members.find(m => m.id === created.data.memberId).disconnectedAt);
    guest.socket.send(JSON.stringify({ type: 'leave' })); outsider.socket.send(JSON.stringify({ type: 'leave' }));
  } finally { sockets.forEach(ws => ws.close()); }
});
