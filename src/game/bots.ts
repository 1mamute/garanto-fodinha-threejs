import { cardStrength } from './cards';
import { legalBids } from './round';
import { findPlayer, isInPlay } from './state';
import type { Action, Card, GameState, Player, RandomSource } from './types';

/** Rough chance that a card wins a trick, used to turn a hand into an expected number of tricks. */
function winChance(card: Card, kicker: Card | null): number {
  const strength = cardStrength(card, kicker);
  if (strength >= 36) return 0.9; // trumps and the strongest 3s
  if (strength >= 28) return 0.45; // aces, 2s and weaker 3s
  return 0.08;
}

function chooseBid(state: GameState, bot: Player): Action {
  const expected = Math.round(bot.hand.reduce((total, card) => total + winChance(card, state.kicker), 0));
  const options = legalBids(state, bot.id);
  const closest = options.reduce((best, bid) =>
    Math.abs(bid - expected) < Math.abs(best - expected) ? bid : best,
  );
  return { type: 'bid', value: closest };
}

/**
 * Still needs tricks: play the weakest card that beats the table, or else dump the weakest card.
 * Already has enough: play the strongest card that loses, or else get rid of the weakest card.
 */
function chooseCard(state: GameState, bot: Player): Action | null {
  const strength = (card: Card): number => cardStrength(card, state.kicker);
  const weakestFirst = [...bot.hand].sort((first, second) => strength(first) - strength(second));
  const bestOnTable = state.table.reduce((best, entry) => Math.max(best, strength(entry.card)), -1);
  const wantsToWin = bot.won < (bot.bid ?? 0);
  const preferred = wantsToWin
    ? weakestFirst.find(card => strength(card) > bestOnTable)
    : weakestFirst.findLast(card => strength(card) < bestOnTable);
  const card = preferred ?? weakestFirst[0];
  return card ? { type: 'play', cardId: card.id } : null;
}

/** What the bot `botId` wants to do now, or `null` if it has nothing to do. */
export function botAction(
  state: GameState,
  botId: string,
  random: RandomSource = Math.random,
): Action | null {
  const bot = findPlayer(state, botId);
  if (!bot || !isInPlay(bot) || state.paused) return null;
  if (state.phase === 'vote') {
    return state.votes[botId] ? null : { type: 'vote', value: random() < 0.5 ? 'reset' : 'down' };
  }
  if (state.turn !== botId) return null;
  if (state.phase === 'bet') return chooseBid(state, bot);
  if (state.phase === 'play') return chooseCard(state, bot);
  return null;
}
