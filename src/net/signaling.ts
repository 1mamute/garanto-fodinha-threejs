import { CLOSE_REPLACED, PING, PONG, type ClientMessage, type ServerMessage } from '../shared/protocol';
import { errorMessage } from '../shared/errors';

const PING_INTERVAL_MS = 20_000;
const MAX_RECONNECT_DELAY_MS = 8_000;

export interface SignalingHandlers {
  onMessage(message: ServerMessage): Promise<void>;
  onStatus(status: string): void;
  onError(message: string): void;
  /** The server closed this socket for good (the session was opened in another tab). */
  onReplaced(message: string): void;
}

/** WebSocket to the room service. Reconnects with a growing delay until `close()` is called. */
export class SignalingSocket {
  private socket: WebSocket | null = null;
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private lastPingAt = 0;
  private closed = false;

  constructor(
    private readonly token: string,
    private readonly handlers: SignalingHandlers,
  ) {}

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.closed) return;
    const url = new URL('/api/connect', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', this.token);
    const socket = new WebSocket(url);
    this.socket = socket;
    this.handlers.onStatus('Conectando à sala…');
    socket.onopen = () => {
      this.retries = 0;
      this.handlers.onStatus('Preparando conexão P2P…');
    };
    socket.onmessage = event => void this.receive(event.data);
    socket.onerror = () => {
      this.handlers.onStatus('Tentando reconectar à sala…');
    };
    socket.onclose = event => {
      this.handleClose(event.code);
    };
  }

  send(message: ClientMessage): void {
    if (this.isOpen) this.socket?.send(JSON.stringify(message));
  }

  /** Idle sockets get dropped by proxies; a periodic ping keeps the connection alive. */
  keepAlive(now: number): void {
    if (now - this.lastPingAt < PING_INTERVAL_MS) return;
    this.lastPingAt = now;
    if (this.isOpen) this.socket?.send(PING);
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  private async receive(data: unknown): Promise<void> {
    if (data === PONG || typeof data !== 'string') return;
    try {
      await this.handlers.onMessage(JSON.parse(data) as ServerMessage);
    } catch (error) {
      this.handlers.onError(`Conexão: ${errorMessage(error)}`);
    }
  }

  private handleClose(code: number): void {
    if (this.closed) return;
    if (code === CLOSE_REPLACED) {
      this.closed = true;
      this.handlers.onReplaced('Esta sessão foi aberta em outra aba.');
      return;
    }
    this.handlers.onStatus('Reconectando… seu lugar fica reservado por 3 minutos.');
    this.retries++;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * this.retries);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
