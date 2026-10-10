import assert from 'node:assert/strict';
import { test } from 'node:test';
import initJolt from 'jolt-physics';
import * as THREE from 'three';
import { CARD_SIZE } from '../src/scene/cardGeometry';
import type { CardMesh } from '../src/scene/cards';
import { demoState } from '../src/scene/demo';
import { PhysicsCards } from '../src/scene/physicsCards';
import { PhysicsCharacter } from '../src/scene/physicsCharacter';
import { PhysicsWorld } from '../src/scene/physicsWorld';
import { playerSpawn } from '../src/scene/playerSpawn';
import { Robot } from '../src/scene/robot';
import { ROBOT_DIMENSIONS } from '../src/scene/robotDimensions';
import { TABLE_TOP } from '../src/scene/room';
import { ROOM_RADIUS } from '../src/scene/roomDimensions';
import { TableCards } from '../src/scene/tableCards';

const runtime = await initJolt();

test('observadores nascem separados e conseguem caminhar com outros corpos conectados', () => {
  const { world, root } = fixture();
  const start = playerSpawn(2);
  const walker = new PhysicsCharacter(world, start);
  try {
    for (const slot of [0, 1]) {
      const robot = new Robot('#5599aa', 'standing');
      robot.group.position.copy(playerSpawn(slot)).setY(0);
      root.add(robot.group);
      world.addRobot(robot.group);
    }
    const position = start.clone();
    for (let frame = 0; frame < 30; frame++) {
      position.copy(walker.move(position, position.clone().add(new THREE.Vector3(0.045, 0, 0)), 1 / 60));
    }
    assert.ok(position.distanceTo(start) > 1, 'os corpos remotos não bloqueiam o nascimento');
  } finally {
    walker.dispose();
    world.dispose();
  }
});

function fixture(): { world: PhysicsWorld; root: THREE.Group } {
  const world = new PhysicsWorld(runtime);
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 0.15, 64));
  floor.position.y = -0.075;
  root.add(floor);
  world.addSolids(root);
  return { world, root };
}

function cardMesh(): CardMesh {
  const card = demoState().table[0]?.card;
  if (!card) assert.fail('Carta da demonstração ausente');
  const { width, height, depth } = CARD_SIZE;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), [new THREE.MeshBasicMaterial()]);
  return Object.assign(mesh, {
    card,
    faceDown: false,
    target: new THREE.Vector3(),
    targetRotation: 0,
    index: 0,
    details: { card, playerName: 'Teste' },
    destroy: () => {
      mesh.removeFromParent();
    },
  });
}

function simulate(world: PhysicsWorld, seconds: number, step = 1 / 60): void {
  for (let index = 0; index < Math.round(seconds / step); index++) world.step(step);
}

function addFelt(world: PhysicsWorld, root: THREE.Group): void {
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.035, 64));
  felt.position.y = 1.62;
  root.add(felt);
  world.addSolids(felt);
}

function animateCard(world: PhysicsWorld, physics: PhysicsCards, card: CardMesh, seconds: number): void {
  for (let index = 0; index < Math.round(seconds * 60); index++) {
    world.step(1 / 60);
    physics.animate(card, 1 / 60, null);
  }
}

test('Jolt aplica gravidade e impede que uma carta fina atravesse o chão', () => {
  const { world, root } = fixture();
  try {
    const card = cardMesh();
    card.position.set(0, 3, 5);
    root.add(card);
    world.addCard(card, true);
    simulate(world, 0.2);
    assert.ok(card.position.y < 2.9 && card.position.y > 2.6);
    simulate(world, 2);
    assert.ok(Math.abs(card.position.y - CARD_SIZE.height / 2) < 0.012);
    assert.ok(card.quaternion.angleTo(new THREE.Quaternion()) < 0.000001);
  } finally {
    world.dispose();
  }
});

test('colisão contínua segura uma carta lançada em alta velocidade', () => {
  const { world, root } = fixture();
  try {
    const card = cardMesh();
    card.position.set(0, 2, 5);
    root.add(card);
    world.addCard(card, true);
    world.setVelocity(card, new THREE.Vector3(0, -100, 0));
    simulate(world, 1);
    assert.ok(card.position.y >= -0.005, 'a carta não atravessa o piso entre passos');
  } finally {
    world.dispose();
  }
});

test('a borda circular da mesa tem colisão horizontal alinhada ao desenho', () => {
  const { world, root } = fixture();
  try {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.73, 0.095, 8, 64));
    rail.position.y = 1.58;
    rail.rotation.x = Math.PI / 2;
    root.add(rail);
    world.addSolids(rail);
    const card = cardMesh();
    card.position.set(2.73, 3, 0);
    root.add(card);
    world.addCard(card, true);
    simulate(world, 2);
    assert.ok(Math.abs(card.position.y - 1.681) < 0.015);
  } finally {
    world.dispose();
  }
});

test('a caminhada colide com o robô e desliza ao lado dele', () => {
  const { world, root } = fixture();
  const start = new THREE.Vector3(0, ROBOT_DIMENSIONS.eyeHeight, 5);
  const walker = new PhysicsCharacter(world, start);
  try {
    const robot = new Robot('#648bc1', 'standing');
    robot.group.position.set(0, 0, 3);
    root.add(robot.group);
    world.addRobot(robot.group);
    let position = start.clone();
    for (let index = 0; index < 180; index++) {
      world.step(1 / 60);
      position = walker.move(position, position.clone().add(new THREE.Vector3(0, 0, -0.045)), 1 / 60).clone();
    }
    assert.ok(position.z > 3.9 && position.z < 4.2);
    const blocked = position.clone();
    for (let index = 0; index < 120; index++) {
      position = walker
        .move(position, position.clone().add(new THREE.Vector3(0.035, 0, -0.035)), 1 / 60)
        .clone();
    }
    assert.ok(position.x > blocked.x + 2, 'a componente tangente continua andando');
    assert.ok(position.z < 3, 'é possível contornar o robô');
    assert.ok(Math.abs(position.y - ROBOT_DIMENSIONS.eyeHeight) < 0.03);
  } finally {
    walker.dispose();
    world.dispose();
  }
});

test('a parede circular não bloqueia o centro e contém a caminhada', () => {
  const { world, root } = fixture();
  const start = new THREE.Vector3(0, ROBOT_DIMENSIONS.eyeHeight, 5);
  const walker = new PhysicsCharacter(world, start);
  try {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 6, 40, 1, true));
    wall.position.y = 2.8;
    root.add(wall);
    world.addSolids(wall);
    let position = start.clone();
    for (let index = 0; index < 360; index++) {
      position = walker.move(position, position.clone().add(new THREE.Vector3(0, 0, 0.045)), 1 / 60).clone();
    }
    assert.ok(position.z > 12.7 && position.z < ROOM_RADIUS - 0.5);
    for (let index = 0; index < 360; index++) {
      position = walker.move(position, position.clone().add(new THREE.Vector3(0, 0, -0.045)), 1 / 60).clone();
    }
    assert.ok(position.z < 0, 'a parede é oca e deixa o centro livre');
  } finally {
    walker.dispose();
    world.dispose();
  }
});

test('carta cai no feltro e a coleta preserva seu corpo e sua identidade', () => {
  const { world, root } = fixture();
  const physics = new PhysicsCards(world);
  try {
    addFelt(world, root);
    const state = demoState();
    const entry = state.table[0];
    const player = state.players[0];
    if (!entry || !player) assert.fail('Demonstração incompleta');
    state.table = [entry];
    state.kicker = null;
    const card = cardMesh();
    card.position.set(0, 2.2, 2.2);
    root.add(card);
    const cards = new TableCards(root, physics);
    cards.releaseFromHand(card, new THREE.Vector3(0, TABLE_TOP, 1.45));
    const seats = new Map([[entry.playerId, { position: new THREE.Vector3(0, 0, 3.35), rotation: Math.PI }]]);
    cards.sync(state, seats);
    for (let index = 0; index < 360; index++) {
      world.step(1 / 60);
      cards.animate(1 / 60, 0.1, null);
    }
    assert.ok(card.position.distanceTo(card.target) < 0.001);
    const count = world.bodyCount;
    state.table = [];
    player.tricks = [{ entries: [entry], winningCardId: entry.card.id }];
    seats.set(player.id, { position: new THREE.Vector3(3.35, 0, 0), rotation: Math.PI * 1.5 });
    cards.sync(state, seats);
    for (let index = 0; index < 180; index++) {
      world.step(1 / 60);
      cards.animate(1 / 60, 0.1, null);
    }
    assert.equal(cards.pickable[0], card);
    assert.equal(world.bodyCount, count);
    assert.ok(card.position.distanceTo(card.target) < 0.001);
    player.tricks = [];
    cards.sync(state, seats);
    assert.equal(world.bodyCount, count - 1);
    assert.equal(card.parent, null);
  } finally {
    physics.dispose();
    world.dispose();
  }
});

test('passos fixos produzem a mesma queda a 30 e 60 quadros por segundo', () => {
  const results: number[] = [];
  for (const step of [1 / 30, 1 / 60]) {
    const { world, root } = fixture();
    try {
      const card = cardMesh();
      card.position.set(0, 3, 5);
      root.add(card);
      world.addCard(card, true);
      simulate(world, 0.5, step);
      results.push(card.position.y);
    } finally {
      world.dispose();
    }
  }
  assert.equal(results[0], results[1]);
});

test('a carta permanece livre no feltro por alguns segundos antes de retornar ao jogador', () => {
  const { world, root } = fixture();
  const physics = new PhysicsCards(world);
  try {
    addFelt(world, root);
    const card = cardMesh();
    card.position.set(0, 2.2, 2.2);
    card.target.set(0, TABLE_TOP, 1.45);
    root.add(card);
    physics.add(card, new THREE.Vector3(0, TABLE_TOP, -0.5));
    animateCard(world, physics, card, 1.5);
    assert.ok(
      card.position.distanceTo(card.target) > 0.5,
      'o retorno não deve começar logo após o primeiro contato com o feltro',
    );
  } finally {
    physics.dispose();
    world.dispose();
  }
});

test('um arraste mais rápido aumenta o impacto e o deslizamento físico da carta', () => {
  const results = [0.5, 4].map(speed => {
    const { world, root } = fixture();
    const physics = new PhysicsCards(world);
    try {
      addFelt(world, root);
      const card = cardMesh();
      card.position.set(0, 2.2, 1.8);
      card.target.set(0, TABLE_TOP, 1.45);
      root.add(card);
      physics.add(card, new THREE.Vector3(0, TABLE_TOP, 1.5), new THREE.Vector3(0, 0, -speed));
      animateCard(world, physics, card, 0.1);
      const height = card.position.y;
      animateCard(world, physics, card, 0.5);
      return { height, distance: 1.8 - card.position.z };
    } finally {
      physics.dispose();
      world.dispose();
    }
  });
  const [slow, fast] = results;
  if (!slow || !fast) assert.fail('Lançamentos ausentes');
  assert.ok(fast.height < slow.height - 0.05, 'o gesto rápido lança a carta para baixo com mais força');
  assert.ok(fast.distance > slow.distance + 0.3, 'o atrito desacelera o impulso maior ao longo do feltro');
});

test('a espera configurada precede um retorno lento que começa e termina suavemente', () => {
  const { world, root } = fixture();
  const physics = new PhysicsCards(world, { slideSeconds: 1, returnSeconds: 2 });
  try {
    addFelt(world, root);
    const card = cardMesh();
    card.position.set(0, TABLE_TOP + 0.1, 1);
    card.target.set(1.4, TABLE_TOP, 1);
    root.add(card);
    physics.add(card, new THREE.Vector3(0, TABLE_TOP, 1));
    animateCard(world, physics, card, 1);
    const waitingX = card.position.x;
    assert.equal(waitingX, 0, 'a carta não é guiada durante a espera');
    animateCard(world, physics, card, 0.15);
    assert.ok(card.position.x > 0 && card.position.x < 0.015, 'o retorno começa sem tranco');
    animateCard(world, physics, card, 0.5);
    assert.ok(card.position.distanceTo(card.target) > 0.8, 'meio segundo não basta para voltar ao lugar');
    animateCard(world, physics, card, 1.7);
    assert.ok(card.position.distanceTo(card.target) < 1e-6, 'a duração configurada completa o retorno');
  } finally {
    physics.dispose();
    world.dispose();
  }
});

test('coletar a vaza durante o deslizamento interrompe a espera sem trocar o corpo da carta', () => {
  const { world, root } = fixture();
  const physics = new PhysicsCards(world, { slideSeconds: 10, returnSeconds: 1.5 });
  try {
    addFelt(world, root);
    const card = cardMesh();
    card.position.set(0, 2.2, 1.8);
    card.target.set(0, TABLE_TOP, 1.45);
    root.add(card);
    physics.add(card, new THREE.Vector3(0, TABLE_TOP, 0.5), new THREE.Vector3(0, 0, -2));
    animateCard(world, physics, card, 0.5);
    const count = world.bodyCount;
    card.target.set(1, TABLE_TOP, 1);
    world.step(1 / 60);
    const position = card.position.clone();
    physics.animate(card, 1 / 60, null);
    assert.ok(card.position.distanceTo(position) < 0.002, 'a coleta parte da posição física atual');
    animateCard(world, physics, card, 1.6);
    assert.ok(card.position.distanceTo(card.target) < 1e-6, 'a coleta não aguarda os dez segundos');
    assert.equal(world.bodyCount, count);
  } finally {
    physics.dispose();
    world.dispose();
  }
});

test('corpos de robôs removidos e descarte repetido liberam o mundo', () => {
  const { world, root } = fixture();
  const robot = new Robot('#648bc1');
  root.add(robot.group);
  world.addRobot(robot.group);
  assert.ok(world.bodyCount > 1);
  world.removeObject(robot.group);
  assert.equal(world.bodyCount, 1);
  world.dispose();
  world.dispose();
  assert.equal(world.bodyCount, 0);
  world.step(1 / 60);
});
