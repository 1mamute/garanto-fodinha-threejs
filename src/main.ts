import './style.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!root || !canvas) throw new Error('index.html must contain #app and #scene.');

/** Exposed for the browser integration checks in `tests/browser.integration.ts`. */
export const app = new App(root, canvas);
