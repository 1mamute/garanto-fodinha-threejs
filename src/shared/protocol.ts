/**
 * Messages exchanged between the browser and the signaling Worker.
 * Shared by `src/net` and `worker/`, so both sides agree on the wire format.
 */

export const ROOM_PHASES = ['lobby', 'bet', 'play', 'trick', 'score', 'vote', 'finished'] as const;
export type RoomPhase = (typeof ROOM_PHASES)[number];

export interface RoomSettings {
  capacity: number;
  lives: number;
}

/** What the room directory shows. Never contains secrets. */
export interface PublicRoom {
  id: string;
  name: string;
  locked: boolean;
  capacity: number;
  count: number;
  phase: RoomPhase;
  createdAt: number;
}

export interface RosterMember {
  id: string;
  name: string;
  retired: boolean;
  connected: boolean;
  disconnectedAt: number | null;
}

/** Credentials returned when creating or joining a room. */
export interface RoomIdentity {
  roomId: string;
  memberId: string;
  token: string;
  settings: RoomSettings;
}

/** Same shape as the DOM `RTCIceServer`, declared here because the Worker has no DOM types. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  turnConfigured: boolean;
}

export type ServerMessage =
  | {
      type: 'roster';
      room: PublicRoom & { settings: RoomSettings };
      hostId: string;
      /** Increases every time the host changes; stale signals from older hosts are ignored. */
      epoch: number;
      members: RosterMember[];
    }
  /** `data` is an opaque WebRTC payload; the server relays it without looking inside. */
  | { type: 'signal'; from: string; data: unknown; epoch: number };

export type ClientMessage =
  | { type: 'signal'; to: string; epoch: number; data: unknown }
  | { type: 'status'; phase: RoomPhase; botCount: number; spectatorIds: string[] }
  | { type: 'leave' };

export const PING = 'ping';
export const PONG = 'pong';

/** WebSocket close codes (4000–4999 are free for applications). */
export const CLOSE_REPLACED = 4001;
export const CLOSE_RATE_LIMITED = 4008;
