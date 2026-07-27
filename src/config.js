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
  computerDesk: './assets/models/furniture/ComputerDesk.glb',
  couch: './assets/models/furniture/Two_Seat_Black_Leather_Couch.glb',
  queenBed: './assets/models/furniture/Apartment_Queen_Bed.glb?v=1',
  bedsideTable: './assets/models/furniture/Apartment_Bedside_Table.glb?v=1',
  alarmClock: './assets/models/furniture/Apartment_Digital_Alarm_Clock.glb?v=1',
  entertainmentUnit: './assets/models/furniture/Apartment_Entertainment_Unit.glb?v=1',
  apartmentTV: './assets/models/furniture/Apartment_Flatscreen_TV_v2.glb?v=1',
  monitor: './assets/models/computer/modern_flat_monitor_24in.glb',
  keyboard: './assets/models/computer/Keyboard_corrected.glb',
  mouse: './assets/models/computer/modern_desktop_mouse.glb',
  computerTower: './assets/models/computer/modern_desktop_tower.glb',
  pistol: './assets/models/tools/Generic_Striker_Pistol_v5_final.glb',
  torch: './assets/models/tools/Generic_Handheld_Torch_v2_forward_button.glb',
  woodenBat: './assets/models/tools/Apartment_Wooden_Bat.glb?v=1',
  apartmentEntryDoor: './assets/models/architecture/Apartment_Entry_Door.glb?v=1'
});

export const PLAYER = Object.freeze({
  moveSpeed: 2.25,
  turnSpeed: 1.9,
  eyeHeight: 1.65
});

export const INTERACTION = Object.freeze({
  decorationEnabledByDefault: true,
  decorationToggleHoldSeconds: 0.75
});

export const GAME_TIME = Object.freeze({
  realSecondsPerDay: 30 * 60,
  sleepHour: 8,
  sleepMinute: 0,
  advanceOnlyInXR: true
});
