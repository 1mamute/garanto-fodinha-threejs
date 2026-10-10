import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PeerLink, type PeerHandlers } from '../src/net/peers';

class TestChannel {
  readyState = 'open';
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  onbufferedamountlow: (() => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly label: string) {}

  send(text: string): void {
    this.sent.push(text);
  }
}

class TestConnection {
  static latest: TestConnection | undefined;
  readonly channels = new Map<string, TestChannel>();
  readonly settings = new Map<string, RTCDataChannelInit>();
  localDescription: { toJSON(): RTCSessionDescriptionInit } | null = null;

  constructor() {
    TestConnection.latest = this;
  }

  createDataChannel(label: string, settings: RTCDataChannelInit): TestChannel {
    const channel = new TestChannel(label);
    this.channels.set(label, channel);
    this.settings.set(label, settings);
    return channel;
  }

  createOffer(): Promise<RTCSessionDescriptionInit> {
    return Promise.resolve({ type: 'offer', sdp: 'test' });
  }

  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = { toJSON: () => description };
    return Promise.resolve();
  }

  close(): void {
    for (const channel of this.channels.values()) channel.readyState = 'closed';
  }
}

const handlers: PeerHandlers = {
  onSignal: () => undefined,
  onOpen: () => undefined,
  onClose: () => undefined,
  onMessage: () => undefined,
  onFailed: () => undefined,
};

test('congestionamento preserva jogadas, substitui estados antigos e descarta movimentos atrasados', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'RTCPeerConnection');
  Object.defineProperty(globalThis, 'RTCPeerConnection', { value: TestConnection, configurable: true });
  const peer = new PeerLink('guest', [], handlers);
  try {
    await peer.offer();
    const connection = TestConnection.latest;
    const reliable = connection?.channels.get('garanto');
    const realtime = connection?.channels.get('garanto-realtime');
    if (!reliable || !realtime) assert.fail('Canais não criados');
    assert.deepEqual(connection?.settings.get('garanto-realtime'), { ordered: false, maxRetransmits: 0 });
    reliable.bufferedAmount = 300_000;
    realtime.bufferedAmount = 20_000;
    peer.send('primeiro estado', true);
    peer.send('jogar carta');
    peer.send('estado atual', true);
    peer.sendRealtime('pose antiga');
    assert.deepEqual(reliable.sent, []);
    assert.deepEqual(realtime.sent, []);
    reliable.bufferedAmount = 0;
    reliable.onbufferedamountlow?.();
    assert.deepEqual(reliable.sent, ['jogar carta', 'estado atual']);
    realtime.bufferedAmount = 0;
    peer.sendRealtime('pose atual');
    assert.deepEqual(realtime.sent, ['pose atual']);
    peer.close();
    peer.send('jogada após fechar');
    peer.sendRealtime('pose após fechar');
    assert.equal(reliable.sent.length, 2);
    assert.equal(realtime.sent.length, 1);
  } finally {
    peer.close();
    if (descriptor) Object.defineProperty(globalThis, 'RTCPeerConnection', descriptor);
    else Reflect.deleteProperty(globalThis, 'RTCPeerConnection');
  }
});
