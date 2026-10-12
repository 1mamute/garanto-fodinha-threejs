import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de input; salve para aplicar sem recarregar. */
export const SCENE_INPUT = hotSettings(import.meta.hot, 'SCENE_INPUT', {
  /** Distância em pixels para reconhecer um arrasto; faixa útil 4–15. */
  DRAG_THRESHOLD_PX: 7,
  /** Sensibilidade do olhar em radianos por pixel; 0 desliga o giro. */
  LOOK_SPEED: 0.004,
  /** Largura em pixels de cada posição ao reordenar a mão. */
  SLOT_WIDTH_PX: 35,
  /** Tempo positivo de toque longo em milissegundos para inspecionar. */
  HOLD_TO_INSPECT_MS: 2000,
  /** Sensibilidade do zoom por pixel da roda; 0 desliga. */
  WHEEL_ZOOM: 0.008,
  /** Sensibilidade do zoom por pixel da pinça; 0 desliga. */
  PINCH_ZOOM: 0.025,
  /** Amplitude horizontal do olhar seguindo o cursor em radianos; 0 desliga. */
  POINTER_YAW: 0.65,
  /** Amplitude vertical do olhar seguindo o cursor em radianos; 0 desliga. */
  POINTER_PITCH: 0.4,
});

/** Parâmetros de dragMomentum; salve para aplicar sem recarregar. */
export const DRAG_MOMENTUM = hotSettings(import.meta.hot, 'DRAG_MOMENTUM', {
  /** Janela positiva em milissegundos para estimar o impulso do arrasto. */
  SAMPLE_WINDOW_MS: 120,
  /** Número inteiro positivo máximo de amostras do gesto. */
  MAX_SAMPLES: 32,
});

/** Parâmetros de handDrag; salve para aplicar sem recarregar. */
export const HAND_DRAG = hotSettings(import.meta.hot, 'HAND_DRAG', {
  /** Distância em pixels para reconhecer um arrasto; faixa útil 4–15. */
  DRAG_THRESHOLD_PX: 8,
  /** Distância vertical em pixels para jogar uma carta arrastada. */
  PLAY_DISTANCE_PX: 90,
  /** Tempo em milissegundos para ignorar o clique após arrastar. */
  CLICK_SUPPRESS_MS: 400,
});

/** Parâmetros de joystick; salve para aplicar sem recarregar. */
export const JOYSTICK = hotSettings(import.meta.hot, 'JOYSTICK', {
  /** Raio positivo em pixels para atingir velocidade máxima. */
  JOYSTICK_RANGE: 35,
  /** Deslocamento visual máximo do botão em pixels; 0 o mantém parado. */
  KNOB_TRAVEL: 30,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('interactionSettings');
  });
