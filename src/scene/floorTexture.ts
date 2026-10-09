/** One unique map covers the whole floor; grain and scorch marks cost nothing per frame. */
import type * as THREE from 'three';
import { canvasTexture, TAU } from './primitives';
import { FLOOR_ROTATION, WALL_LAMP_ANGLES } from './roomDimensions';

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
  context.fillStyle = '#070808';
  context.fillRect(0, 0, SIZE, SIZE);
  let x = 0;
  while (x < SIZE) {
    const width = 24 + random() * 14;
    let y = -random() * 180;
    while (y < SIZE) {
      const height = 110 + random() * 170;
      drawPlank(context, { x, y, width, height }, random);
      y += height;
    }
    x += width;
  }
  drawScorch(context, random);
  drawLampPools(context);
}

interface Plank {
  x: number;
  y: number;
  width: number;
  height: number;
}

function drawPlank(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const { x, y, width, height } = plank;
  const shade = Math.floor(30 + random() * 14);
  context.fillStyle = `rgb(${shade + 5}, ${shade + 1}, ${shade - 3})`;
  context.fillRect(x + 0.6, y + 0.6, width - 1.2, height - 1.2);
  context.save();
  context.beginPath();
  context.rect(x + 1, y + 1, width - 2, height - 2);
  context.clip();
  drawGrain(context, plank, random);
  if (random() > 0.72) drawKnot(context, plank, random);
  drawWear(context, plank, random);
  context.restore();
}

function drawGrain(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const { x, y, width, height } = plank;
  for (let index = 0; index < 9; index++) {
    const start = x + random() * width;
    const bend = (random() - 0.5) * 5;
    context.strokeStyle = index % 3 ? 'rgba(4, 5, 5, 0.42)' : 'rgba(87, 73, 53, 0.17)';
    context.lineWidth = 0.7 + random() * 0.8;
    context.beginPath();
    context.moveTo(start, y);
    context.lineTo(start + bend, y + height * 0.3);
    context.lineTo(start - bend * 0.4, y + height * 0.7);
    context.lineTo(start, y + height);
    context.stroke();
  }
}

function drawWear(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const { x, y, width, height } = plank;
  // Broken edge highlights and end splits read as worn boards without bright, uniform outlines.
  context.fillStyle = 'rgba(95, 80, 60, 0.18)';
  for (let chip = 0; chip < 6; chip++) {
    context.fillRect(x + 1, y + random() * height, 1, 3 + random() * 14);
  }
  const split = x + width * (0.2 + random() * 0.6);
  context.strokeStyle = 'rgba(2, 3, 3, 0.65)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(split, y);
  context.lineTo(split + 2, y + 8);
  context.lineTo(split - 1, y + 15 + random() * 15);
  context.stroke();
  context.fillStyle = '#101110';
  context.fillRect(x + 4, y + 4, 1.5, 1.5);
  context.fillRect(x + width - 5, y + 4, 1.5, 1.5);
}

function drawKnot(context: CanvasRenderingContext2D, plank: Plank, random: Random): void {
  const x = plank.x + plank.width * (0.25 + random() * 0.5);
  const y = plank.y + random() * plank.height;
  const width = 1.5 + random() * 2.5;
  for (let ring = 4; ring > 0; ring--) {
    context.strokeStyle = 'rgba(5, 6, 5, 0.4)';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(x, y, width * ring, width * ring * 3, 0.08, 0.3, TAU - 0.4);
    context.stroke();
  }
  context.fillStyle = '#0d0e0c';
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

/** Bake the side lamps into the wood, preserving grain without four extra real-time lights. */
function drawLampPools(context: CanvasRenderingContext2D): void {
  context.save();
  context.globalCompositeOperation = 'screen';
  for (const angle of WALL_LAMP_ANGLES) {
    const localAngle = angle - FLOOR_ROTATION;
    // Cylinder cap UVs use cosine horizontally and sine vertically; canvas Y is inverted.
    const x = SIZE * (0.5 + Math.cos(localAngle) * 0.43);
    const y = SIZE * (0.5 - Math.sin(localAngle) * 0.43);
    const radius = SIZE * 0.19;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(104, 73, 39, 0.42)');
    gradient.addColorStop(0.4, 'rgba(75, 48, 23, 0.2)');
    gradient.addColorStop(1, 'rgba(75, 48, 23, 0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.restore();
}
