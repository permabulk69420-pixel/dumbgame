import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from '../config.js?v=10';
import { createExteriorMist as createBaseExteriorMist } from './exterior-mist.js?base=1';

const corridorBounds = new THREE.Box3();

function readShellDistance(name = '') {
  const match = name.match(/Exterior_Mist_Shell_([\d.]+)m/i);
  return match ? Number(match[1]) : null;
}

function getProtectedBuildingBounds(scene) {
  const bounds = {
    minX: -HOUSE.width * 0.5,
    maxX: HOUSE.width * 0.5,
    minZ: -HOUSE.depth * 0.5,
    maxZ: HOUSE.depth * 0.5
  };

  const corridor = scene.getObjectByName('Apartment_Corridor');
  if (!corridor) return bounds;

  corridor.updateWorldMatrix(true, true);
  corridorBounds.setFromObject(corridor);
  if (corridorBounds.isEmpty()) return bounds;

  bounds.minX = Math.min(bounds.minX, corridorBounds.min.x);
  bounds.maxX = Math.max(bounds.maxX, corridorBounds.max.x);
  bounds.minZ = Math.min(bounds.minZ, corridorBounds.min.z);
  bounds.maxZ = Math.max(bounds.maxZ, corridorBounds.max.z);
  return bounds;
}

function expandMistShellsAroundBuilding(mist, scene) {
  const bounds = getProtectedBuildingBounds(scene);
  const centreX = (bounds.minX + bounds.maxX) * 0.5;
  const centreZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const buildingWidth = bounds.maxX - bounds.minX;
  const buildingDepth = bounds.maxZ - bounds.minZ;

  for (const shell of mist.root.children) {
    const distance = readShellDistance(shell.name);
    if (!shell.isMesh || !Number.isFinite(distance)) continue;

    const height = shell.geometry?.parameters?.height || 42;
    const replacement = new THREE.BoxGeometry(
      buildingWidth + distance * 2,
      height,
      buildingDepth + distance * 2
    );

    shell.geometry?.dispose();
    shell.geometry = replacement;
    shell.position.x = centreX;
    shell.position.z = centreZ;
    shell.userData.protectedBuildingBounds = { ...bounds };
  }
}

export function createExteriorMist(options = {}) {
  const mist = createBaseExteriorMist(options);
  expandMistShellsAroundBuilding(mist, options.scene);
  return mist;
}
