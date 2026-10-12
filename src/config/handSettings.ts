import { hotSettings, settingsChanged } from './hotSettings';

/** Leque do robô: escala relativa, separação e posição em unidades da cena, inclinação em radianos. Inclinação 0 deixa as cartas paralelas. */
export const ROBOT_FAN = hotSettings(import.meta.hot, 'ROBOT_FAN', {
  scale: 0.6,
  spread: 0.065,
  y: 0,
  z: 0,
  tilt: -0.08,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('handSettings');
  });
