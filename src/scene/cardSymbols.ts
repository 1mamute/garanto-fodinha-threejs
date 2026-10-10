import type { Suit } from '../game';

// Shared vector silhouettes keep the corner indices and centre pips identical at every size.
const SUIT_PATHS: Record<Suit, string> = {
  '♥': 'M 0 0.46 C -0.12 0.28 -0.5 0.02 -0.5 -0.22 C -0.5 -0.53 -0.16 -0.61 0 -0.34 C 0.16 -0.61 0.5 -0.53 0.5 -0.22 C 0.5 0.02 0.12 0.28 0 0.46 Z',
  '♦': 'M 0 -0.53 L 0.4 0 L 0 0.53 L -0.4 0 Z',
  '♠': 'M 0 -0.53 C -0.12 -0.35 -0.48 -0.08 -0.48 0.15 C -0.48 0.4 -0.17 0.45 -0.06 0.22 C -0.06 0.36 -0.1 0.44 -0.2 0.5 L 0.2 0.5 C 0.1 0.44 0.06 0.36 0.06 0.22 C 0.17 0.45 0.48 0.4 0.48 0.15 C 0.48 -0.08 0.12 -0.35 0 -0.53 Z',
  '♣': 'M -0.08 0.21 C -0.31 0.5 -0.62 0.21 -0.44 -0.04 C -0.37 -0.14 -0.25 -0.16 -0.16 -0.12 C -0.42 -0.53 0.42 -0.53 0.16 -0.12 C 0.25 -0.16 0.37 -0.14 0.44 -0.04 C 0.62 0.21 0.31 0.5 0.08 0.21 C 0.08 0.38 0.13 0.45 0.22 0.5 L -0.22 0.5 C -0.13 0.45 -0.08 0.38 -0.08 0.21 Z',
};

interface SymbolPlacement {
  x: number;
  y: number;
  size: number;
  inverted?: boolean;
}

export function drawSuit(
  context: CanvasRenderingContext2D,
  suit: Suit,
  { x, y, size, inverted = false }: SymbolPlacement,
): void {
  context.save();
  context.translate(x, y);
  if (inverted) context.rotate(Math.PI);
  context.scale(size, size);
  context.fill(new Path2D(SUIT_PATHS[suit]));
  context.restore();
}
