import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';

const CEILING_LIGHT_URL = './assets/models/architecture/Basic_Apartment_Ceiling_Light.glb?v=1';
const LEGACY_RADIUS = 0.09;
const LEGACY_HEIGHT = 0.025;
const LEGACY_CENTRE_BELOW_CEILING = 0.06;
const LEGACY_LIGHT_BELOW_CEILING = 0.18;
const ON_EMISSIVE = new THREE.Color(0xffedc8);
const OFF_EMISSIVE = new THREE.Color(0x000000);

const tempWorldPosition = new THREE.Vector3();
const tempLocalPosition = new THREE.Vector3();

function approximately(value, target, tolerance = 0.002) {
  return Math.abs((value ?? Number.NaN) - target) <= tolerance;
}

function isLegacyDownlight(mesh) {
  if (!mesh?.isMesh || mesh.geometry?.type !== 'CylinderGeometry') return false;
  const parameters = mesh.geometry.parameters || {};
  return approximately(parameters.radiusTop, LEGACY_RADIUS)
    && approximately(parameters.radiusBottom, LEGACY_RADIUS)
    && approximately(parameters.height, LEGACY_HEIGHT);
}

function cloneFixture(source) {
  const fixture = prepareModel(source.clone(true), {
    castShadow: false,
    receiveShadow: true
  });

  fixture.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });

  return fixture;
}

function materialList(object) {
  if (!object?.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
}

function findNearestLegacyFixture(light, fixtures) {
  light.getWorldPosition(tempWorldPosition);
  let best = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (const fixture of fixtures) {
    fixture.getWorldPosition(tempLocalPosition);
    const dx = tempWorldPosition.x - tempLocalPosition.x;
    const dz = tempWorldPosition.z - tempLocalPosition.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= bestDistanceSq) continue;
    best = fixture;
    bestDistanceSq = distanceSq;
  }

  return bestDistanceSq <= 0.04 ? best : null;
}

function disposeFixtureMaterials(root) {
  root?.traverse?.((object) => {
    if (!object.isMesh) return;
    for (const material of materialList(object)) material.dispose();
  });
}

function syncDiffuser(entry, force = false) {
  const { light, diffuserMaterials } = entry;
  const baseIntensity = Math.max(0.001, light.userData.dayNightBaseIntensity || light.intensity || 1);
  const output = THREE.MathUtils.clamp(light.intensity / baseIntensity, 0, 1);
  const enabled = light.visible && light.intensity > 0.001;
  const emissiveIntensity = enabled ? 0.72 + output * 1.18 : 0;
  const stateKey = `${enabled ? 1 : 0}:${emissiveIntensity.toFixed(3)}`;
  if (!force && stateKey === entry.stateKey) return;
  entry.stateKey = stateKey;

  for (const material of diffuserMaterials) {
    if (!material.emissive) continue;
    material.emissive.copy(enabled ? ON_EMISSIVE : OFF_EMISSIVE);
    material.emissiveIntensity = emissiveIntensity;
    material.needsUpdate = true;
  }
}

export async function loadApartmentCeilingLights({
  scene,
  statusElement = null
}) {
  const apartment = scene?.getObjectByName('Apartment');
  if (!apartment) throw new Error('Apartment root was not found for ceiling-light replacement');

  const pointLights = [];
  const legacyFixtures = [];
  apartment.traverse((object) => {
    if (object.isPointLight) pointLights.push(object);
    if (isLegacyDownlight(object)) legacyFixtures.push(object);
  });

  if (!pointLights.length) throw new Error('No apartment PointLights were found to attach to ceiling fixtures');

  const gltf = await loadGLB(CEILING_LIGHT_URL);
  const source = gltf.scene;
  if (!source.getObjectByName('CeilingLight')) {
    throw new Error('Ceiling light GLB is missing the CeilingLight root node');
  }
  if (!source.getObjectByName('Light_Origin')) {
    throw new Error('Ceiling light GLB is missing the Light_Origin locator');
  }
  if (!source.getObjectByName('Light_Diffuser')) {
    throw new Error('Ceiling light GLB is missing the Light_Diffuser node');
  }

  apartment.updateMatrixWorld(true);
  const remainingFixtures = new Set(legacyFixtures);
  const entries = [];

  for (let index = 0; index < pointLights.length; index += 1) {
    const light = pointLights[index];
    const legacyFixture = findNearestLegacyFixture(light, remainingFixtures);
    const fixture = cloneFixture(source);
    const zoneId = light.userData.lightZoneId || `common-${index + 1}`;
    fixture.name = `ApartmentCeilingLight_${zoneId}_${index + 1}`;

    if (legacyFixture) {
      legacyFixture.getWorldPosition(tempWorldPosition);
      tempWorldPosition.y += LEGACY_CENTRE_BELOW_CEILING;
      remainingFixtures.delete(legacyFixture);
    } else {
      light.getWorldPosition(tempWorldPosition);
      tempWorldPosition.y += LEGACY_LIGHT_BELOW_CEILING;
    }

    tempLocalPosition.copy(tempWorldPosition);
    apartment.worldToLocal(tempLocalPosition);
    fixture.position.copy(tempLocalPosition);
    fixture.rotation.set(0, 0, 0);
    fixture.scale.set(1, 1, 1);
    apartment.add(fixture);
    fixture.updateMatrixWorld(true);

    const lightOrigin = fixture.getObjectByName('Light_Origin');
    const diffuser = fixture.getObjectByName('Light_Diffuser');
    const diffuserMaterials = materialList(diffuser);

    lightOrigin.add(light);
    light.position.set(0, 0, 0);
    light.rotation.set(0, 0, 0);
    light.castShadow = false;

    if (legacyFixture) {
      legacyFixture.removeFromParent();
      legacyFixture.geometry?.dispose?.();
    }

    const entry = {
      fixture,
      light,
      diffuserMaterials,
      stateKey: ''
    };
    entries.push(entry);
    syncDiffuser(entry, true);
  }

  if (statusElement) {
    statusElement.textContent = `${entries.length} apartment ceiling-light fixtures loaded`;
  }

  return {
    roots: entries.map((entry) => entry.fixture),
    lights: entries.map((entry) => entry.light),
    update() {
      for (const entry of entries) syncDiffuser(entry);
    },
    dispose() {
      for (const entry of entries) {
        apartment.attach(entry.light);
        disposeFixtureMaterials(entry.fixture);
        entry.fixture.removeFromParent();
      }
    }
  };
}
