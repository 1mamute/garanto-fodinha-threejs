import { hotSettings, settingsChanged } from './hotSettings';

/** Iluminação compartilhada: distâncias em unidades da cena, luz pontual em candelas; intensidade 0 desliga a luz. Exposição 1 é neutra. */
export const ENVIRONMENT = hotSettings(import.meta.hot, 'ENVIRONMENT', {
  background: '#080d0e',
  exposure: 1.35,
  fogNear: 8,
  fogFar: 23,
  lamp: { color: '#ffd298', intensity: 32, distance: 15, decay: 2, height: 4.7 },
  rim: { color: '#749baf', intensity: 0.45, x: -5, y: 4, z: -5 },
  hemisphere: { sky: '#d0b190', ground: '#30241f', intensity: 0.8 },
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('environmentSettings');
  });
