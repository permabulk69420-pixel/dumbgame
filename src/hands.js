import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from './config.js';
import { loadGLB, prepareModel } from './asset-loader.js';

function createActions(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    action.weight = 0;
    actions.set(clip.name, action);
  }
  return { mixer, actions, current: null };
}

function setPose(state, name, amount) {
  const action = state.actions.get(name);
  if (!action) return;
  if (state.current && state.current !== action) state.current.weight = 0;
  state.current = action;
  action.weight = 1;
  action.time = THREE.MathUtils.clamp(amount, 0, 1);
}

export async function createVRHands({
  controllers,
  grips,
  controllerModes = null,
  onError = console.warn
}) {
  const sources = await Promise.allSettled([
    loadGLB(ASSETS.leftHand),
    loadGLB(ASSETS.rightHand)
  ]);

  const models = {
    left: sources[0].status === 'fulfilled' ? sources[0].value : null,
    right: sources[1].status === 'fulfilled' ? sources[1].value : null
  };

  const states = controllers.map((controller, index) => ({
    controller,
    grip: grips[index],
    inputSource: null,
    handedness: '',
    handRoot: null,
    mixerState: null
  }));

  function attach(state, handedness) {
    if (state.handRoot) state.grip.remove(state.handRoot);
    state.handRoot = null;
    state.mixerState = null;

    const gltf = models[handedness];
    if (!gltf) {
      onError(`Missing ${handedness} hand model`);
      return;
    }

    const root = prepareModel(gltf.scene, { castShadow: true, receiveShadow: false });
    root.name = `${handedness}-vr-hand`;
    state.grip.add(root);
    state.handRoot = root;
    state.mixerState = createActions(root, gltf.animations);
    setPose(state.mixerState, 'Open', 0);
  }

  for (const state of states) {
    state.controller.addEventListener('connected', (event) => {
      state.inputSource = event.data;
      state.handedness = event.data.handedness || '';
      if (state.handedness === 'left' || state.handedness === 'right') {
        attach(state, state.handedness);
      }
    });
    state.controller.addEventListener('disconnected', () => {
      state.inputSource = null;
      state.handedness = '';
      if (state.handRoot) state.grip.remove(state.handRoot);
      state.handRoot = null;
      state.mixerState = null;
    });
  }

  function update(dt) {
    for (const state of states) {
      if (!state.mixerState) continue;
      const gamepad = state.inputSource?.gamepad;
      const trigger = gamepad?.buttons?.[0]?.value ?? 0;
      const squeeze = gamepad?.buttons?.[1]?.value ?? 0;
      const pointing = controllerModes?.isPointing?.(state.handedness) ?? false;

      if (squeeze > 0.08 && trigger > 0.08) {
        setPose(state.mixerState, 'Fist', Math.max(trigger, squeeze));
      } else if (squeeze > 0.08) {
        setPose(state.mixerState, 'Grip', squeeze);
      } else if (pointing && trigger <= 0.08) {
        setPose(state.mixerState, 'Point', 1);
      } else if (trigger > 0.08) {
        setPose(state.mixerState, 'Pinch', trigger);
      } else {
        setPose(state.mixerState, 'Open', 0);
      }

      // Paused, scrubbed hand actions still require the mixer tick every frame.
      state.mixerState.mixer.update(dt);
    }
  }

  return { update, states };
}
