/** Traditional CC0 faces, rasterized once at a bounded resolution for the GPU. */
import { isRedSuit, type Card } from '../game';

export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 720;
const PAPER = '#fffaf0';
const SUIT_FILES = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' } as const;

function drawIndex(context: CanvasRenderingContext2D, card: Card): void {
  context.fillStyle = PAPER;
  context.fillRect(9, 13, 78, 173);
  context.fillStyle = isRedSuit(card.suit) ? '#aa202d' : '#111820';
  context.textAlign = 'center';
  context.font = 'bold 76px Georgia';
  context.fillText(card.rank, 48, 83);
  context.font = '64px Georgia';
  context.fillText(card.suit, 48, 150);
}

function drawIndices(context: CanvasRenderingContext2D, card: Card): void {
  context.save();
  drawIndex(context, card);
  context.translate(CARD_WIDTH, CARD_HEIGHT);
  context.rotate(Math.PI);
  drawIndex(context, card);
  context.restore();
}

export function drawCardArtwork(
  context: CanvasRenderingContext2D,
  card: Card | null,
  onReady: () => void,
): void {
  context.fillStyle = PAPER;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (card) drawIndices(context, card);
  else {
    context.fillStyle = '#702c32';
    context.fillRect(20, 20, CARD_WIDTH - 40, CARD_HEIGHT - 40);
  }
  const image = new Image();
  image.onload = () => {
    context.fillStyle = PAPER;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    if (card) drawIndices(context, card);
    onReady();
  };
  const file = card ? `${SUIT_FILES[card.suit]}-${card.rank}.svg` : 'back.svg';
  image.src = `${import.meta.env.BASE_URL}cards/${file}`;
}
