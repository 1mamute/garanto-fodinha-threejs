import { shuffle } from './cards';
import { BOT_NAMES, COLORS, MAX_BOTS, MAX_PLAYERS, MIN_PLAYERS } from './constants';
import { prepareRound } from './round';
import { RuleError, createPlayer, firstFreeColor } from './state';
import type { Action, GameState, Player, RandomSource } from './types';

export type LobbyAction = Extract<Action, { type: 'color' | 'ready' | 'bots' | 'start' | 'rematch' }>;

const LOBBY_ACTION_TYPES = new Set<Action['type']>(['color', 'ready', 'bots', 'start', 'rematch']);

export function isLobbyAction(action: Action): action is LobbyAction {
  return LOBBY_ACTION_TYPES.has(action.type);
}

function chooseColor(state: GameState, player: Player, color: string): void {
  if (player.ready) throw new RuleError('A cor fica fixa enquanto você estiver pronto.');
  const isKnownColor = (COLORS as readonly string[]).includes(color);
  const takenByOther = state.players.some(other => other.id !== player.id && other.color === color);
  if (!isKnownColor || takenByOther) throw new RuleError('Esta cor já está ocupada.');
  player.color = color;
}

function toggleReady(player: Player): void {
  if (player.spectator) throw new RuleError('Aguarde uma vaga para jogar.');
  player.ready = !player.ready;
}

/** Replaces every bot with `requested` new ones, limited by the free seats. */
function setBotCount(state: GameState, requested: number): void {
  if (!Number.isInteger(requested) || requested < 0 || requested > MAX_BOTS) {
    throw new RuleError('Quantidade de bots inválida.');
  }
  state.players = state.players.filter(player => !player.bot);
  state.players.forEach((player, index) => {
    player.spectator = index >= state.settings.capacity;
  });
  const freeSeats = Math.min(state.settings.capacity, MAX_PLAYERS) - state.players.length;
  const count = Math.max(0, Math.min(requested, freeSeats));
  for (let i = 0; i < count; i++) {
    const color = firstFreeColor(state) ?? COLORS[0];
    state.players.push(createPlayer(`bot-${i}`, BOT_NAMES[i] ?? 'Robô', color, true));
  }
}

function startMatch(state: GameState, now: number, random: RandomSource): void {
  const seated = state.players.filter(player => player.seated && !player.spectator);
  const everyoneReady = seated.every(player => player.ready && player.disconnectedAt === null);
  if (seated.length < MIN_PLAYERS || !everyoneReady) {
    throw new RuleError('Precisamos de pelo menos dois jogadores sentados, conectados e prontos.');
  }
  // Spectators keep their chairs without joining the deal or exceeding the match capacity.
  state.players = [...shuffle(seated, random), ...state.players.filter(player => player.spectator)];
  for (const player of state.players) {
    player.lives = state.settings.lives;
    player.eliminated = false;
  }
  const dealer = seated[Math.floor(random() * seated.length)];
  if (dealer) state.dealer = dealer.id;
  prepareRound(state, now, random);
}

function resetPlayerForLobby(player: Player, lives: number): void {
  Object.assign(player, {
    eliminated: false,
    seated: true,
    hand: [],
    tricks: [],
    bid: null,
    won: 0,
    ready: player.bot,
    lives,
  } satisfies Partial<Player>);
}

/** Back to the lobby with the same table. Players who timed out are gone and must rejoin. */
function openRematch(state: GameState): void {
  state.players = state.players.filter(player => !player.expired);
  state.players.forEach((player, index) => {
    resetPlayerForLobby(player, state.settings.lives);
    player.spectator = index >= state.settings.capacity;
  });
  Object.assign(state, {
    phase: 'lobby',
    round: 0,
    cardsPerPlayer: 1,
    mode: 'up',
    winner: null,
    trickWinner: null,
    turn: null,
    history: [],
    table: [],
    votes: {},
    voteEndsAt: null,
    kicker: null,
    paused: false,
    pausedAt: null,
    dueAt: null,
    lastEvent: 'Nova partida! Marquem pronto para começar.',
  } satisfies Partial<GameState>);
}

export function applyLobbyAction(
  state: GameState,
  player: Player,
  action: LobbyAction,
  clock: { now: number; random: RandomSource },
): void {
  switch (action.type) {
    case 'color':
      chooseColor(state, player, action.color);
      return;
    case 'ready':
      toggleReady(player);
      return;
    case 'bots':
      setBotCount(state, action.count);
      return;
    case 'start':
      startMatch(state, clock.now, clock.random);
      return;
    case 'rematch':
      openRematch(state);
      return;
  }
}
