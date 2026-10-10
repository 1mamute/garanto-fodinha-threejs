// Run on the dev server: import('/tests/browser.rendering.ts').then(module => module.run()).
import * as THREE from 'three';
import { createDeck } from '../src/game';
import { createRenderer, createScene } from '../src/scene/environment';
import { GraphicsRenderer } from '../src/scene/graphicsRenderer';
import { FirstPersonHands } from '../src/scene/hands';
import { ANTIALIASING_MODES, antialiasingMode, setAntialiasingMode } from '../src/scene/graphicsSettings';

const SIZE = 128;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readPixel(renderer: THREE.WebGLRenderer, x: number, y: number): Uint8Array {
  const context = renderer.getContext();
  const pixel = new Uint8Array(4);
  context.readPixels(x, y, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
  return pixel;
}

/** Exercise the real room + hands render passes in every graphics mode. */
export function run(): string[] {
  const previousMode = antialiasingMode();
  const renderer = createRenderer(document.createElement('canvas'));
  renderer.setPixelRatio(1);
  const scene = createScene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.04, 60);
  scene.add(camera);
  const hands = new FirstPersonHands(camera);
  hands.show(createDeck().slice(0, 1));
  hands.fitTo(1);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const surface = new THREE.MeshBasicMaterial({ color: '#ff0000', toneMapped: false });
  const marker = new THREE.Mesh(geometry, surface);
  marker.position.z = -3;
  scene.add(marker);
  const graphics = new GraphicsRenderer({
    renderer,
    scene,
    camera,
    overlay: () => {
      hands.render(renderer, scene);
    },
  });
  graphics.resize(SIZE, SIZE);
  const background = scene.background;
  const results: string[] = [];
  try {
    for (const mode of ANTIALIASING_MODES) {
      setAntialiasingMode(mode);
      hands.visible = true;
      graphics.render(1);
      const roomPixel = readPixel(renderer, SIZE / 2, SIZE / 2);
      check((roomPixel[0] ?? 0) > 100, `${mode}: a cena desapareceu ao desenhar as mãos`);
      const skyPixel = readPixel(renderer, SIZE - 1, SIZE - 1);
      check(
        Math.max(...skyPixel.slice(0, 3)) < 20 && skyPixel[3] === 255,
        `${mode}: o fundo acima da sala deixou de ser escuro e opaco`,
      );
      check(scene.background === background, `${mode}: o fundo da cena não foi restaurado`);
      check(camera.layers.mask === 1, `${mode}: as camadas da câmera não foram restauradas`);
      check(renderer.autoClear, `${mode}: a limpeza do renderizador não foi restaurada`);
      check(scene.matrixWorldAutoUpdate, `${mode}: a atualização de matrizes não foi restaurada`);
      hands.visible = false;
      graphics.render(1);
      check(
        (readPixel(renderer, SIZE / 2, SIZE / 2)[0] ?? 0) > 100,
        `${mode}: a cena desapareceu sem a sobreposição das mãos`,
      );
      results.push(`${mode}: cena visível e fundo escuro com e sem as mãos`);
    }
    return results;
  } finally {
    graphics.dispose();
    surface.dispose();
    scene.traverse(object => {
      if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
        object.geometry.dispose();
      }
    });
    renderer.dispose();
    setAntialiasingMode(previousMode);
  }
}
