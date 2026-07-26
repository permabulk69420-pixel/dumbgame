import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const tempWorld = new THREE.Vector3();
const tempLocal = new THREE.Vector3();

function clampAngle(value, min, max) {
  return THREE.MathUtils.clamp(value, Math.min(min, max), Math.max(min, max));
}

function shortestAngleDelta(current, start) {
  let delta = current - start;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function pulseHand(controllerModes, handedness, strength = 0.28, duration = 32) {
  const gamepad = controllerModes?.getState?.(handedness)?.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
  try {
    if (actuator?.pulse) {
      const result = actuator.pulse(strength, duration);
      result?.catch?.(() => {});
    } else if (actuator?.playEffect) {
      const result = actuator.playEffect('dual-rumble', {
        duration,
        strongMagnitude: strength,
        weakMagnitude: strength * 0.55
      });
      result?.catch?.(() => {});
    }
  } catch {
    // Door interaction still works when the browser exposes no haptic actuator.
  }
}

function setWorldCollisionFromLocators(collision, hingeLocator, edgeLocator) {
  hingeLocator.updateWorldMatrix(true, false);
  edgeLocator.updateWorldMatrix(true, false);
  hingeLocator.getWorldPosition(tempWorld);
  collision.x1 = tempWorld.x;
  collision.z1 = tempWorld.z;
  edgeLocator.getWorldPosition(tempWorld);
  collision.x2 = tempWorld.x;
  collision.z2 = tempWorld.z;
}

/**
 * Runtime swing-door interaction shared by placeholder geometry and future GLB doors.
 * The supplied hierarchy is expected to keep DoorPivot on the hinge line, with the
 * collisionEdge locator sitting on the free vertical edge of the leaf.
 */
export function createSwingDoor({
  placement,
  collisionSegments,
  controllerModes = null,
  assemblyRoot,
  doorPivot,
  handleInteractionRoot,
  collisionEdge,
  handlePivots = [],
  latch = null,
  statusElement = null,
  id = 'swing-door',
  label = 'door',
  minAngle = THREE.MathUtils.degToRad(-112),
  maxAngle = THREE.MathUtils.degToRad(6),
  handleAngle = THREE.MathUtils.degToRad(-34),
  initialAngle = 0,
  locked = false
}) {
  if (!placement || !collisionSegments || !assemblyRoot || !doorPivot ||
      !handleInteractionRoot || !collisionEdge) {
    throw new Error('createSwingDoor requires placement, collisionSegments and the complete door hierarchy');
  }

  const collision = { x1: 0, z1: 0, x2: 0, z2: 0, dynamic: true, id };
  collisionSegments.push(collision);

  const latchRestX = latch?.position.x ?? 0;
  let angle = clampAngle(initialAngle, minAngle, maxAngle);
  let targetAngle = angle;
  let handlePress = 0;
  let handleTarget = 0;
  let latchReleased = Math.abs(angle) > THREE.MathUtils.degToRad(2.5);
  let activeGrab = null;
  let isLocked = Boolean(locked);

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function applyPose() {
    doorPivot.rotation.y = angle;
    for (const pivot of handlePivots) pivot.rotation.z = handleAngle * handlePress;
    if (latch) latch.position.x = latchRestX - 0.014 * handlePress;
    setWorldCollisionFromLocators(collision, doorPivot, collisionEdge);
  }

  function controllerPolarAngle(controller) {
    controller.updateWorldMatrix(true, false);
    controller.getWorldPosition(tempWorld);
    assemblyRoot.updateWorldMatrix(true, false);
    tempLocal.copy(tempWorld);
    assemblyRoot.worldToLocal(tempLocal);
    return Math.atan2(
      tempLocal.z - doorPivot.position.z,
      tempLocal.x - doorPivot.position.x
    );
  }

  function beginGrab({ controller, handedness }) {
    if (isLocked) {
      pulseHand(controllerModes, handedness, 0.38, 46);
      setStatus(`${label} is locked`);
      return false;
    }

    activeGrab = {
      controller,
      handedness,
      startPolar: controllerPolarAngle(controller),
      startAngle: angle,
      latchPulseSent: false
    };
    handleTarget = 1;
    setStatus(`Hold grip and pull or push the ${label}`);
    return activeGrab;
  }

  function endGrab({ handedness }) {
    if (!activeGrab || activeGrab.handedness !== handedness) return;
    activeGrab = null;
    handleTarget = 0;

    if (Math.abs(angle) < THREE.MathUtils.degToRad(4.5)) {
      targetAngle = 0;
    }
    setStatus(`${label} released`);
  }

  const unregisterGrab = placement.registerGrabInteraction(handleInteractionRoot, {
    id,
    label,
    begin: beginGrab,
    end: endGrab
  });

  function update(dt) {
    handlePress = THREE.MathUtils.damp(handlePress, handleTarget, 28, dt);

    if (activeGrab && !latchReleased && handlePress >= 0.52) {
      latchReleased = true;
      if (!activeGrab.latchPulseSent) {
        activeGrab.latchPulseSent = true;
        pulseHand(controllerModes, activeGrab.handedness, 0.24, 28);
      }
    }

    if (activeGrab && latchReleased) {
      const polar = controllerPolarAngle(activeGrab.controller);
      const delta = shortestAngleDelta(polar, activeGrab.startPolar);
      // Three.js positive polar motion corresponds to a negative Y hinge rotation.
      targetAngle = clampAngle(activeGrab.startAngle - delta, minAngle, maxAngle);
    }

    const followRate = activeGrab ? 24 : 12;
    angle = THREE.MathUtils.damp(angle, targetAngle, followRate, dt);

    if (!activeGrab && Math.abs(targetAngle) < THREE.MathUtils.degToRad(4.5)) {
      targetAngle = 0;
      if (Math.abs(angle) < THREE.MathUtils.degToRad(0.35)) angle = 0;
    }

    if (!activeGrab && handlePress < 0.08 && Math.abs(angle) < THREE.MathUtils.degToRad(1.5)) {
      latchReleased = false;
    }

    applyPose();
  }

  function setAngle(nextAngle, immediate = false) {
    targetAngle = clampAngle(nextAngle, minAngle, maxAngle);
    latchReleased = Math.abs(targetAngle) > THREE.MathUtils.degToRad(1.5);
    if (immediate) angle = targetAngle;
    applyPose();
    return targetAngle;
  }

  function setLocked(nextLocked) {
    isLocked = Boolean(nextLocked);
    if (isLocked && activeGrab) {
      activeGrab = null;
      handleTarget = 0;
    }
    return isLocked;
  }

  applyPose();

  return {
    root: assemblyRoot,
    update,
    setAngle,
    getAngle: () => angle,
    setLocked,
    isLocked: () => isLocked,
    isOpen: () => Math.abs(angle) > THREE.MathUtils.degToRad(8),
    dispose() {
      unregisterGrab();
      const index = collisionSegments.indexOf(collision);
      if (index !== -1) collisionSegments.splice(index, 1);
      assemblyRoot.removeFromParent();
    }
  };
}
