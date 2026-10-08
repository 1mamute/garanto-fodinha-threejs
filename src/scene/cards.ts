/** Playing card meshes and their canvas-drawn faces. */
import * as THREE from 'three';
import type { Card } from '../game';
import { CARD_HEIGHT, CARD_WIDTH, drawCardArtwork } from './cardArtwork';
import { canvasTexture, disposeMaterials, material } from './primitives';
import type { CardInspection } from './types';

const faceTextures = new Map<string, THREE.CanvasTexture>();

/** Card textures are cached forever: there are only 40 faces plus one back. */
function cardTexture(card: Card | null): THREE.CanvasTexture {
  const key = card?.id ?? 'back';
  const cached = faceTextures.get(key);
  if (cached) return cached;
  const texture = canvasTexture(CARD_WIDTH, CARD_HEIGHT, context => {
    drawCardArtwork(context, card, () => {
      texture.needsUpdate = true;
    });
  });
  texture.anisotropy = 4;
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
