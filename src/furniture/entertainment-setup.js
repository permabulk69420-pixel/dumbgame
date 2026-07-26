import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js?v=4';
import { loadGLB, prepareModel } from '../asset-loader.js';

const BUTTON_TRAVEL = 0.003;
const BUTTON_PRESS_SECONDS = 0.16;

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Entertainment setup is missing required node: ${name}`);
  return node;
}

function cloneMaterials(mesh) {
  const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const cloned = source.map((material) => material.clone());
  mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  return cloned;
}

function rememberMaterial(material) {
  return {
    material,
    color: material.color?.clone() || null,
    emissive: material.emissive?.clone() || null,
    emissiveIntensity: material.emissiveIntensity ?? 1
  };
}

function restoreMaterial(state) {
  const { material } = state;
  if (state.color && material.color) material.color.copy(state.color);
  if (state.emissive && material.emissive) material.emissive.copy(state.emissive);
  if ('emissiveIntensity' in material) material.emissiveIntensity = state.emissiveIntensity;
  material.needsUpdate = true;
}

function createTelevisionInteraction({ tvRoot, placement, statusElement }) {
  const assembly = requireNode(tvRoot, 'TV_Assembly');
  const screen = requireNode(tvRoot, 'Screen');
  const statusLight = requireNode(tvRoot, 'StatusLight');
  const buttonPivot = requireNode(tvRoot, 'PowerButtonPivot');
  const buttonPoint = requireNode(tvRoot, 'PowerButton_Point');

  const screenMaterials = cloneMaterials(screen);
  const lightMaterials = cloneMaterials(statusLight);
  const screenRest = screenMaterials.map(rememberMaterial);
  const lightRest = lightMaterials.map(rememberMaterial);
  const buttonRestZ = buttonPivot.position.z;

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.10, 0.08),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    })
  );
  hitbox.name = 'TV_PowerButton_Hitbox';
  hitbox.position.copy(buttonPoint.position);
  assembly.add(hitbox);

  let powered = false;
  let pressRemaining = 0;

  function applyPowerState() {
    if (powered) {
      for (const material of screenMaterials) {
        if (material.color) material.color.setHex(0x101b23);
        if (material.emissive) material.emissive.setHex(0x17445f);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 0.85;
        material.needsUpdate = true;
      }
      for (const material of lightMaterials) {
        if (material.color) material.color.setHex(0xbcefff);
        if (material.emissive) material.emissive.setHex(0x7ce6ff);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 4;
        material.needsUpdate = true;
      }
    } else {
      for (const state of screenRest) restoreMaterial(state);
      for (const state of lightRest) restoreMaterial(state);
    }
  }

  function setPowered(value) {
    powered = Boolean(value);
    applyPowerState();
    if (statusElement) {
      statusElement.textContent = powered
        ? 'TV powered on · screen source can be added later'
        : 'TV powered off';
    }
    return powered;
  }

  const unregisterUse = placement.registerUseInteraction(hitbox, {
    id: 'apartment-tv-power',
    label: 'TV power button',
    begin() {
      pressRemaining = BUTTON_PRESS_SECONDS;
      setPowered(!powered);
      return {};
    }
  });

  applyPowerState();

  return {
    update(dt) {
      pressRemaining = Math.max(0, pressRemaining - dt);
      if (pressRemaining > 0) {
        const progress = 1 - pressRemaining / BUTTON_PRESS_SECONDS;
        buttonPivot.position.z = buttonRestZ + Math.sin(progress * Math.PI) * BUTTON_TRAVEL;
      } else {
        buttonPivot.position.z = buttonRestZ;
      }
    },
    isPowered: () => powered,
    setPowered,
    toggle: () => setPowered(!powered),
    dispose() {
      unregisterUse();
      hitbox.removeFromParent();
      hitbox.geometry.dispose();
      hitbox.material.dispose();
      for (const material of [...screenMaterials, ...lightMaterials]) material.dispose();
    }
  };
}

export async function loadEntertainmentSetup({
  scene,
  placement,
  floorY,
  statusElement = null
}) {
  const [unitGltf, tvGltf] = await Promise.all([
    loadGLB(ASSETS.entertainmentUnit),
    loadGLB(ASSETS.apartmentTV)
  ]);

  const unit = prepareModel(unitGltf.scene, { castShadow: true, receiveShadow: true });
  const tv = prepareModel(tvGltf.scene, { castShadow: true, receiveShadow: true });
  unit.name = 'ApartmentEntertainmentUnit';
  tv.name = 'ApartmentFlatscreenTV';

  requireNode(unit, 'EntertainmentUnit_Assembly');
  const tvAnchor = requireNode(unit, 'TV_Placement_Anchor');
  requireNode(tv, 'TV_Assembly');

  tv.position.set(0, 0, 0);
  tv.rotation.set(0, 0, 0);
  tv.scale.set(1, 1, 1);
  tvAnchor.add(tv);

  // Against the living-room hall wall, opposite the couch. The cabinet and TV are
  // one decoration-mode placeable, so moving the unit keeps the TV correctly mounted.
  unit.position.set(0.98, floorY, -1.35);
  unit.rotation.y = -Math.PI * 0.5;
  scene.add(unit);

  const television = createTelevisionInteraction({
    tvRoot: tv,
    placement,
    statusElement
  });

  placement.registerPlaceable(unit, 'living-room-entertainment-setup', { floorY });

  if (statusElement) {
    statusElement.textContent =
      'TV and entertainment unit loaded · move them together with B/Y · point and trigger the power button';
  }

  return {
    root: unit,
    tv,
    television,
    update(dt) {
      television.update(dt);
    },
    dispose() {
      television.dispose();
      placement.unregisterPlaceable(unit);
      unit.removeFromParent();
    }
  };
}
