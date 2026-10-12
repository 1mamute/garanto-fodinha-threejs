import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de playerSpawn; salve para aplicar sem recarregar. */
export const PLAYER_SPAWN = hotSettings(import.meta.hot, 'PLAYER_SPAWN', {
  /** Raio inicial dos observadores em unidades da cena. */
  SPAWN_RADIUS: 5.5,
});

/** Parâmetros de playerMotion; salve para aplicar sem recarregar. */
export const PLAYER_MOTION = hotSettings(import.meta.hot, 'PLAYER_MOTION', {
  /** Tempo em milissegundos antes de descartar uma pose remota antiga. */
  POSE_TIMEOUT_MS: 1_000,
});

/** Velocidade em unidades/s; 0 impede o deslocamento. Faixa útil: 1–5. */
export const PLAYER_MOVEMENT = hotSettings(import.meta.hot, 'PLAYER_MOVEMENT', {
  walkSpeed: 2.7,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('playerSettings');
  });
