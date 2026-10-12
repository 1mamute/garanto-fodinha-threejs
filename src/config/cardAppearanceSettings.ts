import { hotSettings, settingsChanged } from './hotSettings';

/** Carta em unidades da cena: width é a largura, height a espessura e depth a altura impressa; raio deve ser menor que metade da largura. */
export const CARD_SIZE = hotSettings(import.meta.hot, 'CARD_SIZE', {
  width: 0.35,
  height: 0.0017,
  depth: 0.49,
  cornerRadius: 0.017,
});

/** Resolução das texturas em pixels e cores CSS do papel, tintas e detalhes dourados. */
export const CARD_ARTWORK = hotSettings(import.meta.hot, 'CARD_ARTWORK', {
  CARD_WIDTH: 512,
  CARD_HEIGHT: 720,
  PAPER: '#f4ecda',
  BLACK_INK: '#252e2b',
  RED_INK: '#a63238',
  BRASS: '#ae8952',
});

if (import.meta.hot)
  import.meta.hot.accept(() => {
    settingsChanged('cardAppearanceSettings');
  });
