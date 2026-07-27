import { createWorld } from './scene.js';
import { createMaterials } from './materials.js';
import { createHouse } from './house.js?v=2';
import { createPlacementSystem } from './placement-system.js?v=2';
import { createLocomotion } from './locomotion.js?v=2';
import { createVRHands } from './hands.js?v=7';
import { loadDecorAssets } from './assets.js?v=3';
import { loadPistol } from './weapons/pistol.js?v=3';
import { loadTorch } from './tools/torch.js?v=3';
import { loadApartmentEntryDoor } from './doors/apartment-entry-door.js?v=2';
import { GAME_TIME, INTERACTION } from './config.js?v=4';
import { createControllerModes } from './input/controller-modes.js?v=2';
import { createGameState } from './state/game-state.js';
import { createGameClock } from './time/game-clock.js';
import { createDayNightCycle } from './time/day-night-cycle.js';
import { createEventScheduler } from './story/event-scheduler.js';
import {
  createWakeSequence,
  readPublishedWakeSetup,
  WAKE_SEQUENCE_EVENT_ID
} from './story/wake-sequence.js?v=1';
import { createWakeAuthoring } from './debug/wake-authoring.js?v=2';
import { createPerformanceHud } from './debug/performance-hud.js?v=1';
import { MODE_STORAGE_KEYS, selectStartMode } from './ui/start-menu.js?v=1';

const app = document.getElementById('app');
const loading = document.getElementById('loading');
const title = document.getElementById('title');
const status = document.getElementById('status');

const startSelection = await selectStartMode({ loadingElement: loading });
const gameMode = startSelection.mode;
const isCreativeMode = gameMode === 'creative';
const gameModeLabel = isCreativeMode ? 'Creative Build' : 'Story Mode';
const stateStorageKey = isCreativeMode
  ? MODE_STORAGE_KEYS.creativeState
  : MODE_STORAGE_KEYS.storyState;
const placementStorageKey = isCreativeMode
  ? MODE_STORAGE_KEYS.creativePlacements
  : MODE_STORAGE_KEYS.storyPlacements;

const world = createWorld(app);
const materials = createMaterials();
const house = createHouse(world.scene, materials);

const gameState = createGameState({ storageKey: stateStorageKey });
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
  allowDecoration: isCreativeMode,
  decorationEnabledByDefault: isCreativeMode,
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
  statusElement: status,
  storageKey: placementStorageKey
});

let hands = {
  update() {},
  setVisible() { return false; },
  isVisible() { return false; }
};
let decor = { update() {} };
let pistol = { update() {} };
let torch = { update() {} };

const wakeSequence = createWakeSequence({
  renderer: world.renderer,
  camera: world.camera,
  rig: world.rig,
  placement,
  performanceHud,
  clock,
  statusElement: status,
  setHandsVisible: (value) => hands.setVisible?.(value)
});

let wakeAuthoring = {
  update() {},
  preview() { return false; },
  publish() { return null; },
  setVisible() { return false; },
  captureSetup() { return null; }
};

if (isCreativeMode) {
  wakeAuthoring = createWakeAuthoring({
    scene: world.scene,
    renderer: world.renderer,
    placement,
    house,
    wakeSequence,
    statusElement: status
  });
}

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

let displayedClockKey = '';

function refreshClockLabel(state) {
  const wholeMinute = Math.floor(state.minuteOfDay);
  const key = `${state.day}:${wholeMinute}`;
  if (key === displayedClockKey) return;
  displayedClockKey = key;
  title.textContent = `${gameModeLabel} · Day ${state.day} · ${clock.formatTime(state.minuteOfDay)}`;
}

gameState.subscribe(refreshClockLabel, { immediate: true });

const handsReady = createVRHands({
  controllers: world.controllers,
  grips: world.grips,
  controllerModes,
  onError: (message) => console.warn(message)
}).then((value) => {
  hands = value;
  hands.setVisible(wakeSequence.shouldShowHands());
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

function finishOpeningStoryBeat() {
  gameState.completeEvent(WAKE_SEQUENCE_EVENT_ID);
  gameState.setStoryPhase('day1_awake');
  status.textContent = 'Story Mode · awake · investigate the apartment';
}

world.renderer.xr.addEventListener('sessionstart', () => {
  world.rig.position.copy(house.spawn);
  world.rig.rotation.set(0, 0, 0);
  world.rig.scale.set(1, 1, 1);
  world.camera.position.set(0, 0, 0);
  world.camera.quaternion.identity();
  performanceHud.reset();

  if (isCreativeMode) {
    wakeAuthoring.setVisible(true);
    status.textContent =
      'Creative Build · move the three wake markers, then point and trigger PREVIEW or PUBLISH';
    return;
  }

  const publishedSetup = readPublishedWakeSetup();
  const openingComplete = gameState.read().completedEvents.includes(WAKE_SEQUENCE_EVENT_ID);
  if (publishedSetup && !openingComplete) {
    const started = wakeSequence.start(publishedSetup, { onComplete: finishOpeningStoryBeat });
    if (!started) {
      hands.setVisible(true);
      status.textContent = 'Story Mode · wake sequence could not start · using the normal apartment spawn';
    }
  } else {
    hands.setVisible(true);
    status.textContent = publishedSetup
      ? 'Story Mode · grip handles or held items · A/X points'
      : 'Story Mode · no wake setup published yet · starting at the normal apartment spawn';
  }
});

world.renderer.xr.addEventListener('sessionend', () => {
  wakeSequence.cancel();
  if (isCreativeMode) wakeAuthoring.setVisible(true);
  world.rig.position.set(0, 0, 0);
  world.rig.rotation.set(0, 0, 0);
  world.rig.scale.set(1, 1, 1);
  world.camera.quaternion.identity();
  gameState.save();
  status.textContent = `${gameModeLabel} · left stick moves, right stick turns smoothly.`;
});

// Stable hooks for beds, computers, doors, story scripts and temporary decorating tools.
window.game = {
  mode: gameMode,
  startAction: startSelection.action,
  returnToTitle: () => window.location.reload(),
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
  isDecorationAllowed: controllerModes.isDecorationAllowed,
  isDecorationMode: controllerModes.isDecorationMode,
  setPointing: controllerModes.setPointing,
  setPerformanceHudVisible: performanceHud.setVisible,
  isPerformanceHudVisible: performanceHud.isVisible,
  previewWakeSequence: wakeAuthoring.preview,
  publishWakeSetup: wakeAuthoring.publish,
  readWakeSetup: readPublishedWakeSetup,
  cancelWakeSequence: wakeSequence.cancel,
  getWakePhase: wakeSequence.getPhase,
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
  wakeSequence.update(dt);
  wakeAuthoring.update(dt);

  const advanceClock = GAME_TIME.advanceOnlyInXR ? world.renderer.xr.isPresenting : true;
  clock.update(dt, advanceClock && !wakeSequence.isActive());
  dayNight.update(dt);
  if (!isCreativeMode && !wakeSequence.isActive()) {
    events.update({ world, house, placement, clock });
  }

  placement.update(dt);
  hands.update(dt);
  decor.update(dt);
  pistol.update(dt);
  torch.update(dt);
  entryDoor.update(dt);

  if (world.renderer.xr.isPresenting) {
    if (!wakeSequence.isActive()) locomotion.update(dt);
  } else {
    previewAngle += dt * 0.08;
    const radius = Math.max(house.dimensions.width, house.dimensions.depth) * 1.08;
    world.camera.position.set(Math.sin(previewAngle) * radius, 12.5, Math.cos(previewAngle) * radius);
    world.camera.lookAt(0, 0.7, 0);
  }

  performanceHud.update(time);
  world.renderer.render(world.scene, world.camera);
});
