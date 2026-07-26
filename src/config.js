export const SCALE = 0.3048 * 1.5;

export const HOUSE = Object.freeze({
  width: 33 * SCALE,
  depth: 32 * SCALE,
  porchDepth: 5 * SCALE,
  wallHeight: 2.72,
  wallThickness: 0.17,
  slabHeight: 0.14,
  playerRadius: 0.25
});

export const ASSETS = Object.freeze({
  leftHand: './assets/models/hands/LeftHand.glb',
  rightHand: './assets/models/hands/RightHand.glb',
  computerDesk: './assets/models/furniture/ComputerDesk.glb'
});

export const PLAYER = Object.freeze({
  moveSpeed: 2.25,
  turnSpeed: 1.9
});

export const GAME_TIME = Object.freeze({
  realSecondsPerDay: 30 * 60,
  sleepHour: 8,
  sleepMinute: 0,
  advanceOnlyInXR: true
});
