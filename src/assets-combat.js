import { loadDecorAssets as loadBaseDecorAssets } from './assets.js?base=1';
import { loadSkitterEnemy } from './enemies/skitter-enemy.js?v=1';

export async function loadDecorAssets(options) {
  const decor = await loadBaseDecorAssets(options);
  let skitter = null;

  try {
    skitter = await loadSkitterEnemy({
      scene: options.scene,
      floorY: options.floorY,
      statusElement: options.statusElement
    });
  } catch (error) {
    console.error('Skitter enemy failed to load', error);
  }

  const baseUpdate = decor.update.bind(decor);
  const baseDispose = decor.dispose.bind(decor);

  return {
    ...decor,
    enemy: skitter,
    update(dt) {
      baseUpdate(dt);
      skitter?.update(dt);
    },
    dispose() {
      skitter?.dispose();
      baseDispose();
    }
  };
}
