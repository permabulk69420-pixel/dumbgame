import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from './config.js';
import { loadGLB, prepareModel } from './asset-loader.js';

// The hand meshes are authored with fingers along -Z and palms along -Y.
// A mirrored 90-degree roll makes the palms wrap inward around the Quest grips
// instead of appearing flat. Keep this separate from object-specific grip poses.
const HAND_GRIP_OFFSETS = Object.freeze({
  left: Object.freeze({
    position: Object.freeze([0, 0, 0]),
    rotation: Object.freeze([0, 0, Math.PI / 2])
  }),
  right: Object.freeze({
    position: Object.freeze([0, 0, 0]),
    rotation: Object.freeze([0, 0, -Math.PI / 2])
  })
});

const gripMatrix = new THREE.Matrix4();

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

  const states = controllers.map((controller, index) => {
    const objectGrip = new THREE.Group();
    objectGrip.name = `controller-${index}-held-object-anchor`;
    grips[index].add(objectGrip);

    return {
      controller,
      grip: grips[index],
      objectGrip,
      inputSource: null,
      handedness: '',
      handAnchor: null,
      handRoot: null,
      gripSocket: null,
      mixerState: null
    };
  });

  function resetObjectGrip(state) {
    state.grip.add(state.objectGrip);
    state.objectGrip.position.set(0, 0, 0);
    state.objectGrip.quaternion.identity();
    state.objectGrip.scale.set(1, 1, 1);
  }

  function syncObjectGrip(state) {
    if (!state.gripSocket) return;

    // Keep this anchor under the stable WebXR grip node, but copy the live palm
    // socket transform into that space every frame. This avoids skeletal-parenting
    // quirks and guarantees held objects follow the centre of the closed hand,
    // rather than silently remaining at the controller/wrist origin.
    if (state.objectGrip.parent !== state.grip) state.grip.add(state.objectGrip);
    state.grip.updateWorldMatrix(true, false);
    state.gripSocket.updateWorldMatrix(true, false);
    gripMatrix
      .copy(state.grip.matrixWorld)
      .invert()
      .multiply(state.gripSocket.matrixWorld)
      .decompose(state.objectGrip.position, state.objectGrip.quaternion, state.objectGrip.scale);
    state.objectGrip.updateMatrixWorld(true);
  }

  function detach(state) {
    resetObjectGrip(state);
    if (state.handAnchor) state.grip.remove(state.handAnchor);
    state.handAnchor = null;
    state.handRoot = null;
    state.gripSocket = null;
    state.mixerState = null;
  }

  function attach(state, handedness) {
    detach(state);

    const gltf = models[handedness];
    if (!gltf) {
      onError(`Missing ${handedness} hand model`);
      return;
    }

    const root = prepareModel(gltf.scene, { castShadow: true, receiveShadow: false });
    root.name = `${handedness}-vr-hand`;

    const offset = HAND_GRIP_OFFSETS[handedness];
    const anchor = new THREE.Group();
    anchor.name = `${handedness}-hand-grip-offset`;
    anchor.position.fromArray(offset.position);
    anchor.rotation.set(...offset.rotation);
    anchor.add(root);
    state.grip.add(anchor);

    const socketName = handedness === 'left' ? 'b_l_grip' : 'b_r_grip';
    const gripSocket = root.getObjectByName(socketName);
    if (!gripSocket) {
      onError(`Missing ${socketName}; held objects will fall back to the controller wrist origin`);
    }

    state.handAnchor = anchor;
    state.handRoot = root;
    state.gripSocket = gripSocket || null;
    state.mixerState = createActions(root, gltf.animations);
    setPose(state.mixerState, 'Open', 0);
    syncObjectGrip(state);
  }

  for (const state of states) {
    state.controller.addEventListener('connected', (event) => {
      state.inputSource = event.data;
      state.handedness = event.data.handedness || '';
      state.objectGrip.name = `${state.handedness || 'unknown'}-held-object-anchor`;
      if (state.handedness === 'left' || state.handedness === 'right') {
        attach(state, state.handedness);
      }
    });
    state.controller.addEventListener('disconnected', () => {
      state.inputSource = null;
      state.handedness = '';
      detach(state);
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
      syncObjectGrip(state);
    }
  }

  return {
    update,
    states,
    objectGrips: states.map((state) => state.objectGrip)
  };
}
