import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { createHouse as createExpandedHouse } from './house-expanded.js?base=1';
import { CORRIDOR_LIGHT_LAYER } from './scene-light-layers.js?v=1';

const corridorBounds = new THREE.Box3();
const worldPosition = new THREE.Vector3();

function insideCorridorBounds(position, margin = 0.12) {
  return position.x >= corridorBounds.min.x - margin &&
    position.x <= corridorBounds.max.x + margin &&
    position.z >= corridorBounds.min.z - margin &&
    position.z <= corridorBounds.max.z + margin;
}

function configureCorridorLighting(houseData) {
  const corridor = houseData.root.getObjectByName('Apartment_Corridor');
  if (!corridor) return;

  corridor.updateWorldMatrix(true, true);
  corridorBounds.setFromObject(corridor);

  // Every part of the enclosed hallway uses layer 1. The world's sun,
  // hemisphere light and fill light remain on layer 0, so they cannot provide
  // impossible ambient daylight through the corridor walls and ceiling.
  corridor.traverse((object) => {
    object.layers.set(CORRIDOR_LIGHT_LAYER);
    object.userData.enclosedCorridor = true;
  });

  // The original three corridor downlights were added directly to the house
  // rather than parented to Apartment_Corridor. Move those lights, and their
  // small cylinder fixtures, onto the same lighting layer by position.
  houseData.root.traverse((object) => {
    if (object === corridor || corridor.getObjectById(object.id)) return;
    if (!object.isPointLight && !(object.isMesh && object.geometry?.type === 'CylinderGeometry')) return;

    object.getWorldPosition(worldPosition);
    if (!insideCorridorBounds(worldPosition)) return;

    object.layers.set(CORRIDOR_LIGHT_LAYER);
    object.userData.enclosedCorridor = true;
    if (object.isPointLight && !object.name) object.name = 'Corridor_Downlight';
  });
}

export function createHouse(scene, materials) {
  const houseData = createExpandedHouse(scene, materials);
  configureCorridorLighting(houseData);
  return houseData;
}
