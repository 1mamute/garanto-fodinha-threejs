import { onSettingsChange } from '../config/hotSettings';
import { POST_PROCESSING } from '../config/postProcessingSettings';

const STORAGE_KEY = 'garanto-post-processing';
const listeners = new Set<(enabled: boolean) => void>();
let selected: boolean | undefined;

/** Local browser preference; the artistic settings supply the initial default. */
export function postProcessingEnabled(): boolean {
  if (selected !== undefined) return selected;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) selected = saved === 'true';
  } catch {
    return POST_PROCESSING.enabled;
  }
  return selected ?? POST_PROCESSING.enabled;
}

export function setPostProcessingEnabled(enabled: boolean): void {
  selected = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Storage restrictions still allow changing effects for this tab.
  }
  for (const listener of listeners) listener(enabled);
}

export function onPostProcessingChange(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

onSettingsChange(category => {
  if (category !== 'postProcessingSettings') return;
  for (const listener of listeners) listener(postProcessingEnabled());
});
