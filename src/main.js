import { createWorld } from './scene.js';
import { createMaterials } from './materials.js';
import { createHouse } from './house.js';
import { createPlacementSystem } from './placement-system.js';
import { createLocomotion } from './locomotion.js';
import { createVRHands } from './hands.js';
import { loadDecorAssets } from './assets.js';

const app = document.getElementById('app');
const loading = document.getElementById('loading');
const status = document.getElementById('status');

const world = createWorld(app);
const materials = createMaterials();
const house = createHouse(world.scene, materials);

const placement = createPlacementSystem({
  scene: world.scene,
  renderer: world.renderer,
  controllers: world.controllers,
  floorY: house.floorY,
  bounds: house.bounds,
  statusElement: status
});

const locomotion = createLocomotion({
  renderer: world.renderer,
  camera: world.camera,
  rig: world.rig,
  collisionSegments: house.collisionSegments,
  placement
});

let hands = { update() {} };
let decor = { update() {} };

createVRHands({
  controllers: world.controllers,
  grips: world.grips,
  onError: (message) => console.warn(message)
}).then((value) => {
  hands = value;
}).catch(console.error);

loadDecorAssets({
  scene: world.scene,
  placement,
  floorY: house.floorY,
  statusElement: status
}).then((value) => {
  decor = value;
}).catch(console.error);

world.renderer.xr.addEventListener('sessionstart', () => {
  world.rig.position.copy(house.spawn);
  world.rig.rotation.set(0, 0, 0);
  world.camera.position.set(0, 0, 0);
  status.textContent = 'Left stick moves · right stick turns · point and hold trigger to place objects';
});

world.renderer.xr.addEventListener('sessionend', () => {
  world.rig.position.set(0, 0, 0);
  world.rig.rotation.set(0, 0, 0);
  status.textContent = 'Quest: left stick moves, right stick turns smoothly. No snap turning.';
});

loading.remove();
let lastTime = performance.now();
let previewAngle = 0.5;

world.renderer.setAnimationLoop((time) => {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  placement.update(dt);
  hands.update(dt);
  decor.update(dt);

  if (world.renderer.xr.isPresenting) {
    locomotion.update(dt);
  } else {
    previewAngle += dt * 0.08;
    const radius = Math.max(house.dimensions.width, house.dimensions.depth) * 1.08;
    world.camera.position.set(Math.sin(previewAngle) * radius, 12.5, Math.cos(previewAngle) * radius);
    world.camera.lookAt(0, 0.7, 0);
  }

  world.renderer.render(world.scene, world.camera);
});
