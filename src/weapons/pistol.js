import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js';
import { loadGLB, prepareModel } from '../asset-loader.js';

const SLIDE_REST_Z = -0.004;
const SLIDE_REAR_Z = 0.026;
const TRIGGER_TRAVEL = THREE.MathUtils.degToRad(18);
const MAG_RELEASE_TRAVEL = 0.0025;
const MAG_SEATED_POSITION = Object.freeze([0, 0.079, 0.0395]);
const MAG_INSERT_DISTANCE = 0.115;
const GRAVITY = 7.5;

const tempPosition = new THREE.Vector3();
const tempPositionB = new THREE.Vector3();
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
  // Make the exported locator coincide with the WebXR grip origin.
  grip.add(root);
  tempMatrix.copy(locatorMatrix).invert();
  tempMatrix.decompose(root.position, root.quaternion, root.scale);
  root.updateMatrixWorld(true);
}

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Pistol GLB is missing required node: ${name}`);
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

export async function loadPistol({
  scene,
  placement,
  grips,
  controllerModes = null,
  floorY = 0,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.pistol);
  const modelRoot = prepareModel(gltf.scene, { castShadow: true, receiveShadow: false });
  modelRoot.name = 'RuntimePistol';

  const pistol = modelRoot.getObjectByName('Pistol') || modelRoot;
  const gripPoint = requireNode(modelRoot, 'Grip_Point');
  const slide = requireNode(modelRoot, 'Pistol_Slide');
  const trigger = requireNode(modelRoot, 'Pistol_Trigger');
  const magazine = requireNode(modelRoot, 'Pistol_Magazine');
  const magazineGripPoint = requireNode(modelRoot, 'Magazine_Grip_Point');
  const magazineWellPoint = requireNode(modelRoot, 'Magazine_Well_Point');
  const magazineRelease = requireNode(modelRoot, 'Magazine_Release');

  const pistolGripMatrix = relativeMatrix(modelRoot, gripPoint);
  const magazineGripMatrix = relativeMatrix(magazine, magazineGripPoint);
  const triggerRestX = trigger.rotation.x;
  const releaseRestX = magazineRelease.position.x;
  const slideRestX = slide.position.x;
  const slideRestY = slide.position.y;

  // Temporary test position on the computer desk. It remains upright so it is easy to target.
  modelRoot.position.set(3.82, floorY + 0.79, 5.62);
  modelRoot.rotation.set(0, Math.PI * 0.5, 0);
  scene.add(modelRoot);

  const pistolVelocity = new THREE.Vector3();
  const magazineVelocity = new THREE.Vector3();
  const pistolBounds = new THREE.Box3();
  const magazineBounds = new THREE.Box3();

  let holder = null;
  let magazineHolder = null;
  let pistolFalling = false;
  let magazineSeated = true;
  let magazineFalling = false;
  let slideReturning = false;
  let releaseAnimation = 0;
  let unregisterSlide = null;
  let unregisterMagazine = null;

  const getGrip = (handedness) => {
    const index = controllerModes?.states?.findIndex((state) => state.handedness === handedness) ?? -1;
    return index >= 0 ? grips[index] : null;
  };

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function disableSlideInteraction() {
    unregisterSlide?.();
    unregisterSlide = null;
  }

  function enableSlideInteraction() {
    if (unregisterSlide) return;
    unregisterSlide = placement.registerGrabInteraction(slide, {
      id: 'pistol-slide',
      label: 'pistol slide',
      begin({ handedness }) {
        if (!holder || holder.handedness === handedness) return false;
        const grip = getGrip(handedness);
        if (!grip) return false;

        grip.getWorldPosition(tempPosition);
        pistol.worldToLocal(tempPosition);
        slideReturning = false;
        setStatus('Pull the slide rearward · release grip to let it snap forward');
        return {
          grip,
          startGripZ: tempPosition.z,
          startSlideZ: slide.position.z
        };
      },
      update({ context }) {
        context.grip.getWorldPosition(tempPosition);
        pistol.worldToLocal(tempPosition);
        const delta = tempPosition.z - context.startGripZ;
        slide.position.set(
          slideRestX,
          slideRestY,
          THREE.MathUtils.clamp(context.startSlideZ + delta, SLIDE_REST_Z, SLIDE_REAR_Z)
        );
      },
      end() {
        slideReturning = true;
        setStatus('Pistol held · trigger moves trigger · A/X releases magazine · other grip pulls slide');
      }
    });
  }

  function disableMagazineInteraction() {
    unregisterMagazine?.();
    unregisterMagazine = null;
  }

  function seatMagazine() {
    disableMagazineInteraction();
    pistol.add(magazine);
    magazine.position.fromArray(MAG_SEATED_POSITION);
    magazine.quaternion.identity();
    magazine.scale.set(1, 1, 1);
    magazine.updateMatrixWorld(true);
    magazineSeated = true;
    magazineFalling = false;
    magazineHolder = null;
    magazineVelocity.set(0, 0, 0);
    setStatus('Magazine inserted');
  }

  function enableMagazineInteraction() {
    if (unregisterMagazine) return;
    unregisterMagazine = placement.registerGrabInteraction(magazine, {
      id: 'pistol-magazine',
      label: 'pistol magazine',
      begin({ handedness }) {
        if (magazineSeated || magazineHolder) return false;
        const grip = getGrip(handedness);
        if (!grip) return false;
        magazineHolder = { handedness, grip };
        magazineFalling = false;
        attachLocatorToGrip(magazine, magazineGripMatrix, grip);
        setStatus('Magazine held · release grip near the pistol grip to insert it');
        return { handedness };
      },
      end({ handedness }) {
        if (magazineHolder?.handedness !== handedness) return;
        scene.attach(magazine);
        magazineHolder = null;

        magazine.getWorldPosition(tempPosition);
        magazineWellPoint.getWorldPosition(tempPositionB);
        if (tempPosition.distanceTo(tempPositionB) <= MAG_INSERT_DISTANCE) {
          seatMagazine();
          return;
        }

        magazineFalling = true;
        magazineVelocity.set(0, -0.15, 0);
        setStatus('Magazine dropped · grip it and bring it to the pistol grip to reinsert');
      }
    });
  }

  function ejectMagazine() {
    if (!magazineSeated) return;
    scene.attach(magazine);
    magazineSeated = false;
    magazineFalling = true;
    magazineVelocity.set(0, -0.35, 0);
    enableMagazineInteraction();
    setStatus('Magazine released · grip it to pick it up');
  }

  function pressMagazineRelease() {
    releaseAnimation = 1;
    ejectMagazine();
  }

  const unregisterPistol = placement.registerGrabInteraction(modelRoot, {
    id: 'pistol-grip',
    label: 'pistol',
    begin({ handedness }) {
      if (holder) return false;
      const grip = getGrip(handedness);
      if (!grip) return false;

      holder = { handedness, grip };
      pistolFalling = false;
      pistolVelocity.set(0, 0, 0);
      controllerModes?.setPointing?.(handedness, false);
      attachLocatorToGrip(modelRoot, pistolGripMatrix, grip);
      enableSlideInteraction();
      setStatus('Pistol held · trigger moves trigger · A/X releases magazine · other grip pulls slide');
      return { handedness };
    },
    end({ handedness }) {
      if (holder?.handedness !== handedness) return;
      scene.attach(modelRoot);
      holder = null;
      disableSlideInteraction();
      pistolFalling = true;
      pistolVelocity.set(0, -0.1, 0);
      setStatus('Pistol dropped · point at it and hold grip to pick it up');
    }
  });

  function update(dt) {
    if (holder) {
      const modeState = controllerModes?.getState?.(holder.handedness);
      const triggerAmount = modeState?.inputSource?.gamepad?.buttons?.[0]?.value ?? 0;
      trigger.rotation.x = triggerRestX - TRIGGER_TRAVEL * THREE.MathUtils.clamp(triggerAmount, 0, 1);

      if (modeState?.primaryPressed) {
        controllerModes?.setPointing?.(holder.handedness, false);
        pressMagazineRelease();
      }
    } else {
      trigger.rotation.x = triggerRestX;
    }

    if (slideReturning) {
      const alpha = 1 - Math.exp(-34 * dt);
      slide.position.z = THREE.MathUtils.lerp(slide.position.z, SLIDE_REST_Z, alpha);
      slide.position.x = slideRestX;
      slide.position.y = slideRestY;
      if (Math.abs(slide.position.z - SLIDE_REST_Z) < 0.00015) {
        slide.position.z = SLIDE_REST_Z;
        slideReturning = false;
      }
    }

    if (releaseAnimation > 0) {
      releaseAnimation = Math.max(0, releaseAnimation - dt * 7.5);
      magazineRelease.position.x = releaseRestX - MAG_RELEASE_TRAVEL * releaseAnimation;
    } else {
      magazineRelease.position.x = releaseRestX;
    }

    if (pistolFalling) {
      pistolFalling = !settleOnFloor(modelRoot, floorY, pistolVelocity, dt, pistolBounds);
    }

    if (!magazineSeated && !magazineHolder && magazineFalling) {
      magazineFalling = !settleOnFloor(magazine, floorY, magazineVelocity, dt, magazineBounds);
    }
  }

  return {
    root: modelRoot,
    update,
    isHeld: () => Boolean(holder),
    isMagazineSeated: () => magazineSeated,
    dispose() {
      unregisterPistol();
      disableSlideInteraction();
      disableMagazineInteraction();
      modelRoot.removeFromParent();
      if (!magazineSeated) magazine.removeFromParent();
    }
  };
}
