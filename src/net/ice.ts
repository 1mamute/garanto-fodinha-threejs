import { errorMessage } from '../shared/errors';
import type { IceConfig } from '../shared/protocol';
import { api } from './api';

export const FALLBACK_ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export async function loadIceServers(
  token: string,
  onError: (message: string) => void,
): Promise<RTCIceServer[]> {
  try {
    const config = await api<IceConfig>('/ice', undefined, token);
    return config.iceServers;
  } catch (error) {
    onError(errorMessage(error));
    return FALLBACK_ICE;
  }
}
