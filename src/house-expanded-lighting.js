import { createHouse as createExpandedHouse } from './house-expanded.js?base=1';
import {
  applyCorridorDistanceDarkening,
  CORRIDOR_DARKENING_PROFILE
} from './lighting/corridor-darkening.js?v=1';

export function createHouse(scene, materials) {
  const houseData = createExpandedHouse(scene, materials);
  const corridor = houseData.root.getObjectByName('Apartment_Corridor');

  if (corridor) {
    // Keep the original central corridor normally lit, then smoothly remove the
    // impossible global daylight contribution along both unlit extensions.
    applyCorridorDistanceDarkening(corridor, CORRIDOR_DARKENING_PROFILE);
  }

  return houseData;
}
