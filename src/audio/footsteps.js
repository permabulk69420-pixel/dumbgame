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

function currentSfxVolume() {
  const volumes = globalThis.game?.getAudioVolumes?.();
  const master = Number.isFinite(volumes?.master) ? volumes.master : 1;
  const sfx = Number.isFinite(volumes?.sfx) ? volumes.sfx : 1;
  return THREE.MathUtils.clamp(master * sfx, 0, 1);
}

export function createFootstepSystem({
  rig,
  renderer,
  audio = null,
  isSuppressed = () => false,
  stepDistance = 0.68
}) {
  if (!rig || !renderer) {
    throw new Error('createFootstepSystem requires rig and renderer');
  }

  const previousPosition = new THREE.Vector3();
  const activeNativeVoices = new Set();
  let hasPreviousPosition = false;
  let travelled = stepDistance * 0.42;
  let lastSample = -1;
  let enabled = true;

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
    if (next === lastSample) {
      next = (next + 1 + Math.floor(Math.random() * (WOOD_STEPS.length - 1))) % WOOD_STEPS.length;
    }
    lastSample = next;
    return next;
  }

  function playNative(sampleIndex, gain, playbackRate) {
    const voice = preloaders[sampleIndex].cloneNode();
    voice.volume = THREE.MathUtils.clamp(currentSfxVolume() * gain, 0, 1);
    voice.playbackRate = playbackRate;
    if ('preservesPitch' in voice) voice.preservesPitch = false;
    if ('mozPreservesPitch' in voice) voice.mozPreservesPitch = false;
    if ('webkitPreservesPitch' in voice) voice.webkitPreservesPitch = false;
    activeNativeVoices.add(voice);
    const cleanup = () => {
      activeNativeVoices.delete(voice);
      voice.removeAttribute('src');
      voice.load();
    };
    voice.addEventListener('ended', cleanup, { once: true });
    voice.addEventListener('error', cleanup, { once: true });
    void voice.play().catch(() => cleanup());
  }

  function playStep() {
    const sampleIndex = chooseSample();
    const gain = randomBetween(0.76, 0.92);
    const playbackRate = randomBetween(0.94, 1.06);

    if (audio?.playSfx) {
      audio.playSfx(WOOD_STEPS[sampleIndex], {
        gain,
        playbackRate,
        preservePitch: false
      });
    } else {
      playNative(sampleIndex, gain, playbackRate);
    }
  }

  function canPlay() {
    return enabled && renderer.xr.isPresenting && !isSuppressed();
  }

  function advance(distance) {
    if (!canPlay()) {
      travelled = Math.min(travelled, stepDistance * 0.42);
      return false;
    }
    if (!Number.isFinite(distance) || distance < 0.002 || distance > 0.45) return false;

    travelled += distance;
    if (travelled < stepDistance) return false;

    travelled %= stepDistance;
    playStep();
    return true;
  }

  function reset() {
    rig.getWorldPosition(previousPosition);
    hasPreviousPosition = true;
    travelled = stepDistance * 0.42;
  }

  // Position-tracking fallback for other movers. Player locomotion uses advance() with
  // the exact collision-approved movement distance, avoiding false steps during turning.
  function update() {
    rig.getWorldPosition(tempPosition);
    if (!hasPreviousPosition) {
      previousPosition.copy(tempPosition);
      hasPreviousPosition = true;
      return;
    }
    const distance = Math.hypot(
      tempPosition.x - previousPosition.x,
      tempPosition.z - previousPosition.z
    );
    previousPosition.copy(tempPosition);
    advance(distance);
  }

  return {
    update,
    advance,
    reset,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) travelled = stepDistance * 0.42;
      return enabled;
    },
    isEnabled: () => enabled,
    dispose() {
      for (const voice of activeNativeVoices) {
        voice.pause();
        voice.removeAttribute('src');
        voice.load();
      }
      activeNativeVoices.clear();
      for (const element of preloaders) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    }
  };
}
