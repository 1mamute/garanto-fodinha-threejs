import { finishVote, legalBids, resolveTrick } from './round';
import { RuleError, livingPlayers, nextLivingPlayerId } from './state';
import type { Action, GameState, Player, RandomSource } from './types';

export type MatchAction = Extract<Action, { type: 'bid' | 'play' | 'reorder' | 'vote' }>;

function placeBid(state: GameState, player: Player, value: number): void {
  if (state.phase !== 'bet' || state.turn !== player.id) throw new RuleError('Espere a sua vez de apostar.');
  if (!Number.isInteger(value) || !legalBids(state, player.id).includes(value)) {
    throw new RuleError('Aposta não permitida.');
  }
  player.bid = value;
  const everyoneBid = livingPlayers(state).every(other => other.bid !== null);
  if (everyoneBid) {
    // The player after the dealer leads the first trick, like in the bidding.
    state.phase = 'play';
    state.turn = nextLivingPlayerId(state, state.dealer);
  } else {
    state.turn = nextLivingPlayerId(state, player.id);
  }
}

function playCard(state: GameState, player: Player, cardId: string, now: number): void {
  if (state.phase !== 'play' || state.turn !== player.id) throw new RuleError('Espere a sua vez de jogar.');
  const index = player.hand.findIndex(card => card.id === cardId);
  const [card] = index >= 0 ? player.hand.splice(index, 1) : [];
  if (!card) throw new RuleError('Essa carta não está na sua mão.');
  state.table.push({ playerId: player.id, playerName: player.name, card });
  if (state.table.length === livingPlayers(state).length) resolveTrick(state, now);
  else state.turn = nextLivingPlayerId(state, player.id);
}

/** `ids` must be a permutation of the cards in hand. */
function isPermutationOfHand(player: Player, ids: readonly string[]): boolean {
  const handIds = new Set(player.hand.map(card => card.id));
  return ids.length === handIds.size && new Set(ids).size === ids.length && ids.every(id => handIds.has(id));
}

function reorderHand(state: GameState, player: Player, ids: string[]): void {
  const canReorder = state.phase === 'bet' || state.phase === 'play';
  if (!canReorder || !isPermutationOfHand(player, ids)) throw new RuleError('Ordem de cartas inválida.');
  const cardsById = new Map(player.hand.map(card => [card.id, card]));
  player.hand = ids.flatMap(id => cardsById.get(id) ?? []);
}

function castVote(
  state: GameState,
  player: Player,
  action: Extract<Action, { type: 'vote' }>,
  random: RandomSource,
) {
  if (state.phase !== 'vote') {
    throw new RuleError('Voto inválido.');
  }
  state.votes[player.id] = action.value;
  const everyoneVoted = livingPlayers(state).every(other => state.votes[other.id]);
  if (everyoneVoted) finishVote(state, random);
}

export function applyMatchAction(
  state: GameState,
  player: Player,
  action: MatchAction,
  clock: { now: number; random: RandomSource },
): void {
  if (state.paused) throw new RuleError('Aguardando reconexão.');
  if (player.eliminated || player.spectator) throw new RuleError('Espectadores não jogam.');
  switch (action.type) {
    case 'bid':
      placeBid(state, player, action.value);
      return;
    case 'play':
      playCard(state, player, action.cardId, clock.now);
      return;
    case 'reorder':
      reorderHand(state, player, action.ids);
      return;
    case 'vote':
      castVote(state, player, action, clock.random);
      return;
  }
}
