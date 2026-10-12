import { hotSettings, settingsChanged } from './hotSettings';

/** Movimento visual local das cartas; não altera regras nem relógios da partida. Velocidades em unidades/s; coeficientes 0 desativam o efeito. */
export const CARD_MOTION = hotSettings(import.meta.hot, 'CARD_MOTION', {
  /** Tempo em segundos de deslizamento livre após pousar; 0 inicia o retorno imediatamente. */
  slideSeconds: 1.2,
  /** Duração do retorno em segundos, inclusive ao recolher a vaza; 0 conclui imediatamente. */
  returnSeconds: 1.2,
  /** Ganho da velocidade do gesto no lançamento; 0 ignora o impulso, faixa útil 0–1. */
  dragVelocityGain: 0.45,
  maxDragSpeed: 6,
  maxLaunchSpeed: 7,
  dropSpeed: 0.6,
  impactSpeedGain: 0.35,
  friction: 0.445,
  linearDamping: 0.1,
});

export type CardMotionSettings = typeof CARD_MOTION;

/** Parâmetros de cardThrow; salve para aplicar sem recarregar. */
export const CARD_FLIGHT = hotSettings(import.meta.hot, 'CARD_FLIGHT', {
  /** Duração positiva em segundos do lançamento visual sem física. */
  FLIGHT_SECONDS: 0.28,
});

/** Parâmetros de physicsCards; salve para aplicar sem recarregar. */
export const CARD_CONTACT = hotSettings(import.meta.hot, 'CARD_CONTACT', {
  /** Espera adicional em segundos antes de forçar o retorno de uma carta sem contato. */
  FLIGHT_TIMEOUT_SECONDS: 1.5,
  /** Margem de contato com a mesa em unidades da cena. */
  CONTACT_MARGIN: 0.025,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('cardMotionSettings');
  });
