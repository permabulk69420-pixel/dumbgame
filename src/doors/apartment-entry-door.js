import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE, SCALE } from '../config.js?v=10';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { createSwingDoor } from './door-system.js?v=1';
import { loadApartmentInternalDoors } from './apartment-internal-doors.js?v=1';

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Apartment door GLB is missing required node: ${name}`);
  return node;
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

function removeProceduralEntryFrame(parent, centreX, floorY, centreZ) {
  // house.js originally supplied an unnamed four-piece frame around every doorway.
  // Remove only the exact entry-frame group so the finished GLB frame does not overlap it.
  const oldFrame = parent.children.find((child) =>
    child.isGroup &&
    !child.name &&
    child.children.length === 4 &&
    Math.abs(child.position.x - centreX) < 0.001 &&
    Math.abs(child.position.y - floorY) < 0.001 &&
    Math.abs(child.position.z - centreZ) < 0.001
  );
  oldFrame?.removeFromParent();
}

export async function loadApartmentEntryDoor({
  parent,
  placement,
  collisionSegments,
  controllerModes = null,
  floorY = HOUSE.slabHeight,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.apartmentEntryDoor);
  const loadedRoot = prepareModel(gltf.scene, { castShadow: true, receiveShadow: true });
  const assembly = requireNode(loadedRoot, 'DoorAssembly');
  const pivot = requireNode(assembly, 'DoorPivot');
  const handleInside = requireNode(assembly, 'HandlePivot_Inside');
  const handleOutside = requireNode(assembly, 'HandlePivot_Outside');
  const latch = requireNode(assembly, 'Latch');
  const collisionEdge = requireNode(assembly, 'Door_Collision_FreeEdge');

  // The asset was authored exactly to the apartment opening dimensions. Its root is
  // floor-centred, with corridor/front facing local -Z and the apartment at local +Z.
  const centreX = -HOUSE.width / 2 + 16 * SCALE;
  const centreZ = -HOUSE.depth / 2;
  removeProceduralEntryFrame(parent, centreX, floorY, centreZ);
  assembly.position.set(centreX, floorY, centreZ);
  assembly.quaternion.identity();
  assembly.scale.set(1, 1, 1);
  parent.add(assembly);
  assembly.updateWorldMatrix(true, true);

  // One generous invisible interaction volume covers both physical lever handles.
  // The visible pivots still animate independently and remain the source of truth.
  const handleInteractionRoot = new THREE.Group();
  handleInteractionRoot.name = 'Door_Handle_Interaction';
  handleInteractionRoot.position.copy(handleInside.position);
  pivot.add(handleInteractionRoot);

  const zone = invisibleZone(0.34, 0.25, 0.32);
  handleInteractionRoot.add(zone);

  const entryDoor = createSwingDoor({
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
    id: 'apartment-entry-door',
    label: 'apartment door',
    minAngle: THREE.MathUtils.degToRad(-112),
    maxAngle: THREE.MathUtils.degToRad(5),
    handleAngle: THREE.MathUtils.degToRad(32)
  });

  let internalDoors = {
    roots: [],
    doors: [],
    update() {},
    getDoor() { return null; },
    dispose() {}
  };

  try {
    internalDoors = await loadApartmentInternalDoors({
      parent,
      placement,
      collisionSegments,
      controllerModes,
      floorY,
      statusElement
    });
  } catch (error) {
    console.error('Internal apartment doors failed to load', error);
    if (statusElement) statusElement.textContent = 'Apartment loaded; the internal doors failed to load.';
  }

  return {
    root: entryDoor.root,
    internalRoots: internalDoors.roots,
    internalDoors: internalDoors.doors,
    update(dt) {
      entryDoor.update(dt);
      internalDoors.update(dt);
    },
    setAngle: entryDoor.setAngle,
    getAngle: entryDoor.getAngle,
    setLocked: entryDoor.setLocked,
    isLocked: entryDoor.isLocked,
    isOpen: entryDoor.isOpen,
    getInternalDoor: internalDoors.getDoor,
    dispose() {
      entryDoor.dispose();
      internalDoors.dispose();
    }
  };
}
