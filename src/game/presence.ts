import { COLORS } from './constants';
import { cloneState, createPlayer, findPlayer, firstFreeColor, livingPlayers } from './state';
import type { GameState, Player, PresenceMember } from './types';

/** Someone new in the room: they pick a color in the lobby, or watch a running match. */
function addNewcomer(state: GameState, member: PresenceMember): Player {
  const color = firstFreeColor(state) ?? COLORS[COLORS.length - 1];
  const newcomer = createPlayer(member.id, member.name, color);
  newcomer.spectator = state.phase !== 'lobby';
  state.players.push(newcomer);
  return newcomer;
}

function updateConnection(player: Player, member: PresenceMember, now: number): void {
  if (member.connected) {
    player.disconnectedAt = null;
    player.expired = false;
    return;
  }
  // Keep the earliest known disconnection time so the reconnection window never restarts.
  player.disconnectedAt ??= member.disconnectedAt ?? now;
}

/** Players who are not in the room at all (not even reconnecting) count as disconnected. */
function markAbsentPlayers(state: GameState, members: readonly PresenceMember[], now: number): void {
  const memberIds = new Set(members.map(member => member.id));
  for (const player of state.players) {
    if (!player.bot && !memberIds.has(player.id)) player.disconnectedAt ??= now;
  }
}

/** Pauses the clocks while a living player is away, and shifts the deadlines on resume. */
function updatePause(state: GameState, now: number): void {
  const isMatchRunning = state.phase !== 'lobby' && state.phase !== 'finished';
  const someoneMissing = livingPlayers(state).some(player => player.disconnectedAt !== null);
  const shouldPause = isMatchRunning && someoneMissing;
  if (shouldPause && !state.paused) {
    state.paused = true;
    state.pausedAt = now;
  } else if (!shouldPause && state.paused) {
    const pausedFor = now - (state.pausedAt ?? now);
    if (state.dueAt !== null) state.dueAt += pausedFor;
    if (state.voteEndsAt !== null) state.voteEndsAt += pausedFor;
    state.paused = false;
    state.pausedAt = null;
  }
}

/**
 * Syncs the players with the room members the host can currently reach.
 * Returns `state` itself when nothing changed, so callers can skip broadcasting.
 */
export function reconcilePresence(
  state: GameState,
  members: readonly PresenceMember[],
  now: number = Date.now(),
): GameState {
  const next = cloneState(state);
  for (const member of members) {
    const player = findPlayer(next, member.id) ?? (member.retired ? undefined : addNewcomer(next, member));
    if (player && !player.bot) updateConnection(player, member, now);
  }
  markAbsentPlayers(next, members, now);
  updatePause(next, now);
  if (JSON.stringify(next) === JSON.stringify(state)) return state;
  next.version++;
  return next;
}
