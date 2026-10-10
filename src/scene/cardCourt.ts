/** Mirrored mechanical royalty: a small original woodcut for Garanto's robot table. */
import { isRedSuit, type Card } from '../game';
import { drawSuit } from './cardSymbols';

const PAPER = '#f4ecda';
const BRASS = '#ae8952';
const CROWNS: Readonly<Record<string, string>> = {
  J: 'M -56 -104 L -58 -126 L 29 -142 L 57 -113 L 46 -104 Z M 20 -137 L 48 -174 L 61 -168 L 41 -124 Z',
  Q: 'M -52 -104 L -66 -131 L -38 -123 L -22 -157 L 0 -132 L 22 -157 L 38 -123 L 66 -131 L 52 -104 Z',
  K: 'M -53 -104 L -63 -153 L -30 -130 L 0 -174 L 30 -130 L 63 -153 L 53 -104 Z',
};

function drawRegalia(context: CanvasRenderingContext2D, card: Card): void {
  context.fillStyle = BRASS;
  context.fill(new Path2D(CROWNS[card.rank] ?? ''));
  context.fillStyle = isRedSuit(card.suit) ? '#a63238' : '#252e2b';
  context.fill(new Path2D('M -28 -8 L -109 44 L -114 105 L 114 105 L 109 44 L 28 -8 Z'));
  context.fillStyle = BRASS;
  context.fill(new Path2D('M -28 -8 L -64 20 L 28 105 L 64 105 Z'));
  context.strokeStyle = PAPER;
  context.lineWidth = 3;
  for (let index = 0; index < 4; index++) {
    const offset = index * 15;
    context.beginPath();
    context.moveTo(-97 + offset, 52);
    context.lineTo(-104 + offset, 97);
    context.stroke();
  }
  context.fillStyle = PAPER;
  drawSuit(context, card.suit, { x: 74, y: 67, size: 37 });
}

function drawRobotPortrait(context: CanvasRenderingContext2D, card: Card): void {
  const ink = isRedSuit(card.suit) ? '#a63238' : '#252e2b';
  context.fillStyle = BRASS;
  context.fillRect(-17, -26, 34, 27);
  context.fillStyle = ink;
  context.fillRect(-62, -80, 124, 29);
  context.fillStyle = PAPER;
  context.strokeStyle = ink;
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(-49, -105, 98, 83, 13);
  context.fill();
  context.stroke();
  context.fillStyle = ink;
  context.fillRect(-36, -81, 72, 24);
  context.fillStyle = BRASS;
  context.fillRect(-28, -76, 19, 14);
  context.fillRect(9, -76, 19, 14);
  context.strokeStyle = ink;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-20, -40);
  context.lineTo(20, -40);
  context.stroke();
  if (card.rank === 'K') {
    context.fillStyle = ink;
    context.fill(new Path2D('M -29 -24 L 29 -24 L 17 0 L 0 10 L -17 0 Z'));
  }
}

function drawCourtHalf(context: CanvasRenderingContext2D, card: Card): void {
  drawRegalia(context, card);
  drawRobotPortrait(context, card);
}

export function drawCourt(context: CanvasRenderingContext2D, card: Card): void {
  context.save();
  context.strokeStyle = BRASS;
  context.lineWidth = 3;
  context.strokeRect(111, 136, 290, 448);
  context.lineWidth = 1;
  context.strokeRect(118, 143, 276, 434);
  context.translate(256, 254);
  drawCourtHalf(context, card);
  context.translate(0, 212);
  context.rotate(Math.PI);
  drawCourtHalf(context, card);
  context.restore();
}
