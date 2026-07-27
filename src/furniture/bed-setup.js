import { ASSETS } from '../config.js?v=5';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';

function optionalNode(root, name) {
  return root.getObjectByName(name) || null;
}

export async function loadBedroomBed({
  scene,
  placement,
  floorY,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.queenBed);
  const root = prepareModel(gltf.scene, { castShadow: false, receiveShadow: true });
  root.name = 'ApartmentQueenBed';

  const assembly = optionalNode(root, 'BedAssembly') || root;
  const sleepAnchor = optionalNode(root, 'Sleep_Anchor');
  const headAnchor = optionalNode(root, 'Head_Anchor');
  const mattressAnchor = optionalNode(root, 'Mattress_Surface_Anchor');
  const collisionAnchor = optionalNode(root, 'Bed_Collision');

  // First bedroom: headboard against the exterior/front wall, leaving the doorway clear.
  // Creative Build can move it from here and Publish to Story preserves the result.
  root.position.set(-5.15, floorY, -6.05);
  root.rotation.y = Math.PI;
  scene.add(root);
  placement.registerPlaceable(root, 'bedroom-queen-bed', { floorY });

  if (statusElement) {
    statusElement.textContent = 'Queen bed loaded · Creative Build can move it with B/Y';
  }

  return {
    root,
    assembly,
    sleepAnchor,
    headAnchor,
    mattressAnchor,
    collisionAnchor,
    dispose() {
      placement.unregisterPlaceable(root);
      root.removeFromParent();
    }
  };
}
