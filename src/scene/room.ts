/** Static decor: floor, walls, table, plant, the turn spotlight, the dealer chip and chairs. */
import * as THREE from 'three';
import { canvasTexture, material, mesh, TAU, WOOD } from './primitives';
import { ROOM_RADIUS } from './roomDimensions';
import { wornTexture } from './surfaceTextures';

/** Table surface height; cards lie just above it. */
export const TABLE_TOP = 1.68;
const WALL_PANEL_INSET = 0.25;
let shadowMaterial: THREE.MeshBasicMaterial | undefined;

export interface RoomProps {
  /** Spotlight over the player whose turn it is. */
  spotlight: THREE.Group;
  dealerChip: THREE.Mesh;
}

export function buildRoom(world: THREE.Group): RoomProps {
  buildFloorAndWalls(world);
  buildTable(world);
  buildLamp(world);
  buildUtilities(world);
  return { spotlight: buildSpotlight(world), dealerChip: buildDealerChip(world) };
}

function buildFloorAndWalls(world: THREE.Group): void {
  mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 0.15, 64),
    material('#242a29', { map: wornTexture('wood') }),
    world,
    [0, -0.1, 0],
  ).rotation.y = Math.PI / 12;
  mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.02, 48), material('#151e1c'), world, [0, 0.005, 0]);
  const wallMaterial = material('#313a39', { side: THREE.BackSide, map: wornTexture('metal') });
  mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 6, 40, 1, true),
    wallMaterial,
    world,
    [0, 2.8, 0],
  );
  const panelCount = 16;
  const panelRadius = ROOM_RADIUS - WALL_PANEL_INSET;
  for (let panel = 0; panel < panelCount; panel++) {
    const angle = (panel * TAU) / panelCount;
    const position = [Math.sin(angle) * panelRadius, 1.4, Math.cos(angle) * panelRadius] as const;
    mesh(new THREE.BoxGeometry(0.12, 2.9, 0.18), material('#222a29'), world, position).rotation.y = angle;
  }
}

function buildTable(world: THREE.Group): void {
  WOOD.color.set('#694832');
  WOOD.map = wornTexture('wood');
  mesh(new THREE.CylinderGeometry(2.83, 2.83, 0.2, 64), WOOD, world, [0, 1.5, 0]);
  mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 0.035, 64),
    material('#315d49', { map: wornTexture('felt') }),
    world,
    [0, 1.62, 0],
  );
  mesh(new THREE.TorusGeometry(2.73, 0.095, 8, 64), material('#282521'), world, [0, 1.58, 0]).rotation.x =
    Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.45, 16), WOOD, world, [0, 0.73, 0]);
  for (let leg = 0; leg < 4; leg++) {
    mesh(new THREE.BoxGeometry(0.23, 0.18, 2), WOOD, world, [0, 0.18, 0]).rotation.y = (leg * Math.PI) / 2;
  }
  contactShadow(world, 3.15, [0, 0.03, 0]);
}

function buildLamp(world: THREE.Group): void {
  const brass = material('#67533a', { metalness: 0.5, map: wornTexture('metal') });
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), brass, world, [0, 5.55, 0]);
  mesh(new THREE.CylinderGeometry(0.28, 1.05, 0.48, 24, 1, true), brass, world, [0, 4.85, 0]);
  const glow = new THREE.MeshBasicMaterial({ color: '#ffdb9c', side: THREE.DoubleSide });
  mesh(new THREE.CircleGeometry(0.98, 24), glow, world, [0, 4.61, 0]).rotation.x = Math.PI / 2;
}

function buildUtilities(world: THREE.Group): void {
  const steel = material('#343b3a', { map: wornTexture('metal'), metalness: 0.35 });
  const pipe = new THREE.CylinderGeometry(0.07, 0.07, 5, 7);
  for (const x of [-6, 6]) {
    mesh(pipe, steel, world, [x, 2.5, -8]);
    mesh(new THREE.BoxGeometry(1.2, 1.7, 0.35), steel, world, [x - 1, 1.7, -8]);
    const amber = new THREE.MeshBasicMaterial({ color: '#b3824b' });
    mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), amber, world, [x - 1, 2, -7.81]);
  }
  const door = material('#202928', { map: wornTexture('wood') });
  mesh(new THREE.BoxGeometry(1.9, 3.6, 0.18), door, world, [0, 1.8, -12.8]);
  mesh(new THREE.BoxGeometry(0.1, 0.38, 0.12), steel, world, [0.65, 1.7, -12.65]);
}

/** Soft baked contact occlusion avoids a shadow pass for every robot and chair. */
function contactShadow(parent: THREE.Group, radius: number, at: readonly [number, number, number]): void {
  shadowMaterial ??= new THREE.MeshBasicMaterial({
    map: shadowTexture(),
    transparent: true,
    depthWrite: false,
  });
  const shadow = mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), shadowMaterial, parent, at);
  shadow.rotation.x = -Math.PI / 2;
}

function shadowTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, context => {
    const gradient = context.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, '#050909b0');
    gradient.addColorStop(1, '#05090900');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  });
}

function buildSpotlight(world: THREE.Group): THREE.Group {
  const spotlight = new THREE.Group();
  world.add(spotlight);
  const halo = material('#d2aa65', { emissive: '#b58842', emissiveIntensity: 0.35 });
  mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 32), halo, spotlight, [0, 0.04, 0]).rotation.x = Math.PI / 2;
  return spotlight;
}

function buildDealerChip(world: THREE.Group): THREE.Mesh {
  const chip = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.045, 24), material('#fff2ce'), world);
  const texture = canvasTexture(128, 128, context => {
    context.fillStyle = '#fff2ce';
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = '#b3964b';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(64, 64, 57, 0, TAU);
    context.stroke();
    context.fillStyle = '#5f5f37';
    context.font = 'bold 76px Georgia';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('D', 64, 68);
  });
  const face = mesh(
    new THREE.CircleGeometry(0.185, 24),
    new THREE.MeshBasicMaterial({ map: texture }),
    chip,
    [0, 0.023, 0],
  );
  face.rotation.x = -Math.PI / 2;
  return chip;
}

export function buildChair(): THREE.Group {
  const chair = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.95, 0.15, 0.8), WOOD, chair, [0, 0.78, 0]);
  mesh(new THREE.BoxGeometry(0.95, 0.75, 0.13), WOOD, chair, [0, 1.28, -0.39]);
  for (const x of [-0.36, 0.36]) {
    for (const z of [-0.29, 0.29])
      mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.78, 7), WOOD, chair, [x, 0.39, z]);
  }
  contactShadow(chair, 0.64, [0, 0.035, 0]);
  return chair;
}

/** A rounded name tag drawn on a canvas. */
export function labelTexture(text: string, color = '#f9edcc'): THREE.CanvasTexture {
  return canvasTexture(512, 128, context => {
    context.fillStyle = '#111819d9';
    context.beginPath();
    context.roundRect(0, 10, 512, 108, 8);
    context.fill();
    context.fillStyle = color;
    context.font = 'bold 40px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 64, 470);
  });
}

export function nameLabel(text: string): THREE.Sprite {
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTexture(text), transparent: true, depthTest: false }),
  );
  label.scale.set(1.55, 0.39, 1);
  return label;
}
