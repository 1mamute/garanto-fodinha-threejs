/** Original two-colour deck, drawn once per face and shared by both scenes. */
import { isRedSuit, type Card } from '../game';
import { drawCourt } from './cardCourt';
import { drawSuit } from './cardSymbols';

export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 720;
const PAPER = '#f4ecda';
const BLACK_INK = '#252e2b';
const RED_INK = '#a63238';
const BRASS = '#ae8952';
const PIP_ROWS: Readonly<Record<string, readonly number[]>> = {
  '2': [190, 530],
  '3': [190, 360, 530],
  '4': [190, 530],
  '5': [190, 530],
  '6': [190, 360, 530],
  '7': [190, 360, 530],
};

function drawPaper(context: CanvasRenderingContext2D): void {
  context.fillStyle = PAPER;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  // Fixed grain gives every print the same subtle stock without flicker or random dependencies.
  context.fillStyle = '#94764a';
  context.globalAlpha = 0.055;
  for (let index = 0; index < 2400; index++) {
    const x = (index * 137.31) % CARD_WIDTH;
    const y = (index * 97.73) % CARD_HEIGHT;
    context.fillRect(x, y, 1.2, 1.2);
  }
  context.globalAlpha = 1;
  context.strokeStyle = '#d4c5aa';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(13, 13, CARD_WIDTH - 26, CARD_HEIGHT - 26, 22);
  context.stroke();
}

function drawIndex(context: CanvasRenderingContext2D, card: Card): void {
  context.textAlign = 'center';
  context.font = 'bold 78px Georgia, serif';
  context.fillText(card.rank, 57, 94);
  drawSuit(context, card.suit, { x: 57, y: 134, size: 47 });
}

function drawIndices(context: CanvasRenderingContext2D, card: Card): void {
  context.save();
  drawIndex(context, card);
  context.translate(CARD_WIDTH, CARD_HEIGHT);
  context.rotate(Math.PI);
  drawIndex(context, card);
  context.restore();
}

function drawPips(context: CanvasRenderingContext2D, card: Card): void {
  if (card.rank === 'A') {
    drawAce(context, card);
    return;
  }
  const columns = card.rank === '2' || card.rank === '3' ? [256] : [167, 345];
  for (const x of columns) {
    for (const y of PIP_ROWS[card.rank] ?? []) {
      drawSuit(context, card.suit, { x, y, size: 78, inverted: y > CARD_HEIGHT / 2 });
    }
  }
  if (card.rank === '5') drawSuit(context, card.suit, { x: 256, y: 360, size: 78 });
  if (card.rank === '7') drawSuit(context, card.suit, { x: 256, y: 275, size: 78 });
}

function drawAce(context: CanvasRenderingContext2D, card: Card): void {
  context.save();
  context.strokeStyle = BRASS;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(256, 171);
  context.lineTo(391, 360);
  context.lineTo(256, 549);
  context.lineTo(121, 360);
  context.closePath();
  context.stroke();
  drawSuit(context, card.suit, { x: 256, y: 360, size: 184 });
  context.fillStyle = BRASS;
  context.font = 'bold 16px Georgia, serif';
  context.textAlign = 'center';
  context.fillText('G A R A N T O', 256, 592);
  context.translate(CARD_WIDTH, CARD_HEIGHT);
  context.rotate(Math.PI);
  context.fillText('G A R A N T O', 256, 592);
  context.restore();
}

function drawBackPattern(context: CanvasRenderingContext2D): void {
  context.save();
  context.beginPath();
  context.roundRect(30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60, 12);
  context.clip();
  context.fillStyle = '#652b35';
  context.fillRect(30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60);
  context.strokeStyle = '#aa665e';
  context.lineWidth = 2;
  for (let y = 30; y < CARD_HEIGHT; y += 32) {
    for (let x = 30; x < CARD_WIDTH; x += 32) {
      context.beginPath();
      context.moveTo(x, y - 12);
      context.lineTo(x + 12, y);
      context.lineTo(x, y + 12);
      context.lineTo(x - 12, y);
      context.closePath();
      context.stroke();
    }
  }
  context.restore();
}

function drawBackEmblem(context: CanvasRenderingContext2D): void {
  context.save();
  context.translate(CARD_WIDTH / 2, CARD_HEIGHT / 2);
  context.fillStyle = '#652b35';
  context.strokeStyle = '#d5b580';
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(0, 0, 144, 210, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(0, 0, 133, 199, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#ead6ac';
  drawSuit(context, '♠', { x: 0, y: -94, size: 74 });
  drawSuit(context, '♠', { x: 0, y: 94, size: 74, inverted: true });
  context.font = 'bold 29px Georgia, serif';
  context.textAlign = 'center';
  context.fillText('GARANTO', 0, -13);
  context.rotate(Math.PI);
  context.fillText('GARANTO', 0, -13);
  context.restore();
}

function drawBack(context: CanvasRenderingContext2D): void {
  drawBackPattern(context);
  context.strokeStyle = '#d5b580';
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(42, 42, CARD_WIDTH - 84, CARD_HEIGHT - 84, 8);
  context.stroke();
  drawBackEmblem(context);
}

export function drawCardArtwork(context: CanvasRenderingContext2D, card: Card | null): void {
  context.save();
  drawPaper(context);
  if (card) {
    context.fillStyle = isRedSuit(card.suit) ? RED_INK : BLACK_INK;
    drawIndices(context, card);
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') drawCourt(context, card);
    else drawPips(context, card);
  } else drawBack(context);
  context.restore();
}
