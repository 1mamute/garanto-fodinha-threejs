export const FPS_METER = {
  /** Milliseconds between readings; 250–1000 keeps the display readable. Must be positive. */
  sampleIntervalMs: 500,
  /** Hidden by default; true shows the meter when no browser preference exists. */
  defaultEnabled: false,
};

const STORAGE_KEY = 'garanto-fps-meter';
const listeners = new Set<(enabled: boolean) => void>();
let enabled: boolean | undefined;

export function fpsMeterEnabled(): boolean {
  if (enabled !== undefined) return enabled;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    enabled = saved === null ? FPS_METER.defaultEnabled : saved === 'true';
  } catch {
    enabled = FPS_METER.defaultEnabled;
  }
  return enabled;
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
