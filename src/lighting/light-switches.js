import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE } from '../config.js?v=8';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { LIGHT_ZONES, LIGHT_SWITCH_WALL_SEGMENTS } from './light-zones.js?v=1';

const ON_ANGLE = THREE.MathUtils.degToRad(12);
const OFF_ANGLE = THREE.MathUtils.degToRad(-12);
const POKE_RADIUS = 0.043;
const POKE_RELEASE_RADIUS = 0.075;
const WALL_SNAP_DISTANCE = 0.32;
const WALL_SURFACE_OFFSET = HOUSE.wallThickness * 0.5 + 0.004;

const tempTip = new THREE.Vector3();
const tempInteraction = new THREE.Vector3();

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Light switch GLB is missing required node: ${name}`);
  return node;
}

function yawForNormal(normalX, normalZ) {
  return Math.atan2(-normalX, -normalZ);
}

function pulseHand(hands, handedness) {
  const inputSource = hands?.states?.find((state) => state.handedness === handedness)?.inputSource;
  const gamepad = inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
  const pulse = actuator?.pulse?.(0.32, 34);
  pulse?.catch?.(() => {});
}

function findNearestWall(position) {
  let best = null;
  for (const segment of LIGHT_SWITCH_WALL_SEGMENTS) {
    const along = segment.axis === 'x' ? position.z : position.x;
    if (along < segment.min - 0.08 || along > segment.max + 0.08) continue;
    const value = segment.axis === 'x' ? position.x : position.z;
    const delta = value - segment.value;
    const distance = Math.abs(delta);
    if (distance > WALL_SNAP_DISTANCE || (best && distance >= best.distance)) continue;
    best = { segment, delta, distance };
  }
  return best;
}

function snapSwitchToWall(root, { requireHeld = true } = {}) {
  if (requireHeld && !root.userData.heldBy) return false;
  const match = findNearestWall(root.position);
  if (!match) return false;

  const { segment, delta } = match;
  let sign = Math.sign(delta);
  if (!sign) sign = root.userData.wallNormalSign || 1;
  root.userData.wallNormalSign = sign;

  let normalX = 0;
  let normalZ = 0;
  if (segment.axis === 'x') {
    normalX = sign;
    root.position.x = segment.value + sign * WALL_SURFACE_OFFSET;
  } else {
    normalZ = sign;
    root.position.z = segment.value + sign * WALL_SURFACE_OFFSET;
  }

  root.rotation.set(0, yawForNormal(normalX, normalZ), 0);
  root.updateMatrixWorld(true);
  return true;
}

export async function loadApartmentLightSwitches({
  scene,
  placement,
  hands,
  lighting,
  floorY = 0,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.wallLightSwitch);
  const switches = [];

  for (const zone of LIGHT_ZONES) {
    const root = prepareModel(gltf.scene.clone(true), { castShadow: false, receiveShadow: true });
    root.name = `ApartmentLightSwitch_${zone.id}`;
    root.position.set(
      zone.initialPosition[0],
      floorY + zone.initialPosition[1],
      zone.initialPosition[2]
    );
    root.rotation.set(0, yawForNormal(zone.initialNormal[0], zone.initialNormal[2]), 0);
    root.userData.lightZoneId = zone.id;
    root.userData.wallNormalSign = zone.initialNormal[0] || zone.initialNormal[2] || 1;

    const toggle = requireNode(root, 'Switch_Toggle');
    const interactionPoint = requireNode(root, 'Switch_Interaction_Point');
    const latches = new Map();
    let targetAngle = lighting?.isLightZoneEnabled?.(zone.id) ? ON_ANGLE : OFF_ANGLE;
    toggle.rotation.x = targetAngle;

    scene.add(root);
    placement.registerPlaceable(root, `room-light-switch-${zone.id}`, {
      allowVertical: true,
      minY: floorY + 0.32,
      maxY: floorY + 2.15,
      confineToBounds: true
    });

    // Placement saves from the first switch build used the wall centreline. Migrate any
    // restored switch that is still close to a known wall onto the visible wall surface.
    snapSwitchToWall(root, { requireHeld: false });

    switches.push({
      zone,
      root,
      toggle,
      interactionPoint,
      latches,
      get targetAngle() { return targetAngle; },
      set targetAngle(value) { targetAngle = value; }
    });
  }

  function setStatus(text) {
    if (statusElement) statusElement.textContent = text;
  }

  function toggleSwitch(entry, handedness) {
    const enabled = lighting?.toggleLightZone?.(entry.zone.id) ?? false;
    entry.targetAngle = enabled ? ON_ANGLE : OFF_ANGLE;
    pulseHand(hands, handedness);
    setStatus(`${entry.zone.label} light ${enabled ? 'on' : 'off'} · poke the rocker again to toggle`);
  }

  function updatePokes(entry) {
    entry.interactionPoint.getWorldPosition(tempInteraction);
    for (const handState of hands?.states || []) {
      const handedness = handState.handedness;
      if (!handedness || !hands.isVisible?.()) continue;
      const hasTip = hands.getIndexTipWorldPosition?.(handedness, tempTip);
      if (!hasTip) continue;

      const distance = tempTip.distanceTo(tempInteraction);
      const latched = entry.latches.get(handedness) || false;
      const busy = placement.isHandBusy?.(handedness) || false;

      if (busy) {
        if (distance < POKE_RELEASE_RADIUS) entry.latches.set(handedness, true);
        continue;
      }

      if (!latched && distance <= POKE_RADIUS) {
        entry.latches.set(handedness, true);
        toggleSwitch(entry, handedness);
      } else if (latched && distance >= POKE_RELEASE_RADIUS) {
        entry.latches.set(handedness, false);
      }
    }
  }

  return {
    roots: switches.map((entry) => entry.root),
    switches,
    update(dt) {
      for (const entry of switches) {
        snapSwitchToWall(entry.root);
        entry.toggle.rotation.x = THREE.MathUtils.damp(
          entry.toggle.rotation.x,
          entry.targetAngle,
          20,
          Math.max(0, dt || 0)
        );
        entry.root.updateMatrixWorld(true);
        updatePokes(entry);
      }
    },
    dispose() {
      for (const entry of switches) {
        placement.unregisterPlaceable(entry.root);
        entry.root.removeFromParent();
      }
    }
  };
}
