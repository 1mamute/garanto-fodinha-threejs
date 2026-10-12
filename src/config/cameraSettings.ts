import { hotSettings, settingsChanged } from './hotSettings';

/** Primeira pessoa: campo de visão em graus (35–80), ampliação relativa (1 desliga o zoom) e sensibilidade por pixel da roda. */
export const FIRST_PERSON_CAMERA = hotSettings(import.meta.hot, 'FIRST_PERSON_CAMERA', {
  fieldOfView: 55,
  maxZoom: 2.5,
  wheelSensitivity: 0.0015,
});

/** Câmera sentada: false preserva o olhar ao soltar; duração do retorno em segundos (0,2–2). */
export const SEATED_CAMERA = hotSettings(import.meta.hot, 'SEATED_CAMERA', {
  returnOnLookRelease: true,
  returnDurationSeconds: 1.2,
});

/** Vista superior: inclinação em graus (0 é vertical, 0–45 é a faixa útil); retorno em segundos. */
export const TABLE_CAMERA = hotSettings(import.meta.hot, 'TABLE_CAMERA', {
  angleDegrees: 15,
  maxAngleDegrees: 45,
  returnDurationSeconds: 1.2,
});

/** Parâmetros de cameraRig; salve para aplicar sem recarregar. */
export const CAMERA_RIG = hotSettings(import.meta.hot, 'CAMERA_RIG', {
  /** Limite inferior do olhar em radianos; aproximadamente -1,2. */
  MIN_PITCH: -1.2,
  /** Limite superior do olhar em radianos; aproximadamente 1,15. */
  MAX_PITCH: 1.15,
  /** Distância mínima da vista superior em unidades da cena; deve ser menor que DEFAULT_TABLE_ZOOM. */
  MIN_ZOOM: 3,
  /** Altura dos olhos sentados em unidades da cena. */
  EYE_HEIGHT: 3.05,
  /** Inclinação inicial do olhar em radianos; 0 olha para o horizonte. */
  DEFAULT_PITCH: -0.436,
  /** Raio interno em unidades da cena usado na caminhada sem física. */
  WALK_INNER_RADIUS: 3,
  /** Duração positiva da subida para a vista superior em segundos. */
  VIEW_TRANSITION_SECONDS: 1.2,
});

/** Parâmetros de tableCamera; salve para aplicar sem recarregar. */
export const TABLE_VIEW = hotSettings(import.meta.hot, 'TABLE_VIEW', {
  /** Altura do foco e plano de arrasto em unidades da cena. */
  TABLE_VIEW_HEIGHT: 1.68,
  /** Distância inicial/máxima da vista superior em unidades da cena. */
  DEFAULT_TABLE_ZOOM: 4.8,
  /** Altura máxima da câmera em unidades da cena; deve ficar abaixo da luminária. */
  MAX_VIEW_HEIGHT: 4.3,
  /** Margem ao enquadrar cartas em unidades da cena; 0 elimina a folga. */
  CARD_FRAME_MARGIN: 0.12,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('cameraSettings');
  });
