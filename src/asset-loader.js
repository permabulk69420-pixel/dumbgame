import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js/+esm';

const loader = new GLTFLoader();

export async function loadGLB(url) {
  return loader.loadAsync(url);
}

export function prepareModel(root, { castShadow = true, receiveShadow = true } = {}) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
  return root;
}
