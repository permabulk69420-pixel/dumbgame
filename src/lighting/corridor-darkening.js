const DEFAULT_PROFILE = Object.freeze({
  centreX: 0,
  litHalfWidth: 8.2,
  fadeLength: 7.2,
  minimumLight: 0.055
});

function makeDarkenedMaterial(source, profile) {
  if (!source?.isMaterial) return source;
  if (!source.isMeshStandardMaterial && !source.isMeshPhysicalMaterial) return source;

  const material = source.clone();
  const previousCompile = source.onBeforeCompile;
  const previousCacheKey = source.customProgramCacheKey?.bind(source);

  material.name = `${source.name || source.type}_CorridorFalloff`;
  material.userData = {
    ...source.userData,
    corridorDistanceDarkening: { ...profile }
  };

  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.call(material, shader, renderer);

    shader.uniforms.uCorridorCentreX = { value: profile.centreX };
    shader.uniforms.uCorridorLitHalfWidth = { value: profile.litHalfWidth };
    shader.uniforms.uCorridorFadeLength = { value: profile.fadeLength };
    shader.uniforms.uCorridorMinimumLight = { value: profile.minimumLight };

    shader.vertexShader = `
      varying vec3 vCorridorWorldPosition;
    ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vCorridorWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    shader.fragmentShader = `
      uniform float uCorridorCentreX;
      uniform float uCorridorLitHalfWidth;
      uniform float uCorridorFadeLength;
      uniform float uCorridorMinimumLight;
      varying vec3 vCorridorWorldPosition;
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float corridorDistance = abs(vCorridorWorldPosition.x - uCorridorCentreX);
       float corridorFade = smoothstep(
         uCorridorLitHalfWidth,
         uCorridorLitHalfWidth + uCorridorFadeLength,
         corridorDistance
       );
       float corridorLightFactor = mix(1.0, uCorridorMinimumLight, corridorFade);
       outgoingLight *= corridorLightFactor;
       #include <opaque_fragment>`
    );
  };

  material.customProgramCacheKey = () =>
    `${previousCacheKey?.() || source.type}|corridor-distance-darkening-v1`;
  material.needsUpdate = true;
  return material;
}

export function applyCorridorDistanceDarkening(root, options = {}) {
  if (!root?.traverse) return [];

  const profile = {
    ...DEFAULT_PROFILE,
    ...options
  };
  const clones = new Map();
  const created = [];

  function cloneMaterial(source) {
    if (clones.has(source)) return clones.get(source);
    const clone = makeDarkenedMaterial(source, profile);
    clones.set(source, clone);
    if (clone !== source) created.push(clone);
    return clone;
  }

  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
    object.userData.corridorDistanceDarkened = true;
  });

  return created;
}

export const CORRIDOR_DARKENING_PROFILE = DEFAULT_PROFILE;
