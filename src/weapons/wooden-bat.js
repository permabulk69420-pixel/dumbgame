import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js?v=8';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';

const SUPPORT_PROXY_RADIUS = 0.052;
const ONE_HAND_GRIP_FLIP = Math.PI;

const tempMatrix = new THREE.Matrix4();
const tempPrimaryPosition = new THREE.Vector3();
const tempSupportPosition = new THREE.Vector3();
const tempMainLocalPosition = new THREE.Vector3();
const tempMainLocalQuaternion = new THREE.Quaternion();
const tempMainLocalScale = new THREE.Vector3();
const tempGripQuaternion = new THREE.Quaternion();
const xAxis = new THREE.Vector3();
const yAxis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const referenceAxis = new THREE.Vector3();

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Wooden bat GLB is missing required node: ${name}`);
  return node;
}

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

export async function loadWoodenBat({
  scene,
  placement,
  grips,
  physics = null,
  controllerModes = null,
  floorY = 0,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.woodenBat);
  const root = prepareModel(gltf.scene, { castShadow: false, receiveShadow: true });
  root.name = 'ApartmentWoodenBat';

  const mainGripPoint = requireNode(root, 'GripPoint_Main');
  const secondaryGripPoint = requireNode(root, 'GripPoint_Secondary');
  const impactPoint = requireNode(root, 'Impact_Point');
  const collisionAnchor = requireNode(root, 'Bat_Collision');

  // The GLB's +Y axis runs from the handle toward the barrel, while the animated
  // palm anchor presents the opposite longitudinal direction. Rotate only the
  // one-hand locator around local Z so the barrel points upward without changing
  // the palm-facing -Z reference or the separate two-hand steering calculation.
  mainGripPoint.rotateZ(ONE_HAND_GRIP_FLIP);
  const mainGripMatrix = relativeMatrix(root, mainGripPoint);
  mainGripMatrix.decompose(tempMainLocalPosition, tempMainLocalQuaternion, tempMainLocalScale);

  root.position.set(-1.58, floorY + 0.125, -4.58);
  root.rotation.set(0.08, -0.35, -0.20);
  scene.add(root);
  placement.registerPlaceable(root, 'bedroom-wooden-bat', { floorY });

  const physicsBody = physics?.registerDynamicObject?.({
    root,
    collider: {
      shape: 'capsule',
      halfHeight: 0.38,
      radius: 0.038,
      translation: [0, 0.30, 0]
    },
    mass: 0.72,
    friction: 0.72,
    restitution: 0.08,
    linearDamping: 0.18,
    angularDamping: 0.34,
    ccd: true
  }) || null;

  let holder = null;
  let support = null;
  let unregisterSupport = null;

  const supportProxy = new THREE.Mesh(
    new THREE.SphereGeometry(SUPPORT_PROXY_RADIUS, 12, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    })
  );
  supportProxy.name = 'Runtime_Bat_SecondaryGripTarget';
  supportProxy.renderOrder = -1;

  const getGrip = (handedness) => {
    const index = controllerModes?.states?.findIndex((state) => state.handedness === handedness) ?? -1;
    return index >= 0 ? grips?.[index] || null : null;
  };

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function setPhysicsHeld(value) {
    root.userData.physicsHeld = Boolean(value);
  }

  function updateSupportProxy() {
    if (!supportProxy.parent) return;
    secondaryGripPoint.getWorldPosition(supportProxy.position);
    supportProxy.quaternion.identity();
    supportProxy.scale.set(1, 1, 1);
    supportProxy.updateMatrixWorld(true);
  }

  function updateTwoHandPose() {
    if (!holder || !support || support.promoted) return;
    holder.grip.getWorldPosition(tempPrimaryPosition);
    support.grip.getWorldPosition(tempSupportPosition);
    yAxis.copy(tempSupportPosition).sub(tempPrimaryPosition);
    if (yAxis.lengthSq() < 0.0016) return;
    yAxis.normalize();

    holder.grip.getWorldQuaternion(tempGripQuaternion);
    referenceAxis.set(0, 0, 1).applyQuaternion(tempGripQuaternion);
    zAxis.copy(referenceAxis).addScaledVector(yAxis, -referenceAxis.dot(yAxis));
    if (zAxis.lengthSq() < 0.0001) {
      referenceAxis.set(1, 0, 0).applyQuaternion(tempGripQuaternion);
      zAxis.copy(referenceAxis).addScaledVector(yAxis, -referenceAxis.dot(yAxis));
    }
    zAxis.normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    tempMatrix.makeBasis(xAxis, yAxis, zAxis);
    root.quaternion.setFromRotationMatrix(tempMatrix);
    root.position.copy(tempMainLocalPosition)
      .multiply(root.scale)
      .applyQuaternion(root.quaternion)
      .multiplyScalar(-1)
      .add(tempPrimaryPosition);
    root.updateMatrixWorld(true);
  }

  function disableSupportInteraction() {
    unregisterSupport?.();
    unregisterSupport = null;
    supportProxy.removeFromParent();
  }

  function dropBat(handedness) {
    if (holder?.handedness !== handedness) return;
    scene.attach(root);
    holder = null;
    support = null;
    setPhysicsHeld(false);
    disableSupportInteraction();
    setStatus('Bat dropped · point at the handle and hold grip to pick it up');
  }

  function enableSupportInteraction() {
    if (unregisterSupport || !holder) return;
    scene.add(supportProxy);
    updateSupportProxy();
    unregisterSupport = placement.registerGrabInteraction(supportProxy, {
      id: 'wooden-bat-secondary-grip',
      label: 'bat support grip',
      begin({ handedness }) {
        if (!holder || support || holder.handedness === handedness) return false;
        const grip = getGrip(handedness);
        if (!grip) return false;
        scene.attach(root);
        support = { handedness, grip, promoted: false };
        setPhysicsHeld(true);
        controllerModes?.setPointing?.(handedness, false);
        updateTwoHandPose();
        setStatus('Bat held with two hands · release either grip to return to one hand');
        return support;
      },
      update({ context }) {
        if (!context.promoted) updateTwoHandPose();
      },
      end({ handedness, context }) {
        if (context.promoted) {
          dropBat(handedness);
          return;
        }
        if (support?.handedness !== handedness || !holder) return;
        support = null;
        attachLocatorToGrip(root, mainGripMatrix, holder.grip);
        updateSupportProxy();
        setStatus('Bat held one-handed · grip higher on the handle with the other hand for two-handed control');
      }
    });
  }

  const unregisterMain = placement.registerGrabInteraction(root, {
    id: 'wooden-bat-main-grip',
    label: 'wooden bat',
    begin({ handedness }) {
      if (holder) return false;
      const grip = getGrip(handedness);
      if (!grip) return false;
      holder = { handedness, grip };
      support = null;
      setPhysicsHeld(true);
      controllerModes?.setPointing?.(handedness, false);
      attachLocatorToGrip(root, mainGripMatrix, grip);
      enableSupportInteraction();
      setStatus('Bat held one-handed · use the other grip higher on the handle for two-handed control');
      return { handedness };
    },
    end({ handedness }) {
      if (holder?.handedness !== handedness) return;
      if (support) {
        const promoted = support;
        promoted.promoted = true;
        holder = { handedness: promoted.handedness, grip: promoted.grip };
        support = null;
        disableSupportInteraction();
        setPhysicsHeld(true);
        attachLocatorToGrip(root, mainGripMatrix, holder.grip);
        setStatus('Bat transferred to the remaining hand');
        return;
      }
      dropBat(handedness);
    }
  });

  setPhysicsHeld(false);

  return {
    root,
    mainGripPoint,
    secondaryGripPoint,
    impactPoint,
    collisionAnchor,
    physicsBody,
    update() {
      if (support) {
        updateTwoHandPose();
      } else if (holder) {
        updateSupportProxy();
      }
    },
    isHeld: () => Boolean(holder),
    isTwoHanded: () => Boolean(support),
    dispose() {
      setPhysicsHeld(false);
      physicsBody?.dispose?.();
      unregisterMain();
      disableSupportInteraction();
      placement.unregisterPlaceable(root);
      supportProxy.geometry.dispose();
      supportProxy.material.dispose();
      root.removeFromParent();
    }
  };
}
