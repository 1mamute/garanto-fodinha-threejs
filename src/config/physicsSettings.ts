import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de physicsWorld; salve para aplicar sem recarregar. */
export const PHYSICS_WORLD = hotSettings(import.meta.hot, 'PHYSICS_WORLD', {
  /** Passo fixo positivo em segundos; 1/60 é 60 Hz. */
  PHYSICS_STEP: 1 / 60,
  /** Aceleração gravitacional em unidades/s²; 0 remove a gravidade. */
  GRAVITY: 9.81,
  /** Tempo máximo acumulado por quadro em segundos. */
  MAX_FRAME_SECONDS: 0.1,
});

/** Parâmetros de physicsCharacter; salve para aplicar sem recarregar. */
export const PHYSICS_CHARACTER = hotSettings(import.meta.hot, 'PHYSICS_CHARACTER', {
  /** Raio positivo da cápsula em unidades da cena. */
  CHARACTER_RADIUS: 0.55,
  /** Altura da cápsula em unidades da cena; deve superar duas vezes o raio. */
  CHARACTER_HEIGHT: 3.5,
  /** Tempo máximo de caminhada simulada por quadro em segundos. */
  MAX_MOVE_SECONDS: 0.1,
});

/** Parâmetros de physicsShapes; salve para aplicar sem recarregar. */
export const PHYSICS_SHAPES = hotSettings(import.meta.hot, 'PHYSICS_SHAPES', {
  /** Arredondamento dos colisores em unidades da cena; 0 elimina o arredondamento. */
  CONVEX_RADIUS: 0.002,
  /** Número inteiro positivo de segmentos das paredes; faixa útil 32–96. */
  RING_SEGMENTS: 64,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('physicsSettings');
  });
