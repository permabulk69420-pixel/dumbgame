import { ASSETS } from './config.js';
import { loadGLB, prepareModel } from './asset-loader.js';
import { loadComputerSetup } from './computer/computer-setup.js';
import { registerComputerPlaceables } from './computer/computer-placeables.js';
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

    const drawerAnimations = createDrawerAnimations(desk, gltf.animations, {
      gameState,
      storageId: 'computer-desk-drawers'
    });
    updaters.push(drawerAnimations.update);

    const computer = await loadComputerSetup({
      desk,
      gameState,
      statusElement
    });
    updaters.push(computer.update);
    disposers.push(computer.dispose);

    // Register the desk first, then its child props. The later registrations deliberately
    // override the desk's placeable marker on each computer component, so the ray selects
    // the exact monitor, keyboard, mouse or tower instead of always resolving to the desk.
    placement.registerPlaceable(desk, 'computer-desk', { floorY });
    const computerPlaceables = registerComputerPlaceables({
      placement,
      roots: computer.roots,
      floorY
    });
    updaters.push(computerPlaceables.update);
    disposers.push(computerPlaceables.dispose);

    const slidingInteractions = registerSlidingDeskInteractions({
      desk,
      placement,
      drawerAnimations,
      statusElement
    });
    disposers.push(slidingInteractions.dispose);
    disposers.push(computer.registerInteractions(placement));

    if (statusElement) {
      statusElement.textContent =
        'Computer loaded · B/Y moves the exact highlighted prop · grip pulls drawers · A/X points';
    }
  } catch (error) {
    console.error('Computer desk setup failed to load', error);
    if (statusElement) statusElement.textContent = 'House loaded; the computer setup failed to load.';
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
