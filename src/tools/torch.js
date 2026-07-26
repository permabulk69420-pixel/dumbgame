import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js?v=2';
import { loadGLB, prepareModel } from '../asset-loader.js';

const GRAVITY = 7.5;
const LIGHT_DISTANCE = 15;
const LIGHT_INTENSITY = 95;
const LIGHT_ANGLE = THREE.MathUtils.degToRad(22);

const tempMatrix = new THREE.Matrix4();

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

export async function loadTorch({
  scene,
  placement,
  grips,
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

  const buttonMixer = new THREE.AnimationMixer(root);
  const buttonClip = THREE.AnimationClip.findByName(gltf.animations, 'PowerButton_Click');
  const buttonAction = buttonClip ? buttonMixer.clipAction(buttonClip) : null;
  if (buttonAction) {
    buttonAction.setLoop(THREE.LoopOnce, 1);
    buttonAction.clampWhenFinished = false;
  }

  const buttonRestY = powerButton.position.y;
  let manualButtonTime = 0;

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

  function clickButton() {
    if (buttonAction) {
      buttonAction.reset();
      buttonAction.play();
    } else {
      manualButtonTime = 0.18;
    }
  }

  function toggleLight() {
    lightOn = !lightOn;
    clickButton();
    applyLightState();
    setStatus(lightOn
      ? 'Torch ON · A/X toggles it · release grip to drop it'
      : 'Torch OFF · A/X toggles it · release grip to drop it');
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
      velocity.set(0, 0, 0);
      controllerModes?.setPointing?.(handedness, false);
      attachLocatorToGrip(root, gripMatrix, grip);
      setStatus(lightOn
        ? 'Torch held and ON · A/X toggles it · release grip to drop it'
        : 'Torch held and OFF · A/X toggles it · release grip to drop it');
      return { handedness };
    },
    end({ handedness }) {
      if (holder?.handedness !== handedness) return;
      scene.attach(root);
      holder = null;
      falling = true;
      velocity.set(0, -0.1, 0);
      setStatus('Torch dropped · point at it and hold grip to pick it up');
    }
  });

  function update(dt) {
    buttonMixer.update(dt);

    if (manualButtonTime > 0) {
      manualButtonTime = Math.max(0, manualButtonTime - dt);
      const phase = 1 - manualButtonTime / 0.18;
      const press = phase < 0.48 ? phase / 0.48 : (1 - phase) / 0.52;
      powerButton.position.y = buttonRestY - Math.max(0, press) * 0.0016;
    } else if (!buttonAction) {
      powerButton.position.y = buttonRestY;
    }

    if (holder) {
      const modeState = controllerModes?.getState?.(holder.handedness);
      if (modeState?.primaryPressed) {
        controllerModes?.setPointing?.(holder.handedness, false);
        toggleLight();
      }
    }

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
