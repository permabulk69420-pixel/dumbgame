import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE, PLAYER } from './config.js';

export function thumbstick(source) {
  const gamepad = source?.gamepad;
  if (!gamepad?.axes?.length) return { x: 0, y: 0 };
  const axes = gamepad.axes;
  const index = axes.length >= 4 ? axes.length - 2 : 0;
  return { x: axes[index] || 0, y: axes[index + 1] || 0 };
}

export function deadzone(value, zone = 0.15) {
  const magnitude = Math.abs(value);
  if (magnitude < zone) return 0;
  return Math.sign(value) * (magnitude - zone) / (1 - zone);
}

function distanceToSegment(px, pz, wall) {
  const vx = wall.x2 - wall.x1;
  const vz = wall.z2 - wall.z1;
  const wx = px - wall.x1;
  const wz = pz - wall.z1;
  const lengthSquared = vx * vx + vz * vz;
  let t = lengthSquared ? (wx * vx + wz * vz) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = wall.x1 + t * vx;
  const cz = wall.z1 + t * vz;
  return Math.hypot(px - cx, pz - cz);
}

export function createLocomotion({ renderer, camera, rig, collisionSegments, placement }) {
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function canOccupy(x, z) {
    for (const wall of collisionSegments) {
      if (distanceToSegment(x, z, wall) < HOUSE.playerRadius + HOUSE.wallThickness * 0.55) return false;
    }
    return true;
  }

  function update(dt) {
    const session = renderer.xr.getSession();
    if (!session) return;

    let leftSource = null;
    let rightSource = null;
    for (const source of session.inputSources) {
      if (source.handedness === 'left') leftSource = source;
      if (source.handedness === 'right') rightSource = source;
    }

    const left = thumbstick(leftSource);
    const rightInput = thumbstick(rightSource);
    const leftBusy = placement?.isHandBusy('left') ?? false;
    const rightBusy = placement?.isHandBusy('right') ?? false;

    const strafe = leftBusy ? 0 : deadzone(left.x);
    const advance = leftBusy ? 0 : deadzone(left.y);
    const turn = rightBusy ? 0 : deadzone(rightInput.x);

    rig.rotation.y -= turn * PLAYER.turnSpeed * dt;
    if (!strafe && !advance) return;

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, up).normalize();
    movement.set(0, 0, 0).addScaledVector(right, strafe).addScaledVector(forward, -advance);
    if (movement.lengthSq() > 1) movement.normalize();
    movement.multiplyScalar(PLAYER.moveSpeed * dt);

    const nextX = rig.position.x + movement.x;
    const nextZ = rig.position.z + movement.z;
    if (canOccupy(nextX, rig.position.z)) rig.position.x = nextX;
    if (canOccupy(rig.position.x, nextZ)) rig.position.z = nextZ;
  }

  return { update, canOccupy };
}
