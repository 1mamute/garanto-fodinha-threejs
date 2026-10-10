import type Jolt from 'jolt-physics';

export const STATIC_LAYER = 0;
export const MOVING_LAYER = 1;

export function createPhysicsSystem(runtime: typeof Jolt): Jolt.JoltInterface {
  const settings = new runtime.JoltSettings();
  settings.mMaxBodies = 2048;
  settings.mMaxBodyPairs = 4096;
  settings.mMaxContactConstraints = 4096;
  settings.mMaxWorkerThreads = 0;
  const pairs = new runtime.ObjectLayerPairFilterTable(2);
  pairs.EnableCollision(STATIC_LAYER, MOVING_LAYER);
  pairs.EnableCollision(MOVING_LAYER, MOVING_LAYER);
  const broadPhase = new runtime.BroadPhaseLayerInterfaceTable(2, 2);
  const staticLayer = new runtime.BroadPhaseLayer(0);
  const movingLayer = new runtime.BroadPhaseLayer(1);
  broadPhase.MapObjectToBroadPhaseLayer(STATIC_LAYER, staticLayer);
  broadPhase.MapObjectToBroadPhaseLayer(MOVING_LAYER, movingLayer);
  runtime.destroy(staticLayer);
  runtime.destroy(movingLayer);
  settings.mObjectLayerPairFilter = pairs;
  settings.mBroadPhaseLayerInterface = broadPhase;
  settings.mObjectVsBroadPhaseLayerFilter = new runtime.ObjectVsBroadPhaseLayerFilterTable(
    broadPhase,
    2,
    pairs,
    2,
  );
  // JoltInterface owns the filters; only the temporary settings belong to this caller.
  const system = new runtime.JoltInterface(settings);
  runtime.destroy(settings);
  return system;
}
