import { createWorld as createBaseWorld } from './scene.js?base=1';

export const CORRIDOR_LIGHT_LAYER = 1;

export function createWorld(app) {
  const world = createBaseWorld(app);

  // The camera sees both normal apartment objects (layer 0) and the enclosed
  // corridor (layer 1). Global daylight remains on layer 0, so it cannot bend
  // around the corridor walls and illuminate the dark extensions.
  world.camera.layers.enable(CORRIDOR_LIGHT_LAYER);
  world.corridorLightLayer = CORRIDOR_LIGHT_LAYER;

  return world;
}
