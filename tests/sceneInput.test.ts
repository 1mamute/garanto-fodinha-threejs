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

function pointer(canvas: TestCanvas, type: string, point: [number, number]): void {
  canvas.dispatchEvent(
    Object.assign(new Event(type), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: point[0],
      clientY: point[1],
    }),
  );
}

function fixture(context: TestContext): {
  canvas: TestCanvas;
  rig: CameraRig;
  start: [number, number];
  drops: boolean[];
} {
  browserGlobals(context);
  const canvas = new TestCanvas();
  const rig = new CameraRig();
  rig.resize(844 / 390);
  rig.update(0.05, 1, {
    mode: 'first',
    observer: false,
    seat: new THREE.Vector3(0, 0, 3.35),
    inspected: null,
  });
  const card = heldCard(rig.camera);
  rig.camera.updateMatrixWorld();
  const start = screenPoint(rig.camera, card.getWorldPosition(new THREE.Vector3()));
  const drops: boolean[] = [];
  const target: InputTarget = {
    mode: 'first',
    inspected: null,
    rig,
    freeLook: false,
    pick: () => card,
    inspect: () => undefined,
    clearInspection: () => undefined,
    toggleMode: () => undefined,
    reach: () => undefined,
    afterDrag: () => undefined,
    dropHandCard: (_card, play) => {
      drops.push(play !== null);
    },
  };
  new SceneInput(canvas as unknown as HTMLCanvasElement, target);
  return { canvas, rig, start, drops };
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
