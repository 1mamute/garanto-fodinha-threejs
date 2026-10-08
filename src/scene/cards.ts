/** Playing card meshes and their canvas-drawn faces. */
import * as THREE from 'three';
import { isRedSuit, type Card } from '../game';
import { canvasTexture, disposeMaterials, material, TAU } from './primitives';
import type { CardInspection } from './types';

const CARD_WIDTH = 256;
const CARD_HEIGHT = 360;
const faceTextures = new Map<string, THREE.CanvasTexture>();

function drawCorner(context: CanvasRenderingContext2D, card: Card): void {
  context.font = 'bold 48px Georgia';
  context.fillText(card.rank, 22, 58);
  context.font = '42px Georgia';
  context.fillText(card.suit, 23, 103);
}

function drawFace(context: CanvasRenderingContext2D, card: Card): void {
  context.fillStyle = isRedSuit(card.suit) ? '#a0332c' : '#202927';
  drawCorner(context, card);
  // The opposite corner is the same drawing turned upside down.
  context.save();
  context.translate(CARD_WIDTH, CARD_HEIGHT);
  context.rotate(Math.PI);
  drawCorner(context, card);
  context.restore();
  context.textAlign = 'center';
  context.font = '100px Georgia';
  context.fillText(card.suit, 128, 216);
  context.font = 'bold 14px sans-serif';
  context.fillStyle = '#a49b85';
  context.fillText('G A R A N T O', 128, 283);
}

function drawBack(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#68332e';
  context.fillRect(15, 15, 226, 330);
  context.strokeStyle = '#ab8262';
  context.lineWidth = 2;
  // Criss-cross diagonal lines.
  for (let offset = -350; offset < 500; offset += 24) {
    context.beginPath();
    context.moveTo(offset, 15);
    context.lineTo(offset + 330, 345);
    context.moveTo(offset, 345);
    context.lineTo(offset + 330, 15);
    context.stroke();
  }
  context.fillStyle = '#ceb78c';
  context.beginPath();
  context.arc(128, 180, 48, 0, TAU);
  context.fill();
  context.fillStyle = '#532923';
  context.font = 'bold 70px Georgia';
  context.textAlign = 'center';
  context.fillText('G', 128, 204);
}

/** Card textures are cached forever: there are only 40 faces plus one back. */
function cardTexture(card: Card | null): THREE.CanvasTexture {
  const key = card?.id ?? 'back';
  const cached = faceTextures.get(key);
  if (cached) return cached;
  const texture = canvasTexture(CARD_WIDTH, CARD_HEIGHT, context => {
    context.fillStyle = '#efe1c4';
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    context.strokeStyle = '#dccfb7';
    context.lineWidth = 10;
    context.strokeRect(6, 6, 244, 348);
    if (card) drawFace(context, card);
    else drawBack(context);
  });
  texture.userData.cached = true;
  faceTextures.set(key, texture);
  return texture;
}

/** Consolidate the four thin edges into one draw instead of four per card. */
function cardGeometry(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(0.42, 0.012, 0.59);
  const original = geometry.getIndex();
  if (!original) return geometry;
  const indices: number[] = [];
  for (const face of [0, 1, 4, 5, 2, 3]) {
    for (let index = 0; index < 6; index++) indices.push(original.getX(face * 6 + index));
  }
  geometry.setIndex(indices);
  geometry.clearGroups();
  geometry.addGroup(0, 24, 0);
  geometry.addGroup(24, 6, 1);
  geometry.addGroup(30, 6, 2);
  return geometry;
}

const CARD_GEOMETRY = cardGeometry();
const EDGE = material('#ded3ba');

/** A card in the world. It eases towards `target`/`targetRotation` every frame. */
export class CardMesh extends THREE.Mesh<THREE.BoxGeometry, THREE.Material[]> {
  readonly target = new THREE.Vector3();
  targetRotation = 0;
  /** What the inspection panel shows about this card. */
  details: CardInspection;
  /** Position in the owner's hand, for hand cards. */
  index = 0;

  constructor(
    readonly card: Card,
    readonly faceDown = false,
  ) {
    // Consolidated geometry groups: edges, top and bottom.
    const face = cardTexture(faceDown ? null : card);
    // Held faces point away from the ceiling lamp; a little baked fill preserves suit contrast.
    const top = material('#ffffff', {
      map: face,
      emissiveMap: face,
      emissive: '#ffffff',
      emissiveIntensity: 0.3,
    });
    const bottom = material('#ffffff', { map: cardTexture(null) });
    super(CARD_GEOMETRY, [EDGE, top, bottom]);
    this.details = { card, playerName: '' };
  }

  destroy(): void {
    this.removeFromParent();
    disposeMaterials(this, [EDGE]);
  }
}
