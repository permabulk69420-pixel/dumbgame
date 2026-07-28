import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE, SCALE } from '../config.js?v=11';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { registerCombatTarget } from '../combat/combat-system.js?v=1';

const TARGET_MODEL_SIZE = 0.95;
const MAX_HEALTH = 100;
const MOVE_SPEED = 1.35;
const AGGRO_DISTANCE = 14;
const ATTACK_DISTANCE = 0.92;
const APARTMENT_FRONT_Z = -HOUSE.depth / 2;
const HALLWAY_STOP_Z = APARTMENT_FRONT_Z - 0.48;
const APARTMENT_DOOR_X = -HOUSE.width / 2 + 16 * SCALE;
const MODEL_FORWARD_YAW = Math.PI;

const playerPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const movement = new THREE.Vector3();
const modelBounds = new THREE.Box3();
const modelSize = new THREE.Vector3();
const corridorBounds = new THREE.Box3();

async function assetExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function findCamera(scene) {
  let camera = null;
  scene.traverse((object) => {
    if (!camera && object.isCamera) camera = object;
  });
  return camera;
}

function findClip(clips, keywords, fallbackIndex = -1) {
  const match = clips.find((clip) => {
    const name = clip.name.toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
  return match || clips[fallbackIndex] || null;
}

function buildAnimationSet(mixer, clips) {
  const clipMap = {
    idle: findClip(clips, ['idle', 'breath', 'stand'], 0),
    move: findClip(clips, ['walk', 'run', 'crawl', 'skitter', 'move'], 1),
    attack: findClip(clips, ['attack', 'bite', 'lunge', 'strike'], 2),
    hit: findClip(clips, ['hit', 'hurt', 'damage', 'impact'], 3),
    death: findClip(clips, ['death', 'die', 'dead'], 4)
  };

  return Object.fromEntries(Object.entries(clipMap).map(([key, clip]) => [
    key,
    clip ? mixer.clipAction(clip) : null
  ]));
}

function installDebugApi(enemy) {
  const install = () => {
    if (!window.game) return false;
    window.game.getSkitterEnemy = () => enemy;
    window.game.damageSkitter = (amount = 25) => enemy.damage(amount);
    window.game.respawnSkitter = () => enemy.respawn();
    window.game.getSkitterAnimations = () => [...enemy.animationNames];
    return true;
  };

  if (!install()) setTimeout(install, 0);
}

export async function loadSkitterEnemy({
  scene,
  floorY = 0,
  statusElement = null
}) {
  if (!await assetExists(ASSETS.skitterCreature)) {
    console.info(`Skitter enemy waiting for ${ASSETS.skitterCreature}`);
    return null;
  }

  const gltf = await loadGLB(ASSETS.skitterCreature);
  const visual = prepareModel(gltf.scene, { castShadow: false, receiveShadow: true });
  visual.name = 'SkitterEnemyVisual';
  visual.rotation.y = MODEL_FORWARD_YAW;

  modelBounds.setFromObject(visual);
  modelBounds.getSize(modelSize);
  const largestDimension = Math.max(modelSize.x, modelSize.y, modelSize.z, 0.001);
  visual.scale.multiplyScalar(TARGET_MODEL_SIZE / largestDimension);
  visual.updateMatrixWorld(true);
  modelBounds.setFromObject(visual);
  visual.position.y -= modelBounds.min.y;

  const root = new THREE.Group();
  root.name = 'SkitterEnemy';
  root.add(visual);
  scene.add(root);

  const corridor = scene.getObjectByName('Apartment_Corridor');
  if (corridor) {
    corridorBounds.setFromObject(corridor);
  } else {
    corridorBounds.min.set(-HOUSE.width * 1.5, floorY, APARTMENT_FRONT_Z - 3.5);
    corridorBounds.max.set(HOUSE.width * 1.5, floorY + HOUSE.wallHeight, APARTMENT_FRONT_Z);
  }

  const movementBounds = {
    minX: corridorBounds.min.x + 0.42,
    maxX: corridorBounds.max.x - 0.42,
    minZ: corridorBounds.min.z + 0.42,
    maxZ: HALLWAY_STOP_Z
  };
  const spawnPosition = new THREE.Vector3(
    movementBounds.maxX - 3.1,
    floorY,
    THREE.MathUtils.clamp((corridorBounds.min.z + corridorBounds.max.z) * 0.5,
      movementBounds.minZ, movementBounds.maxZ)
  );
  root.position.copy(spawnPosition);

  const camera = findCamera(scene);
  const mixer = new THREE.AnimationMixer(visual);
  const actions = buildAnimationSet(mixer, gltf.animations || []);
  const animationNames = (gltf.animations || []).map((clip) => clip.name);
  console.info('Skitter animations:', animationNames);

  let activeAction = null;
  let alerted = false;
  let dead = false;
  let hitLock = 0;
  let attackLock = 0;
  let attackCooldown = 0;

  function playAction(action, { once = false, fade = 0.16, force = false } = {}) {
    if (!action || (!force && action === activeAction)) return;
    const previous = activeAction;
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.clampWhenFinished = once;
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.play();
    if (previous && previous !== action) previous.fadeOut(fade);
    action.fadeIn(fade);
    activeAction = action;
  }

  function setStatus(text) {
    if (statusElement) statusElement.textContent = text;
  }

  const combatTarget = registerCombatTarget(root, {
    maxHealth: MAX_HEALTH,
    hitRadius: 0.48,
    hitOffset: [0, 0.32, 0],
    onDamage(event) {
      alerted = true;
      if (event.health > 0) {
        hitLock = actions.hit ? Math.min(0.5, actions.hit.getClip().duration * 0.8) : 0.16;
        playAction(actions.hit, { once: true, fade: 0.05, force: true });
        setStatus(`Skitter hit · ${Math.ceil(event.health)}/${event.maxHealth} health`);
      }
    },
    onDeath() {
      dead = true;
      hitLock = 0;
      attackLock = 0;
      playAction(actions.death, { once: true, fade: 0.08, force: true });
      setStatus('Skitter killed · hallway temporarily less horrible');
    }
  });

  function respawn() {
    combatTarget.reset();
    dead = false;
    alerted = false;
    hitLock = 0;
    attackLock = 0;
    attackCooldown = 0;
    root.visible = true;
    root.position.copy(spawnPosition);
    root.rotation.set(0, 0, 0);
    mixer.stopAllAction();
    activeAction = null;
    playAction(actions.idle || actions.move);
    setStatus('Skitter respawned in the dark end of the hallway');
    return root;
  }

  playAction(actions.idle || actions.move);

  const enemy = {
    root,
    visual,
    mixer,
    actions,
    animationNames,
    combatTarget,
    movementBounds,
    damage(amount = 25) {
      return combatTarget.damage(amount, { source: 'debug', cooldownMs: 0 });
    },
    respawn,
    isDead: () => dead,
    isAlerted: () => alerted,
    update(dt) {
      mixer.update(dt);
      if (dead || !camera) return;

      hitLock = Math.max(0, hitLock - dt);
      attackLock = Math.max(0, attackLock - dt);
      attackCooldown = Math.max(0, attackCooldown - dt);

      camera.getWorldPosition(playerPosition);
      playerPosition.y = floorY;
      const distanceToPlayer = root.position.distanceTo(playerPosition);
      if (!alerted && distanceToPlayer <= AGGRO_DISTANCE) alerted = true;

      if (!alerted) {
        playAction(actions.idle || actions.move);
        return;
      }

      const playerIsInHallway = playerPosition.z <= HALLWAY_STOP_Z &&
        playerPosition.x >= movementBounds.minX && playerPosition.x <= movementBounds.maxX;

      if (playerIsInHallway) {
        targetPosition.copy(playerPosition);
      } else {
        targetPosition.set(APARTMENT_DOOR_X, floorY, HALLWAY_STOP_Z - 0.12);
      }
      targetPosition.x = THREE.MathUtils.clamp(targetPosition.x,
        movementBounds.minX, movementBounds.maxX);
      targetPosition.z = THREE.MathUtils.clamp(targetPosition.z,
        movementBounds.minZ, movementBounds.maxZ);

      movement.copy(targetPosition).sub(root.position);
      movement.y = 0;
      const distance = movement.length();

      if (hitLock > 0 || attackLock > 0) return;

      if (playerIsInHallway && distance <= ATTACK_DISTANCE) {
        if (attackCooldown <= 0) {
          attackCooldown = 1.45;
          attackLock = actions.attack ? Math.min(0.85, actions.attack.getClip().duration) : 0.45;
          playAction(actions.attack || actions.idle, { once: true, fade: 0.08, force: true });
        } else {
          playAction(actions.idle || actions.move);
        }
        return;
      }

      if (distance > 0.08) {
        movement.normalize();
        root.position.addScaledVector(movement, Math.min(distance, MOVE_SPEED * dt));
        root.position.x = THREE.MathUtils.clamp(root.position.x,
          movementBounds.minX, movementBounds.maxX);
        root.position.z = THREE.MathUtils.clamp(root.position.z,
          movementBounds.minZ, movementBounds.maxZ);
        root.lookAt(targetPosition.x, root.position.y, targetPosition.z);
        playAction(actions.move || actions.idle);
      } else {
        playAction(actions.idle || actions.move);
      }
    },
    dispose() {
      combatTarget.dispose();
      mixer.stopAllAction();
      root.removeFromParent();
    }
  };

  installDebugApi(enemy);
  setStatus('Skitter loaded in the dark hallway · it cannot cross into the apartment');
  return enemy;
}
