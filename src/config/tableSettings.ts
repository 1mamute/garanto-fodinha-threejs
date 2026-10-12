import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de tableCards; salve para aplicar sem recarregar. */
export const TABLE_CARDS = hotSettings(import.meta.hot, 'TABLE_CARDS', {
  /** Raio das cartas jogadas em unidades da cena; 0 centraliza. */
  PLAYED_CARD_RADIUS: 1.45,
  /** Rotação do kicker em radianos; 0 o alinha aos eixos. */
  KICKER_ROTATION: -0.15,
});

/** Parâmetros de tableScene; salve para aplicar sem recarregar. */
export const TABLE_SCENE = hotSettings(import.meta.hot, 'TABLE_SCENE', {
  /** Raio dos assentos em unidades da cena; mantenha maior que o raio da mesa. */
  SEAT_RADIUS: 3.35,
  /** Intervalo positivo em segundos de envio das poses; 1/20 equivale a 20 Hz. */
  POSE_INTERVAL_S: 1 / 20,
  /** Número inteiro positivo máximo de cartas visíveis no leque dos robôs. */
  MAX_FAN_CARDS: 20,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('tableSettings');
  });
