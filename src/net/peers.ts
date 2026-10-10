/** One WebRTC connection plus its DataChannel. Gameplay messages travel over this channel. */

/** What peers relay through the signaling server: an SDP description or an ICE candidate. */
export interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface PeerHandlers {
  onSignal(peer: PeerLink, data: SignalData): void;
  onOpen(peer: PeerLink): void;
  onClose(peer: PeerLink): void;
  onMessage(peer: PeerLink, raw: unknown): void;
  /** The connection failed or was closed; the link is unusable. */
  onFailed(peer: PeerLink): void;
}

/** Keep reliable actions queued; replace pending full states when the receiver falls behind. */
const MAX_BUFFERED_BYTES = 262_144;
const MAX_REALTIME_BUFFERED_BYTES = 16_384;

export class PeerLink {
  readonly connection: RTCPeerConnection;
  readonly startedAt = Date.now();
  private channel: RTCDataChannel | null = null;
  private realtime: RTCDataChannel | null = null;
  private readonly pending: { text: string; state: boolean }[] = [];
  /** ICE candidates can arrive before the remote description; they are applied once it is set. */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    readonly id: string,
    iceServers: RTCIceServer[],
    private readonly handlers: PeerHandlers,
  ) {
    this.connection = new RTCPeerConnection({ iceServers });
    this.connection.onicecandidate = event => {
      if (event.candidate) handlers.onSignal(this, { candidate: event.candidate.toJSON() });
    };
    this.connection.ondatachannel = event => {
      this.attach(event.channel);
    };
    this.connection.onconnectionstatechange = () => {
      const { connectionState } = this.connection;
      if (connectionState === 'failed' || connectionState === 'closed') handlers.onFailed(this);
    };
  }

  get isOpen(): boolean {
    return this.channel?.readyState === 'open';
  }

  get isRealtimeOpen(): boolean {
    return this.realtime?.readyState === 'open';
  }

  /** The host starts every connection: it opens the channel and sends the offer. */
  async offer(): Promise<void> {
    this.attach(this.connection.createDataChannel('garanto', { ordered: true }));
    this.attach(this.connection.createDataChannel('garanto-realtime', { ordered: false, maxRetransmits: 0 }));
    await this.connection.setLocalDescription(await this.connection.createOffer());
    this.sendLocalDescription();
  }

  async receiveSignal(data: unknown): Promise<void> {
    const { description, candidate } = parseSignal(data);
    if (description) await this.acceptDescription(description);
    else if (candidate) await this.acceptCandidate(candidate);
  }

  send(text: string, state = false): void {
    if (!this.isOpen) return;
    if (state) {
      const index = this.pending.findIndex(frame => frame.state);
      if (index >= 0) this.pending.splice(index, 1);
    }
    this.pending.push({ text, state });
    this.flush();
  }

  /** Drop obsolete motion instead of delaying gameplay behind retransmissions. */
  sendRealtime(text: string): void {
    if (this.realtime?.readyState === 'open' && this.realtime.bufferedAmount < MAX_REALTIME_BUFFERED_BYTES) {
      this.realtime.send(text);
    }
  }

  close(): void {
    this.pending.length = 0;
    this.connection.close();
  }

  private async acceptDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.connection.setRemoteDescription(description);
    for (const candidate of this.pendingCandidates.splice(0))
      await this.connection.addIceCandidate(candidate);
    if (description.type !== 'offer') return;
    await this.connection.setLocalDescription(await this.connection.createAnswer());
    this.sendLocalDescription();
  }

  private async acceptCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.connection.remoteDescription) await this.connection.addIceCandidate(candidate);
    else this.pendingCandidates.push(candidate);
  }

  private sendLocalDescription(): void {
    const description = this.connection.localDescription;
    if (description) this.handlers.onSignal(this, { description: description.toJSON() });
  }

  private attach(channel: RTCDataChannel): void {
    if (channel.label === 'garanto-realtime') {
      this.realtime = channel;
      channel.onmessage = event => {
        this.handlers.onMessage(this, event.data);
      };
      return;
    }
    this.channel = channel;
    channel.bufferedAmountLowThreshold = MAX_BUFFERED_BYTES / 2;
    channel.onbufferedamountlow = () => {
      this.flush();
    };
    channel.onopen = () => {
      this.handlers.onOpen(this);
    };
    channel.onclose = () => {
      this.handlers.onClose(this);
    };
    channel.onmessage = event => {
      this.handlers.onMessage(this, event.data);
    };
  }

  private flush(): void {
    const channel = this.channel;
    if (channel?.readyState !== 'open') return;
    while (this.pending.length && channel.bufferedAmount < MAX_BUFFERED_BYTES) {
      const frame = this.pending.shift();
      if (frame) channel.send(frame.text);
    }
  }
}

/** Signals come from other browsers through the server, so their shape is checked before use. */
function parseSignal(data: unknown): SignalData {
  if (typeof data !== 'object' || data === null) return {};
  const { description, candidate } = data as Record<string, unknown>;
  const signal: SignalData = {};
  if (isDescription(description)) signal.description = description;
  if (typeof candidate === 'object' && candidate !== null) signal.candidate = candidate;
  return signal;
}

function isDescription(value: unknown): value is RTCSessionDescriptionInit {
  if (typeof value !== 'object' || value === null) return false;
  const { type, sdp } = value as Record<string, unknown>;
  return (type === 'offer' || type === 'answer') && typeof sdp === 'string';
}
