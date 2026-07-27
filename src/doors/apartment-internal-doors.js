import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE, SCALE } from '../config.js?v=10';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { createSwingDoor } from './door-system.js?v=1';

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Internal door GLB is missing required node: ${name}`);
  return node;
}

function invisibleZone(width = 0.34, height = 0.25, depth = 0.32) {
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

function hideColliderHelpers(root) {
  root.traverse((object) => {
    if (object.name?.startsWith('COLLIDER_')) object.visible = false;
  });
}

function removeProceduralDoorFrame(parent, centreX, floorY, centreZ) {
  const oldFrame = parent.children.find((child) =>
    child.isGroup &&
    !child.name &&
    child.children.length === 4 &&
    Math.abs(child.position.x - centreX) < 0.002 &&
    Math.abs(child.position.y - floorY) < 0.002 &&
    Math.abs(child.position.z - centreZ) < 0.002
  );
  oldFrame?.removeFromParent();
}

function getDoorSpecs() {
  const xL = -HOUSE.width / 2;
  const zF = -HOUSE.depth / 2;
  const xBedroomWall = xL + 14 * SCALE;
  const xHallWall = xBedroomWall + 4 * SCALE;
  const intoBedroom = {
    minAngle: THREE.MathUtils.degToRad(-112),
    maxAngle: THREE.MathUtils.degToRad(5)
  };
  const intoRoom = {
    minAngle: THREE.MathUtils.degToRad(-5),
    maxAngle: THREE.MathUtils.degToRad(112)
  };

  return [
    {
      id: 'bedroom-front',
      label: 'front bedroom door',
      x: xBedroomWall,
      z: zF + 5.3 * SCALE,
      rotationY: -Math.PI / 2,
      scaleX: 1,
      ...intoBedroom
    },
    {
      id: 'bedroom-middle',
      label: 'middle bedroom door',
      x: xBedroomWall,
      z: zF + 15.2 * SCALE,
      rotationY: -Math.PI / 2,
      scaleX: 1,
      ...intoBedroom
    },
    {
      id: 'bedroom-rear',
      label: 'rear bedroom door',
      x: xBedroomWall,
      z: zF + 25.6 * SCALE,
      rotationY: -Math.PI / 2,
      scaleX: 1,
      ...intoBedroom
    },
    {
      id: 'hall-room-front',
      label: 'hall room door',
      x: xHallWall,
      z: zF + 15 * SCALE,
      rotationY: -Math.PI / 2,
      scaleX: 1,
      ...intoRoom
    },
    {
      id: 'hall-room-rear',
      label: 'rear hall room door',
      x: xHallWall,
      z: zF + 21.6 * SCALE,
      rotationY: -Math.PI / 2,
      // This one existing opening is 2.8 rather than 3 SCALE units wide.
      scaleX: 2.8 / 3,
      ...intoRoom
    }
  ];
}

export async function loadApartmentInternalDoors({
  parent,
  placement,
  collisionSegments,
  controllerModes = null,
  floorY = HOUSE.slabHeight,
  statusElement = null
}) {
  if (!parent || !placement || !collisionSegments) {
    throw new Error('loadApartmentInternalDoors requires parent, placement and collisionSegments');
  }

  const gltf = await loadGLB(ASSETS.apartmentInternalDoor);
  const sourceRoot = prepareModel(gltf.scene, { castShadow: false, receiveShadow: true });
  const sourceAssembly = requireNode(sourceRoot, 'DoorAssembly');
  const doors = [];

  for (const spec of getDoorSpecs()) {
    removeProceduralDoorFrame(parent, spec.x, floorY, spec.z);

    const assembly = sourceAssembly.clone(true);
    assembly.name = `ApartmentInternalDoor_${spec.id}`;
    assembly.position.set(spec.x, floorY, spec.z);
    assembly.rotation.set(0, spec.rotationY, 0);
    assembly.scale.set(spec.scaleX, 1, 1);
    hideColliderHelpers(assembly);
    parent.add(assembly);
    assembly.updateWorldMatrix(true, true);

    const pivot = requireNode(assembly, 'DoorPivot');
    const handleInside = requireNode(assembly, 'HandlePivot_Inside');
    const handleOutside = requireNode(assembly, 'HandlePivot_Outside');
    const latch = requireNode(assembly, 'Latch');
    const collisionEdge = requireNode(assembly, 'Door_Collision_FreeEdge');

    const handleInteractionRoot = new THREE.Group();
    handleInteractionRoot.name = `Door_Handle_Interaction_${spec.id}`;
    handleInteractionRoot.position.copy(handleInside.position);
    pivot.add(handleInteractionRoot);
    handleInteractionRoot.add(invisibleZone());

    const door = createSwingDoor({
      placement,
      collisionSegments,
      controllerModes,
      assemblyRoot: assembly,
      doorPivot: pivot,
      handleInteractionRoot,
      collisionEdge,
      handlePivots: [handleInside, handleOutside],
      latch,
      statusElement,
      id: `apartment-internal-door-${spec.id}`,
      label: spec.label,
      minAngle: spec.minAngle,
      maxAngle: spec.maxAngle,
      handleAngle: THREE.MathUtils.degToRad(-28)
    });

    doors.push({ id: spec.id, ...door });
  }

  return {
    roots: doors.map((door) => door.root),
    doors,
    getDoor(id) {
      return doors.find((door) => door.id === id) || null;
    },
    update(dt) {
      for (const door of doors) door.update(dt);
    },
    dispose() {
      for (const door of doors) door.dispose();
    }
  };
}
