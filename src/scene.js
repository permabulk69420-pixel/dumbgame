import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/webxr/VRButton.js/+esm';

export function createWorld(app) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa4bac3);
  scene.fog = new THREE.Fog(0xa4bac3, 42, 95);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 160);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  app.appendChild(renderer.domElement);

  const vrButton = VRButton.createButton(renderer, {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['bounded-floor']
  });
  app.appendChild(vrButton);

  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const hemisphere = new THREE.HemisphereLight(0xf6fafb, 0x66584b, 1.55);
  hemisphere.name = 'World_HemisphereLight';
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffefd8, 2.65);
  sun.name = 'World_Sun';
  sun.position.set(12, 21, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 65;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x91adc1, 0.52);
  fill.name = 'World_FillLight';
  fill.position.set(-14, 9, -15);
  scene.add(fill);

  const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
  const grips = [renderer.xr.getControllerGrip(0), renderer.xr.getControllerGrip(1)];
  for (const controller of controllers) rig.add(controller);
  for (const grip of grips) rig.add(grip);

  function resize() {
    const width = Math.max(1, app.clientWidth);
    const height = Math.max(1, app.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(app);
  resize();

  return {
    scene,
    camera,
    renderer,
    rig,
    controllers,
    grips,
    lights: { hemisphere, sun, fill },
    dispose: () => observer.disconnect()
  };
}
