import { HOUSE, SCALE } from '../config.js?v=8';

const xL = -HOUSE.width / 2;
const xR = HOUSE.width / 2;
const zF = -HOUSE.depth / 2;
const zB = HOUSE.depth / 2;
const xBedroomWall = xL + 14 * SCALE;
const xHallWall = xBedroomWall + 4 * SCALE;
const zBedroomOne = zF + 10 * SCALE;
const zBedroomTwo = zF + 20 * SCALE;
const zLivingKitchen = zF + 16 * SCALE;
const bathRight = xHallWall + 6 * SCALE;
const bathFront = zF + 12 * SCALE;
const bathBack = zF + 19 * SCALE;
const laundryBack = zF + 25 * SCALE;

export const LIGHT_ZONES = Object.freeze([
  Object.freeze({
    id: 'bedroom-1',
    label: 'front bedroom',
    defaultOn: true,
    initialPosition: [xBedroomWall - 0.003, 1.08, zF + 6.9 * SCALE],
    initialNormal: [-1, 0, 0]
  }),
  Object.freeze({
    id: 'bedroom-2',
    label: 'middle bedroom',
    defaultOn: false,
    initialPosition: [xBedroomWall - 0.003, 1.08, zF + 16.7 * SCALE],
    initialNormal: [-1, 0, 0]
  }),
  Object.freeze({
    id: 'bedroom-3',
    label: 'rear bedroom',
    defaultOn: false,
    initialPosition: [xBedroomWall - 0.003, 1.08, zF + 27.0 * SCALE],
    initialNormal: [-1, 0, 0]
  }),
  Object.freeze({
    id: 'living-room',
    label: 'living room',
    defaultOn: true,
    initialPosition: [xHallWall + 0.003, 1.08, zF + 6.9 * SCALE],
    initialNormal: [1, 0, 0]
  }),
  Object.freeze({
    id: 'kitchen',
    label: 'kitchen',
    defaultOn: false,
    initialPosition: [xHallWall + 9.0 * SCALE, 1.08, zLivingKitchen + 0.003],
    initialNormal: [0, 0, 1]
  }),
  Object.freeze({
    id: 'hallway',
    label: 'hallway',
    defaultOn: true,
    initialPosition: [xBedroomWall + 0.003, 1.08, zF + 6.9 * SCALE],
    initialNormal: [1, 0, 0]
  }),
  Object.freeze({
    id: 'bathroom',
    label: 'bathroom',
    defaultOn: false,
    initialPosition: [xHallWall + 0.003, 1.08, bathFront + 0.65],
    initialNormal: [1, 0, 0]
  }),
  Object.freeze({
    id: 'laundry',
    label: 'laundry',
    defaultOn: false,
    initialPosition: [xHallWall + 0.003, 1.08, bathBack + 0.72],
    initialNormal: [1, 0, 0]
  })
]);

export const LIGHT_SWITCH_WALL_SEGMENTS = Object.freeze([
  Object.freeze({ axis: 'x', value: xL, min: zF, max: zB }),
  Object.freeze({ axis: 'x', value: xR, min: zF, max: zB }),
  Object.freeze({ axis: 'z', value: zF, min: xL, max: xR }),
  Object.freeze({ axis: 'z', value: zB, min: xL, max: xR }),
  Object.freeze({ axis: 'x', value: xBedroomWall, min: zF, max: zB }),
  Object.freeze({ axis: 'x', value: xHallWall, min: zF, max: zB }),
  Object.freeze({ axis: 'z', value: zBedroomOne, min: xL, max: xBedroomWall }),
  Object.freeze({ axis: 'z', value: zBedroomTwo, min: xL, max: xBedroomWall }),
  Object.freeze({ axis: 'z', value: zLivingKitchen, min: xHallWall + 6 * SCALE, max: xR }),
  Object.freeze({ axis: 'z', value: bathFront, min: xHallWall, max: bathRight }),
  Object.freeze({ axis: 'x', value: bathRight, min: bathFront, max: bathBack }),
  Object.freeze({ axis: 'z', value: bathBack, min: xHallWall, max: bathRight }),
  Object.freeze({ axis: 'z', value: bathBack, min: xHallWall, max: xHallWall + 4.5 * SCALE }),
  Object.freeze({ axis: 'x', value: xHallWall + 4.5 * SCALE, min: bathBack, max: laundryBack }),
  Object.freeze({ axis: 'z', value: laundryBack, min: xHallWall, max: xHallWall + 4.5 * SCALE })
]);
