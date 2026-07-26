import { createWorld } from './scene.js';
import { createMaterials } from './materials.js';
import { createHouse } from './house.js?v=2';
import { createPlacementSystem } from './placement-system.js';
import { createLocomotion } from './locomotion.js?v=2';
import { createVRHands } from './hands.js?v=6';
import { loadDecorAssets } from './assets.js?v=2';
import { loadPistol } from './weapons/pistol.js?v=3';
import { loadTorch } from './tools/torch.js?v=3';
import { loadApartmentEntryDoor } from './doors/apartment-entry-door.js?v=2';
import { GAME_TIME, INTERACTION } from './config.js?v=3';
import { createControllerModes } from './input/controller-modes.js';
import { createGameState } from './state/game-state.js';
import { createGameClock } from './time/game-clock.js';
import { createDayNightCycle } from './time/day-night-cycle.js';
import { createEventScheduler } from './story/event-scheduler.js';
import { createPerformanceHud } from './debug/performance-hud.js?v=1';

const app = document.getElementById('app');
const loading = document.getElementById('loading');
const title = document.getElementById('title');
const status = document.getElementById('status');

const world = createWorld(app);
const materials = createMaterials();
const house = createHouse(world.scene, materials);

const gameState = createGameState();
const clock = createGameClock({
  gameState,
  realSecondsPerDay: GAME_TIME.realSecondsPerDay
});
const dayNight = createDayNightCycle({
  scene: world.scene,
  renderer: world.renderer,
  lights: world.lights,
  houseRoot: house.root,
  gameState
});
const events = createEventScheduler({ gameState });

const controllerModes = createControllerModes({
  controllers: world.controllers,
  statusElement: status,
  decorationEnabledByDefault: INTERACTION.decorationEnabledByDefault,
  decorationToggleHoldSeconds: INTERACTION.decorationToggleHoldSeconds
});

const performanceHud = createPerformanceHud({
  scene: world.scene,
  camera: world.camera,
  renderer: world.renderer,
  grips: world.grips,
  controllerModes,
  visibleByDefault: true
});

const placement = createPlacementSystem({
  scene: world.scene,
  renderer: world.renderer,
  controllers: world.controllers,
  controllerModes,
  floorY: house.floorY,
  bounds: house.bounds,
  statusElement: status
});

let entryDoor = {
  update() {},
  setLocked() { return false; },
  setAngle() { return 0; },
  getAngle() { return 0; }
};

loadApartmentEntryDoor({
  parent: house.root,
  placement,
  collisionSegments: house.collisionSegments,
  controllerModes,
  floorY: house.floorY,
  statusElement: status
}).then((value) => {
  entryDoor = value;
}).catch((error) => {
  console.error('Apartment entry door failed to load', error);
  status.textContent = 'Apartment loaded; the entry door failed to load.';
});

const locomotion = createLocomotion({
  renderer: world.renderer,
  camera: world.camera,
  rig: world.rig,
  collisionSegments: house.collisionSegments,
  placement
});

let hands = { update() {} };
let decor = { update() {} };
let pistol = { update() {} };
let torch = { update() {} };
let displayedClockKey = '';

function refreshClockLabel(state) {
  const wholeMinute = Math.floor(state.minuteOfDay);
  const key = `${state.day}:${wholeMinute}`;
  if (key === displayedClockKey) return;
  displayedClockKey = key;
  title.textContent = `Day ${state.day} · ${clock.formatTime(state.minuteOfDay)}`;
}

gameState.subscribe(refreshClockLabel, { immediate: true });

const handsReady = createVRHands({
  controllers: world.controllers,
  grips: world.grips,
  controllerModes,
  onError: (message) => console.warn(message)
}).then((value) => {
  hands = value;
  return value;
}).catch((error) => {
  console.error('VR hands failed to load', error);
  return null;
});

loadDecorAssets({
  scene: world.scene,
  placement,
  floorY: house.floorY,
  statusElement: status,
  gameState
}).then((value) => {
  decor = value;
}).catch(console.error);

handsReady.then((handsSystem) => loadPistol({
  scene: world.scene,
  placement,
  grips: handsSystem?.objectGrips || world.grips,
  controllerModes,
  floorY: house.floorY,
  statusElement: status
})).then((value) => {
  pistol = value;
}).catch((error) => {
  console.error('Pistol failed to load', error);
  status.textContent = 'Apartment loaded; the pistol failed to load.';
});

handsReady.then((handsSystem) => loadTorch({
  scene: world.scene,
  placement,
  grips: handsSystem?.objectGrips || world.grips,
  hands: handsSystem,
  controllerModes,
  floorY: house.floorY,
  statusElement: status
})).then((value) => {
  torch = value;
}).catch((error) => {
  console.error('Torch failed to load', error);
  status.textContent = 'Apartment loaded; the torch failed to load.';
});

world.renderer.xr.addEventListener('sessionstart', () => {
  world.rig.position.copy(house.spawn);
  world.rig.rotation.set(0, 0, 0);
  world.camera.position.set(0, 0, 0);
  performanceHud.reset();
  status.textContent =
    'FPS panel follows left controller · grip door handles · grip picks up pistol or torch · A/X points';
});

world.renderer.xr.addEventListener('sessionend', () => {
  world.rig.position.set(0, 0, 0);
  world.rig.rotation.set(0, 0, 0);
  gameState.save();
  status.textContent = 'Quest: left stick moves, right stick turns smoothly. No snap turning.';
});

// Stable hooks for beds, computers, doors, story scripts and temporary decorating tools.
window.game = {
  readState: gameState.read,
  setFlag: gameState.setFlag,
  clearFlag: gameState.clearFlag,
  setStoryPhase: gameState.setStoryPhase,
  completeEvent: gameState.completeEvent,
  registerEvent: events.register,
  setTime: clock.setTime,
  skipMinutes: clock.skipMinutes,
  sleepToNextDay: () => clock.sleepToNextDay(GAME_TIME.sleepHour, GAME_TIME.sleepMinute),
  setTimeScale: clock.setTimeScale,
  pauseTime: clock.setPaused,
  setDecorationMode: controllerModes.setDecorationMode,
  isDecorationMode: controllerModes.isDecorationMode,
  setPointing: controllerModes.setPointing,
  setPerformanceHudVisible: performanceHud.setVisible,
  isPerformanceHudVisible: performanceHud.isVisible,
  setEntryDoorLocked: (...args) => entryDoor.setLocked(...args),
  setEntryDoorAngle: (...args) => entryDoor.setAngle(...args),
  getEntryDoorAngle: () => entryDoor.getAngle(),
  resetGameState: gameState.reset
};

window.addEventListener('pagehide', () => gameState.save());

loading.remove();
let lastTime = performance.now();
let previewAngle = 0.5;

world.renderer.setAnimationLoop((time) => {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  controllerModes.update(dt);

  const advanceClock = GAME_TIME.advanceOnlyInXR ? world.renderer.xr.isPresenting : true;
  clock.update(dt, advanceClock);
  dayNight.update(dt);
  events.update({ world, house, placement, clock });

  placement.update(dt);
  hands.update(dt);
  decor.update(dt);
  pistol.update(dt);
  torch.update(dt);
  entryDoor.update(dt);

  if (world.renderer.xr.isPresenting) {
    locomotion.update(dt);
  } else {
    previewAngle += dt * 0.08;
    const radius = Math.max(house.dimensions.width, house.dimensions.depth) * 1.08;
    world.camera.position.set(Math.sin(previewAngle) * radius, 12.5, Math.cos(previewAngle) * radius);
    world.camera.lookAt(0, 0.7, 0);
  }

  performanceHud.update(time);
  world.renderer.render(world.scene, world.camera);
});
