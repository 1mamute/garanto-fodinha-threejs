/** Local graphics preferences never become part of the multiplayer state. */
export const ANTIALIASING_MODES = ['off', 'msaa', 'fxaa', 'smaa', 'ssaa', 'taa'] as const;
export type AntialiasingMode = (typeof ANTIALIASING_MODES)[number];

const STORAGE_KEY = 'garanto-antialiasing';
const DEFAULT_MODE: AntialiasingMode = 'msaa';
const listeners = new Set<(mode: AntialiasingMode) => void>();
let selectedMode: AntialiasingMode | undefined;

export function isAntialiasingMode(value: unknown): value is AntialiasingMode {
  return ANTIALIASING_MODES.some(mode => mode === value);
}

export function antialiasingMode(): AntialiasingMode {
  if (selectedMode) return selectedMode;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    selectedMode = isAntialiasingMode(saved) ? saved : DEFAULT_MODE;
  } catch {
    selectedMode = DEFAULT_MODE;
  }
  return selectedMode;
}

export function setAntialiasingMode(mode: AntialiasingMode): void {
  selectedMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Browsers that deny storage can still change graphics for this tab.
  }
  for (const listener of listeners) listener(mode);
}

export function onAntialiasingChange(listener: (mode: AntialiasingMode) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
