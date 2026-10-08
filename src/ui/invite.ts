/** Invite links and the requests behind the create/join room forms. */
import { toast } from './feedback';
import type { Modal } from './state';

const ROOM_CODE = /^[a-z0-9]{6}$/i;

/** `?room=ABC123` in the URL opens the join dialog with the code filled in. */
export function inviteModal(): Modal | null {
  const room = new URL(location.href).searchParams.get('room');
  return room && ROOM_CODE.test(room) ? { type: 'join', room: room.toUpperCase() } : null;
}

/** Copies a link to the room; the password is never part of it. */
export async function copyInvite(roomId: string | null): Promise<void> {
  if (!roomId) return;
  const url = new URL(location.href);
  url.searchParams.set('room', roomId);
  try {
    await navigator.clipboard.writeText(url.href);
    toast('Convite copiado! A senha é enviada separadamente.');
  } catch {
    // Clipboard access can be denied: show the code so it can be shared by hand.
    toast(`Código da sala: ${roomId}`);
  }
}

/** The API call for the create or join form, or `null` for other forms. */
export function roomRequest(
  formId: string,
  data: Record<string, string>,
): { path: string; body: object } | null {
  if (formId === 'create-form') {
    return { path: '/rooms', body: { ...data, capacity: Number(data.capacity), lives: Number(data.lives) } };
  }
  if (formId === 'join-form') {
    return { path: `/rooms/${encodeURIComponent((data.room ?? '').toUpperCase())}/join`, body: data };
  }
  return null;
}
