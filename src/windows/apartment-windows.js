import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE, SCALE } from '../config.js?v=9';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';

const WINDOW_BOTTOM = 0.86;
const WINDOW_HEIGHT = 1.18;
const WINDOW_CENTRE_Y = HOUSE.slabHeight + WINDOW_BOTTOM + WINDOW_HEIGHT / 2;
const tempWorld = new THREE.Vector3();
const tempLocal = new THREE.Vector3();

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Apartment window GLB is missing required node: ${name}`);
  return node;
}

function createInvisibleInteractionZone(width = 0.26, height = 0.28, depth = 0.24) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false
  });
  const zone = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  zone.name = 'Window_Handle_Interaction';
  zone.castShadow = false;
  zone.receiveShadow = false;
  return zone;
}

function hideColliderHelpers(root) {
  root.traverse((object) => {
    if (object.name?.startsWith('COLLIDER_')) object.visible = false;
  });
}

function disposeRemovedGeometry(root) {
  const geometries = new Set();
  root.traverse((object) => {
    if (object.isMesh && object.geometry) geometries.add(object.geometry);
  });
  for (const geometry of geometries) geometry.dispose();
}

function removeProceduralWindow(parent, spec) {
  const oldWindow = parent.children.find((child) =>
    child.isGroup &&
    !child.name &&
    child.children.length === 7 &&
    Math.abs(child.position.x - spec.x) < 0.002 &&
    Math.abs(child.position.y - WINDOW_CENTRE_Y) < 0.002 &&
    Math.abs(child.position.z - spec.z) < 0.002
  );
  if (!oldWindow) return false;
  oldWindow.removeFromParent();
  disposeRemovedGeometry(oldWindow);
  return true;
}

function getWindowSpecs() {
  const xL = -HOUSE.width / 2;
  const xR = HOUSE.width / 2;
  const zF = -HOUSE.depth / 2;
  const zB = HOUSE.depth / 2;

  return [
    { id: 'right-1', x: xR, z: zF + 5 * SCALE, rotationY: -Math.PI / 2 },
    { id: 'right-2', x: xR, z: zF + 13 * SCALE, rotationY: -Math.PI / 2 },
    { id: 'right-3', x: xR, z: zF + 25 * SCALE, rotationY: -Math.PI / 2 },
    { id: 'rear-1', x: xR - 11 * SCALE, z: zB, rotationY: -Math.PI },
    { id: 'rear-2', x: xR - 26 * SCALE, z: zB, rotationY: -Math.PI },
    { id: 'left-1', x: xL, z: zB - 5 * SCALE, rotationY: Math.PI / 2 },
    { id: 'left-2', x: xL, z: zB - 16 * SCALE, rotationY: Math.PI / 2 },
    { id: 'left-3', x: xL, z: zB - 27 * SCALE, rotationY: Math.PI / 2 }
  ];
}

function readSavedAmount(gameState, eventId) {
  const value = gameState?.read?.().eventData?.[eventId]?.amount;
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

export async function loadApartmentWindows({
  parent,
  placement,
  gameState = null,
  statusElement = null
}) {
  if (!parent || !placement) {
    throw new Error('loadApartmentWindows requires the apartment parent and placement system');
  }

  const gltf = await loadGLB(ASSETS.apartmentWindow);
  const sourceRoot = prepareModel(gltf.scene, { castShadow: false, receiveShadow: true });
  const sourceAssembly = requireNode(sourceRoot, 'WindowAssembly');
  const roots = [];
  const unregisterInteractions = [];

  for (const spec of getWindowSpecs()) {
    removeProceduralWindow(parent, spec);

    const assembly = sourceAssembly.clone(true);
    assembly.name = `ApartmentWindow_${spec.id}`;
    assembly.position.set(spec.x, WINDOW_CENTRE_Y, spec.z);
    assembly.rotation.set(0, spec.rotationY, 0);
    assembly.scale.set(1, 1, 1);
    hideColliderHelpers(assembly);
    parent.add(assembly);
    assembly.updateWorldMatrix(true, true);

    const sash = requireNode(assembly, 'SlidingSash');
    const handle = requireNode(assembly, 'WindowHandle');
    const closedAnchor = requireNode(assembly, 'ClosedAnchor');
    const openAnchor = requireNode(assembly, 'OpenAnchor');
    const eventId = `apartment-window-${spec.id}`;
    const closedX = closedAnchor.position.x;
    const openX = openAnchor.position.x;
    const minX = Math.min(closedX, openX);
    const maxX = Math.max(closedX, openX);
    let amount = readSavedAmount(gameState, eventId);

    sash.position.x = THREE.MathUtils.lerp(closedX, openX, amount);

    const interactionZone = createInvisibleInteractionZone();
    handle.add(interactionZone);

    const unregister = placement.registerGrabInteraction(interactionZone, {
      id: eventId,
      label: 'sliding window',
      begin({ controller }) {
        controller.getWorldPosition(tempWorld);
        tempLocal.copy(tempWorld);
        assembly.worldToLocal(tempLocal);
        if (statusElement) statusElement.textContent = 'Hold grip and slide the window sideways';
        return {
          startControllerX: tempLocal.x,
          startSashX: sash.position.x
        };
      },
      update({ controller, context }) {
        controller.getWorldPosition(tempWorld);
        tempLocal.copy(tempWorld);
        assembly.worldToLocal(tempLocal);
        sash.position.x = THREE.MathUtils.clamp(
          context.startSashX + (tempLocal.x - context.startControllerX),
          minX,
          maxX
        );
        amount = THREE.MathUtils.clamp((sash.position.x - closedX) / (openX - closedX), 0, 1);
      },
      end() {
        gameState?.setEventData?.(eventId, { amount });
        if (statusElement) {
          statusElement.textContent = amount > 0.92
            ? 'Window fully open'
            : amount < 0.08
              ? 'Window closed'
              : 'Window left partly open';
        }
      }
    });

    unregisterInteractions.push(unregister);
    roots.push(assembly);
  }

  return {
    roots,
    getAmount(id) {
      const root = roots.find((windowRoot) => windowRoot.name === `ApartmentWindow_${id}`);
      if (!root) return null;
      const sash = root.getObjectByName('SlidingSash');
      const closed = root.getObjectByName('ClosedAnchor');
      const open = root.getObjectByName('OpenAnchor');
      return THREE.MathUtils.clamp((sash.position.x - closed.position.x) / (open.position.x - closed.position.x), 0, 1);
    },
    dispose() {
      for (const unregister of unregisterInteractions) unregister();
      for (const root of roots) root.removeFromParent();
    }
  };
}
