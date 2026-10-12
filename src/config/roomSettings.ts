import { hotSettings, settingsChanged } from './hotSettings';

/** Parâmetros de cardDrag; salve para aplicar sem recarregar. */
export const FELT = hotSettings(import.meta.hot, 'FELT', {
  /** Raio do feltro em unidades da cena, compartilhado pela geometria e limites do arrasto. */
  FELT_RADIUS: 2.65,
});

/** Dimensões em unidades da cena; rotação e posições das luminárias em radianos. Raio da sala: 8–20. */
export const ROOM_DIMENSIONS = hotSettings(import.meta.hot, 'ROOM_DIMENSIONS', {
  ROOM_RADIUS: 13.5,
  TABLE_RADIUS: 2.83,
  FLOOR_ROTATION: Math.PI / 12,
  WALL_LAMP_ANGLES: [Math.PI - 0.65, Math.PI + 0.65, -0.65, 0.65],
  WALL_WALK_CLEARANCE: 1.5,
  WALL_PANEL_INSET: 0.25,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('roomSettings');
  });
