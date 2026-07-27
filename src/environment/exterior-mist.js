import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from '../config.js?v=10';

const MIST_SHELLS = Object.freeze([
  { distance: 5, opacity: 0.075, phase: 0.0 },
  { distance: 8, opacity: 0.19, phase: 3.7 },
  { distance: 10, opacity: 0.86, phase: 8.2 }
]);

const CLOUD_LAYERS = Object.freeze([
  { y: -3.5, opacity: 0.16, phase: 2.1 },
  { y: -6.5, opacity: 0.34, phase: 6.4 },
  { y: -9.5, opacity: 0.9, phase: 10.8 }
]);

const mutedMistColour = new THREE.Color(0x87969d);

function makeMistMaterial({ opacity, phase, side = THREE.BackSide }) {
  return new THREE.ShaderMaterial({
    name: 'Exterior_Mist_Material',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side,
    fog: false,
    toneMapped: false,
    uniforms: {
      uColour: { value: new THREE.Color(0xa4bac3) },
      uOpacity: { value: opacity },
      uPhase: { value: phase },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColour;
      uniform float uOpacity;
      uniform float uPhase;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + 7.17;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 drift = vec2(uTime * 0.012, -uTime * 0.006);
        vec2 worldPattern = vWorldPosition.xz * 0.075 + drift + uPhase;
        vec2 facePattern = vUv * 7.0 - drift * 0.7 + uPhase * 0.31;
        float broad = fbm(worldPattern);
        float wisps = fbm(facePattern);
        float density = clamp(broad * 0.62 + wisps * 0.38, 0.0, 1.0);
        float alpha = uOpacity * mix(0.72, 1.08, density);
        gl_FragColor = vec4(uColour, clamp(alpha, 0.0, 0.98));
      }
    `
  });
}

function disposeObject(root, { disposeMaterials = true } = {}) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) geometries.add(object.geometry);
    if (!disposeMaterials) return;
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) {
      if (material) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function removeOldCity(scene) {
  const city = scene.getObjectByName('LowPoly_City_View');
  if (!city) return false;
  city.removeFromParent();
  // City meshes reuse the apartment's shared material instances. Disposing only their
  // geometry removes the old view without invalidating the walls, floors, or trim.
  disposeObject(city, { disposeMaterials: false });
  return true;
}

export function createExteriorMist({ scene }) {
  if (!scene) throw new Error('createExteriorMist requires a scene');

  removeOldCity(scene);

  // Three.js scene fog affects every object, including the apartment interior. The mist
  // below is real geometry outside the apartment, so rooms remain completely clear.
  scene.fog = null;

  const root = new THREE.Group();
  root.name = 'Localised_Exterior_Mist';
  scene.add(root);

  const materials = [];
  const shellHeight = 42;

  for (let index = 0; index < MIST_SHELLS.length; index++) {
    const layer = MIST_SHELLS[index];
    const material = makeMistMaterial(layer);
    const geometry = new THREE.BoxGeometry(
      HOUSE.width + layer.distance * 2,
      shellHeight,
      HOUSE.depth + layer.distance * 2
    );
    const shell = new THREE.Mesh(geometry, material);
    shell.name = `Exterior_Mist_Shell_${layer.distance}m`;
    shell.position.y = -5;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.frustumCulled = false;
    shell.renderOrder = 20 + index;
    root.add(shell);
    materials.push(material);
  }

  const cloudSize = Math.max(HOUSE.width, HOUSE.depth) + 44;
  for (let index = 0; index < CLOUD_LAYERS.length; index++) {
    const layer = CLOUD_LAYERS[index];
    const material = makeMistMaterial({ ...layer, side: THREE.DoubleSide });
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(cloudSize, cloudSize), material);
    cloud.name = `Exterior_Cloud_Floor_${Math.abs(layer.y)}m`;
    cloud.rotation.x = -Math.PI / 2;
    cloud.position.y = layer.y;
    cloud.castShadow = false;
    cloud.receiveShadow = false;
    cloud.frustumCulled = false;
    cloud.renderOrder = 23 + index;
    root.add(cloud);
    materials.push(material);
  }

  const colour = new THREE.Color();
  let elapsed = 0;

  function update(dt) {
    elapsed += Math.max(0, dt || 0);
    if (scene.background?.isColor) colour.copy(scene.background);
    else colour.setHex(0x8fa3ad);

    // Slightly mute the sky colour so it reads as dense moisture rather than a flat skybox.
    colour.lerp(mutedMistColour, 0.12);
    for (const material of materials) {
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uColour.value.copy(colour);
    }
  }

  update(0);

  return {
    root,
    visibilityDistance: 10,
    update,
    dispose() {
      root.removeFromParent();
      disposeObject(root);
    }
  };
}
