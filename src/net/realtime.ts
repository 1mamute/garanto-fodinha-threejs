import { canWalk, type GameState } from '../game';
import { sanitizePose, type Envelope, type PeerMessage, type Pose } from './messages';
import { sanitizeCardFrame, sanitizeRelease, type CardFrame, type CardRelease } from './sceneMessages';

export interface RealtimeContext {
  state: GameState | null;
  memberId: string;
  hostId: string | null;
  isHost: boolean;
  closed: boolean;
}

interface RealtimeOptions {
  context(): RealtimeContext;
  send(id: string, message: PeerMessage, reliable?: boolean): void;
  broadcast(message: PeerMessage, exceptId?: string): void;
  onPose(id: string, pose: Pose): void;
  onCards(frame: CardFrame): void;
}

/** Epoch-scoped motion cache with authenticated senders and monotonically ordered samples. */
export class RealtimeSession {
  private readonly poses = new Map<string, Extract<PeerMessage, { type: 'pose' }>>();
  private readonly sequences = new Map<string, number>();
  private poseSequence = 0;
  private cardSequence = 0;
  private cards: { type: 'cards'; frame: CardFrame; sequence: number } | null = null;

  constructor(private readonly options: RealtimeOptions) {}

  resetEpoch(): void {
    this.sequences.clear();
    this.poseSequence = 0;
    this.cardSequence = 0;
    this.cards = null;
    for (const pose of this.poses.values()) pose.sequence = 0;
  }

  replay(id: string): void {
    for (const [playerId, pose] of this.poses) {
      if (playerId !== id) this.options.send(id, pose, true);
    }
    if (this.cards) this.options.send(id, this.cards, true);
  }

  sendPose(raw: Pose): void {
    const context = this.options.context();
    if (context.closed || !context.memberId) return;
    const pose = this.validPose(context.memberId, raw);
    if (!pose) return;
    const message: PeerMessage = {
      type: 'pose',
      id: context.memberId,
      pose,
      sequence: ++this.poseSequence,
    };
    this.poses.set(context.memberId, message);
    if (context.isHost) this.options.broadcast(message);
    else if (context.hostId) this.options.send(context.hostId, message);
  }

  sendCards(frame: CardFrame): void {
    const context = this.options.context();
    if (context.closed || !context.isHost || frame.version !== context.state?.version) return;
    const clean = sanitizeCardFrame(frame);
    if (!clean) return;
    this.cards = { type: 'cards', frame: clean, sequence: ++this.cardSequence };
    this.options.broadcast(this.cards);
  }

  receive(peerId: string, message: Envelope): void {
    const context = this.options.context();
    if (context.closed) return;
    if (message.type === 'pose') this.receivePose(peerId, message);
    else if (message.type === 'cards' && !context.isHost && peerId === context.hostId) {
      const frame = sanitizeCardFrame(message.frame);
      if (!frame || !this.acceptSequence('cards', message.sequence)) return;
      this.cards = { type: 'cards', frame, sequence: message.sequence };
      this.syncState();
    }
  }

  syncState(): void {
    const { state } = this.options.context();
    for (const id of this.poses.keys()) {
      if (!state?.players.some(player => player.id === id)) this.poses.delete(id);
    }
    if (this.cards && state?.version === this.cards.frame.version) {
      this.options.onCards(this.cards.frame);
    }
  }

  releaseFor(id: string, raw: unknown): CardRelease | null {
    const player = this.options.context().state?.players.find(member => member.id === id);
    const release = sanitizeRelease(raw);
    if (!release || !player?.hand.some(card => card.id === release.transform.id)) return null;
    return release;
  }

  private receivePose(peerId: string, message: Extract<PeerMessage, { type: 'pose' }>): void {
    const context = this.options.context();
    if (!context.isHost && peerId !== context.hostId) return;
    const id = context.isHost ? peerId : message.id;
    if (typeof id !== 'string' || id === context.memberId) return;
    const pose = this.validPose(id, message.pose);
    if (!pose || !this.acceptSequence(`pose:${id}`, message.sequence)) return;
    const forwarded: PeerMessage = { type: 'pose', id, pose, sequence: message.sequence };
    this.poses.set(id, forwarded);
    this.options.onPose(id, pose);
    if (context.isHost) this.options.broadcast(forwarded, id);
  }

  private validPose(id: string, raw: unknown): Pose | null {
    const player = this.options.context().state?.players.find(member => member.id === id);
    const pose = sanitizePose(raw);
    if (!player || player.bot || player.disconnectedAt !== null || !pose) return null;
    if (!canWalk(player)) delete pose.position;
    if (pose.heldCard && !player.hand.some(card => card.id === pose.heldCard?.id)) {
      pose.heldCard = null;
      pose.reaching = false;
    }
    return pose;
  }

  private acceptSequence(key: string, sequence: number): boolean {
    if (!Number.isSafeInteger(sequence) || sequence < 0) return false;
    if (sequence <= (this.sequences.get(key) ?? -1)) return false;
    this.sequences.set(key, sequence);
    return true;
  }
}
