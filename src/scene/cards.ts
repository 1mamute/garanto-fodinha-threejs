/** Playing card meshes and their canvas-drawn faces. */
import * as THREE from 'three';
import type { Card } from '../game';
import { CARD_HEIGHT, CARD_WIDTH, drawCardArtwork } from './cardArtwork';
import { createCardGeometry } from './cardGeometry';
import { canvasTexture, disposeMaterials, material } from './primitives';
import type { CardInspection } from './types';

const faceTextures = new Map<string, THREE.CanvasTexture>();

/** Card textures are cached forever: there are only 40 faces plus one back. */
function cardTexture(card: Card | null): THREE.CanvasTexture {
  const key = card?.id ?? 'back';
  const cached = faceTextures.get(key);
  if (cached) return cached;
  const texture = canvasTexture(CARD_WIDTH, CARD_HEIGHT, context => {
    drawCardArtwork(context, card);
  });
  texture.anisotropy = 4;
  texture.userData.cached = true;
  faceTextures.set(key, texture);
  return texture;
}

const CARD_GEOMETRY = createCardGeometry();
const EDGE = material('#e5d8be');

/** A card in the world. It eases towards `target`/`targetRotation` every frame. */
export class CardMesh extends THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
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
    // Printed ink needs stable contrast under the bright overhead lamp and in the player's hand.
    const top = new THREE.MeshBasicMaterial({ color: '#dedbd2', map: face, toneMapped: false });
    const bottom = new THREE.MeshBasicMaterial({
      color: '#dedbd2',
      map: cardTexture(null),
      toneMapped: false,
    });
    super(CARD_GEOMETRY, [EDGE, top, bottom]);
    this.details = { card, playerName: '' };
  }

  destroy(): void {
    this.removeFromParent();
    disposeMaterials(this, [EDGE]);
  }
}
