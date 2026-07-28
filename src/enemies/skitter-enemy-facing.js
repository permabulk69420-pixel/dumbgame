import { loadSkitterEnemy as loadBaseSkitterEnemy } from './skitter-enemy.js?v=2';
import {
  applyCorridorDistanceDarkening,
  CORRIDOR_DARKENING_PROFILE
} from '../lighting/corridor-darkening.js?v=1';

export async function loadSkitterEnemy(options) {
  const enemy = await loadBaseSkitterEnemy(options);
  if (!enemy) return null;

  // Ordinary THREE.Object3D.lookAt() aims local +Z at its target. The supplied
  // creature is also authored facing +Z, so the earlier 180-degree visual yaw
  // made it skitter toward the player backwards.
  enemy.visual.rotation.y = 0;

  // Match the creature to the same darkness gradient as the hallway instead of
  // letting global daylight make it glow at the unlit corridor ends.
  applyCorridorDistanceDarkening(enemy.visual, CORRIDOR_DARKENING_PROFILE);

  enemy.visual.updateMatrixWorld(true);
  return enemy;
}
