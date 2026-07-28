import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { loadWoodenBat as loadBaseWoodenBat } from './wooden-bat.js?base=1';
import { sweepCombatSphere } from '../combat/combat-system.js?v=1';

const previousImpact = new THREE.Vector3();
const currentImpact = new THREE.Vector3();

export async function loadWoodenBat(options) {
  const bat = await loadBaseWoodenBat(options);
  const baseUpdate = bat.update.bind(bat);
  let hasPreviousImpact = false;

  return {
    ...bat,
    update(dt) {
      baseUpdate(dt);
      bat.impactPoint.getWorldPosition(currentImpact);

      if (hasPreviousImpact && bat.isHeld() && dt > 0.0001) {
        const speed = previousImpact.distanceTo(currentImpact) / dt;
        if (speed >= 1.65) {
          const damage = THREE.MathUtils.clamp(12 + speed * 8.5, 24, 72);
          sweepCombatSphere({
            start: previousImpact,
            end: currentImpact,
            radius: 0.105,
            damage,
            source: 'wooden-bat',
            cooldownMs: 340
          });
        }
      }

      previousImpact.copy(currentImpact);
      hasPreviousImpact = true;
    }
  };
}
