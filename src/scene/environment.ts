/** Rendering and lighting shared by the game and the inspection laboratory. */
import * as THREE from 'three';

const NARROW_SCREEN_PX = 700;

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  // Touch screens and small windows render at a lower resolution to stay smooth.
  const lowPower = innerWidth < NARROW_SCREEN_PX || matchMedia('(pointer:coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : 1.75));
  renderer.setClearColor('#dfd7bf');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d9d1bb', 17, 31);
  const sun = new THREE.DirectionalLight('#fff1cc', 3);
  sun.position.set(3, 9, 5);
  const rim = new THREE.DirectionalLight('#87bfb3', 1.3);
  rim.position.set(-5, 4, -5);
  scene.add(new THREE.HemisphereLight('#fff3d1', '#647569', 2.5), sun, rim);
  return scene;
}
