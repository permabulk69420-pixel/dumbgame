import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const MINUTES_PER_DAY = 1440;
const MAX_ACTIVE_INTERIOR_LIGHTS = 3;
const INTERIOR_LIGHT_NIGHT_THRESHOLD = 0.08;
const SHADOW_REFRESH_MINUTES = 30;

export function createDayNightCycle({ scene, renderer, lights, houseRoot, gameState, camera = null }) {
  if (!scene || !renderer || !lights || !gameState) {
    throw new Error('createDayNightCycle requires scene, renderer, lights and gameState');
  }

  const indoorLights = [];
  houseRoot?.traverse((object) => {
    if (!object.isPointLight) return;
    object.userData.dayNightBaseIntensity ??= object.intensity;
    object.visible = false;
    indoorLights.push(object);
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
  const viewerPosition = new THREE.Vector3();
  const lightPosition = new THREE.Vector3();
  let accumulator = 0;
  let lastShadowBucket = -1;

  function updateInteriorLights(night) {
    const interiorFactor = 0.12 + night * 0.88;
    const shouldIlluminate = night > INTERIOR_LIGHT_NIGHT_THRESHOLD;
    const activeLights = new Set();

    if (shouldIlluminate && indoorLights.length) {
      if (camera) {
        camera.getWorldPosition(viewerPosition);
      } else {
        viewerPosition.set(0, 1.6, 0);
      }

      const nearest = indoorLights
        .map((light) => {
          light.getWorldPosition(lightPosition);
          return { light, distanceSq: lightPosition.distanceToSquared(viewerPosition) };
        })
        .sort((a, b) => a.distanceSq - b.distanceSq)
        .slice(0, MAX_ACTIVE_INTERIOR_LIGHTS);

      for (const entry of nearest) activeLights.add(entry.light);
    }

    for (const light of indoorLights) {
      const visible = activeLights.has(light);
      if (light.visible !== visible) light.visible = visible;
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
    updateInteriorLights(night);

    // The shadow map is frozen for Quest performance. Refresh occasionally as the
    // sun moves, plus whenever callers explicitly force an update after loading.
    const shadowBucket = Math.floor(minute / SHADOW_REFRESH_MINUTES);
    if (force || shadowBucket !== lastShadowBucket) {
      lastShadowBucket = shadowBucket;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function update(dt) {
    accumulator += dt;
    if (accumulator < 0.1) return;
    accumulator = 0;
    apply();
  }

  apply(true);
  return { update, apply, indoorLights };
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
