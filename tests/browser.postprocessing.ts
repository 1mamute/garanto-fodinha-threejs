// Run on Vite: import('/tests/browser.postprocessing.ts').then(module => module.run()).
import * as THREE from 'three';
import { createRenderer } from '../src/scene/environment';
import { GraphicsRenderer } from '../src/scene/graphicsRenderer';
import { antialiasingMode, setAntialiasingMode } from '../src/scene/graphicsPreference';
import { POST_PROCESSING } from '../src/config/postProcessingSettings';
import { postProcessingEnabled, setPostProcessingEnabled } from '../src/scene/postProcessingPreference';

const SIZE = 128;
const TOLERANCE = 3;
type Fixture = ReturnType<typeof createFixture>;
interface Image {
  pixels: Uint8Array;
  width: number;
  height: number;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function neutralEffects(): void {
  setPostProcessingEnabled(true);
  for (const effect of [
    POST_PROCESSING.colorGrading,
    POST_PROCESSING.ambientOcclusion,
    POST_PROCESSING.bloom,
    POST_PROCESSING.vignette,
  ]) {
    effect.enabled = true;
    effect.strength = 0;
  }
}

function createFixture() {
  const renderer = createRenderer(document.createElement('canvas'));
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(0.01, 0.01, 0.01);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 20);
  scene.add(camera);
  return { renderer, scene, camera, overlay: false };
}

function withFixture(scenario: (fixture: Fixture) => string): string {
  const fixture = createFixture();
  neutralEffects();
  try {
    return scenario(fixture);
  } finally {
    fixture.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry: unknown = object.geometry;
      if (geometry instanceof THREE.BufferGeometry) geometry.dispose();
      const material: unknown = object.material;
      if (material instanceof THREE.Material) material.dispose();
    });
    fixture.renderer.dispose();
    fixture.renderer.forceContextLoss();
  }
}

function addMesh(fixture: Fixture, geometry: THREE.BufferGeometry, color: THREE.Color): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
  fixture.scene.add(mesh);
  return mesh;
}

function renderOverlay(fixture: Fixture): void {
  const { scene, camera, renderer } = fixture;
  const layers = camera.layers.mask;
  const background = scene.background;
  const autoClear = renderer.autoClear;
  try {
    camera.layers.set(1);
    scene.background = null;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
  } finally {
    camera.layers.mask = layers;
    scene.background = background;
    renderer.autoClear = autoClear;
  }
}

function render(fixture: Fixture, size = { width: SIZE, height: SIZE, zoom: 1 }): Image {
  const { scene, camera, renderer } = fixture;
  const graphics = new GraphicsRenderer({
    renderer,
    scene,
    camera,
    ...(fixture.overlay
      ? {
          overlay: () => {
            renderOverlay(fixture);
          },
        }
      : {}),
  });
  const background = scene.background;
  const overrideMaterial = scene.overrideMaterial;
  const callback: unknown = Object.getOwnPropertyDescriptor(scene, 'onAfterRender')?.value;
  const layers = camera.layers.mask;
  const clearColor = renderer.getClearColor(new THREE.Color());
  const clearAlpha = renderer.getClearAlpha();
  const autoClear = renderer.autoClear;
  const shadowUpdate = renderer.shadowMap.autoUpdate;
  try {
    graphics.resize(SIZE, SIZE);
    graphics.render(1);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    graphics.resize(size.width, size.height);
    // Zoom must update AO projection independently of target resizing.
    camera.zoom = size.zoom;
    camera.updateProjectionMatrix();
    graphics.render(1);
    check(scene.background === background, 'O pós-processamento alterou o fundo da cena');
    check(scene.overrideMaterial === overrideMaterial, 'O material auxiliar não foi restaurado');
    check(
      Object.getOwnPropertyDescriptor(scene, 'onAfterRender')?.value === callback,
      'O pós-processamento substituiu o callback da sobreposição',
    );
    check(camera.layers.mask === layers, 'As camadas da câmera não foram restauradas');
    check(renderer.autoClear === autoClear, 'A limpeza automática não foi restaurada');
    check(renderer.shadowMap.autoUpdate === shadowUpdate, 'A atualização de sombras foi alterada');
    check(renderer.getRenderTarget() === null, 'O renderizador manteve um alvo auxiliar ativo');
    check(renderer.getClearColor(new THREE.Color()).equals(clearColor), 'A cor de limpeza mudou');
    check(renderer.getClearAlpha() === clearAlpha, 'A opacidade de limpeza mudou');
    return readImage(renderer, size);
  } finally {
    graphics.dispose();
  }
}

function readImage(renderer: THREE.WebGLRenderer, size: { width: number; height: number }): Image {
  const context = renderer.getContext();
  const pixels = new Uint8Array(size.width * size.height * 4);
  context.readPixels(0, 0, size.width, size.height, context.RGBA, context.UNSIGNED_BYTE, pixels);
  return { pixels, width: size.width, height: size.height };
}

function brightness(image: Image, x: number, y: number): number {
  const offset = (y * image.width + x) * 4;
  return image.pixels[offset] ?? 0;
}

function maxDifference(left: Image, right: Image): number {
  let maximum = 0;
  left.pixels.forEach((value, index) => {
    maximum = Math.max(maximum, Math.abs(value - (right.pixels[index] ?? 0)));
  });
  return maximum;
}

function centerDifference(left: Image, right: Image): number {
  let maximum = 0;
  const centerX = Math.floor(left.width / 2);
  const centerY = Math.floor(left.height / 2);
  for (let y = centerY - 6; y < centerY + 6; y++) {
    for (let x = centerX - 6; x < centerX + 6; x++) {
      const offset = (y * left.width + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const before = left.pixels[offset + channel] ?? 0;
        const after = right.pixels[offset + channel] ?? 0;
        maximum = Math.max(maximum, Math.abs(before - after));
      }
    }
  }
  return maximum;
}

function changedBackground(before: Image, after: Image, direction: number): number {
  let changed = 0;
  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      // Exclude the central marker/hand silhouette and inspect its surroundings.
      if (Math.abs(x - before.width / 2) < 20 && Math.abs(y - before.height / 2) < 20) continue;
      const difference = (brightness(after, x, y) - brightness(before, x, y)) * direction;
      if (difference > TOLERANCE) changed++;
    }
  }
  return changed;
}

function neutralScenario(fixture: Fixture): string {
  // Direct color backgrounds bypass tone mapping; black isolates material output.
  fixture.scene.background = new THREE.Color(0);
  const marker = addMesh(
    fixture,
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.Color().setRGB(0.45, 0.2, 0.08),
  );
  marker.position.z = -3;
  setPostProcessingEnabled(false);
  const direct = render(fixture);
  setPostProcessingEnabled(true);
  const neutral = render(fixture);
  check(maxDifference(direct, neutral) <= TOLERANCE, 'Os efeitos neutros repetiram a conversão de cor');
  return 'Efeitos neutros preservam a imagem direta e a conversão de cor';
}

function vignetteScenario(fixture: Fixture): string {
  fixture.scene.background = new THREE.Color().setRGB(0.3, 0.3, 0.3);
  POST_PROCESSING.vignette.radius = 0.35;
  POST_PROCESSING.vignette.softness = 0.6;
  const portrait = { width: 96, height: 160, zoom: 1 };
  const baseline = render(fixture, portrait);
  POST_PROCESSING.vignette.strength = 0.4;
  const vignette = render(fixture, portrait);
  check(
    Math.abs(brightness(baseline, 48, 80) - brightness(vignette, 48, 80)) <= TOLERANCE,
    'A vinheta escureceu o centro após redimensionar para retrato',
  );
  check(brightness(vignette, 2, 2) < brightness(baseline, 2, 2) - 10, 'A vinheta não escureceu o canto');
  check(
    Math.abs(brightness(vignette, 2, 2) - brightness(vignette, 93, 157)) <= TOLERANCE,
    'Os cantos da vinheta ficaram assimétricos em retrato',
  );
  return 'Vinheta preserva o centro e escurece os cantos após resize em retrato';
}

function bloomScenario(fixture: Fixture): string {
  POST_PROCESSING.bloom.threshold = 1.1;
  POST_PROCESSING.bloom.radius = 0.35;
  const marker = addMesh(fixture, new THREE.PlaneGeometry(0.3, 0.3), new THREE.Color());
  marker.position.z = -3;
  const material: unknown = marker.material;
  check(material instanceof THREE.MeshBasicMaterial, 'Material do marcador inválido');
  material.color.setRGB(0.8, 0.8, 0.8);
  const ordinary = render(fixture);
  POST_PROCESSING.bloom.strength = 0.8;
  const ordinaryBloom = render(fixture);
  check(maxDifference(ordinary, ordinaryBloom) <= TOLERANCE, 'Uma superfície comum ganhou bloom');
  POST_PROCESSING.bloom.strength = 0;
  material.color.setRGB(8, 8, 8);
  const bright = render(fixture);
  POST_PROCESSING.bloom.strength = 0.8;
  const halo = render(fixture);
  check(changedBackground(bright, halo, 1) > 30, 'A fonte HDR não produziu um halo fora do marcador');
  return 'Bloom cria halo em uma fonte HDR e preserva superfícies abaixo do limiar';
}

function occlusionScenario(fixture: Fixture): string {
  Object.assign(POST_PROCESSING.ambientOcclusion, {
    kernelRadius: 0.35,
    minDistance: 0.0005,
    maxDistance: 0.02,
    excludedLayer: 1,
  });
  fixture.camera.position.set(2, 2, 3);
  fixture.camera.lookAt(0, 0.4, 0);
  const color = new THREE.Color().setRGB(0.5, 0.5, 0.5);
  const floor = addMesh(fixture, new THREE.PlaneGeometry(8, 8), color);
  floor.rotation.x = -Math.PI / 2;
  const sphere = addMesh(fixture, new THREE.SphereGeometry(0.5, 32, 16), color);
  sphere.position.y = 0.5;
  const hand = addMesh(
    fixture,
    new THREE.PlaneGeometry(0.35, 0.25),
    new THREE.Color().setRGB(0.15, 0.6, 0.15),
  );
  fixture.camera.add(hand);
  hand.position.set(0, 0, -1.2);
  hand.layers.set(1);
  fixture.overlay = true;
  const size = { width: 112, height: 144, zoom: 1.15 };
  const baseline = render(fixture, size);
  POST_PROCESSING.ambientOcclusion.strength = 0.8;
  const occluded = render(fixture, size);
  check(changedBackground(baseline, occluded, -1) > 10, 'O contato da esfera com o piso não ganhou AO');
  check(centerDifference(baseline, occluded) <= TOLERANCE, 'A sobreposição da mão recebeu a oclusão da sala');
  return 'AO escurece contatos e protege a mão após zoom e resize, restaurando o estado';
}

/** GPU regressions: neutral output, portrait vignette, HDR bloom and protected AO. */
export function run(): string[] {
  const snapshot = structuredClone(POST_PROCESSING);
  const previousMode = antialiasingMode();
  const previousEnabled = postProcessingEnabled();
  try {
    setAntialiasingMode('off');
    return [neutralScenario, vignetteScenario, bloomScenario, occlusionScenario].map(withFixture);
  } finally {
    POST_PROCESSING.enabled = snapshot.enabled;
    Object.assign(POST_PROCESSING.colorGrading, snapshot.colorGrading);
    Object.assign(POST_PROCESSING.ambientOcclusion, snapshot.ambientOcclusion);
    Object.assign(POST_PROCESSING.bloom, snapshot.bloom);
    Object.assign(POST_PROCESSING.vignette, snapshot.vignette);
    setAntialiasingMode(previousMode);
    setPostProcessingEnabled(previousEnabled);
  }
}
