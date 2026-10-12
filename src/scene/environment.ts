/** Rendering and lighting shared by the game and the inspection laboratory. */
import * as THREE from 'three';
import { ENVIRONMENT } from '../config/environmentSettings';
import { watchSettings } from '../config/hotSettings';
import { RenderBudget, isMobileRenderer } from './renderBudget';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(new RenderBudget(isMobileRenderer).pixelRatio(devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  updateRenderer(renderer);
  watchSettings(renderer, current => {
    updateRenderer(current);
  });
  return renderer;
}

function updateRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.setClearColor(ENVIRONMENT.background);
  renderer.toneMappingExposure = ENVIRONMENT.exposure;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const lights = {
    scene,
    lamp: new THREE.PointLight(),
    rim: new THREE.DirectionalLight(),
    hemisphere: new THREE.HemisphereLight(),
  };
  scene.add(lights.lamp, lights.rim, lights.hemisphere);
  scene.userData.environmentLights = lights;
  updateLights(lights);
  watchSettings(lights, (current, category) => {
    if (category === 'environmentSettings') updateLights(current);
  });
  return scene;
}

function updateLights(lights: {
  scene: THREE.Scene;
  lamp: THREE.PointLight;
  rim: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
}): void {
  const { scene, lamp, rim, hemisphere } = lights;
  scene.background = new THREE.Color(ENVIRONMENT.background);
  scene.fog = new THREE.Fog(ENVIRONMENT.background, ENVIRONMENT.fogNear, ENVIRONMENT.fogFar);
  lamp.color.set(ENVIRONMENT.lamp.color);
  lamp.intensity = ENVIRONMENT.lamp.intensity;
  lamp.distance = ENVIRONMENT.lamp.distance;
  lamp.decay = ENVIRONMENT.lamp.decay;
  lamp.position.set(0, ENVIRONMENT.lamp.height, 0);
  rim.color.set(ENVIRONMENT.rim.color);
  rim.intensity = ENVIRONMENT.rim.intensity;
  rim.position.set(ENVIRONMENT.rim.x, ENVIRONMENT.rim.y, ENVIRONMENT.rim.z);
  hemisphere.color.set(ENVIRONMENT.hemisphere.sky);
  hemisphere.groundColor.set(ENVIRONMENT.hemisphere.ground);
  hemisphere.intensity = ENVIRONMENT.hemisphere.intensity;
}
