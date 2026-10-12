import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de dealerIndicator; salve para aplicar sem recarregar. */
export const DEALER_INDICATOR = hotSettings(import.meta.hot, 'DEALER_INDICATOR', {
  /** Fração da metade da tela reservada à direção do dealer (0–1). */
  SCREEN_MARGIN: 0.72,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('dealerIndicatorSettings');
  });
