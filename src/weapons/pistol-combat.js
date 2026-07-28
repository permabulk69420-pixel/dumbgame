import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { loadPistol as loadBasePistol } from './pistol.js?base=1';
import { fireHitscan } from '../combat/combat-system.js?v=1';

const muzzleOrigin = new THREE.Vector3();
const muzzleDirection = new THREE.Vector3();
const muzzleQuaternion = new THREE.Quaternion();

export async function loadPistol(options) {
  const pistol = await loadBasePistol(options);
  const muzzlePoint = pistol.root.getObjectByName('Muzzle_Point');
  const muzzleFlash = pistol.root.getObjectByName('Runtime_MuzzleFlash');

  if (!muzzlePoint || !muzzleFlash) return pistol;

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
        muzzlePoint.updateWorldMatrix(true, false);
        muzzlePoint.getWorldPosition(muzzleOrigin);
        muzzlePoint.getWorldQuaternion(muzzleQuaternion);
        muzzleDirection.set(0, 0, -1).applyQuaternion(muzzleQuaternion).normalize();
        fireHitscan({
          origin: muzzleOrigin,
          direction: muzzleDirection,
          damage: 34,
          maxDistance: 45,
          source: 'pistol'
        });
      }
      flashVisible = nextVisible;
    }
  });

  const baseDispose = pistol.dispose.bind(pistol);
  return {
    ...pistol,
    dispose() {
      delete muzzleFlash.visible;
      muzzleFlash.visible = flashVisible;
      baseDispose();
    }
  };
}
