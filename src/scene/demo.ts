/** The decorative table shown behind the home screen. */
import { COLORS, createPlayer, createState, type Card, type GameState } from '../game';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { id: `${rank}${suit}`, rank, suit };
}

export function demoState(): GameState {
  const players = ['Você', 'Pistache', 'Paçoca', 'Parafuso'].map((name, index) => {
    const player = createPlayer(`demo-${index}`, name, COLORS[index % COLORS.length]);
    player.seated = true;
    player.hand = [card('A', '♠'), card('7', '♥')];
    return player;
  });
  const [owner] = players;
  if (!owner) throw new Error('The demo needs players.');
  const state = createState(owner);
  state.players = players;
  state.dealer = 'demo-1';
  state.turn = 'demo-2';
  state.kicker = card('6', '♦');
  state.table = [
    { playerId: 'demo-1', playerName: 'Pistache', card: card('3', '♣') },
    { playerId: 'demo-2', playerName: 'Paçoca', card: card('K', '♥') },
  ];
  return state;
}
