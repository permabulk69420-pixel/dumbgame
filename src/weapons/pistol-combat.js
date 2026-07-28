import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { loadPistol as loadBasePistol } from './pistol.js?base=1';
import { fireHitscan } from '../combat/combat-system.js?v=1';

const LASER_RANGE = 45;
const muzzleOrigin = new THREE.Vector3();
const muzzleDirection = new THREE.Vector3();
const muzzleQuaternion = new THREE.Quaternion();
const laserRaycaster = new THREE.Raycaster();

function isDescendantOf(object, ancestor) {
  for (let current = object; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function hasHeldAncestor(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData?.physicsHeld) return true;
  }
  return false;
}

function createLaser(muzzlePoint) {
  const group = new THREE.Group();
  group.name = 'Runtime_PistolLaser';
  group.visible = false;
  group.userData.ignoreLaser = true;

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xff1010,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.00125, 0.00125, 1, 6, 1, true),
    beamMaterial
  );
  beam.name = 'Runtime_PistolLaserBeam';
  beam.rotation.x = Math.PI * 0.5;
  beam.renderOrder = 40;
  group.add(beam);

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), dotMaterial);
  dot.name = 'Runtime_PistolLaserDot';
  dot.renderOrder = 41;
  group.add(dot);

  muzzlePoint.add(group);
  return { group, beam, dot, beamMaterial, dotMaterial };
}

export async function loadPistol(options) {
  const pistol = await loadBasePistol(options);
  const muzzlePoint = pistol.root.getObjectByName('Muzzle_Point');
  const muzzleFlash = pistol.root.getObjectByName('Runtime_MuzzleFlash');

  if (!muzzlePoint || !muzzleFlash) return pistol;

  const laser = createLaser(muzzlePoint);
  const scene = options.scene;

  function updateMuzzleRay() {
    muzzlePoint.updateWorldMatrix(true, false);
    muzzlePoint.getWorldPosition(muzzleOrigin);
    muzzlePoint.getWorldQuaternion(muzzleQuaternion);
    muzzleDirection.set(0, 0, -1).applyQuaternion(muzzleQuaternion).normalize();
  }

  function findLaserHit() {
    if (!scene) return null;
    laserRaycaster.set(muzzleOrigin, muzzleDirection);
    laserRaycaster.near = 0.025;
    laserRaycaster.far = LASER_RANGE;

    const intersections = laserRaycaster.intersectObjects(scene.children, true);
    return intersections.find(({ object }) => {
      if (!object?.isMesh || !object.visible) return false;
      if (object.userData?.ignoreLaser) return false;
      if (isDescendantOf(object, pistol.root)) return false;
      if (hasHeldAncestor(object)) return false;
      return object.material?.visible !== false;
    }) || null;
  }

  function updateLaser() {
    const held = Boolean(pistol.isHeld?.());
    laser.group.visible = held;
    if (!held) return;

    updateMuzzleRay();
    const hit = findLaserHit();
    const distance = THREE.MathUtils.clamp(hit?.distance ?? LASER_RANGE, 0.04, LASER_RANGE);

    laser.beam.scale.set(1, distance, 1);
    laser.beam.position.set(0, 0, -distance * 0.5);
    laser.dot.visible = Boolean(hit);
    laser.dot.position.set(0, 0, -Math.max(0.035, distance - 0.006));
  }

  let flashVisible = Boolean(muzzleFlash.visible);
  Object.defineProperty(muzzleFlash, 'visible', {
    configurable: true,
    enumerable: true,
    get() {
      return flashVisible;
    },
    set(value) {
      const nextVisible = Boolean(value);
      if (nextVisible && !flashVisible) {
        updateMuzzleRay();
        fireHitscan({
          origin: muzzleOrigin,
          direction: muzzleDirection,
          damage: 34,
          maxDistance: LASER_RANGE,
          source: 'pistol'
        });
      }
      flashVisible = nextVisible;
    }
  });

  const baseUpdate = pistol.update.bind(pistol);
  const baseDispose = pistol.dispose.bind(pistol);
  return {
    ...pistol,
    laser: laser.group,
    update(dt) {
      baseUpdate(dt);
      updateLaser();
    },
    dispose() {
      delete muzzleFlash.visible;
      muzzleFlash.visible = flashVisible;
      laser.beam.geometry.dispose();
      laser.dot.geometry.dispose();
      laser.beamMaterial.dispose();
      laser.dotMaterial.dispose();
      laser.group.removeFromParent();
      baseDispose();
    }
  };
}
