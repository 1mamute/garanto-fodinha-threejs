/** One unique map covers the whole floor; grain and scorch marks cost nothing per frame. */
import type * as THREE from 'three';
import { canvasTexture, TAU } from './primitives';

const SIZE = 1024;
let texture: THREE.CanvasTexture | undefined;
type Random = () => number;

export function floorTexture(): THREE.CanvasTexture {
  texture ??= canvasTexture(SIZE, SIZE, drawFloor);
  texture.anisotropy = 4;
  texture.userData.cached = true;
  return texture;
}

function drawFloor(context: CanvasRenderingContext2D): void {
  let seed = 391;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  context.fillStyle = '#100e0c';
  context.fillRect(0, 0, SIZE, SIZE);
  let x = 0;
  while (x < SIZE) {
    const width = 18 + random() * 10;
    let y = -random() * 180;
    while (y < SIZE) {
      const height = 110 + random() * 170;
      drawPlank(context, { x, y, width, height }, random);
      y += height;
    }
    x += width;
  }
  drawScorch(context, random);
}

interface Plank {
  x: number;
  y: number;
  width: number;
  height: number;
}

function drawPlank(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const { x, y, width, height } = plank;
  const shade = Math.floor(38 + random() * 26);
  context.fillStyle = `rgb(${shade + 13}, ${shade + 2}, ${shade - 9})`;
  context.fillRect(x + 0.6, y + 0.6, width - 1.2, height - 1.2);
  context.save();
  context.beginPath();
  context.rect(x + 1, y + 1, width - 2, height - 2);
  context.clip();
  drawGrain(context, plank, random);
  if (random() > 0.55) drawKnot(context, plank, random);
  context.restore();
  context.fillStyle = 'rgba(168, 127, 79, 0.12)';
  context.fillRect(x + 1, y + 1, 0.7, height - 2);
}

function drawGrain(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const { x, y, width, height } = plank;
  for (let index = 0; index < 22; index++) {
    const start = x + random() * width;
    const bend = (random() - 0.5) * 7;
    context.strokeStyle = index % 3 ? 'rgba(12, 8, 5, 0.24)' : 'rgba(170, 126, 76, 0.14)';
    context.lineWidth = 0.3 + random() * 0.7;
    context.beginPath();
    context.moveTo(start, y);
    context.bezierCurveTo(start + bend, y + height * 0.3, start - bend, y + height * 0.7, start, y + height);
    context.stroke();
  }
  for (let index = 0; index < 45; index++) {
    context.fillStyle = 'rgba(8, 6, 4, 0.12)';
    context.fillRect(x + random() * width, y + random() * height, 0.6, 2 + random() * 15);
  }
}

function drawKnot(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const x = plank.x + plank.width * (0.25 + random() * 0.5);
  const y = plank.y + random() * plank.height;
  const width = 1.5 + random() * 2.5;
  for (let ring = 4; ring > 0; ring--) {
    context.strokeStyle = 'rgba(16, 10, 6, 0.35)';
    context.lineWidth = 0.7;
    context.beginPath();
    context.ellipse(x, y, width * ring, width * ring * 3, 0, 0, TAU);
    context.stroke();
  }
  context.fillStyle = '#211810';
  context.beginPath();
  context.ellipse(x, y, width, width * 2.5, 0, 0, TAU);
  context.fill();
}

function drawScorch(context: CanvasRenderingContext2D, random: Random): void {
  for (let patch = 0; patch < 32; patch++) {
    context.save();
    context.translate(random() * SIZE, random() * SIZE);
    context.rotate(random() * TAU);
    context.scale(0.5 + random(), 0.6 + random() * 0.8);
    const radius = 25 + random() * 130;
    const gradient = context.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(5, 4, 3, 0.68)');
    gradient.addColorStop(0.45, 'rgba(15, 9, 4, 0.38)');
    gradient.addColorStop(1, 'rgba(15, 9, 4, 0)');
    context.fillStyle = gradient;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();
  }
}
