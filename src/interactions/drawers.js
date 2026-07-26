import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

export function createDrawerAnimations(root, clips = []) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();

  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    action.clampWhenFinished = true;
    action.weight = 1;
    actions.set(clip.name, action);
  }

  function setAmount(nodeName, amount) {
    const action = actions.get(`${nodeName}_Open`);
    if (!action) return false;
    action.time = THREE.MathUtils.clamp(amount, 0, 1);
    return true;
  }

  function update(dt) {
    // Required even for paused actions being scrubbed manually.
    mixer.update(dt);
  }

  return { mixer, actions, setAmount, update };
}
