import { loadSkitterEnemy as loadBaseSkitterEnemy } from './skitter-enemy.js?v=2';

export async function loadSkitterEnemy(options) {
  const enemy = await loadBaseSkitterEnemy(options);
  if (!enemy) return null;

  // Ordinary THREE.Object3D.lookAt() aims local +Z at its target. The supplied
  // creature is also authored facing +Z, so the earlier 180-degree visual yaw
  // made it skitter toward the player backwards.
  enemy.visual.rotation.y = 0;
  enemy.visual.updateMatrixWorld(true);
  return enemy;
}
