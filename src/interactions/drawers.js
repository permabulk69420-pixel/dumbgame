import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

export function createDrawerAnimations(root, clips = [], {
  gameState = null,
  storageId = 'computer-desk-drawers'
} = {}) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  const amounts = new Map();

  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    action.clampWhenFinished = true;
    action.weight = 0;
    actions.set(clip.name, action);
  }

  const restored = gameState?.read?.().eventData?.[storageId];
  if (restored && typeof restored === 'object') {
    for (const [nodeName, amount] of Object.entries(restored)) {
      setAmount(nodeName, amount);
    }
  }

  function setAmount(nodeName, amount) {
    const action = actions.get(`${nodeName}_Open`);
    if (!action) return false;

    const safeAmount = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
    amounts.set(nodeName, safeAmount);
    action.weight = 1;
    action.time = safeAmount;
    return true;
  }

  function getAmount(nodeName) {
    return amounts.get(nodeName) ?? 0;
  }

  function setAllAmount(amount) {
    const action = actions.get('All_Open');
    if (!action) return false;
    action.weight = 1;
    action.time = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
    return true;
  }

  function save() {
    if (!gameState?.setEventData) return;
    gameState.setEventData(storageId, Object.fromEntries(amounts));
  }

  function update(dt) {
    // Required even for paused actions being scrubbed manually.
    mixer.update(dt);
  }

  return {
    mixer,
    actions,
    setAmount,
    getAmount,
    setAllAmount,
    save,
    update
  };
}
