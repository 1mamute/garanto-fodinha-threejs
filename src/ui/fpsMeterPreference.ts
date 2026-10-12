import { onSettingsChange } from '../config/hotSettings';
import { FPS_METER } from '../config/fpsMeterSettings';

const STORAGE_KEY = 'garanto-fps-meter';
const listeners = new Set<(enabled: boolean) => void>();
let enabled: boolean | undefined;

export function fpsMeterEnabled(): boolean {
  if (enabled !== undefined) return enabled;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) enabled = saved === 'true';
  } catch {
    return FPS_METER.defaultEnabled;
  }
  return enabled ?? FPS_METER.defaultEnabled;
}

export function setFpsMeterEnabled(value: boolean): void {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage restrictions still allow changing the preference for this tab.
  }
  for (const listener of listeners) listener(value);
}

export function onFpsMeterChange(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

onSettingsChange(category => {
  if (category !== 'fpsMeterSettings') return;
  for (const listener of listeners) listener(fpsMeterEnabled());
});
