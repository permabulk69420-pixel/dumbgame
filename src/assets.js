import { ASSETS } from './config.js';
import { loadGLB, prepareModel } from './asset-loader.js';
import { createDrawerAnimations } from './interactions/drawers.js';
import { registerSlidingDeskInteractions } from './interactions/sliding-grab.js';

export async function loadDecorAssets({
  scene,
  placement,
  floorY,
  statusElement,
  gameState = null
}) {
  const updaters = [];
  const disposers = [];

  try {
    const gltf = await loadGLB(ASSETS.computerDesk);
    const desk = prepareModel(gltf.scene);
    desk.name = 'ComputerDesk';
    desk.position.set(4.25, floorY, 5.85);
    desk.rotation.y = 0;
    scene.add(desk);

    placement.registerPlaceable(desk, 'computer-desk', { floorY });

    const drawerAnimations = createDrawerAnimations(desk, gltf.animations, {
      gameState,
      storageId: 'computer-desk-drawers'
    });
    updaters.push(drawerAnimations.update);

    const slidingInteractions = registerSlidingDeskInteractions({
      desk,
      placement,
      drawerAnimations,
      statusElement
    });
    disposers.push(slidingInteractions.dispose);

    if (statusElement) {
      statusElement.textContent = 'Desk loaded · pull drawers with trigger · point at the desk body to move it';
    }
  } catch (error) {
    console.error('ComputerDesk.glb failed to load', error);
    if (statusElement) statusElement.textContent = 'House loaded; the desk asset failed to load.';
  }

  return {
    update(dt) {
      for (const updater of updaters) updater(dt);
    },
    dispose() {
      for (const dispose of disposers) dispose();
    }
  };
}
