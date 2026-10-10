import initJolt from 'jolt-physics/wasm';
import wasmUrl from 'jolt-physics/jolt-physics.wasm.wasm?url';

let runtime: typeof initJolt | undefined;

export async function initializePhysics(): Promise<void> {
  runtime = await initJolt({ locateFile: () => wasmUrl });
}

export function physicsRuntime(): typeof initJolt {
  if (!runtime) throw new Error('A física ainda não foi inicializada.');
  return runtime;
}
