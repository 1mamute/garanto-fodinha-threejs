import './style.css';
import type { LabScene } from './scene/labScene';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!root || !canvas) throw new Error('index.html must contain #app and #scene.');

/** Exposed for the browser integration checks in `tests/browser.integration.ts`. */
export let app: App | undefined;
export let lab: LabScene | undefined;

if (import.meta.env.DEV && new URLSearchParams(location.search).get('scene') === 'lab') {
  void import('./scene/labScene').then(({ LabScene }) => {
    lab = new LabScene(root, canvas);
  });
} else {
  app = new App(root, canvas);
}
