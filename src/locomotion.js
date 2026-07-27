import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE, PLAYER } from './config.js?v=6';
import { createFootstepSystem } from './audio/footsteps.js?v=3';

export function thumbstick(source) {
  const gamepad = source?.gamepad;
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  const axes = gamepad.axes;
  const index = axes.length >= 4 ? axes.length - 2 : 0;
  return { x: axes[index] || 0, y: axes[index + 1] || 0 };
}

export function deadzone(value, zone = 0.15) {
  const magnitude = Math.abs(value);
  if (magnitude < zone) return 0;
  return Math.sign(value) * (magnitude - zone) / (1 - zone);
}

function distanceToSegment(px, pz, wall) {
  const vx = wall.x2 - wall.x1;
  const vz = wall.z2 - wall.z1;
  const wx = px - wall.x1;
  const wz = pz - wall.z1;
  const lengthSquared = vx * vx + vz * vz;
  let t = lengthSquared ? (wx * vx + wz * vz) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = wall.x1 + t * vx;
  const cz = wall.z1 + t * vz;
  return Math.hypot(px - cx, pz - cz);
}

export function createLocomotion({ renderer, camera, rig, collisionSegments, placement }) {
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const headBefore = new THREE.Vector3();
  const headAfter = new THREE.Vector3();
  const footsteps = createFootstepSystem({ rig, renderer });

  let currentSession = null;
  let calibrationPending = true;
  let targetEyeHeight = PLAYER.eyeHeight ?? 1.65;

  function canOccupy(x, z) {
    for (const wall of collisionSegments) {
      if (distanceToSegment(x, z, wall) < HOUSE.playerRadius + HOUSE.wallThickness * 0.55) return false;
    }
    return true;
  }

  function isPlacementStickCaptured(handedness) {
    const placeables = placement?.getPlaceables?.() || [];
    return placeables.some((root) => {
      const interactionState = root?.userData?.heldBy;
      return interactionState?.handedness === handedness &&
        interactionState.placementGrabbed === root;
    });
  }

  function requestHeightCalibration(height = targetEyeHeight) {
    if (Number.isFinite(height)) targetEyeHeight = THREE.MathUtils.clamp(height, 1.35, 1.95);
    calibrationPending = true;
    return targetEyeHeight;
  }

  function applyHeightCalibration() {
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(headBefore);
    if (!Number.isFinite(headBefore.y) || headBefore.y < 0.08 || headBefore.y > 4) return false;

    // Local-floor reports the user's real headset height. Offset the whole rig once so
    // seated play still walks around at a normal virtual eye height.
    rig.position.y += targetEyeHeight - headBefore.y;
    rig.updateMatrixWorld(true);
    calibrationPending = false;
    return true;
  }

  function turnAroundHead(angle) {
    if (!angle) return;

    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(headBefore);

    // Keep the rig itself upright during gameplay. Cinematic wake poses may temporarily
    // tilt it, but locomotion must remain a flat yaw-only transform.
    rig.rotation.set(0, rig.rotation.y + angle, 0);
    rig.updateMatrixWorld(true);
    camera.getWorldPosition(headAfter);

    // Smooth turning must pivot around the player's head, not around the XR reference-space
    // origin. This matters enormously when the player is seated away from that origin.
    rig.position.x += headBefore.x - headAfter.x;
    rig.position.z += headBefore.z - headAfter.z;
    rig.updateMatrixWorld(true);
  }

  function update(dt) {
    const session = renderer.xr.getSession();
    if (!session) {
      currentSession = null;
      return;
    }

    if (session !== currentSession) {
      currentSession = session;
      calibrationPending = true;
      footsteps.reset();
    }
    if (calibrationPending) applyHeightCalibration();

    let leftSource = null;
    let rightSource = null;
    for (const source of session.inputSources) {
      if (source.handedness === 'left') leftSource = source;
      if (source.handedness === 'right') rightSource = source;
    }

    const left = thumbstick(leftSource);
    const rightInput = thumbstick(rightSource);

    // Gameplay grabs such as the pistol and torch must not consume either stick.
    // Only active furniture placement captures a hand's stick because that mode uses
    // the same axes for object rotation and reach adjustment.
    const leftCaptured = isPlacementStickCaptured('left');
    const rightCaptured = isPlacementStickCaptured('right');

    const strafe = leftCaptured ? 0 : deadzone(left.x);
    const advance = leftCaptured ? 0 : deadzone(left.y);
    const turn = rightCaptured ? 0 : deadzone(rightInput.x);

    turnAroundHead(-turn * PLAYER.turnSpeed * dt);
    if (!strafe && !advance) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, up).normalize();
    movement.set(0, 0, 0).addScaledVector(right, strafe).addScaledVector(forward, -advance);
    if (movement.lengthSq() > 1) movement.normalize();
    movement.multiplyScalar(PLAYER.moveSpeed * dt);

    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(headBefore);

    let movedX = 0;
    let movedZ = 0;
    if (canOccupy(headBefore.x + movement.x, headBefore.z)) {
      rig.position.x += movement.x;
      movedX = movement.x;
    }
    if (canOccupy(headBefore.x, headBefore.z + movement.z)) {
      rig.position.z += movement.z;
      movedZ = movement.z;
    }

    // Count only movement that actually survived collision checks. Holding the stick
    // against a wall therefore stays silent instead of producing fake marching sounds.
    footsteps.advance(Math.hypot(movedX, movedZ));
  }

  window.addEventListener('pagehide', () => footsteps.dispose(), { once: true });

  return {
    update,
    canOccupy,
    requestHeightCalibration,
    getTargetEyeHeight: () => targetEyeHeight,
    setFootstepsEnabled: footsteps.setEnabled,
    areFootstepsEnabled: footsteps.isEnabled
  };
}
