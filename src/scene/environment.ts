/** Rendering and lighting shared by the game and the inspection laboratory. */
import * as THREE from 'three';

const NARROW_SCREEN_PX = 700;

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  // Touch screens and small windows render at a lower resolution to stay smooth.
  const lowPower = innerWidth < NARROW_SCREEN_PX || matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1 : 1.5));
  renderer.setClearColor('#080d0e');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#080d0e', 8, 23);
  // A single overhead pool and two cheap fill lights keep cards readable without shadow maps.
  const lamp = new THREE.PointLight('#ffd298', 32, 15, 2);
  lamp.position.set(0, 4.7, 0);
  const rim = new THREE.DirectionalLight('#749baf', 0.45);
  rim.position.set(-5, 4, -5);
  scene.add(new THREE.HemisphereLight('#d0b190', '#30241f', 0.8), lamp, rim);
  return scene;
}
