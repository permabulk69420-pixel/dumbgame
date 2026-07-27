import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from '../config.js?v=8';

function yawQuaternion(angle) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle).toArray();
}

export function registerApartmentShell(physics, house) {
  const handles = [];
  const halfWidth = house.dimensions.width * 0.5;
  const halfDepth = house.dimensions.depth * 0.5;

  handles.push(physics.registerFixedBox({
    position: [0, house.floorY - 0.10, 0],
    halfExtents: [halfWidth, 0.10, halfDepth],
    friction: 0.9
  }));

  for (const segment of house.collisionSegments) {
    const dx = segment.x2 - segment.x1;
    const dz = segment.z2 - segment.z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const angle = -Math.atan2(dz, dx);
    handles.push(physics.registerFixedBox({
      position: [
        (segment.x1 + segment.x2) * 0.5,
        house.floorY + HOUSE.wallHeight * 0.5,
        (segment.z1 + segment.z2) * 0.5
      ],
      quaternion: yawQuaternion(angle),
      halfExtents: [length * 0.5, HOUSE.wallHeight * 0.5, HOUSE.wallThickness * 0.5],
      friction: 0.78
    }));
  }

  return handles;
}

export function registerBedColliders(physics, bedRoot) {
  if (!physics || !bedRoot) return null;
  return physics.registerKinematicBody({
    source: bedRoot,
    colliders: [
      { shape: 'box', halfExtents: [0.86, 0.15, 1.08], translation: [0, 0.15, 0], friction: 0.82 },
      { shape: 'box', halfExtents: [0.765, 0.122, 1.015], translation: [0, 0.535, 0], friction: 0.94 },
      { shape: 'box', halfExtents: [0.86, 0.46, 0.07], translation: [0, 0.64, 1.055], friction: 0.82 }
    ]
  });
}

export function registerBedsideColliders(physics, tableRoot, drawerPivot) {
  if (!physics || !tableRoot || !drawerPivot) return null;

  const cabinet = physics.registerKinematicBody({
    source: tableRoot,
    colliders: [
      { shape: 'box', halfExtents: [0.32, 0.018, 0.24], translation: [0, 0.602, 0], friction: 0.86 },
      { shape: 'box', halfExtents: [0.018, 0.31, 0.24], translation: [-0.302, 0.31, 0], friction: 0.78 },
      { shape: 'box', halfExtents: [0.018, 0.31, 0.24], translation: [0.302, 0.31, 0], friction: 0.78 },
      { shape: 'box', halfExtents: [0.284, 0.31, 0.018], translation: [0, 0.31, 0.222], friction: 0.78 },
      { shape: 'box', halfExtents: [0.32, 0.025, 0.24], translation: [0, 0.025, 0], friction: 0.82 },
      { shape: 'box', halfExtents: [0.284, 0.018, 0.22], translation: [0, 0.352, 0], friction: 0.82 }
    ]
  });

  const drawer = physics.registerKinematicBody({
    source: drawerPivot,
    colliders: [
      { shape: 'box', halfExtents: [0.27, 0.012, 0.184], translation: [0, -0.071, 0], friction: 0.88 },
      { shape: 'box', halfExtents: [0.012, 0.083, 0.184], translation: [-0.258, 0, 0], friction: 0.78 },
      { shape: 'box', halfExtents: [0.012, 0.083, 0.184], translation: [0.258, 0, 0], friction: 0.78 },
      { shape: 'box', halfExtents: [0.27, 0.083, 0.012], translation: [0, 0, 0.172], friction: 0.78 },
      { shape: 'box', halfExtents: [0.27, 0.083, 0.012], translation: [0, 0, -0.172], friction: 0.78 }
    ]
  });

  return {
    cabinet,
    drawer,
    dispose() {
      cabinet.dispose();
      drawer.dispose();
    }
  };
}

export function registerTopSurfaceCollider(physics, root, {
  thickness = 0.055,
  insetX = 0.025,
  insetZ = 0.025,
  friction = 0.84
} = {}) {
  if (!physics || !root) return null;
  const bounds = physics.computeLocalBounds(root);
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const halfX = Math.max(0.03, size.x * 0.5 - insetX);
  const halfZ = Math.max(0.03, size.z * 0.5 - insetZ);
  const topY = bounds.max.y;

  return physics.registerKinematicBody({
    source: root,
    colliders: [{
      shape: 'box',
      halfExtents: [halfX, thickness * 0.5, halfZ],
      translation: [centre.x, topY - thickness * 0.5, centre.z],
      friction
    }]
  });
}
