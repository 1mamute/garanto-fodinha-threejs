import './style.css';
import type { LabScene } from './scene/labScene';
import { App } from './ui/app';
import { morph } from './ui/dom';
import { html } from './ui/html';
import { bindGraphicsMenu } from './ui/graphicsMenu';
import { initializePhysics } from './scene/physicsRuntime';
import { bindUiVisibilityShortcut } from './ui/visibility';

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!root || !canvas) throw new Error('index.html must contain #app and #scene.');
if (import.meta.env.DEV) bindUiVisibilityShortcut();

/** Exposed for the browser integration checks in `tests/browser.integration.ts`. */
export let app: App | undefined;
export let lab: LabScene | undefined;

async function start(root: HTMLElement, canvas: HTMLCanvasElement): Promise<void> {
  await initializePhysics();
  bindGraphicsMenu(root);
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('scene') === 'lab') {
    const { LabScene } = await import('./scene/labScene');
    lab = new LabScene(root, canvas);
  } else app = new App(root, canvas);
}

morph(root, html`<section class="panel"><p>Preparando a mesa…</p></section>`);
export const ready = start(root, canvas).catch((error: unknown) => {
  console.error(error);
  morph(
    root,
    html`<section class="panel"><p>Não foi possível preparar o jogo. Recarregue a página para tentar novamente.</p><a href="/">Voltar ao início</a></section>`,
  );
});
