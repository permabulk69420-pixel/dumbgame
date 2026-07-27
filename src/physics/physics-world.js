import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import RAPIER from 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.3/rapier.mjs';

const DEFAULT_FIXED_STEP = 1 / 72;
const MAX_SUBSTEPS = 4;
const MAX_THROW_SPEED = 10;
const MAX_THROW_ANGULAR_SPEED = 24;
const EPSILON = 1e-6;

const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();
const tempParentInverse = new THREE.Matrix4();
const tempLocalMatrix = new THREE.Matrix4();
const tempDeltaQuaternion = new THREE.Quaternion();
const tempAxis = new THREE.Vector3();

function vectorObject(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function quaternionObject(quaternion) {
  return { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w };
}

function arrayVector(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return new THREE.Vector3(source[0] || 0, source[1] || 0, source[2] || 0);
}

function arrayQuaternion(value) {
  if (!Array.isArray(value)) return new THREE.Quaternion();
  return new THREE.Quaternion(value[0] || 0, value[1] || 0, value[2] || 0, value[3] ?? 1).normalize();
}

function getWorldTransform(object, position, quaternion, scale = null) {
  object.updateWorldMatrix(true, true);
  object.matrixWorld.decompose(position, quaternion, scale || tempScale);
}

function setObjectWorldTransform(object, position, quaternion, scale) {
  tempMatrix.compose(position, quaternion, scale);
  if (object.parent) {
    object.parent.updateWorldMatrix(true, false);
    tempParentInverse.copy(object.parent.matrixWorld).invert();
    tempLocalMatrix.copy(tempParentInverse).multiply(tempMatrix);
  } else {
    tempLocalMatrix.copy(tempMatrix);
  }
  tempLocalMatrix.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrixWorld(true);
}

function expandLocalBoundsFromObject(root, targetBox) {
  root.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const corner = new THREE.Vector3();
  const localMatrix = new THREE.Matrix4();

  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (!box || box.isEmpty()) return;

    localMatrix.copy(inverseRoot).multiply(object.matrixWorld);
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          corner.set(x, y, z).applyMatrix4(localMatrix);
          targetBox.expandByPoint(corner);
        }
      }
    }
  });

  return targetBox;
}

function makeColliderDesc(spec, defaultMass = 0) {
  const shape = spec.shape || 'box';
  let desc;
  if (shape === 'capsule') {
    desc = RAPIER.ColliderDesc.capsule(
      Math.max(0.001, spec.halfHeight || 0.1),
      Math.max(0.001, spec.radius || 0.025)
    );
  } else {
    const half = arrayVector(spec.halfExtents, [0.05, 0.05, 0.05]);
    desc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.001, half.x),
      Math.max(0.001, half.y),
      Math.max(0.001, half.z)
    );
  }

  const offset = arrayVector(spec.translation);
  const rotation = arrayQuaternion(spec.rotation);
  desc.setTranslation(offset.x, offset.y, offset.z);
  desc.setRotation(quaternionObject(rotation));
  desc.setFriction(spec.friction ?? 0.72);
  desc.setRestitution(spec.restitution ?? 0.04);
  desc.setMass(spec.mass ?? defaultMass);
  if (Number.isFinite(spec.contactSkin) && spec.contactSkin > 0) {
    desc.setContactSkin(spec.contactSkin);
  }
  return desc;
}

function estimateAngularVelocity(previous, current, dt, target) {
  if (dt <= EPSILON) return target.set(0, 0, 0);
  tempDeltaQuaternion.copy(current).multiply(previous.clone().invert()).normalize();
  if (tempDeltaQuaternion.w < 0) {
    tempDeltaQuaternion.x *= -1;
    tempDeltaQuaternion.y *= -1;
    tempDeltaQuaternion.z *= -1;
    tempDeltaQuaternion.w *= -1;
  }

  const angle = 2 * Math.acos(THREE.MathUtils.clamp(tempDeltaQuaternion.w, -1, 1));
  const sinHalf = Math.sqrt(Math.max(0, 1 - tempDeltaQuaternion.w * tempDeltaQuaternion.w));
  if (angle < 1e-5 || sinHalf < 1e-5) return target.set(0, 0, 0);

  tempAxis.set(
    tempDeltaQuaternion.x / sinHalf,
    tempDeltaQuaternion.y / sinHalf,
    tempDeltaQuaternion.z / sinHalf
  );
  target.copy(tempAxis).multiplyScalar(angle / dt);
  if (target.length() > MAX_THROW_ANGULAR_SPEED) target.setLength(MAX_THROW_ANGULAR_SPEED);
  return target;
}

export async function createPhysicsWorld({
  gravity = [0, -9.81, 0],
  fixedStep = DEFAULT_FIXED_STEP
} = {}) {
  await RAPIER.init();

  const gravityVector = arrayVector(gravity, [0, -9.81, 0]);
  const world = new RAPIER.World(vectorObject(gravityVector));
  world.timestep = fixedStep;

  const dynamicEntries = new Set();
  const kinematicEntries = new Set();
  const fixedBodies = new Set();
  let accumulator = 0;

  function createBodyAt(source, descriptor) {
    getWorldTransform(source, tempPosition, tempQuaternion, tempScale);
    descriptor.setTranslation(tempPosition.x, tempPosition.y, tempPosition.z);
    descriptor.setRotation(quaternionObject(tempQuaternion));
    return world.createRigidBody(descriptor);
  }

  function registerKinematicBody({ source, colliders = [], enabled = true }) {
    if (!source) throw new Error('registerKinematicBody requires a source Object3D');
    const body = createBodyAt(source, RAPIER.RigidBodyDesc.kinematicPositionBased().setEnabled(enabled));
    const createdColliders = colliders.map((spec) => world.createCollider(makeColliderDesc(spec, 0), body));
    const entry = { source, body, colliders: createdColliders, active: enabled };
    kinematicEntries.add(entry);

    return {
      body,
      colliders: createdColliders,
      setEnabled(value) {
        entry.active = Boolean(value);
        body.setEnabled(entry.active);
      },
      dispose() {
        kinematicEntries.delete(entry);
        if (body.isValid()) world.removeRigidBody(body);
      }
    };
  }

  function registerFixedBox({ position, quaternion = [0, 0, 0, 1], halfExtents, friction = 0.82 }) {
    const pos = arrayVector(position);
    const rot = arrayQuaternion(quaternion);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(quaternionObject(rot));
    const body = world.createRigidBody(bodyDesc);
    world.createCollider(makeColliderDesc({ shape: 'box', halfExtents, friction, mass: 0 }), body);
    fixedBodies.add(body);
    return body;
  }

  function registerDynamicObject({
    root,
    collider = null,
    mass = 0.5,
    friction = 0.7,
    restitution = 0.04,
    linearDamping = 0.24,
    angularDamping = 0.5,
    ccd = true,
    active = true
  }) {
    if (!root) throw new Error('registerDynamicObject requires a root Object3D');

    let colliderSpec = collider;
    if (!colliderSpec) {
      const bounds = expandLocalBoundsFromObject(root, new THREE.Box3());
      if (bounds.isEmpty()) throw new Error(`No visible bounds found for dynamic object ${root.name || root.uuid}`);
      const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      const center = bounds.getCenter(new THREE.Vector3());
      colliderSpec = {
        shape: 'box',
        halfExtents: [Math.max(0.008, size.x), Math.max(0.008, size.y), Math.max(0.008, size.z)],
        translation: center.toArray()
      };
    }

    const descriptor = RAPIER.RigidBodyDesc.dynamic()
      .setLinearDamping(linearDamping)
      .setAngularDamping(angularDamping)
      .setCcdEnabled(ccd)
      .setCanSleep(true)
      .setEnabled(active);
    const body = createBodyAt(root, descriptor);
    const createdCollider = world.createCollider(makeColliderDesc({
      ...colliderSpec,
      mass,
      friction,
      restitution
    }, mass), body);

    getWorldTransform(root, tempPosition, tempQuaternion, tempScale);
    const entry = {
      root,
      body,
      collider: createdCollider,
      active: Boolean(active),
      held: false,
      worldScale: tempScale.clone(),
      previousPosition: tempPosition.clone(),
      previousQuaternion: tempQuaternion.clone(),
      throwLinearVelocity: new THREE.Vector3(),
      throwAngularVelocity: new THREE.Vector3(),
      sampleReady: false
    };
    dynamicEntries.add(entry);

    function teleportFromObject({ wake = true } = {}) {
      getWorldTransform(root, tempPosition, tempQuaternion, tempScale);
      entry.worldScale.copy(tempScale);
      body.setTranslation(vectorObject(tempPosition), wake);
      body.setRotation(quaternionObject(tempQuaternion), wake);
      entry.previousPosition.copy(tempPosition);
      entry.previousQuaternion.copy(tempQuaternion);
      entry.sampleReady = false;
    }

    function setVelocity(linear = [0, 0, 0], angular = [0, 0, 0]) {
      const lin = arrayVector(linear);
      const ang = arrayVector(angular);
      body.setLinvel(vectorObject(lin), true);
      body.setAngvel(vectorObject(ang), true);
    }

    return {
      root,
      body,
      collider: createdCollider,
      setActive(value, options = {}) {
        entry.active = Boolean(value);
        body.setEnabled(entry.active);
        if (entry.active) {
          teleportFromObject();
          body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          setVelocity(options.linearVelocity, options.angularVelocity);
        }
      },
      teleportFromObject,
      setVelocity,
      wake() { body.wakeUp(); },
      sleep() { body.sleep(); },
      isActive: () => entry.active,
      dispose() {
        dynamicEntries.delete(entry);
        if (body.isValid()) world.removeRigidBody(body);
      }
    };
  }

  function syncKinematicEntry(entry) {
    if (!entry.active || !entry.source.parent) return;
    getWorldTransform(entry.source, tempPosition, tempQuaternion, tempScale);
    entry.body.setNextKinematicTranslation(vectorObject(tempPosition));
    entry.body.setNextKinematicRotation(quaternionObject(tempQuaternion));
  }

  function syncHeldEntry(entry, dt) {
    getWorldTransform(entry.root, tempPosition, tempQuaternion, tempScale);
    entry.worldScale.copy(tempScale);

    if (!entry.held) {
      entry.held = true;
      entry.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      entry.previousPosition.copy(tempPosition);
      entry.previousQuaternion.copy(tempQuaternion);
      entry.sampleReady = false;
    } else if (dt > EPSILON) {
      entry.throwLinearVelocity.copy(tempPosition).sub(entry.previousPosition).divideScalar(dt);
      if (entry.throwLinearVelocity.length() > MAX_THROW_SPEED) {
        entry.throwLinearVelocity.setLength(MAX_THROW_SPEED);
      }
      estimateAngularVelocity(entry.previousQuaternion, tempQuaternion, dt, entry.throwAngularVelocity);
      entry.sampleReady = true;
      entry.previousPosition.copy(tempPosition);
      entry.previousQuaternion.copy(tempQuaternion);
    }

    entry.body.setNextKinematicTranslation(vectorObject(tempPosition));
    entry.body.setNextKinematicRotation(quaternionObject(tempQuaternion));
  }

  function releaseHeldEntry(entry) {
    getWorldTransform(entry.root, tempPosition, tempQuaternion, tempScale);
    entry.worldScale.copy(tempScale);
    entry.body.setTranslation(vectorObject(tempPosition), true);
    entry.body.setRotation(quaternionObject(tempQuaternion), true);
    entry.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    entry.body.setLinvel(vectorObject(entry.sampleReady ? entry.throwLinearVelocity : new THREE.Vector3()), true);
    entry.body.setAngvel(vectorObject(entry.sampleReady ? entry.throwAngularVelocity : new THREE.Vector3()), true);
    entry.previousPosition.copy(tempPosition);
    entry.previousQuaternion.copy(tempQuaternion);
    entry.sampleReady = false;
    entry.held = false;
  }

  function prepareDynamicEntry(entry, dt) {
    if (!entry.active || !entry.root.parent) return;
    const heldNow = Boolean(entry.root.userData.heldBy || entry.root.userData.physicsHeld);
    if (heldNow) syncHeldEntry(entry, dt);
    else if (entry.held) releaseHeldEntry(entry);
  }

  function syncDynamicEntry(entry) {
    if (!entry.active || entry.held || !entry.root.parent || !entry.body.isEnabled()) return;
    const translation = entry.body.translation();
    const rotation = entry.body.rotation();
    tempPosition.set(translation.x, translation.y, translation.z);
    tempQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
    setObjectWorldTransform(entry.root, tempPosition, tempQuaternion, entry.worldScale);
    entry.previousPosition.copy(tempPosition);
    entry.previousQuaternion.copy(tempQuaternion);
  }

  function update(dt) {
    const frameDt = THREE.MathUtils.clamp(Number(dt) || 0, 0, 0.05);
    for (const entry of kinematicEntries) syncKinematicEntry(entry);
    for (const entry of dynamicEntries) prepareDynamicEntry(entry, frameDt);

    accumulator = Math.min(accumulator + frameDt, fixedStep * MAX_SUBSTEPS);
    let steps = 0;
    while (accumulator >= fixedStep && steps < MAX_SUBSTEPS) {
      world.step();
      accumulator -= fixedStep;
      steps += 1;
    }

    for (const entry of dynamicEntries) syncDynamicEntry(entry);
  }

  function computeLocalBounds(root) {
    return expandLocalBoundsFromObject(root, new THREE.Box3());
  }

  function dispose() {
    dynamicEntries.clear();
    kinematicEntries.clear();
    fixedBodies.clear();
    world.free();
  }

  return {
    RAPIER,
    world,
    fixedStep,
    update,
    computeLocalBounds,
    registerFixedBox,
    registerKinematicBody,
    registerDynamicObject,
    getStats: () => ({
      dynamicBodies: dynamicEntries.size,
      kinematicBodies: kinematicEntries.size,
      fixedBodies: fixedBodies.size
    }),
    dispose
  };
}
