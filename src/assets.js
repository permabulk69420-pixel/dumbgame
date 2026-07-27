import { ASSETS } from './config.js?v=7';
import { loadGLB, prepareModel } from './asset-loader.js?v=2';
import { loadComputerSetup } from './computer/computer-setup.js?v=2';
import { registerComputerPlaceables } from './computer/computer-placeables.js';
import { createDrawerAnimations } from './interactions/drawers.js';
import { registerSlidingDeskInteractions } from './interactions/sliding-grab.js';
import { loadBedroomBed } from './furniture/bed-setup.js?v=1';
import { loadBedsideSetup } from './furniture/bedside-setup.js?v=1';
import { loadEntertainmentSetup } from './furniture/entertainment-setup.js?v=2';
import { loadWoodenBat } from './weapons/wooden-bat.js?v=1';

export async function loadDecorAssets({
  scene,
  placement,
  grips = [],
  controllerModes = null,
  floorY,
  statusElement,
  gameState = null
}) {
  const updaters = [];
  const disposers = [];
  let bedroomBed = null;
  let bedsideSetup = null;
  let woodenBat = null;

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
    if (statusElement) statusElement.textContent = 'Apartment loaded; the computer setup failed to load.';
  }

  try {
    const gltf = await loadGLB(ASSETS.couch);
    const couch = prepareModel(gltf.scene, { castShadow: true, receiveShadow: true });
    couch.name = 'TwoSeatBlackLeatherCouch';

    // Against the living-room side wall, facing into the room. It remains a normal
    // decoration-mode placeable, so this is only its first-run position.
    couch.position.set(5.55, floorY, -1.35);
    couch.rotation.y = Math.PI * 0.5;
    scene.add(couch);
    placement.registerPlaceable(couch, 'living-room-couch', { floorY });

    disposers.push(() => {
      placement.unregisterPlaceable(couch);
      couch.removeFromParent();
    });
  } catch (error) {
    console.error('Couch failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the couch failed to load.';
  }

  try {
    bedroomBed = await loadBedroomBed({
      scene,
      placement,
      floorY,
      statusElement
    });
    disposers.push(bedroomBed.dispose);
  } catch (error) {
    console.error('Queen bed failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the queen bed failed to load.';
  }

  try {
    bedsideSetup = await loadBedsideSetup({
      scene,
      placement,
      floorY,
      gameState,
      statusElement
    });
    updaters.push(bedsideSetup.update);
    disposers.push(bedsideSetup.dispose);
  } catch (error) {
    console.error('Bedside table and alarm clock failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the bedside setup failed to load.';
  }

  try {
    woodenBat = await loadWoodenBat({
      scene,
      placement,
      grips,
      controllerModes,
      floorY,
      statusElement
    });
    updaters.push(woodenBat.update);
    disposers.push(woodenBat.dispose);
  } catch (error) {
    console.error('Wooden bat failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the wooden bat failed to load.';
  }

  try {
    const entertainment = await loadEntertainmentSetup({
      scene,
      placement,
      floorY,
      statusElement
    });
    updaters.push(entertainment.update);
    disposers.push(entertainment.dispose);
  } catch (error) {
    console.error('TV entertainment setup failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the TV setup failed to load.';
  }

  return {
    bed: bedroomBed,
    bedside: bedsideSetup,
    bat: woodenBat,
    update(dt) {
      for (const updater of updaters) updater(dt);
    },
    dispose() {
      for (const dispose of disposers) dispose();
    }
  };
}
