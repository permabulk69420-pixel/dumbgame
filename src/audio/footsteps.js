import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const WOOD_STEPS = Object.freeze([
  './assets/audio/footsteps/wood/wood_step_01.wav',
  './assets/audio/footsteps/wood/wood_step_02.wav',
  './assets/audio/footsteps/wood/wood_step_03.wav',
  './assets/audio/footsteps/wood/wood_step_04.wav',
  './assets/audio/footsteps/wood/wood_step_05.wav',
  './assets/audio/footsteps/wood/wood_step_06.wav',
  './assets/audio/footsteps/wood/wood_step_07.wav'
]);

const tempPosition = new THREE.Vector3();

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function createFootstepSystem({
  rig,
  renderer,
  audio,
  isSuppressed = () => false,
  stepDistance = 0.68
}) {
  if (!rig || !renderer || !audio?.playSfx) {
    throw new Error('createFootstepSystem requires rig, renderer and audio manager');
  }

  const previousPosition = new THREE.Vector3();
  let hasPreviousPosition = false;
  let travelled = stepDistance * 0.42;
  let lastSample = -1;
  let enabled = true;

  // Ask the browser to fetch these tiny clips early. Playback still goes through the
  // central audio manager so master/SFX volume controls continue to work.
  const preloaders = WOOD_STEPS.map((url) => {
    const element = new Audio(url);
    element.preload = 'auto';
    element.crossOrigin = 'anonymous';
    element.load();
    return element;
  });

  function chooseSample() {
    if (WOOD_STEPS.length < 2) return 0;
    let next = Math.floor(Math.random() * WOOD_STEPS.length);
    if (next === lastSample) next = (next + 1 + Math.floor(Math.random() * (WOOD_STEPS.length - 1))) % WOOD_STEPS.length;
    lastSample = next;
    return next;
  }

  function playStep() {
    const sampleIndex = chooseSample();
    audio.playSfx(WOOD_STEPS[sampleIndex], {
      gain: randomBetween(0.76, 0.92),
      playbackRate: randomBetween(0.94, 1.06),
      preservePitch: false
    });
  }

  function reset() {
    rig.getWorldPosition(previousPosition);
    hasPreviousPosition = true;
    travelled = stepDistance * 0.42;
  }

  function update() {
    rig.getWorldPosition(tempPosition);

    if (!hasPreviousPosition) {
      previousPosition.copy(tempPosition);
      hasPreviousPosition = true;
      return;
    }

    const dx = tempPosition.x - previousPosition.x;
    const dz = tempPosition.z - previousPosition.z;
    const distance = Math.hypot(dx, dz);
    previousPosition.copy(tempPosition);

    const active = enabled && renderer.xr.isPresenting && !isSuppressed();
    if (!active) {
      travelled = Math.min(travelled, stepDistance * 0.42);
      return;
    }

    // Ignore teleports, spawn placement and calibration corrections rather than firing
    // several footsteps in one frame.
    if (distance < 0.002 || distance > 0.45) return;

    travelled += distance;
    if (travelled < stepDistance) return;

    travelled %= stepDistance;
    playStep();
  }

  return {
    update,
    reset,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) travelled = stepDistance * 0.42;
      return enabled;
    },
    isEnabled: () => enabled,
    dispose() {
      for (const element of preloaders) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    }
  };
}
