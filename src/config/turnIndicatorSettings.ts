import { hotSettings, settingsChanged } from './hotSettings';

/** Identificador do robô sentado usado na prévia do turno; independe da fase da composição congelada. */
export const LAB_TURN_PREVIEW = hotSettings(import.meta.hot, 'LAB_TURN_PREVIEW', {
  playerId: 'demo-2',
});

/** Destaques de turno compartilhados; distâncias em unidades da cena e cores em CSS. */
export const TURN_INDICATOR = hotSettings(import.meta.hot, 'TURN_INDICATOR', {
  enabled: true,
  color: '#e9b767',
  /** Intensidade em candelas: 0 desliga a luz; faixa útil 0–40, sem mapa de sombras. */
  lightIntensity: 40,
  lightHeight: 5.2,
  lightTargetHeight: 1.4,
  lightDistance: 8,
  /** Meio ângulo do cone em radianos (0,15–0,6); penumbra 0–1. */
  lightAngle: 0.3,
  lightPenumbra: 0.75,
  haloRadius: 1.68,
  haloThickness: 0.045,
  haloHeight: 0.04,
  haloEmissiveIntensity: 0.55,
  /** Altura do marcador acima do chão; 3,3–3,8 o mantém perto do nome. */
  markerHeight: 3.5,
  /** Fração da metade da tela: 0 centraliza a seta, 0,65 deixa espaço para os controles. */
  screenMargin: 0.65,
  /** Cone visual independente da luz física; enabled false o oculta e opacidade 0 desliga cada camada. */
  beam: {
    enabled: true,
    color: '#ffe39b',
    /** Opacidade (0–1); comece entre 0,05–0,2 para preservar a leitura das cartas. */
    opacity: 0.05,
    /** Multiplicador do raio do cone; 1 segue lightAngle, faixa útil 0,5–1,5. */
    radiusScale: 1,
    /** Altura acima do chão em unidades da cena; mantenha positiva para evitar sobreposição do piso. */
    bottomHeight: 0.06,
    sourceRadius: 0.22,
    /** Multiplicador de radiância: 1 é neutro; 1–3 realça o brilho da fonte. */
    sourceRadiance: 2,
    poolOpacity: 0.45,
  },
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('turnIndicatorSettings');
  });
