import { hotSettings, settingsChanged } from './hotSettings';

/** Atualização da interface em milissegundos; intervalos devem ser positivos. */
export const UI_TIMING = hotSettings(import.meta.hot, 'UI_TIMING', {
  roomPollMs: 15_000,
  countdownMs: 500,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('uiSettings');
  });
