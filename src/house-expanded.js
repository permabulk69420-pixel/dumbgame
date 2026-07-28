import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { createHouse as createBaseHouse } from './house.js?base=1';
import { HOUSE } from './config.js';

const CORRIDOR_LENGTH_MULTIPLIER = 3;
const ORIGINAL_EXTRA_WIDTH = 0.7;
const EPSILON = 0.01;

function approximately(value, target, epsilon = EPSILON) {
  return Math.abs(value - target) <= epsilon;
}

function isOldEndCollision(segment, oldMinX, oldMaxX, farZ, nearZ) {
  if (!approximately(segment.x1, segment.x2)) return false;
  if (!approximately(segment.x1, oldMinX) && !approximately(segment.x1, oldMaxX)) return false;

  const reachesFarEnd = approximately(segment.z1, farZ) || approximately(segment.z2, farZ);
  const reachesNearEnd = approximately(segment.z1, nearZ) || approximately(segment.z2, nearZ);
  return reachesFarEnd && reachesNearEnd;
}

function extendApartmentCorridor(houseData, MAT) {
  const corridor = houseData.root.getObjectByName('Apartment_Corridor');
  if (!corridor) return;

  const {
    width: apartmentWidth,
    depth: apartmentDepth,
    wallHeight,
    wallThickness,
    slabHeight
  } = HOUSE;

  const apartmentLeft = -apartmentWidth / 2;
  const apartmentRight = apartmentWidth / 2;
  const apartmentFront = -apartmentDepth / 2;
  const oldHalfLength = apartmentWidth / 2 + ORIGINAL_EXTRA_WIDTH;
  const oldMinX = -oldHalfLength;
  const oldMaxX = oldHalfLength;
  const newHalfLength = oldHalfLength * CORRIDOR_LENGTH_MULTIPLIER;
  const newMinX = -newHalfLength;
  const newMaxX = newHalfLength;

  const nearZ = apartmentFront - wallThickness * 0.45;
  const farZ = apartmentFront - 3.35;
  const corridorDepth = nearZ - farZ;
  const centreZ = (nearZ + farZ) / 2;
  const ceilingY = slabHeight + wallHeight - 0.045;
  const extensionLength = newHalfLength - oldHalfLength;

  function box(width, height, depth, x, y, z, material, castShadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    corridor.add(mesh);
    return mesh;
  }

  // Remove the original end caps so the old corridor opens into both extensions.
  for (const child of [...corridor.children]) {
    const isOldEndCap = child.isMesh && approximately(child.position.z, centreZ) &&
      (approximately(child.position.x, oldMinX) || approximately(child.position.x, oldMaxX));
    if (!isOldEndCap) continue;
    corridor.remove(child);
    child.geometry?.dispose();
  }

  const leftExtensionCentre = (newMinX + oldMinX) / 2;
  const rightExtensionCentre = (oldMaxX + newMaxX) / 2;

  // Extend the walkable shell without adding any new light sources.
  for (const x of [leftExtensionCentre, rightExtensionCentre]) {
    box(extensionLength, 0.18, corridorDepth, x, 0.05, centreZ, MAT.concrete, false);
    box(extensionLength, 0.22, corridorDepth, x, ceilingY + 0.14, centreZ, MAT.foundation, true);
    box(extensionLength, wallHeight, wallThickness, x, slabHeight + wallHeight / 2,
      farZ, MAT.inner, true);
  }

  // Close the apartment-facing side outside the apartment frontage.
  const leftNearWallLength = apartmentLeft - newMinX;
  const rightNearWallLength = newMaxX - apartmentRight;
  box(leftNearWallLength, wallHeight, wallThickness, (newMinX + apartmentLeft) / 2,
    slabHeight + wallHeight / 2, nearZ, MAT.inner, true);
  box(rightNearWallLength, wallHeight, wallThickness, (apartmentRight + newMaxX) / 2,
    slabHeight + wallHeight / 2, nearZ, MAT.inner, true);

  // New end caps at the far ends of the three-times-long corridor.
  box(wallThickness, wallHeight, corridorDepth, newMinX, slabHeight + wallHeight / 2,
    centreZ, MAT.inner, true);
  box(wallThickness, wallHeight, corridorDepth, newMaxX, slabHeight + wallHeight / 2,
    centreZ, MAT.inner, true);

  const collisions = houseData.collisionSegments;
  const retainedCollisions = collisions.filter((segment) =>
    !isOldEndCollision(segment, oldMinX, oldMaxX, farZ, nearZ));
  collisions.length = 0;
  collisions.push(...retainedCollisions,
    { x1: newMinX, z1: farZ, x2: oldMinX, z2: farZ },
    { x1: oldMaxX, z1: farZ, x2: newMaxX, z2: farZ },
    { x1: newMinX, z1: nearZ, x2: apartmentLeft, z2: nearZ },
    { x1: apartmentRight, z1: nearZ, x2: newMaxX, z2: nearZ },
    { x1: newMinX, z1: farZ, x2: newMinX, z2: nearZ },
    { x1: newMaxX, z1: farZ, x2: newMaxX, z2: nearZ }
  );

  houseData.corridorBounds = {
    minX: newMinX,
    maxX: newMaxX,
    minZ: farZ,
    // Slightly overlap the apartment slab so physics objects cross the doorway cleanly.
    maxZ: apartmentFront + wallThickness * 0.5
  };
}

export function createHouse(scene, MAT) {
  const houseData = createBaseHouse(scene, MAT);
  extendApartmentCorridor(houseData, MAT);
  return houseData;
}
