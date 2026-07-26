import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js?v=2';
import { loadGLB, prepareModel } from '../asset-loader.js';

const GRAVITY = 7.5;
const LIGHT_DISTANCE = 15;
const LIGHT_INTENSITY = 95;
const LIGHT_ANGLE = THREE.MathUtils.degToRad(22);
const BUTTON_TRAVEL = 0.0016;
const POKE_LATERAL_RADIUS = 0.018;
const POKE_CONTACT_HEIGHT = 0.016;
const POKE_PRESS_DEPTH = 0.012;
const POKE_TRIGGER_AMOUNT = 0.62;

const tempMatrix = new THREE.Matrix4();
const tempFingerWorld = new THREE.Vector3();
const tempFingerLocal = new THREE.Vector3();

function relativeMatrix(root, locator) {
  root.updateWorldMatrix(true, true);
  locator.updateWorldMatrix(true, false);
  return new THREE.Matrix4()
    .copy(root.matrixWorld)
    .invert()
    .multiply(locator.matrixWorld);
}

function attachLocatorToGrip(root, locatorMatrix, grip) {
  grip.add(root);
  tempMatrix.copy(locatorMatrix).invert();
  tempMatrix.decompose(root.position, root.quaternion, root.scale);
  root.updateMatrixWorld(true);
}

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Torch GLB is missing required node: ${name}`);
  return node;
}

function settleOnFloor(root, floorY, velocity, dt, bounds) {
  velocity.y -= GRAVITY * dt;
  root.position.addScaledVector(velocity, dt);
  root.updateWorldMatrix(true, true);
  bounds.setFromObject(root);

  if (bounds.min.y <= floorY) {
    root.position.y += floorY - bounds.min.y;
    velocity.set(0, 0, 0);
    root.updateMatrixWorld(true);
    return true;
  }
  return false;
}

function prepareEmissiveNode(node) {
  node.traverse((child) => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material.clone());
    } else if (child.material) {
      child.material = child.material.clone();
    }
  });
}

function setNodeGlow(node, enabled) {
  node.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      if ('emissive' in material) material.emissive.setHex(enabled ? 0xfff2c7 : 0x000000);
      if ('emissiveIntensity' in material) material.emissiveIntensity = enabled ? 4.2 : 0;
      material.needsUpdate = true;
    }
  });
}

function pulseHand(controllerModes, handedness) {
  const gamepad = controllerModes?.getState?.(handedness)?.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
  try {
    if (actuator?.pulse) {
      const result = actuator.pulse(0.35, 34);
      result?.catch?.(() => {});
    } else if (actuator?.playEffect) {
      const result = actuator.playEffect('dual-rumble', {
        duration: 34,
        strongMagnitude: 0.32,
        weakMagnitude: 0.18
      });
      result?.catch?.(() => {});
    }
  } catch {
    // The poke still works on runtimes that expose no haptic actuator.
  }
}

export async function loadTorch({
  scene,
  placement,
  grips,
  hands = null,
  controllerModes = null,
  floorY = 0,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.torch);
  const root = prepareModel(gltf.scene, { castShadow: true, receiveShadow: false });
  root.name = 'RuntimeTorch';

  const gripPoint = requireNode(root, 'Grip_Point');
  const lightOrigin = requireNode(root, 'Light_Origin');
  const powerButton = requireNode(root, 'PowerButton');
  const led = root.getObjectByName('Torch_LED') || lightOrigin;
  const gripMatrix = relativeMatrix(root, gripPoint);
  const buttonRestY = powerButton.position.y;

  prepareEmissiveNode(led);

  const spot = new THREE.SpotLight(0xfff2cf, 0, LIGHT_DISTANCE, LIGHT_ANGLE, 0.48, 1.35);
  spot.name = 'Torch_SpotLight';
  spot.castShadow = false;
  spot.position.set(0, 0, 0);

  const target = new THREE.Object3D();
  target.name = 'Torch_LightTarget';
  target.position.set(0, 0, -1);

  const spill = new THREE.PointLight(0xffe9bd, 0, 1.3, 2);
  spill.name = 'Torch_LocalSpill';
  spill.position.set(0, 0, -0.025);
  spill.castShadow = false;

  lightOrigin.add(spot, target, spill);
  spot.target = target;

  root.position.set(3.4, floorY + 0.81, 5.62);
  root.rotation.set(0, Math.PI * 0.5, Math.PI * 0.5);
  scene.add(root);

  const velocity = new THREE.Vector3();
  const bounds = new THREE.Box3();
  let holder = null;
  let falling = false;
  let lightOn = false;
  let pokeLatched = false;
  let buttonPressAmount = 0;

  const getGrip = (handedness) => {
    const index = controllerModes?.states?.findIndex((state) => state.handedness === handedness) ?? -1;
    return index >= 0 ? grips[index] : null;
  };

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function applyLightState() {
    spot.intensity = lightOn ? LIGHT_INTENSITY : 0;
    spill.intensity = lightOn ? 2.8 : 0;
    setNodeGlow(led, lightOn);
  }

  function pokeInstructions() {
    return lightOn
      ? 'Torch ON · A/X points with the free hand · poke the power button to switch it off'
      : 'Torch OFF · A/X points with the free hand · poke the power button to switch it on';
  }

  function toggleLight(pokeHandedness) {
    lightOn = !lightOn;
    applyLightState();
    pulseHand(controllerModes, pokeHandedness);
    setStatus(pokeInstructions());
  }

  function updatePoke(dt) {
    let targetPress = 0;
    let touching = false;

    if (holder) {
      const pokeHandedness = holder.handedness === 'left' ? 'right' : 'left';
      const pointing = controllerModes?.isPointing?.(pokeHandedness) ?? false;
      const hasTip = pointing && hands?.getIndexTipWorldPosition?.(pokeHandedness, tempFingerWorld);

      if (hasTip && powerButton.parent) {
        powerButton.parent.updateWorldMatrix(true, false);
        tempFingerLocal.copy(tempFingerWorld);
        powerButton.parent.worldToLocal(tempFingerLocal);

        const dx = tempFingerLocal.x - powerButton.position.x;
        const dz = tempFingerLocal.z - powerButton.position.z;
        const lateralDistance = Math.hypot(dx, dz);
        const contactY = buttonRestY + POKE_CONTACT_HEIGHT;
        const penetration = contactY - tempFingerLocal.y;

        touching = lateralDistance <= POKE_LATERAL_RADIUS &&
          penetration >= 0 &&
          tempFingerLocal.y >= buttonRestY - 0.025;

        if (touching) {
          targetPress = THREE.MathUtils.clamp(penetration / POKE_PRESS_DEPTH, 0, 1);
          if (targetPress >= POKE_TRIGGER_AMOUNT && !pokeLatched) {
            pokeLatched = true;
            toggleLight(pokeHandedness);
          }
        }
      }
    }

    if (!touching || targetPress < 0.16) pokeLatched = false;

    // Follow the fingertip immediately while pressing, then spring back smoothly.
    if (targetPress >= buttonPressAmount) {
      buttonPressAmount = targetPress;
    } else {
      buttonPressAmount = THREE.MathUtils.damp(buttonPressAmount, targetPress, 30, dt);
    }
    powerButton.position.y = buttonRestY - BUTTON_TRAVEL * buttonPressAmount;
  }

  applyLightState();

  const unregisterGrab = placement.registerGrabInteraction(root, {
    id: 'handheld-torch',
    label: 'torch',
    begin({ handedness }) {
      if (holder) return false;
      const grip = getGrip(handedness);
      if (!grip) return false;

      holder = { handedness, grip };
      falling = false;
      pokeLatched = false;
      buttonPressAmount = 0;
      velocity.set(0, 0, 0);
      controllerModes?.setPointing?.(handedness, false);
      attachLocatorToGrip(root, gripMatrix, grip);
      setStatus(pokeInstructions());
      return { handedness };
    },
    end({ handedness }) {
      if (holder?.handedness !== handedness) return;
      scene.attach(root);
      holder = null;
      pokeLatched = false;
      buttonPressAmount = 0;
      powerButton.position.y = buttonRestY;
      falling = true;
      velocity.set(0, -0.1, 0);
      setStatus('Torch dropped · point at it and hold grip to pick it up');
    }
  });

  function update(dt) {
    if (holder) {
      // A/X on the torch hand normally toggles pointing globally. Suppress that hand;
      // the free hand is the one intended to enter point/poke mode.
      const holderMode = controllerModes?.getState?.(holder.handedness);
      if (holderMode?.primaryPressed && controllerModes?.isPointing?.(holder.handedness)) {
        controllerModes.setPointing(holder.handedness, false);
      }
    }

    updatePoke(dt);

    if (falling) {
      falling = !settleOnFloor(root, floorY, velocity, dt, bounds);
    }
  }

  return {
    root,
    update,
    isHeld: () => Boolean(holder),
    isOn: () => lightOn,
    setOn(enabled) {
      lightOn = Boolean(enabled);
      applyLightState();
    },
    dispose() {
      unregisterGrab();
      root.removeFromParent();
    }
  };
}
