import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { thumbstick, deadzone } from './locomotion.js';

const DEFAULT_STORAGE_KEY = 'dumbgame-object-placements-v1';
const COLOUR_USE = 0x7dc8ff;
const COLOUR_GRAB = 0x7dffb2;
const COLOUR_DECOR = 0xffc46b;

export function createPlacementSystem({
  scene,
  renderer,
  controllers,
  controllerModes = null,
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
  const useInteractions = new Set();
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

  function resolveInteraction(object, property, collection) {
    let current = object;
    while (current) {
      const interaction = current.userData[property];
      if (interaction && collection.has(interaction)) return interaction;
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

  function registerInteraction(collection, property, interactionRoot, handlers = {}) {
    if (!interactionRoot?.traverse) {
      throw new Error('Interaction registration requires an Object3D root');
    }

    const record = {
      id: handlers.id || interactionRoot.uuid,
      label: handlers.label || interactionRoot.name || 'interaction',
      target: interactionRoot,
      begin: handlers.begin,
      update: handlers.update,
      end: handlers.end
    };

    collection.add(record);
    interactionRoot.traverse((child) => {
      child.userData[property] = record;
    });

    return () => {
      collection.delete(record);
      interactionRoot.traverse((child) => {
        if (child.userData[property] === record) delete child.userData[property];
      });
    };
  }

  function registerGrabInteraction(interactionRoot, handlers = {}) {
    return registerInteraction(grabInteractions, 'grabInteraction', interactionRoot, handlers);
  }

  function registerUseInteraction(interactionRoot, handlers = {}) {
    return registerInteraction(useInteractions, 'useInteraction', interactionRoot, handlers);
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

  function setRay(state) {
    const ray = getControllerRay(state);
    raycaster.set(ray.origin, ray.direction);
    raycaster.near = 0.05;
    raycaster.far = maxRayDistance;
    return ray;
  }

  function findInteractionHit(state, collection, property) {
    if (!collection.size) return null;
    setRay(state);
    const roots = [...collection].map((record) => record.target).filter(Boolean);
    const hits = raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const interaction = resolveInteraction(hit.object, property, collection);
      if (interaction) {
        return {
          hit,
          interaction,
          root: resolvePlaceable(hit.object) || interaction.target,
          highlightObject: interaction.target
        };
      }
    }
    return null;
  }

  function findPlaceableHit(state) {
    if (!placeables.length) return null;
    setRay(state);
    const hits = raycaster.intersectObjects(placeables, true);
    for (const hit of hits) {
      const root = resolvePlaceable(hit.object);
      if (root && (!root.userData.heldBy || root.userData.heldBy === state)) {
        return { root, hit, highlightObject: root };
      }
    }
    return null;
  }

  function beginInteraction(state, kind, result) {
    if (!result) return false;
    const interaction = result.interaction;
    const context = interaction.begin?.({
      controller: state.controller,
      inputSource: state.inputSource,
      handedness: state.handedness,
      hit: result.hit,
      root: result.root,
      target: interaction.target
    });
    if (context === false) return false;

    state[`${kind}Interaction`] = interaction;
    state[`${kind}Context`] = context ?? {};
    state[`${kind}Root`] = result.root;
    if (kind === 'grab' && result.root?.userData) result.root.userData.heldBy = state;
    state.grabDistance = THREE.MathUtils.clamp(result.hit.distance, 0.2, maxGrabDistance);
    return true;
  }

  function finishInteraction(state, kind) {
    const interaction = state[`${kind}Interaction`];
    if (!interaction) return;
    const root = state[`${kind}Root`];
    try {
      interaction.end?.({
        controller: state.controller,
        inputSource: state.inputSource,
        handedness: state.handedness,
        context: state[`${kind}Context`],
        root,
        target: interaction.target
      });
    } catch (error) {
      console.error(`${kind} interaction ${interaction.id} failed while ending`, error);
    } finally {
      if (kind === 'grab' && root?.userData.heldBy === state) root.userData.heldBy = null;
      state[`${kind}Interaction`] = null;
      state[`${kind}Context`] = null;
      state[`${kind}Root`] = null;
      state.highlight.visible = false;
    }
  }

  function beginUse(state) {
    if (!controllerModes?.isPointing?.(state.handedness)) return;
    if (state.useInteraction || state.grabInteraction || state.placementGrabbed) return;
    beginInteraction(state, 'use', findInteractionHit(state, useInteractions, 'useInteraction'));
  }

  function finishUse(state) {
    finishInteraction(state, 'use');
  }

  function beginGameplayGrab(state) {
    if (state.useInteraction || state.grabInteraction || state.placementGrabbed) return;
    const result = findInteractionHit(state, grabInteractions, 'grabInteraction');
    if (beginInteraction(state, 'grab', result)) {
      state.highlight.material.color.setHex(COLOUR_GRAB);
    }
  }

  function finishGameplayGrab(state) {
    finishInteraction(state, 'grab');
  }

  function beginPlacement(state) {
    if (!controllerModes?.isDecorationMode?.()) return;
    if (state.useInteraction || state.grabInteraction || state.placementGrabbed) return;
    const result = findPlaceableHit(state);
    if (!result) return;

    state.placementGrabbed = result.root;
    state.grabDistance = THREE.MathUtils.clamp(result.hit.distance, 0.65, maxGrabDistance);
    state.placementGrabbed.userData.heldBy = state;
    state.highlight.material.color.setHex(COLOUR_DECOR);
    setStatus('Decorating · hold B/Y · stick left/right rotates · stick up/down changes reach');
  }

  function finishPlacement(state) {
    if (!state.placementGrabbed) return;
    savePlacement(state.placementGrabbed);
    state.placementGrabbed.userData.heldBy = null;
    state.placementGrabbed = null;
    state.highlight.visible = false;
    setStatus('Decorating mode · hold B/Y on furniture to move it');
  }

  function finishEverything(state) {
    finishUse(state);
    finishGameplayGrab(state);
    finishPlacement(state);
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
      color: COLOUR_USE,
      transparent: true,
      opacity: 0.78
    }));
    pointer.scale.z = 6;
    pointer.visible = false;
    controller.add(pointer);

    const highlight = new THREE.Box3Helper(new THREE.Box3(), COLOUR_USE);
    highlight.visible = false;
    scene.add(highlight);

    const state = {
      controller,
      pointer,
      highlight,
      inputSource: null,
      handedness: '',
      grabDistance: 2,
      useInteraction: null,
      useContext: null,
      useRoot: null,
      grabInteraction: null,
      grabContext: null,
      grabRoot: null,
      placementGrabbed: null
    };

    controller.addEventListener('connected', (event) => {
      state.inputSource = event.data;
      state.handedness = event.data.handedness || '';
    });
    controller.addEventListener('disconnected', () => {
      finishEverything(state);
      state.inputSource = null;
      state.handedness = '';
    });
    controller.addEventListener('selectstart', () => beginUse(state));
    controller.addEventListener('selectend', () => finishUse(state));
    controller.addEventListener('squeezestart', () => beginGameplayGrab(state));
    controller.addEventListener('squeezeend', () => finishGameplayGrab(state));
    states.push(state);
  }

  function updateActiveInteraction(state, kind, dt) {
    const interaction = state[`${kind}Interaction`];
    if (!interaction) return false;
    try {
      interaction.update?.({
        dt,
        controller: state.controller,
        inputSource: state.inputSource,
        handedness: state.handedness,
        context: state[`${kind}Context`],
        root: state[`${kind}Root`],
        target: interaction.target
      });
    } catch (error) {
      console.error(`${kind} interaction ${interaction.id} failed while updating`, error);
      finishInteraction(state, kind);
      return false;
    }

    state.pointer.visible = true;
    state.pointer.scale.z = state.grabDistance;
    state.pointer.material.color.setHex(kind === 'grab' ? COLOUR_GRAB : COLOUR_USE);
    state.highlight.material.color.setHex(kind === 'grab' ? COLOUR_GRAB : COLOUR_USE);
    state.highlight.box.setFromObject(interaction.target);
    state.highlight.visible = true;
    return true;
  }

  function updatePlacement(state, dt) {
    const root = state.placementGrabbed;
    if (!root) return false;

    const stick = thumbstick(state.inputSource);
    const rotate = deadzone(stick.x);
    const reach = deadzone(stick.y);
    state.grabDistance = THREE.MathUtils.clamp(
      state.grabDistance - reach * 2.2 * dt,
      0.65,
      maxGrabDistance
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

    state.pointer.visible = true;
    state.pointer.scale.z = state.grabDistance;
    state.pointer.material.color.setHex(COLOUR_DECOR);
    state.highlight.material.color.setHex(COLOUR_DECOR);
    state.highlight.box.setFromObject(root);
    state.highlight.visible = true;
    return true;
  }

  function showIdleTarget(state) {
    const pointing = controllerModes?.isPointing?.(state.handedness) ?? false;
    const decorationMode = controllerModes?.isDecorationMode?.() ?? false;
    const gripButton = state.inputSource?.gamepad?.buttons?.[1];
    const gripAiming = Boolean(gripButton?.touched || (gripButton?.value ?? 0) > 0.02);

    let result = null;
    let colour = COLOUR_USE;

    if (pointing) {
      result = findInteractionHit(state, useInteractions, 'useInteraction');
      colour = COLOUR_USE;
    } else if (gripAiming) {
      result = findInteractionHit(state, grabInteractions, 'grabInteraction');
      colour = COLOUR_GRAB;
    } else if (decorationMode) {
      result = findPlaceableHit(state);
      colour = COLOUR_DECOR;
    }

    state.pointer.visible = renderer.xr.isPresenting && (pointing || gripAiming || decorationMode);
    state.pointer.scale.z = result ? result.hit.distance : 6;
    state.pointer.material.color.setHex(colour);

    if (result?.highlightObject) {
      state.highlight.material.color.setHex(colour);
      state.highlight.box.setFromObject(result.highlightObject);
      state.highlight.visible = true;
    } else {
      state.highlight.visible = false;
    }
  }

  function update(dt) {
    for (const state of states) {
      const modeState = controllerModes?.getState?.(state.handedness);
      if (modeState?.secondaryPressed) beginPlacement(state);
      if (modeState?.secondaryReleased) finishPlacement(state);

      if (updateActiveInteraction(state, 'grab', dt)) continue;
      if (updateActiveInteraction(state, 'use', dt)) continue;
      if (updatePlacement(state, dt)) continue;
      showIdleTarget(state);
    }
  }

  function isHandBusy(handedness) {
    return states.some((state) =>
      (state.placementGrabbed || state.grabInteraction || state.useInteraction) &&
      state.handedness === handedness
    );
  }

  return {
    registerPlaceable,
    unregisterPlaceable,
    registerGrabInteraction,
    registerUseInteraction,
    clearSavedPlacement,
    savePlacement,
    update,
    isHandBusy,
    getPlaceables: () => [...placeables],
    getSavedPlacements: () => JSON.parse(JSON.stringify(saved))
  };
}
