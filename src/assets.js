import { ASSETS } from './config.js?v=9';
import { loadGLB, prepareModel } from './asset-loader.js?v=2';
import { loadComputerSetup } from './computer/computer-setup.js?v=2';
import { registerComputerPlaceables } from './computer/computer-placeables.js';
import { createDrawerAnimations } from './interactions/drawers.js';
import { registerSlidingDeskInteractions } from './interactions/sliding-grab.js';
import { loadBedroomBed } from './furniture/bed-setup.js?v=2';
import { loadBedsideSetup } from './furniture/bedside-setup.js?v=6';
import { loadEntertainmentSetup } from './furniture/entertainment-setup.js?v=3';
import { loadWoodenBat } from './weapons/wooden-bat.js?v=4';
import { loadApartmentCeilingLights } from './lighting/ceiling-lights.js?v=1';
import { loadApartmentLightSwitches } from './lighting/light-switches.js?v=2';
import { loadApartmentWindows } from './windows/apartment-windows.js?v=1';
import { registerTopSurfaceCollider } from './physics/apartment-colliders.js?v=1';

export async function loadDecorAssets({
  scene,
  placement,
  physics = null,
  grips = [],
  hands = null,
  lighting = null,
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
  let ceilingLights = null;
  let lightSwitches = null;
  let apartmentWindows = null;
  let entertainmentSetup = null;

  try {
    ceilingLights = await loadApartmentCeilingLights({
      scene,
      statusElement
    });
    updaters.push(ceilingLights.update);
    disposers.push(ceilingLights.dispose);
  } catch (error) {
    console.error('Apartment ceiling lights failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the replacement ceiling lights failed to load.';
  }

  try {
    const gltf = await loadGLB(ASSETS.computerDesk);
    const desk = prepareModel(gltf.scene);
    desk.name = 'ComputerDesk';
    desk.position.set(4.25, floorY, 5.85);
    desk.rotation.y = 0;
    scene.add(desk);

    // Register the desk itself before monitors and peripherals are parented to it,
    // otherwise their topmost geometry would become the support surface.
    const deskPhysics = registerTopSurfaceCollider(physics, desk, {
      thickness: 0.06,
      insetX: 0.035,
      insetZ: 0.035,
      friction: 0.86
    });
    if (deskPhysics) disposers.push(() => deskPhysics.dispose());

    const drawerAnimations = createDrawerAnimations(desk, gltf.animations, {
      gameState,
      storageId: 'computer-desk-drawers'
    });
    updaters.push(drawerAnimations.update);

    const computer = await loadComputerSetup({ desk, gameState, statusElement });
    updaters.push(computer.update);
    disposers.push(computer.dispose);

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
      physics,
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
      physics,
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
      physics,
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
    lightSwitches = await loadApartmentLightSwitches({
      scene,
      placement,
      hands,
      lighting,
      floorY,
      statusElement
    });
    updaters.push(lightSwitches.update);
    disposers.push(lightSwitches.dispose);
  } catch (error) {
    console.error('Apartment light switches failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the light switches failed to load.';
  }

  try {
    const apartmentRoot = scene.getObjectByName('Apartment');
    apartmentWindows = await loadApartmentWindows({
      parent: apartmentRoot,
      placement,
      gameState,
      statusElement
    });
    disposers.push(apartmentWindows.dispose);
  } catch (error) {
    console.error('Apartment windows failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the replacement windows failed to load.';
  }

  try {
    entertainmentSetup = await loadEntertainmentSetup({
      scene,
      placement,
      physics,
      floorY,
      statusElement
    });
    updaters.push(entertainmentSetup.update);
    disposers.push(entertainmentSetup.dispose);
  } catch (error) {
    console.error('TV entertainment setup failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the TV setup failed to load.';
  }

  return {
    bed: bedroomBed,
    bedside: bedsideSetup,
    bat: woodenBat,
    ceilingLights,
    lightSwitches,
    windows: apartmentWindows,
    entertainment: entertainmentSetup,
    update(dt) {
      for (const updater of updaters) updater(dt);
    },
    dispose() {
      for (const dispose of disposers) dispose();
    }
  };
}
