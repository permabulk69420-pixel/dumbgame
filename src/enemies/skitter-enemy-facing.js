import { loadSkitterEnemy as loadBaseSkitterEnemy } from './skitter-enemy.js?v=2';
import { CORRIDOR_LIGHT_LAYER } from '../scene-light-layers.js?v=1';

export async function loadSkitterEnemy(options) {
  const enemy = await loadBaseSkitterEnemy(options);
  if (!enemy) return null;

  // Ordinary THREE.Object3D.lookAt() aims local +Z at its target. The supplied
  // creature is also authored facing +Z, so the earlier 180-degree visual yaw
  // made it skitter toward the player backwards.
  enemy.visual.rotation.y = 0;

  // The creature never enters the apartment, so light it with the corridor's
  // local downlights rather than the outdoor hemisphere and sun.
  enemy.root.traverse((object) => {
    object.layers.set(CORRIDOR_LIGHT_LAYER);
    object.userData.enclosedCorridor = true;
  });

  enemy.visual.updateMatrixWorld(true);
  return enemy;
}
