import { CHAT_HISTORY, MAX_CHAT_LENGTH } from './constants';
import { applyLobbyAction, isLobbyAction } from './lobby';
import { applyMatchAction } from './play';
import { RuleError, cloneState, findPlayer } from './state';
import type { Action, ActionType, Clock, GameState, Player } from './types';

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord => typeof value === 'object' && value !== null;
const always = (): boolean => true;

/**
 * Shape checks for actions that arrive over the network. They only check types;
 * the rule handlers check whether the values are allowed right now.
 */
const ACTION_SHAPES: Record<ActionType, (raw: RawRecord) => boolean> = {
  chat: raw => typeof raw.text === 'string',
  color: raw => typeof raw.color === 'string',
  ready: always,
  start: always,
  rematch: always,
  bots: raw => typeof raw.count === 'number',
  bid: raw => typeof raw.value === 'number',
  play: raw => typeof raw.cardId === 'string',
  reorder: raw => Array.isArray(raw.ids) && raw.ids.every(id => typeof id === 'string'),
  vote: raw => raw.value === 'reset' || raw.value === 'down',
};

function isActionType(type: unknown): type is ActionType {
  return typeof type === 'string' && Object.hasOwn(ACTION_SHAPES, type);
}

export function parseAction(raw: unknown): Action {
  if (!isRecord(raw) || !isActionType(raw.type)) throw new RuleError('Ação desconhecida.');
  if (!ACTION_SHAPES[raw.type](raw)) throw new RuleError('Ação inválida.');
  return raw as unknown as Action;
}

/** Returns whether the chat changed (blank messages are ignored). */
function addChatMessage(state: GameState, author: Player, text: string, now: number): boolean {
  const cleanText = text.trim().slice(0, MAX_CHAT_LENGTH);
  if (!cleanText) return false;
  const message = { id: `${author.id}-${now}-${state.version}`, playerId: author.id, name: author.name };
  state.chat = [...state.chat, { ...message, text: cleanText, at: now }].slice(-CHAT_HISTORY);
  return true;
}

function dispatch(state: GameState, actor: Player, action: Action, clock: Clock): boolean {
  if (action.type === 'chat') return addChatMessage(state, actor, action.text, clock.now);
  const isRematchOffer = action.type === 'rematch' && state.phase === 'finished';
  if (state.phase === 'lobby' || isRematchOffer) {
    if (!isLobbyAction(action)) throw new RuleError('Ação indisponível na sala de espera.');
    applyLobbyAction(state, actor, action, clock);
    return true;
  }
  if (isLobbyAction(action)) throw new RuleError('Ação desconhecida.');
  applyMatchAction(state, actor, action, clock);
  return true;
}

/**
 * The single entry point for player actions. Never mutates `state`: it returns a new state with a
 * bumped version, returns `state` itself when nothing changed, or throws a `RuleError`.
 */
export function applyAction(
  state: GameState,
  actorId: string,
  rawAction: unknown,
  clock: Partial<Clock> = {},
): GameState {
  const { now = Date.now(), random = Math.random } = clock;
  const action = parseAction(rawAction);
  const next = cloneState(state);
  const actor = findPlayer(next, actorId);
  if (!actor) throw new RuleError('Jogador não está nesta mesa.');
  if (!dispatch(next, actor, action, { now, random })) return state;
  next.version++;
  return next;
}
