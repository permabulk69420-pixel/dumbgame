import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { loadPistol as loadBasePistol } from './pistol.js?base=1';
import { fireHitscan } from '../combat/combat-system.js?v=1';

const LASER_RANGE = 45;
const muzzleOrigin = new THREE.Vector3();
const muzzleDirection = new THREE.Vector3();
const muzzleQuaternion = new THREE.Quaternion();
const laserEndpointWorld = new THREE.Vector3();
const laserEndpointLocal = new THREE.Vector3();
const laserRaycaster = new THREE.Raycaster();

function isDescendantOf(object, ancestor) {
  for (let current = object; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function hasIgnoredAncestor(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData?.ignoreLaser) return true;
    if (current.name === 'PerformanceHUD') return true;
  }
  return false;
}

function hasVisibleMaterial(object) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some((material) =>
    material && material.visible !== false && (!material.transparent || material.opacity > 0.05)
  );
}

function createLaser(muzzlePoint) {
  const group = new THREE.Group();
  group.name = 'Runtime_PistolLaser';
  group.visible = false;
  group.userData.ignoreLaser = true;

  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.018,
    0, 0, -1
  ], 3));

  const beamMaterial = new THREE.LineBasicMaterial({
    color: 0xff1010,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const beam = new THREE.Line(beamGeometry, beamMaterial);
  beam.name = 'Runtime_PistolLaserBeam';
  beam.renderOrder = 40;
  beam.frustumCulled = false;
  group.add(beam);

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), dotMaterial);
  dot.name = 'Runtime_PistolLaserDot';
  dot.renderOrder = 41;
  dot.frustumCulled = false;
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
  const excludedGripRoots = (options.grips || []).filter(Boolean);

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
      if (isDescendantOf(object, pistol.root)) return false;
      if (excludedGripRoots.some((root) => isDescendantOf(object, root))) return false;
      if (hasIgnoredAncestor(object)) return false;
      return hasVisibleMaterial(object);
    }) || null;
  }

  function updateLaser() {
    const held = Boolean(pistol.isHeld?.());
    laser.group.visible = held;
    if (!held) return;

    updateMuzzleRay();
    const hit = findLaserHit();
    if (hit) {
      laserEndpointWorld.copy(hit.point);
    } else {
      laserEndpointWorld.copy(muzzleOrigin).addScaledVector(muzzleDirection, LASER_RANGE);
    }

    laserEndpointLocal.copy(laserEndpointWorld);
    muzzlePoint.worldToLocal(laserEndpointLocal);

    const position = laser.beam.geometry.getAttribute('position');
    position.setXYZ(0, 0, 0, -0.018);
    position.setXYZ(1, laserEndpointLocal.x, laserEndpointLocal.y, laserEndpointLocal.z);
    position.needsUpdate = true;

    laser.dot.visible = Boolean(hit);
    laser.dot.position.copy(laserEndpointLocal);
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
