import {
  ANTIALIASING_MODES,
  antialiasingMode,
  isAntialiasingMode,
  setAntialiasingMode,
  type AntialiasingMode,
} from '../scene/graphicsSettings';
import { morph } from './dom';
import { html, type SafeHtml } from './html';

const LABELS: Record<AntialiasingMode, string> = {
  off: 'Desligado · maior desempenho',
  msaa: 'MSAA 4× · bordas nítidas',
  fxaa: 'FXAA · leve',
  smaa: 'SMAA · equilíbrio',
  ssaa: 'SSAA 4× · pesado',
  taa: 'TAA · experimental',
};

const DESCRIPTIONS: Record<AntialiasingMode, string> = {
  off: 'Sem suavização de bordas. Indicado quando o jogo estiver lento.',
  msaa: 'Suaviza as bordas dos objetos sem borrar as cartas. Até 4 amostras, conforme o aparelho.',
  fxaa: 'Filtro leve para suavizar a imagem. Pode deixar letras e detalhes menos nítidos.',
  smaa: 'Suaviza bordas preservando detalhes. Usa mais recursos que FXAA.',
  ssaa: 'Combina 4 imagens por quadro. Alta qualidade, mas pode reduzir bastante a fluidez.',
  taa: 'Melhora a imagem enquanto a cena está parada. Reinicia ao mover a câmera ou os objetos.',
};

export function graphicsMenu(): SafeHtml {
  return html`<details class="graphics-menu">
    <summary>Gráficos</summary>
    <div class="graphics-options">${graphicsOptions()}</div>
  </details>`;
}

function graphicsOptions(): SafeHtml {
  const selected = antialiasingMode();
  return html`<label for="antialiasing-mode">Suavização de bordas</label>
    <select id="antialiasing-mode" aria-describedby="antialiasing-description">
      ${ANTIALIASING_MODES.map(mode => html`<option value="${mode}" ${selected === mode && 'selected'}>${LABELS[mode]}</option>`)}
    </select>
    <p id="antialiasing-description" role="status">${DESCRIPTIONS[selected]}</p>
    <small>A mudança é imediata e sua escolha fica salva neste navegador.</small>`;
}

export function bindGraphicsMenu(root: HTMLElement): void {
  root.addEventListener('change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || select.id !== 'antialiasing-mode') return;
    if (!isAntialiasingMode(select.value)) return;
    setAntialiasingMode(select.value);
    const options = select.closest('.graphics-options');
    if (options) morph(options, graphicsOptions());
  });
  root.addEventListener('keydown', event => {
    if (event.code !== 'Escape') return;
    const menu = root.querySelector<HTMLDetailsElement>('.graphics-menu[open]');
    if (menu) menu.open = false;
  });
}
