import {
  registerApartmentShell as registerBaseApartmentShell,
  registerBedColliders,
  registerBedsideColliders,
  registerTopSurfaceCollider
} from './apartment-colliders.js?base=1';

export { registerBedColliders, registerBedsideColliders, registerTopSurfaceCollider };

export function registerApartmentShell(physics, house) {
  const handles = registerBaseApartmentShell(physics, house);
  const bounds = house.corridorBounds;
  if (!bounds) return handles;

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  handles.push(physics.registerFixedBox({
    position: [
      (bounds.minX + bounds.maxX) * 0.5,
      house.floorY - 0.10,
      (bounds.minZ + bounds.maxZ) * 0.5
    ],
    halfExtents: [width * 0.5, 0.10, depth * 0.5],
    friction: 0.9
  }));

  return handles;
}
