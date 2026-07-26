import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const COMPONENTS = Object.freeze([
  ['monitor', 'computer-monitor'],
  ['keyboard', 'computer-keyboard'],
  ['mouse', 'computer-mouse'],
  ['tower', 'computer-tower']
]);

const DESKTOP_LIMITS = Object.freeze({
  monitor: { minX: -0.38, maxX: 0.38, minZ: -0.18, maxZ: 0.20 },
  mouse: { minX: -0.62, maxX: 0.62, minZ: -0.24, maxZ: 0.24 }
});

export function registerComputerPlaceables({ placement, roots, floorY = 0 }) {
  if (!placement?.registerPlaceable || !roots) return { update() {}, dispose() {} };

  const registered = [];
  const constraints = [];
  const bounds = new THREE.Box3();

  for (const [key, id] of COMPONENTS) {
    const root = roots[key];
    if (!root) continue;

    root.updateWorldMatrix(true, true);
    bounds.setFromObject(root);

    const placementFloorY = key === 'tower' ? floorY : bounds.min.y;
    root.userData.placementLabel = key;
    placement.registerPlaceable(root, id, {
      floorY: placementFloorY,
      confineToBounds: true
    });
    registered.push(root);

    if (key === 'monitor' || key === 'mouse') {
      const limits = DESKTOP_LIMITS[key];
      const fixedY = root.position.y;
      constraints.push(() => {
        root.position.x = THREE.MathUtils.clamp(root.position.x, limits.minX, limits.maxX);
        root.position.z = THREE.MathUtils.clamp(root.position.z, limits.minZ, limits.maxZ);
        root.position.y = fixedY;
      });
    }

    if (key === 'keyboard') {
      const centreX = root.position.x;
      const centreZ = root.position.z;
      const fixedY = root.position.y;
      constraints.push(() => {
        root.position.x = THREE.MathUtils.clamp(root.position.x, centreX - 0.20, centreX + 0.20);
        root.position.z = THREE.MathUtils.clamp(root.position.z, centreZ - 0.055, centreZ + 0.055);
        root.position.y = fixedY;
      });
    }
  }

  return {
    update() {
      for (const constrain of constraints) constrain();
    },
    dispose() {
      for (const root of registered) placement.unregisterPlaceable(root);
    }
  };
}
