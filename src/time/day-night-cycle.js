import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { LIGHT_ZONES } from '../lighting/light-zones.js?v=1';

const MINUTES_PER_DAY = 1440;
const SHADOW_REFRESH_MINUTES = 30;
const LIGHT_FLAG_PREFIX = 'room-light:';

export function createDayNightCycle({ scene, renderer, lights, houseRoot, gameState }) {
  if (!scene || !renderer || !lights || !gameState) {
    throw new Error('createDayNightCycle requires scene, renderer, lights and gameState');
  }

  const zoneLights = new Map();
  const commonLights = [];
  let pointLightIndex = 0;

  houseRoot?.traverse((object) => {
    if (!object.isPointLight) return;
    object.userData.dayNightBaseIntensity ??= object.intensity;
    object.visible = false;

    const zone = LIGHT_ZONES[pointLightIndex] || null;
    pointLightIndex += 1;
    if (zone) {
      object.userData.lightZoneId = zone.id;
      zoneLights.set(zone.id, object);
    } else {
      object.userData.lightZoneId = 'common-area';
      commonLights.push(object);
    }
  });

  const skyKeys = makeColourKeys([
    [0, 0x07111e],
    [300, 0x101b2d],
    [360, 0xb46f63],
    [450, 0x93afbe],
    [720, 0xa4bac3],
    [1020, 0x9cb3bf],
    [1110, 0xc47a68],
    [1200, 0x23314b],
    [1320, 0x0b1628],
    [1440, 0x07111e]
  ]);
  const fogKeys = makeColourKeys([
    [0, 0x09121e],
    [360, 0x6c5554],
    [480, 0xa4bac3],
    [1020, 0x9eb4be],
    [1140, 0x75545a],
    [1260, 0x111b2c],
    [1440, 0x09121e]
  ]);

  const skyColour = new THREE.Color();
  const fogColour = new THREE.Color();
  const warmSun = new THREE.Color(0xffd6a3);
  const whiteSun = new THREE.Color(0xffefd8);
  const coolMoon = new THREE.Color(0x91aede);
  const dayFill = new THREE.Color(0x91adc1);
  let accumulator = 0;
  let lastShadowBucket = -1;

  function flagName(zoneId) {
    return `${LIGHT_FLAG_PREFIX}${zoneId}`;
  }

  function isLightZoneEnabled(zoneId, snapshot = gameState.read()) {
    const zone = LIGHT_ZONES.find((entry) => entry.id === zoneId);
    if (!zone) return false;
    const stored = snapshot.flags?.[flagName(zoneId)];
    return typeof stored === 'boolean' ? stored : zone.defaultOn;
  }

  function updateInteriorLights(night, snapshot) {
    const interiorFactor = 0.34 + night * 0.66;

    for (const zone of LIGHT_ZONES) {
      const light = zoneLights.get(zone.id);
      if (!light) continue;
      const enabled = isLightZoneEnabled(zone.id, snapshot);
      light.visible = enabled;
      light.intensity = light.userData.dayNightBaseIntensity * interiorFactor;
    }

    for (const light of commonLights) {
      light.visible = true;
      light.intensity = light.userData.dayNightBaseIntensity * interiorFactor;
    }
  }

  function apply(force = false) {
    const state = gameState.read();
    const minute = state.minuteOfDay;
    const dayFraction = minute / MINUTES_PER_DAY;
    const solarAngle = dayFraction * Math.PI * 2 - Math.PI / 2;
    const solarHeight = Math.sin(solarAngle);
    const daylight = THREE.MathUtils.smoothstep(solarHeight, -0.08, 0.18);
    const night = 1 - THREE.MathUtils.smoothstep(solarHeight, -0.18, 0.12);
    const sunriseSunset = 1 - Math.min(1, Math.abs(solarHeight) * 4.2);

    const orbit = dayFraction * Math.PI * 2 + 0.45;
    lights.sun.position.set(
      Math.cos(orbit) * 28,
      solarHeight * 30,
      Math.sin(orbit) * 22
    );
    lights.sun.intensity = 2.65 * daylight;
    lights.sun.visible = daylight > 0.01;
    lights.sun.color.copy(whiteSun).lerp(warmSun, sunriseSunset * 0.72);

    lights.hemisphere.intensity = 0.16 + daylight * 1.39;
    lights.hemisphere.color.setHex(daylight > 0.12 ? 0xf6fafb : 0x7f96bf);
    lights.hemisphere.groundColor.setHex(daylight > 0.12 ? 0x66584b : 0x121521);

    lights.fill.intensity = 0.16 + daylight * 0.36 + night * 0.18;
    lights.fill.color.copy(coolMoon).lerp(dayFill, daylight);

    sampleColour(minute, skyKeys, skyColour);
    sampleColour(minute, fogKeys, fogColour);
    scene.background.copy(skyColour);
    if (scene.fog) {
      scene.fog.color.copy(fogColour);
      scene.fog.near = 38 + daylight * 4;
      scene.fog.far = 82 + daylight * 13;
    }

    renderer.toneMappingExposure = 0.7 + daylight * 0.38;
    updateInteriorLights(night, state);

    const shadowBucket = Math.floor(minute / SHADOW_REFRESH_MINUTES);
    if (force || shadowBucket !== lastShadowBucket) {
      lastShadowBucket = shadowBucket;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function setLightZoneEnabled(zoneId, enabled) {
    if (!zoneLights.has(zoneId)) return false;
    gameState.setFlag(flagName(zoneId), Boolean(enabled));
    apply();
    return Boolean(enabled);
  }

  function toggleLightZone(zoneId) {
    return setLightZoneEnabled(zoneId, !isLightZoneEnabled(zoneId));
  }

  function update(dt) {
    accumulator += dt;
    if (accumulator < 0.1) return;
    accumulator = 0;
    apply();
  }

  apply(true);
  return {
    update,
    apply,
    indoorLights: [...zoneLights.values(), ...commonLights],
    lightZones: LIGHT_ZONES,
    isLightZoneEnabled,
    setLightZoneEnabled,
    toggleLightZone
  };
}

function makeColourKeys(entries) {
  return entries.map(([minute, colour]) => ({ minute, colour: new THREE.Color(colour) }));
}

function sampleColour(minute, keys, target) {
  const wrapped = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  let rightIndex = keys.findIndex((key) => key.minute >= wrapped);
  if (rightIndex <= 0) rightIndex = 1;
  const left = keys[rightIndex - 1];
  const right = keys[rightIndex];
  const span = Math.max(1, right.minute - left.minute);
  target.copy(left.colour).lerp(right.colour, (wrapped - left.minute) / span);
  return target;
}
