import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { thumbstick, deadzone } from './locomotion.js';

const DEFAULT_STORAGE_KEY = 'dumbgame-object-placements-v1';

export function createPlacementSystem({
  scene,
  renderer,
  controllers,
  floorY = 0,
  bounds = null,
  statusElement = null,
  storageKey = DEFAULT_STORAGE_KEY,
  maxRayDistance = 12,
  maxGrabDistance = 9.5
}) {
  const placeables = [];
  const states = [];
  const grabInteractions = new Set();
  const raycaster = new THREE.Raycaster();
  const rotationMatrix = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const target = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();
  const objectBounds = new THREE.Box3();
  const objectSize = new THREE.Vector3();
  const pointerGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
  ]);

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    saved = {};
  }

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // Placement still works when storage is unavailable.
    }
  }

  function savePlacement(root) {
    const id = root.userData.placementId;
    if (!id) return;
    saved[id] = {
      position: root.position.toArray(),
      quaternion: root.quaternion.toArray(),
      scale: root.scale.toArray()
    };
    persist();
  }

  function resolvePlaceable(object) {
    let current = object;
    while (current) {
      if (current.userData.placeableRoot) return current.userData.placeableRoot;
      current = current.parent;
    }
    return null;
  }

  function resolveGrabInteraction(object) {
    let current = object;
    while (current) {
      const interaction = current.userData.grabInteraction;
      if (interaction && grabInteractions.has(interaction)) return interaction;
      current = current.parent;
    }
    return null;
  }

  function registerPlaceable(root, id, options = {}) {
    if (!root || !id) throw new Error('registerPlaceable(root, id) requires both values');
    const duplicate = placeables.find((item) => item.userData.placementId === id);
    if (duplicate && duplicate !== root) unregisterPlaceable(duplicate);
    if (!root.parent) scene.add(root);

    root.userData.placementId = id;
    root.userData.placementFloorY = options.floorY ?? floorY;
    root.userData.confineToBounds = options.confineToBounds ?? true;
    root.userData.heldBy = null;
    root.updateWorldMatrix(true, true);
    objectBounds.setFromObject(root);
    root.getWorldPosition(worldPosition);
    root.userData.placementFloorLift = worldPosition.y - objectBounds.min.y;
    root.traverse((child) => { child.userData.placeableRoot = root; });

    const restored = saved[id];
    if (restored) {
      if (Array.isArray(restored.position)) root.position.fromArray(restored.position);
      if (Array.isArray(restored.quaternion)) root.quaternion.fromArray(restored.quaternion);
      if (Array.isArray(restored.scale)) root.scale.fromArray(restored.scale);
    }

    if (!placeables.includes(root)) placeables.push(root);
    return root;
  }

  function unregisterPlaceable(root) {
    const index = placeables.indexOf(root);
    if (index !== -1) placeables.splice(index, 1);
    root?.traverse((child) => {
      if (child.userData.placeableRoot === root) delete child.userData.placeableRoot;
    });
  }

  function registerGrabInteraction(interactionRoot, handlers = {}) {
    if (!interactionRoot?.traverse) {
      throw new Error('registerGrabInteraction requires an Object3D interaction root');
    }

    const record = {
      id: handlers.id || interactionRoot.uuid,
      label: handlers.label || interactionRoot.name || 'interaction',
      target: interactionRoot,
      begin: handlers.begin,
      update: handlers.update,
      end: handlers.end
    };

    grabInteractions.add(record);
    interactionRoot.traverse((child) => {
      child.userData.grabInteraction = record;
    });

    return () => {
      grabInteractions.delete(record);
      interactionRoot.traverse((child) => {
        if (child.userData.grabInteraction === record) delete child.userData.grabInteraction;
      });
    };
  }

  function clearSavedPlacement(id) {
    delete saved[id];
    persist();
  }

  function getControllerRay(state) {
    rotationMatrix.identity().extractRotation(state.controller.matrixWorld);
    origin.setFromMatrixPosition(state.controller.matrixWorld);
    direction.set(0, 0, -1).applyMatrix4(rotationMatrix).normalize();
    return { origin, direction };
  }

  function findHit(state) {
    if (!placeables.length) return null;
    const ray = getControllerRay(state);
    raycaster.set(ray.origin, ray.direction);
    raycaster.near = 0.05;
    raycaster.far = maxRayDistance;
    const hits = raycaster.intersectObjects(placeables, true);

    for (const hit of hits) {
      const root = resolvePlaceable(hit.object);
      if (!root || (root.userData.heldBy && root.userData.heldBy !== state)) continue;

      const interaction = resolveGrabInteraction(hit.object);
      if (interaction) {
        return {
          root,
          hit,
          interaction,
          highlightObject: interaction.target
        };
      }

      return { root, hit, interaction: null, highlightObject: root };
    }
    return null;
  }

  function beginGrab(state) {
    if (state.grabbed || state.interaction) return;
    const result = findHit(state);
    if (!result) return;

    state.grabDistance = THREE.MathUtils.clamp(result.hit.distance, 0.65, maxGrabDistance);

    if (result.interaction) {
      const context = result.interaction.begin?.({
        controller: state.controller,
        inputSource: state.inputSource,
        handedness: state.handedness,
        hit: result.hit,
        root: result.root,
        target: result.interaction.target
      });
      if (context === false) return;

      state.interaction = result.interaction;
      state.interactionContext = context ?? {};
      state.interactionRoot = result.root;
      result.root.userData.heldBy = state;
      state.highlight.material.color.setHex(0x7dffb2);
      return;
    }

    state.grabbed = result.root;
    state.grabbed.userData.heldBy = state;
    state.highlight.material.color.setHex(0x7dffb2);
    setStatus('Object locked · stick left/right rotates · stick up/down changes reach · release trigger to place');
  }

  function finishGrab(state) {
    if (state.interaction) {
      const interaction = state.interaction;
      const root = state.interactionRoot;
      try {
        interaction.end?.({
          controller: state.controller,
          inputSource: state.inputSource,
          handedness: state.handedness,
          context: state.interactionContext,
          root,
          target: interaction.target
        });
      } catch (error) {
        console.error(`Grab interaction ${interaction.id} failed while ending`, error);
      } finally {
        if (root?.userData.heldBy === state) root.userData.heldBy = null;
        state.interaction = null;
        state.interactionContext = null;
        state.interactionRoot = null;
        state.highlight.visible = false;
      }
      return;
    }

    if (!state.grabbed) return;
    savePlacement(state.grabbed);
    state.grabbed.userData.heldBy = null;
    state.grabbed = null;
    state.highlight.visible = false;
    setStatus('Point at an object and hold trigger to move it · release trigger to place');
  }

  function setWorldPosition(root, position) {
    if (!root.parent) {
      root.position.copy(position);
      return;
    }
    root.parent.updateWorldMatrix(true, false);
    root.position.copy(root.parent.worldToLocal(position.clone()));
  }

  for (const controller of controllers) {
    const pointer = new THREE.Line(pointerGeometry, new THREE.LineBasicMaterial({
      color: 0xb9dfff, transparent: true, opacity: 0.78
    }));
    pointer.scale.z = 6;
    pointer.visible = false;
    controller.add(pointer);

    const highlight = new THREE.Box3Helper(new THREE.Box3(), 0x7dc8ff);
    highlight.visible = false;
    scene.add(highlight);

    const state = {
      controller,
      pointer,
      highlight,
      inputSource: null,
      handedness: '',
      hovered: null,
      hoveredTarget: null,
      grabbed: null,
      interaction: null,
      interactionContext: null,
      interactionRoot: null,
      grabDistance: 2
    };

    controller.addEventListener('connected', (event) => {
      state.inputSource = event.data;
      state.handedness = event.data.handedness || '';
    });
    controller.addEventListener('disconnected', () => {
      finishGrab(state);
      state.inputSource = null;
      state.handedness = '';
    });
    controller.addEventListener('selectstart', () => beginGrab(state));
    controller.addEventListener('selectend', () => finishGrab(state));
    states.push(state);
  }

  function update(dt) {
    const enabled = placeables.length > 0;

    for (const state of states) {
      state.pointer.visible = renderer.xr.isPresenting && enabled;
      if (!enabled) {
        state.highlight.visible = false;
        continue;
      }

      if (state.interaction) {
        try {
          state.interaction.update?.({
            dt,
            controller: state.controller,
            inputSource: state.inputSource,
            handedness: state.handedness,
            context: state.interactionContext,
            root: state.interactionRoot,
            target: state.interaction.target
          });
        } catch (error) {
          console.error(`Grab interaction ${state.interaction.id} failed while updating`, error);
          finishGrab(state);
          continue;
        }

        state.pointer.scale.z = state.grabDistance;
        state.pointer.material.color.setHex(0x7dffb2);
        state.highlight.box.setFromObject(state.interaction.target);
        state.highlight.visible = true;
        continue;
      }

      if (state.grabbed) {
        const root = state.grabbed;
        const stick = thumbstick(state.inputSource);
        const rotate = deadzone(stick.x);
        const reach = deadzone(stick.y);
        state.grabDistance = THREE.MathUtils.clamp(
          state.grabDistance - reach * 2.2 * dt, 0.65, maxGrabDistance
        );
        root.rotation.y -= rotate * 1.65 * dt;

        const ray = getControllerRay(state);
        target.copy(ray.origin).addScaledVector(ray.direction, state.grabDistance);
        root.updateWorldMatrix(true, true);
        objectBounds.setFromObject(root);
        objectBounds.getSize(objectSize);

        if (bounds && root.userData.confineToBounds) {
          const halfX = objectSize.x * 0.5;
          const halfZ = objectSize.z * 0.5;
          target.x = THREE.MathUtils.clamp(target.x, bounds.minX + halfX, bounds.maxX - halfX);
          target.z = THREE.MathUtils.clamp(target.z, bounds.minZ + halfZ, bounds.maxZ - halfZ);
        }

        target.y = root.userData.placementFloorY + root.userData.placementFloorLift;
        setWorldPosition(root, target);
        root.updateWorldMatrix(true, true);
        state.pointer.scale.z = state.grabDistance;
        state.pointer.material.color.setHex(0x7dffb2);
        state.highlight.box.setFromObject(root);
        state.highlight.visible = true;
        continue;
      }

      const result = findHit(state);
      state.hovered = result?.root || null;
      state.hoveredTarget = result?.highlightObject || null;
      state.pointer.scale.z = result ? result.hit.distance : 6;
      state.pointer.material.color.setHex(result ? 0x7dc8ff : 0xb9dfff);

      if (state.hoveredTarget) {
        state.highlight.material.color.setHex(0x7dc8ff);
        state.highlight.box.setFromObject(state.hoveredTarget);
        state.highlight.visible = true;
      } else {
        state.highlight.visible = false;
      }
    }
  }

  function isHandBusy(handedness) {
    return states.some((state) =>
      (state.grabbed || state.interaction) && state.handedness === handedness
    );
  }

  return {
    registerPlaceable,
    unregisterPlaceable,
    registerGrabInteraction,
    clearSavedPlacement,
    savePlacement,
    update,
    isHandBusy,
    getPlaceables: () => [...placeables],
    getSavedPlacements: () => JSON.parse(JSON.stringify(saved))
  };
}
