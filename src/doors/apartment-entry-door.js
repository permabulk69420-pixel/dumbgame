import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE, SCALE } from '../config.js?v=2';
import { createSwingDoor } from './door-system.js?v=1';

function meshBox(width, height, depth, material, name = '') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function invisibleZone(width, height, depth) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * Temporary procedural entrance door. The hierarchy and node names intentionally
 * mirror the future GLB contract, so the model can replace the geometry without
 * changing the interaction system.
 */
export function createApartmentEntryDoor({
  parent,
  placement,
  collisionSegments,
  controllerModes = null,
  floorY = HOUSE.slabHeight,
  materials,
  statusElement = null
}) {
  const openingWidth = 3 * SCALE;
  const doorWidth = openingWidth - 0.095;
  const doorHeight = 2.105;
  const doorThickness = 0.052;
  const centreX = -HOUSE.width / 2 + 16 * SCALE;
  const centreZ = -HOUSE.depth / 2;

  const assembly = new THREE.Group();
  assembly.name = 'DoorAssembly';
  assembly.position.set(centreX, floorY + 0.018, centreZ + 0.008);
  parent.add(assembly);

  const pivot = new THREE.Group();
  pivot.name = 'DoorPivot';
  pivot.position.set(-doorWidth / 2, 0, 0);
  assembly.add(pivot);

  const leaf = meshBox(doorWidth, doorHeight, doorThickness, materials.timber, 'DoorLeaf');
  leaf.position.set(doorWidth / 2, doorHeight / 2, 0);
  pivot.add(leaf);

  // Cheap placeholder details make it read as an apartment entry door until the GLB arrives.
  const upperPanel = meshBox(doorWidth * 0.72, 0.62, 0.012, materials.trim, 'Door_UpperPanel');
  upperPanel.position.set(doorWidth / 2, 1.55, -doorThickness / 2 - 0.007);
  pivot.add(upperPanel);

  const lowerPanel = meshBox(doorWidth * 0.72, 0.54, 0.012, materials.trim, 'Door_LowerPanel');
  lowerPanel.position.set(doorWidth / 2, 0.62, -doorThickness / 2 - 0.007);
  pivot.add(lowerPanel);

  const peephole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.022, 16),
    materials.gutter
  );
  peephole.name = 'Peephole';
  peephole.rotation.x = Math.PI / 2;
  peephole.position.set(doorWidth / 2, 1.66, -doorThickness / 2 - 0.018);
  peephole.castShadow = false;
  pivot.add(peephole);

  const lockX = doorWidth - 0.19;
  const handleY = 1.01;
  const handlePivots = [];

  function addHandle(name, z, inside) {
    const handlePivot = new THREE.Group();
    handlePivot.name = `HandlePivot_${name}`;
    handlePivot.position.set(lockX, handleY, z);
    pivot.add(handlePivot);

    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.024, 16),
      materials.gutter
    );
    spindle.name = `HandleSpindle_${name}`;
    spindle.rotation.x = Math.PI / 2;
    handlePivot.add(spindle);

    const handle = meshBox(0.145, 0.034, 0.032, materials.gutter, `Handle_${name}`);
    handle.position.x = inside ? -0.052 : 0.052;
    handlePivot.add(handle);
    handlePivots.push(handlePivot);
    return handlePivot;
  }

  addHandle('Inside', doorThickness / 2 + 0.045, true);
  addHandle('Outside', -doorThickness / 2 - 0.045, false);

  const latch = meshBox(0.036, 0.055, 0.024, materials.gutter, 'Latch');
  latch.position.set(doorWidth + 0.015, handleY, 0);
  pivot.add(latch);

  const latchPoint = new THREE.Object3D();
  latchPoint.name = 'Latch_Point';
  latchPoint.position.set(doorWidth + 0.015, handleY, 0);
  pivot.add(latchPoint);

  const closedStop = new THREE.Object3D();
  closedStop.name = 'Closed_Stop';
  closedStop.position.set(doorWidth, 0, 0);
  pivot.add(closedStop);

  const collisionEdge = new THREE.Object3D();
  collisionEdge.name = 'Door_Collision_FreeEdge';
  collisionEdge.position.set(doorWidth, 0, 0);
  pivot.add(collisionEdge);

  const handleInteractionRoot = new THREE.Group();
  handleInteractionRoot.name = 'Door_Handle_Interaction';
  pivot.add(handleInteractionRoot);

  for (const z of [doorThickness / 2 + 0.075, -doorThickness / 2 - 0.075]) {
    const zone = invisibleZone(0.3, 0.22, 0.13);
    zone.position.set(lockX + 0.015, handleY, z);
    handleInteractionRoot.add(zone);
  }

  return createSwingDoor({
    placement,
    collisionSegments,
    controllerModes,
    assemblyRoot: assembly,
    doorPivot: pivot,
    handleInteractionRoot,
    collisionEdge,
    handlePivots,
    latch,
    statusElement,
    id: 'apartment-entry-door',
    label: 'apartment door',
    minAngle: THREE.MathUtils.degToRad(-112),
    maxAngle: THREE.MathUtils.degToRad(5)
  });
}
