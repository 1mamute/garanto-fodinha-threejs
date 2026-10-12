import { hotSettings, settingsChanged } from './hotSettings';

export const FPS_METER = hotSettings(import.meta.hot, 'FPS_METER', {
  /** Intervalo positivo das leituras em milissegundos; faixa útil 250–1000. */
  sampleIntervalMs: 500,
  /** true mostra o medidor quando não existe preferência salva no navegador. */
  defaultEnabled: false,
});
if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('fpsMeterSettings');
  });
