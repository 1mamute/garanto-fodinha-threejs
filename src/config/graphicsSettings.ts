import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de graphicsPipeline; salve para aplicar sem recarregar. */
export const GRAPHICS = hotSettings(import.meta.hot, 'GRAPHICS', {
  /** Amostras MSAA: 1 desliga a multiamostragem; faixa útil 2–8, limitada pela GPU. */
  MSAA_SAMPLES: 4,
  /** Nível de amostragem SSAA inteiro (0–5); 0 é neutro, 2 usa quatro amostras. */
  SSAA_SAMPLE_LEVEL: 2,
});

/** Limites de desempenho: FPS, pixels, tempos em segundos e escala de resolução (0–1). */
export const RENDER_BUDGET = hotSettings(import.meta.hot, 'RENDER_BUDGET', {
  narrowScreenPx: 700,
  mobilePixelRatio: 1,
  desktopPixelRatio: 1.5,
  mobileFps: 30,
  pacingToleranceSeconds: 0.002,
  maxFrameSeconds: 0.05,
  sampleSeconds: 3,
  mobileMinimumFps: 25,
  desktopMinimumFps: 42,
  minimumScale: 0.7,
  scaleStep: 0.15,
});

/** Preferência padrão de suavização; uma escolha salva pelo jogador tem prioridade. */
export const GRAPHICS_DEFAULTS = hotSettings<{
  antialiasing: 'off' | 'msaa' | 'fxaa' | 'smaa' | 'ssaa' | 'taa';
}>(import.meta.hot, 'GRAPHICS_DEFAULTS', {
  antialiasing: 'msaa',
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('graphicsSettings');
  });
