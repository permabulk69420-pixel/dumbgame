import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

export const WAKE_SETUP_STORAGE_KEY = 'dumbgame-authored-wake-sequence-v1';
export const WAKE_SEQUENCE_EVENT_ID = 'opening-wake-sequence';

const POSE_NAMES = Object.freeze(['lying', 'sitting', 'standing']);
const ONE = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const TRACKING_SETTLE_FRAMES = 8;
const MAX_TRACKING_WAIT_SECONDS = 2.5;
const MIN_TRACKED_HEAD_HEIGHT = 0.08;
const MAX_TRACKED_HEAD_HEIGHT = 4.0;

function smooth01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function normalisePose(raw) {
  if (!raw || !Array.isArray(raw.position) || !Array.isArray(raw.quaternion)) return null;
  if (raw.position.length !== 3 || raw.quaternion.length !== 4) return null;
  if (![...raw.position, ...raw.quaternion].every(Number.isFinite)) return null;

  const quaternion = new THREE.Quaternion().fromArray(raw.quaternion).normalize();
  return {
    position: raw.position.slice(0, 3),
    quaternion: quaternion.toArray()
  };
}

export function normaliseWakeSetup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const poses = {};
  for (const name of POSE_NAMES) {
    const pose = normalisePose(raw.poses?.[name]);
    if (!pose) return null;
    poses[name] = pose;
  }

  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    poses
  };
}

export function readPublishedWakeSetup() {
  try {
    const stored = localStorage.getItem(WAKE_SETUP_STORAGE_KEY);
    return stored ? normaliseWakeSetup(JSON.parse(stored)) : null;
  } catch (error) {
    console.warn('Published wake setup could not be read.', error);
    return null;
  }
}

export function writePublishedWakeSetup(rawSetup) {
  const setup = normaliseWakeSetup(rawSetup);
  if (!setup) throw new Error('Cannot publish an invalid wake setup');
  setup.updatedAt = new Date().toISOString();
  localStorage.setItem(WAKE_SETUP_STORAGE_KEY, JSON.stringify(setup));
  return setup;
}

function createEyelidOverlay(camera) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      openness: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float openness;

      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float halfGap = mix(-0.06, 0.61, openness) - 0.13 * x * x;
        float distanceFromCentre = abs(vUv.y - 0.5);
        float feather = 0.012;
        float lid = smoothstep(halfGap - feather, halfGap + feather, distanceFromCentre);
        if (lid < 0.005) discard;
        gl_FragColor = vec4(0.0, 0.0, 0.0, lid);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });

  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42), material);
  overlay.name = 'WakeSequence_Eyelids';
  overlay.position.set(0, 0, -0.11);
  overlay.renderOrder = 50000;
  overlay.frustumCulled = false;
  overlay.visible = false;
  camera.add(overlay);

  return {
    object: overlay,
    setOpenness(value) {
      material.uniforms.openness.value = THREE.MathUtils.clamp(value, 0, 1);
    },
    dispose() {
      overlay.removeFromParent();
      overlay.geometry.dispose();
      material.dispose();
    }
  };
}

export function createWakeSequence({
  renderer,
  camera,
  rig,
  placement,
  performanceHud,
  clock,
  statusElement = null,
  setHandsVisible = () => {}
}) {
  const eyelids = createEyelidOverlay(camera);
  const desiredHeadMatrix = new THREE.Matrix4();
  const localHeadMatrix = new THREE.Matrix4();
  const inverseLocalHeadMatrix = new THREE.Matrix4();
  const rigWorldMatrix = new THREE.Matrix4();
  const parentInverseMatrix = new THREE.Matrix4();
  const rigLocalMatrix = new THREE.Matrix4();
  const posePosition = new THREE.Vector3();
  const poseQuaternion = new THREE.Quaternion();
  const localHeadPosition = new THREE.Vector3();
  const localHeadQuaternion = new THREE.Quaternion();
  const gameplayHeadWorldPosition = new THREE.Vector3();
  const gameplayHeadWorldQuaternion = new THREE.Quaternion();
  const gameplayRigWorldPosition = new THREE.Vector3();
  const gameplayRigWorldQuaternion = new THREE.Quaternion();
  const rotatedLocalHeadOffset = new THREE.Vector3();
  const worldHeadEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const localHeadEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const startingRigPosition = new THREE.Vector3();
  const startingRigQuaternion = new THREE.Quaternion();
  const startingRigScale = new THREE.Vector3(1, 1, 1);

  let active = false;
  let phase = 'idle';
  let phaseTime = 0;
  let framesBeforeFirstPose = 0;
  let setup = null;
  let onComplete = null;
  let preview = false;
  let previousPlacementEnabled = true;
  let previousHudVisible = true;
  let previousClockPaused = false;
  let lastAlignedPose = null;

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function readLocalTrackedHead() {
    // Three.js writes the current WebXR viewer pose into the normal camera's
    // local transform after each XR render. Because that camera is a child of
    // the rig, this is exactly the tracked head transform relative to the rig.
    camera.updateMatrix();
    localHeadPosition.copy(camera.position);
    localHeadQuaternion.copy(camera.quaternion).normalize();

    const valid = [
      localHeadPosition.x,
      localHeadPosition.y,
      localHeadPosition.z,
      localHeadQuaternion.x,
      localHeadQuaternion.y,
      localHeadQuaternion.z,
      localHeadQuaternion.w
    ].every(Number.isFinite) &&
      localHeadPosition.y >= MIN_TRACKED_HEAD_HEIGHT &&
      localHeadPosition.y <= MAX_TRACKED_HEAD_HEIGHT;

    if (!valid) return false;
    localHeadMatrix.compose(localHeadPosition, localHeadQuaternion, ONE);
    return true;
  }

  function useFallbackLocalHead() {
    localHeadPosition.set(0, 1.65, 0);
    localHeadQuaternion.identity();
    localHeadMatrix.compose(localHeadPosition, localHeadQuaternion, ONE);
  }

  function applyRigWorldMatrix() {
    if (rig.parent) {
      rig.parent.updateWorldMatrix(true, false);
      parentInverseMatrix.copy(rig.parent.matrixWorld).invert();
      rigLocalMatrix.copy(parentInverseMatrix).multiply(rigWorldMatrix);
    } else {
      rigLocalMatrix.copy(rigWorldMatrix);
    }

    rigLocalMatrix.decompose(rig.position, rig.quaternion, rig.scale);
    rig.updateMatrixWorld(true);
  }

  function alignRigToPose(poseName, allowFallback = false) {
    const pose = setup?.poses?.[poseName];
    if (!pose || !renderer.xr.isPresenting) return false;

    if (!readLocalTrackedHead()) {
      if (!allowFallback) return false;
      useFallbackLocalHead();
      console.warn('Wake sequence used fallback local head tracking.');
    }

    posePosition.fromArray(pose.position);
    poseQuaternion.fromArray(pose.quaternion).normalize();

    // During the cinematic the marker is a literal camera anchor. This may tilt the
    // player rig to cancel the user's real head pitch/roll, which is fine while movement
    // is locked but must be removed before gameplay starts.
    desiredHeadMatrix.compose(posePosition, poseQuaternion, ONE);
    inverseLocalHeadMatrix.copy(localHeadMatrix).invert();
    rigWorldMatrix.copy(desiredHeadMatrix).multiply(inverseLocalHeadMatrix);
    applyRigWorldMatrix();

    lastAlignedPose = poseName;
    return true;
  }

  function rebaseRigForGameplay() {
    if (!renderer.xr.isPresenting) return false;
    if (!readLocalTrackedHead()) {
      useFallbackLocalHead();
    }

    // Capture the camera exactly where the standing marker placed it.
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(gameplayHeadWorldPosition);
    camera.getWorldQuaternion(gameplayHeadWorldQuaternion);

    // Keep only a flat yaw on the gameplay rig. The player's real headset handles pitch
    // and roll from this point onward, so thumbstick turning cannot inherit cinematic tilt.
    worldHeadEuler.setFromQuaternion(gameplayHeadWorldQuaternion, 'YXZ');
    localHeadEuler.setFromQuaternion(localHeadQuaternion, 'YXZ');
    gameplayRigWorldQuaternion.setFromAxisAngle(UP, worldHeadEuler.y - localHeadEuler.y);

    // Preserve the camera's world position exactly while changing the rig decomposition.
    rotatedLocalHeadOffset.copy(localHeadPosition).applyQuaternion(gameplayRigWorldQuaternion);
    gameplayRigWorldPosition.copy(gameplayHeadWorldPosition).sub(rotatedLocalHeadOffset);
    rigWorldMatrix.compose(gameplayRigWorldPosition, gameplayRigWorldQuaternion, ONE);
    applyRigWorldMatrix();
    return true;
  }

  function enterPhase(nextPhase) {
    phase = nextPhase;
    phaseTime = 0;

    if (phase === 'closedAtSitting') {
      eyelids.setOpenness(0);
      alignRigToPose('sitting', true);
    } else if (phase === 'closedAtStanding') {
      eyelids.setOpenness(0);
      alignRigToPose('standing', true);
    } else if (phase === 'openStanding') {
      // Rebase while the eyes are still shut. The standing camera stays in the same place,
      // but locomotion resumes with a clean upright rig and a sensible turn pivot.
      rebaseRigForGameplay();
      setHandsVisible(true);
    }
  }

  function restoreSystems() {
    placement?.setEnabled?.(previousPlacementEnabled);
    performanceHud?.setVisible?.(previousHudVisible);
    clock?.setPaused?.(previousClockPaused);
    setHandsVisible(true);
  }

  function finish() {
    if (!active) return;
    const callback = onComplete;
    const wasPreview = preview;
    active = false;
    phase = 'idle';
    setup = null;
    onComplete = null;
    preview = false;
    lastAlignedPose = null;
    eyelids.object.visible = false;
    eyelids.setOpenness(1);
    restoreSystems();
    setStatus(wasPreview
      ? 'Wake preview complete · upright gameplay height restored'
      : 'Awake · normal movement and interactions restored');
    callback?.();
  }

  function start(rawSetup, options = {}) {
    const nextSetup = normaliseWakeSetup(rawSetup);
    if (!nextSetup || !renderer.xr.isPresenting) return false;
    if (active) cancel();

    setup = nextSetup;
    preview = Boolean(options.preview);
    onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    previousPlacementEnabled = placement?.isEnabled?.() ?? true;
    previousHudVisible = performanceHud?.isVisible?.() ?? true;
    previousClockPaused = clock?.paused ?? false;
    startingRigPosition.copy(rig.position);
    startingRigQuaternion.copy(rig.quaternion);
    startingRigScale.copy(rig.scale);

    placement?.setEnabled?.(false);
    performanceHud?.setVisible?.(false);
    clock?.setPaused?.(true);
    setHandsVisible(false);

    active = true;
    phase = 'waitingForPose';
    phaseTime = 0;
    framesBeforeFirstPose = TRACKING_SETTLE_FRAMES;
    lastAlignedPose = null;
    eyelids.setOpenness(0);
    eyelids.object.visible = true;
    setStatus(preview ? 'Previewing authored wake sequence…' : 'Opening sequence…');
    return true;
  }

  function cancel() {
    if (!active) return false;
    active = false;
    phase = 'idle';
    setup = null;
    onComplete = null;
    preview = false;
    lastAlignedPose = null;
    rig.position.copy(startingRigPosition);
    rig.quaternion.copy(startingRigQuaternion);
    rig.scale.copy(startingRigScale);
    rig.updateMatrixWorld(true);
    eyelids.object.visible = false;
    eyelids.setOpenness(1);
    restoreSystems();
    return true;
  }

  function animateOpenness(from, to, duration) {
    const progress = smooth01(phaseTime / duration);
    eyelids.setOpenness(THREE.MathUtils.lerp(from, to, progress));
    return phaseTime >= duration;
  }

  function update(dt) {
    if (!active) return;
    phaseTime += Math.max(0, dt || 0);

    switch (phase) {
      case 'waitingForPose': {
        framesBeforeFirstPose -= 1;
        if (framesBeforeFirstPose > 0) break;
        const allowFallback = phaseTime >= MAX_TRACKING_WAIT_SECONDS;
        if (alignRigToPose('lying', allowFallback)) enterPhase('openLying');
        break;
      }
      case 'openLying':
        if (animateOpenness(0, 1, 2.6)) enterPhase('holdLying');
        break;
      case 'holdLying':
        eyelids.setOpenness(1);
        if (phaseTime >= 7.5) enterPhase('closeForSitting');
        break;
      case 'closeForSitting':
        if (animateOpenness(1, 0, 1.15)) enterPhase('closedAtSitting');
        break;
      case 'closedAtSitting':
        if (phaseTime >= 0.9) enterPhase('openSitting');
        break;
      case 'openSitting':
        if (animateOpenness(0, 1, 1.55)) enterPhase('holdSitting');
        break;
      case 'holdSitting':
        eyelids.setOpenness(1);
        if (phaseTime >= 10) enterPhase('closeForStanding');
        break;
      case 'closeForStanding':
        if (animateOpenness(1, 0, 1.15)) enterPhase('closedAtStanding');
        break;
      case 'closedAtStanding':
        if (phaseTime >= 0.85) enterPhase('openStanding');
        break;
      case 'openStanding':
        if (animateOpenness(0, 1, 1.55)) finish();
        break;
      default:
        cancel();
        break;
    }
  }

  return {
    start,
    cancel,
    update,
    alignRigToPose,
    rebaseRigForGameplay,
    isActive: () => active,
    shouldShowHands: () => !active || phase === 'openStanding',
    getPhase: () => phase,
    getLastAlignedPose: () => lastAlignedPose,
    dispose() {
      cancel();
      eyelids.dispose();
    }
  };
}
