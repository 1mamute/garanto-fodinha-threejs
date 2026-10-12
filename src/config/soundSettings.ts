import { hotSettings, settingsChanged } from './hotSettings';

/** Sons: frequências em Hz (100–2000), duração em segundos (0,05–0,5), ganho 0–1; ganho 0 silencia. */
export const SOUND_SETTINGS = hotSettings(import.meta.hot, 'SOUND_SETTINGS', {
  play: { startHz: 460, endHz: 180, durationSeconds: 0.19, gain: 0.035 },
  win: { startHz: 660, endHz: 880, durationSeconds: 0.19, gain: 0.035 },
  turn: { startHz: 740, endHz: 1100, durationSeconds: 0.28, gain: 0.035 },
  turnOther: { startHz: 520, endHz: 620, durationSeconds: 0.12, gain: 0.012 },
});

/** Parâmetros de feedback; salve para aplicar sem recarregar. */
export const FEEDBACK = hotSettings(import.meta.hot, 'FEEDBACK', {
  /** Duração da mensagem temporária em milissegundos; faixa útil 1500–6000. */
  TOAST_MS: 4_500,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('soundSettings');
  });
