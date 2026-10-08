/** Robot colors. A color can only be used by one player per table. */
export const COLORS = [
  '#e7ad47',
  '#75b7b0',
  '#d97868',
  '#a496cb',
  '#84b466',
  '#e4a4bf',
  '#67a5cf',
  '#e1d4a8',
  '#ba805c',
  '#8f98a7',
] as const;

export const DECK_SIZE = 40;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const MAX_BOTS = MAX_PLAYERS - 1;
export const DEFAULT_LIVES = 5;
export const DEFAULT_CAPACITY = 6;

/** How long a disconnected player keeps their seat before being eliminated. */
export const RECONNECT_MS = 180_000;
/** How long the finished trick stays on the table before it is collected. */
export const TRICK_DISPLAY_MS = 2_800;
/** How long the score screen is shown between rounds. */
export const SCORE_DISPLAY_MS = 6_000;
/** Maximum duration of the "deck ran out" vote. */
export const VOTE_MS = 30_000;

export const MAX_NAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 240;
export const CHAT_HISTORY = 60;
export const ROUND_HISTORY = 30;

export const BOT_NAMES = [
  'Pistache',
  'Parafuso',
  'Paçoca',
  'Pipoca',
  'Latinha',
  'Pudim',
  'Prego',
  'Tico',
  'Bolota',
];
