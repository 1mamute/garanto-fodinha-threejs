import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de robotWalking; salve para aplicar sem recarregar. */
export const ROBOT_WALKING = hotSettings(import.meta.hot, 'ROBOT_WALKING', {
  /** Resposta do giro do corpo em 1/s; 0 suspende o giro. */
  TURN_RESPONSE: 9,
  /** Resposta do olhar em 1/s; 0 suspende o acompanhamento. */
  LOOK_RESPONSE: 16,
  /** Resposta da intensidade dos passos em 1/s. */
  STRIDE_RESPONSE: 10,
  /** Comprimento positivo da passada em unidades da cena. */
  STRIDE_LENGTH: 1.7,
  /** Deslocamento mínimo positivo para detectar caminhada em unidades da cena. */
  MOVEMENT_EPSILON: 0.00001,
});

/** Parâmetros de robot; salve para aplicar sem recarregar. */
export const ROBOT_LOOK = hotSettings(import.meta.hot, 'ROBOT_LOOK', {
  /** Limite horizontal da cabeça em radianos. */
  MAX_HEAD_YAW: 1.05,
  /** Limite vertical da cabeça em radianos. */
  MAX_HEAD_PITCH: 0.65,
});

/** Animações: amplitudes angulares em radianos, deslocamentos em unidades da cena, frequências em rad/s e durações em segundos. Amplitude 0 desliga o movimento; duração deve ser positiva. */
export const ROBOT_ANIMATION = hotSettings(import.meta.hot, 'ROBOT_ANIMATION', {
  legSwing: 0.38,
  armSwing: 0.28,
  walkingBob: 0.018,
  walkingSway: 0.025,
  idleYawFrequency: 0.6,
  idleYawAmplitude: 0.13,
  breathingFrequency: 2,
  breathingAmplitude: 0.003,
  playSeconds: 1.1,
  playArmPitch: 0.8,
  reachArmPitch: 0.9,
  playArmRoll: 0.25,
  reachArmRoll: 0.15,
  squintHeight: 0.72,
  squintWidth: 0.1,
  eyeYawGain: 0.35,
  eyePitchGain: 0.45,
  deathSeconds: 1.1,
  deathPitch: 0.48,
  deathRoll: 0.12,
  deathEyeClosure: 0.8,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('robotAnimationSettings');
  });
