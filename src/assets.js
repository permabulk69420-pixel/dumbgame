import { ASSETS } from './config.js';
import { loadGLB, prepareModel } from './asset-loader.js';
import { createDrawerAnimations } from './interactions/drawers.js';

export async function loadDecorAssets({ scene, placement, floorY, statusElement }) {
  const updaters = [];

  try {
    const gltf = await loadGLB(ASSETS.computerDesk);
    const desk = prepareModel(gltf.scene);
    desk.name = 'ComputerDesk';
    desk.position.set(4.25, floorY, 5.85);
    desk.rotation.y = 0;
    scene.add(desk);

    const drawerAnimations = createDrawerAnimations(desk, gltf.animations);
    updaters.push(drawerAnimations.update);
    placement.registerPlaceable(desk, 'computer-desk', { floorY });

    if (statusElement) {
      statusElement.textContent = 'Desk loaded · point and hold trigger to move it · release to place';
    }
  } catch (error) {
    console.error('ComputerDesk.glb failed to load', error);
    if (statusElement) statusElement.textContent = 'House loaded; the desk asset failed to load.';
  }

  return {
    update(dt) {
      for (const updater of updaters) updater(dt);
    }
  };
}
