/** Static decor: floor, walls, table, plant, the turn spotlight, the dealer chip and chairs. */
import * as THREE from 'three';
import { canvasTexture, material, mesh, sphere, TAU, WOOD } from './primitives';

/** Table surface height; cards lie just above it. */
export const TABLE_TOP = 1.68;

export interface RoomProps {
  /** Spotlight over the player whose turn it is. */
  spotlight: THREE.Group;
  dealerChip: THREE.Mesh;
}

export function buildRoom(world: THREE.Group): RoomProps {
  buildFloorAndWalls(world);
  buildTable(world);
  buildPlant(world);
  return { spotlight: buildSpotlight(world), dealerChip: buildDealerChip(world) };
}

function buildFloorAndWalls(world: THREE.Group): void {
  mesh(new THREE.CylinderGeometry(12, 12, 0.15, 64), material('#d3c7ad'), world, [0, -0.1, 0]).rotation.y =
    Math.PI / 12;
  mesh(new THREE.CylinderGeometry(5.9, 5.9, 0.02, 64), material('#b5bba1'), world, [0, 0.005, 0]);
  for (let ring = 0; ring < 3; ring++) {
    const torus = new THREE.TorusGeometry(5.3 + ring * 0.2, 0.018, 5, 64);
    mesh(torus, material('#d6d5b8'), world, [0, 0.025, 0]).rotation.x = Math.PI / 2;
  }
  const wallMaterial = material('#ded7c4', { side: THREE.BackSide });
  mesh(new THREE.CylinderGeometry(12, 12, 6, 40, 1, true), wallMaterial, world, [0, 2.8, 0]);
  const panelCount = 16;
  for (let panel = 0; panel < panelCount; panel++) {
    const angle = (panel * TAU) / panelCount;
    const position = [Math.sin(angle) * 11.75, 1.4, Math.cos(angle) * 11.75] as const;
    mesh(new THREE.BoxGeometry(0.12, 2.9, 0.18), material('#c2b69a'), world, position).rotation.y = angle;
  }
}

function buildTable(world: THREE.Group): void {
  mesh(new THREE.CylinderGeometry(2.83, 2.83, 0.2, 64), WOOD, world, [0, 1.5, 0]);
  mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.035, 64), material('#386d55'), world, [0, 1.62, 0]);
  mesh(new THREE.TorusGeometry(2.68, 0.025, 8, 64), material('#d5b77a'), world, [0, 1.642, 0]).rotation.x =
    Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.45, 16), WOOD, world, [0, 0.73, 0]);
  for (let leg = 0; leg < 4; leg++) {
    mesh(new THREE.BoxGeometry(0.23, 0.18, 2), WOOD, world, [0, 0.18, 0]).rotation.y = (leg * Math.PI) / 2;
  }
  const logo = new THREE.MeshBasicMaterial({
    map: labelTexture('G A R A N T O', '#9cbd91'),
    transparent: true,
  });
  mesh(new THREE.PlaneGeometry(1.3, 0.32), logo, world, [0, 1.643, -0.8]).rotation.x = -Math.PI / 2;
}

function buildPlant(world: THREE.Group): void {
  const pot = new THREE.Group();
  pot.position.set(-6, 0, -5);
  world.add(pot);
  mesh(new THREE.CylinderGeometry(0.48, 0.32, 0.65, 12), material('#c38e67'), pot, [0, 0.33, 0]);
  for (let leaf = 0; leaf < 9; leaf++) {
    // Leaves spiral up the stem.
    const angle = leaf * 2.4;
    const color = leaf % 2 ? '#628269' : '#426f53';
    const position = [Math.sin(angle) * 0.35, 0.9 + leaf * 0.17, Math.cos(angle) * 0.35] as const;
    sphere(pot, material(color), 0.35, { at: position, scale: [0.55, 1.8, 0.4] }).rotation.z =
      Math.sin(angle) * 0.7;
  }
}

function buildSpotlight(world: THREE.Group): THREE.Group {
  const spotlight = new THREE.Group();
  world.add(spotlight);
  const beam = new THREE.MeshBasicMaterial({
    color: '#fff0ad',
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  mesh(new THREE.ConeGeometry(0.85, 5, 24, 1, true), beam, spotlight, [0, 3.8, 0]);
  const halo = material('#f0ca74', { emissive: '#ce9f35', emissiveIntensity: 0.5 });
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
  return chair;
}

/** A rounded name tag drawn on a canvas. */
export function labelTexture(text: string, color = '#f9edcc'): THREE.CanvasTexture {
  return canvasTexture(512, 128, context => {
    context.fillStyle = '#1b342de6';
    context.beginPath();
    context.roundRect(0, 10, 512, 108, 30);
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
