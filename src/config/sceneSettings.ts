import { hotSettings, settingsChanged } from './hotSettings';

/** Suavização das posições em 1/s: valores maiores convergem mais rápido; 0 suspende a interpolação. */
export const SCENE_ANIMATION = hotSettings(import.meta.hot, 'SCENE_ANIMATION', {
  smoothingResponse: 7,
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('sceneSettings');
  });
