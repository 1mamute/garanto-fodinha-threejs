type Settings = Record<string, unknown>;

/** Mantém as referências, inclusive objetos internos, usadas pela cena em andamento. */
export function replaceSettings(target: Settings, source: Settings): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) Reflect.deleteProperty(target, key);
  }
  for (const [key, value] of Object.entries(source)) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor?.get) {
      Object.defineProperty(target, key, descriptor);
      continue;
    }
    const previous = target[key];
    if (isSettings(previous) && isSettings(value)) replaceSettings(previous, value);
    else target[key] = value;
  }
}

function isSettings(value: unknown): value is Settings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** O módulo chamador aceita o HMR; seus consumidores continuam usando o mesmo objeto. */
export function hotSettings<Type extends Settings>(
  hot: Pick<NonNullable<ImportMeta['hot']>, 'data'> | undefined,
  key: string,
  defaults: Type,
): Type {
  if (!hot) return defaults;
  const data = hot.data as { settings?: Record<string, Settings> };
  data.settings ??= {};
  const previous = data.settings[key];
  if (previous) {
    replaceSettings(previous, defaults);
    return previous as Type;
  }
  data.settings[key] = defaults;
  return defaults;
}

const listeners = new Set<(category: string) => void>();

/** Notifica recursos que precisam ser reconstruídos, sem reiniciar a cena ou a partida. */
export function settingsChanged(category: string): void {
  for (const listener of listeners) listener(category);
}

export function onSettingsChange(listener: (category: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** As configurações não prolongam a vida de objetos removidos da cena. */
export function watchSettings<Type extends object>(
  target: Type,
  listener: (target: Type, category: string) => void,
): void {
  const reference = new WeakRef(target);
  const unsubscribe = onSettingsChange(category => {
    const current = reference.deref();
    if (current) listener(current, category);
    else unsubscribe();
  });
}
