import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import * as THREE from 'three';
import { CameraRig } from '../src/scene/cameraRig';
import { SceneInput, type InputTarget } from '../src/scene/input';
import type { CardMesh } from '../src/scene/cards';
import { CardDrag } from '../src/scene/cardDrag';
import type { Card } from '../src/game';

class TestCanvas extends EventTarget {
  readonly clientHeight = 390;
  readonly style = { cursor: '' };

  setPointerCapture(): void {
    return undefined;
  }

  getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 844,
      bottom: 390,
      width: 844,
      height: 390,
      toJSON: () => null,
    };
  }
}

function browserGlobals(context: TestContext): void {
  const prompt = Object.assign(new EventTarget(), {
    className: '',
    textContent: '',
    hidden: true,
    disabled: false,
  });
  const document = Object.assign(new EventTarget(), {
    createElement: () => prompt,
    body: { append: () => undefined },
    pointerLockElement: null,
  });
  const globals = {
    document,
    window: new EventTarget(),
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
  };
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    context.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
}

function heldCard(camera: THREE.Camera): CardMesh {
  const card: Card = { id: '4♥', suit: '♥', rank: '4' };
  const mesh = Object.assign(new THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>(), {
    card,
    faceDown: false,
    target: new THREE.Vector3(),
    targetRotation: 0,
    index: 0,
    details: { card, playerName: 'Humano' },
    destroy: () => undefined,
  });
  camera.add(mesh);
  mesh.position.set(-0.12, -0.4, -0.95);
  return mesh;
}

function screenPoint(camera: THREE.Camera, point: THREE.Vector3): [number, number] {
  const projected = point.project(camera);
  return [(projected.x + 1) * 422, (1 - projected.y) * 195];
}

function pointer(canvas: TestCanvas, type: string, point: [number, number], time = performance.now()): void {
  const event = Object.assign(new Event(type), {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: point[0],
    clientY: point[1],
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  canvas.dispatchEvent(event);
}

function fixture(
  context: TestContext,
  mode: 'first' | 'top' = 'first',
): {
  canvas: TestCanvas;
  rig: CameraRig;
  start: [number, number];
  drops: boolean[];
  velocities: THREE.Vector3[];
  inspections: CardMesh[];
  input: SceneInput;
  target: InputTarget;
} {
  browserGlobals(context);
  const canvas = new TestCanvas();
  const rig = new CameraRig();
  rig.resize(844 / 390);
  rig.update(0.05, 1, {
    mode,
    observer: false,
    seat: new THREE.Vector3(0, 0, 3.35),
    inspected: null,
  });
  const card = heldCard(rig.camera);
  rig.camera.updateMatrixWorld();
  const start = screenPoint(rig.camera, card.getWorldPosition(new THREE.Vector3()));
  const drops: boolean[] = [];
  const velocities: THREE.Vector3[] = [];
  const inspections: CardMesh[] = [];
  const target: InputTarget = {
    mode,
    inspected: null,
    rig,
    freeLook: false,
    pick: () => card,
    inspect: inspected => inspections.push(inspected),
    clearInspection: () => undefined,
    toggleMode: () => undefined,
    reach: () => undefined,
    afterDrag: () => undefined,
    dropHandCard: (_card, play, _shift, velocity) => {
      drops.push(play !== null);
      velocities.push(velocity?.clone() ?? new THREE.Vector3());
    },
  };
  const input = new SceneInput(canvas as unknown as HTMLCanvasElement, target);
  return { canvas, rig, start, drops, velocities, inspections, input, target };
}

test('soltar a carta no feltro à frente do jogador registra a jogada mesmo com arrasto curto', context => {
  const { canvas, rig, start, drops } = fixture(context);
  const end = screenPoint(rig.camera, new THREE.Vector3(0, 1.68, 1.45));
  assert.equal(new CardDrag(rig.camera, canvas).overTable(...end), true);
  assert.ok(start[1] - end[1] > 7 && start[1] - end[1] < canvas.clientHeight * 0.08);
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  pointer(canvas, 'pointerup', end);
  assert.deepEqual(drops, [true], 'a carta solta no feltro deve ser jogada, não voltar à mão');
});

test('arrastar até o centro do feltro também registra a jogada', context => {
  const { canvas, rig, start, drops } = fixture(context);
  const end = screenPoint(rig.camera, new THREE.Vector3(0, 1.68, 0));
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  pointer(canvas, 'pointerup', end);
  assert.deepEqual(drops, [true]);
});

test('arrasto lateral continua reordenando a mão', context => {
  const { canvas, start, drops } = fixture(context);
  const end: [number, number] = [start[0] + 70, start[1]];
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  pointer(canvas, 'pointerup', end);
  assert.deepEqual(drops, [false]);
});

test('soltura fora do feltro não registra uma jogada', context => {
  const { canvas, rig, start, drops } = fixture(context);
  const end = screenPoint(rig.camera, new THREE.Vector3(4, 1.68, 0));
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  pointer(canvas, 'pointerup', end);
  assert.deepEqual(drops, [false]);
});

test('arrasto cancelado não joga nem reordena a carta', context => {
  const { canvas, rig, start, drops } = fixture(context);
  const end = screenPoint(rig.camera, new THREE.Vector3(0, 1.68, 0));
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  pointer(canvas, 'pointercancel', end);
  assert.deepEqual(drops, []);
});

test('a soltura transmite ao lançamento a velocidade medida nos eventos do ponteiro', context => {
  const { canvas, rig, start, drops, velocities } = fixture(context);
  const middle = screenPoint(rig.camera, new THREE.Vector3(0, 1.6465, 1.5));
  const end = screenPoint(rig.camera, new THREE.Vector3(0, 1.6465, 1));
  pointer(canvas, 'pointerdown', start, 0);
  pointer(canvas, 'pointermove', middle, 40);
  pointer(canvas, 'pointerup', end, 80);
  assert.deepEqual(drops, [true]);
  const velocity = velocities[0];
  if (!velocity) assert.fail('Impulso ausente');
  assert.ok(velocity.z < -1, 'o gesto fornece impulso para a mesa mesmo sem pointermove na posição final');
  assert.equal(velocity.y, 0, 'a gravidade e o impacto vertical ficam a cargo do lançamento físico');
});

function updateTop(rig: CameraRig, seconds = 0): void {
  rig.update(seconds, 1, {
    mode: 'top',
    observer: false,
    seat: new THREE.Vector3(0, 0, 3.35),
    inspected: null,
  });
}

test('arrastar sobre uma carta move a vista superior sem inspecionar ou jogar', context => {
  const { canvas, rig, start, drops, inspections, input } = fixture(context, 'top');
  const initial = rig.camera.position.clone();
  const end: [number, number] = [start[0] + 90, start[1] + 60];
  pointer(canvas, 'pointermove', start);
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  input.checkLongPress(performance.now() + 2500);
  updateTop(rig);
  assert.ok(rig.camera.position.distanceTo(initial) > 0.1);
  pointer(canvas, 'pointerup', end);
  input.checkLongPress(performance.now() + 3000);
  assert.deepEqual(inspections, []);
  assert.deepEqual(drops, []);
  updateTop(rig, 2);
  assert.ok(rig.camera.position.distanceTo(initial) < 1e-8);
});

test('clicar na carta com pequena oscilação mantém a inspeção da vista superior', context => {
  const { canvas, rig, start, inspections } = fixture(context, 'top');
  const initial = rig.camera.position.clone();
  const end: [number, number] = [start[0] + 2, start[1] + 2];
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  updateTop(rig);
  pointer(canvas, 'pointerup', end);
  assert.equal(inspections.length, 1);
  assert.ok(rig.camera.position.distanceTo(initial) < 1e-8);
});

test('cancelamento e perda de captura devolvem a vista superior sem inspecionar', context => {
  const { canvas, rig, start, inspections } = fixture(context, 'top');
  const initial = rig.camera.position.clone();
  const end: [number, number] = [start[0] + 90, start[1]];
  for (const event of ['pointercancel', 'lostpointercapture']) {
    pointer(canvas, 'pointerdown', start);
    pointer(canvas, 'pointermove', end);
    updateTop(rig);
    assert.ok(rig.camera.position.distanceTo(initial) > 0.1);
    pointer(canvas, event, end);
    updateTop(rig, 2);
    assert.ok(rig.camera.position.distanceTo(initial) < 1e-8);
    assert.deepEqual(inspections, []);
  }
});

test('perder o foco inicia o retorno e encerra o arrasto da mesa', context => {
  const { canvas, rig, start, input, inspections } = fixture(context, 'top');
  const initial = rig.camera.position.clone();
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', [start[0] + 90, start[1]]);
  updateTop(rig);
  window.dispatchEvent(new Event('blur'));
  assert.equal(input.drag, null);
  updateTop(rig, 2);
  assert.ok(rig.camera.position.distanceTo(initial) < 1e-8);
  assert.deepEqual(inspections, []);
});

test('arrastar na área livre também desloca a câmera e respeita o retorno', context => {
  const { canvas, rig, start, target } = fixture(context, 'top');
  context.mock.method(target, 'pick', () => undefined);
  const initial = rig.camera.position.clone();
  const end: [number, number] = [start[0], start[1] + 90];
  pointer(canvas, 'pointerdown', start);
  pointer(canvas, 'pointermove', end);
  updateTop(rig);
  assert.ok(rig.camera.position.distanceTo(initial) > 0.1);
  pointer(canvas, 'pointerup', end);
  updateTop(rig, 2);
  assert.ok(rig.camera.position.distanceTo(initial) < 1e-8);
});

function touchPointer(
  canvas: TestCanvas,
  options: { type: string; pointerId: number; point: [number, number] },
): void {
  canvas.dispatchEvent(
    Object.assign(new Event(options.type), {
      pointerId: options.pointerId,
      pointerType: 'touch',
      button: 0,
      clientX: options.point[0],
      clientY: options.point[1],
    }),
  );
}

test('pinça iniciada sobre uma carta altera só o zoom e não abre a inspeção', context => {
  const { canvas, rig, start, inspections, input } = fixture(context, 'top');
  const zoom = rig.zoom;
  touchPointer(canvas, { type: 'pointerdown', pointerId: 1, point: start });
  touchPointer(canvas, { type: 'pointerdown', pointerId: 2, point: [start[0] + 100, start[1]] });
  touchPointer(canvas, { type: 'pointermove', pointerId: 2, point: [start[0] + 110, start[1]] });
  touchPointer(canvas, { type: 'pointermove', pointerId: 2, point: [start[0] + 150, start[1]] });
  input.checkLongPress(performance.now() + 2500);
  assert.ok(rig.zoom < zoom);
  updateTop(rig);
  const direction = rig.camera.getWorldDirection(new THREE.Vector3());
  const focus = rig.camera.position
    .clone()
    .addScaledVector(direction, (1.68 - rig.camera.position.y) / direction.y);
  assert.ok(Math.hypot(focus.x, focus.z) < 1e-8, 'o zoom mantém o centro da mesa como alvo');
  touchPointer(canvas, { type: 'pointerup', pointerId: 2, point: [start[0] + 150, start[1]] });
  touchPointer(canvas, { type: 'pointerup', pointerId: 1, point: start });
  assert.deepEqual(inspections, []);
});
