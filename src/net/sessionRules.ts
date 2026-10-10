import type { GameState } from '../game';

const CHAT_COOLDOWN_MS = 700;
const HOST_ONLY_ACTIONS = new Set<unknown>(['start', 'bots', 'rematch']);

interface ActionContext {
  state: GameState;
  actorId: string;
  hostId: string | null;
  migrating: boolean;
}

/** Room-level permissions live outside the pure card rules. */
export function checkSessionAction(action: unknown, context: ActionContext): void {
  if (context.migrating) throw new Error('A mesa está sincronizando. Aguarde um instante.');
  const type = (action as { type?: unknown } | null)?.type;
  if (HOST_ONLY_ACTIONS.has(type) && context.actorId !== context.hostId) {
    throw new Error('Somente o host pode fazer isso.');
  }
  if (type !== 'chat') return;
  const last = context.state.chat.filter(message => message.playerId === context.actorId).at(-1);
  if (last && Date.now() - last.at < CHAT_COOLDOWN_MS) {
    throw new Error('Espere um instante antes de enviar outra mensagem.');
  }
}
