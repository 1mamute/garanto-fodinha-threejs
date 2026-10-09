/** Small, shared surface maps: wear is baked once instead of shaded every frame. */
import * as THREE from 'three';
import { canvasTexture } from './primitives';

type Surface = 'felt' | 'wood' | 'metal';
const textures = new Map<Surface, THREE.CanvasTexture>();
const SIZE = 128;

export function wornTexture(kind: Surface): THREE.CanvasTexture {
  const cached = textures.get(kind);
  if (cached) return cached;
  const texture = canvasTexture(SIZE, SIZE, context => {
    drawSurface(context, kind);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.setScalar(kind === 'felt' ? 5 : 2);
  texture.userData.cached = true;
  textures.set(kind, texture);
  return texture;
}

function drawSurface(context: CanvasRenderingContext2D, kind: Surface): void {
  context.fillStyle = '#b8b2a5';
  context.fillRect(0, 0, SIZE, SIZE);
  let seed = 73;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const count = kind === 'metal' ? 550 : 2600;
  for (let index = 0; index < count; index++) {
    const shade = Math.floor(90 + random() * 140);
    context.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
    const width = kind === 'wood' ? 10 + random() * 45 : 1;
    context.fillRect(random() * SIZE, random() * SIZE, width, 1);
  }
  if (kind === 'metal') drawScratches(context, random);
}

function drawScratches(context: CanvasRenderingContext2D, random: () => number): void {
  for (let index = 0; index < 24; index++) {
    context.fillStyle = index % 2 ? '#d3cbbb' : '#78756f';
    context.fillRect(random() * SIZE, random() * SIZE, 1 + random() * 8, 1);
  }
}
