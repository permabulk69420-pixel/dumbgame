import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS, HOUSE, SCALE } from '../config.js?v=12';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { registerCombatTarget } from '../combat/combat-system.js?v=1';

const TARGET_MODEL_LENGTH = 0.95;
const MAX_HEALTH = 100;
const MOVE_SPEED = 1.35;
const AGGRO_DISTANCE = 14;
const ATTACK_DISTANCE = 0.92;
const APARTMENT_FRONT_Z = -HOUSE.depth / 2;
const HALLWAY_STOP_Z = APARTMENT_FRONT_Z - 0.48;
const APARTMENT_DOOR_X = -HOUSE.width / 2 + 16 * SCALE;

// The supplied creature's head and ATTACH_Face node point along local +Z.
// THREE.Object3D.lookAt points local -Z at its target, so the visual needs this half-turn.
const MODEL_FORWARD_YAW = Math.PI;

const playerPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const movement = new THREE.Vector3();
const modelBounds = new THREE.Box3();
const modelSize = new THREE.Vector3();
const originalModelSize = new THREE.Vector3();
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

function normaliseClipName(name = '') {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function findNamedClip(clips, exactName, fallbackKeywords = []) {
  const normalisedExact = normaliseClipName(exactName);
  return clips.find((clip) => normaliseClipName(clip.name) === normalisedExact) ||
    clips.find((clip) => {
      const name = normaliseClipName(clip.name);
      return fallbackKeywords.some((keyword) => name.includes(keyword));
    }) || null;
}

function makeLocomotionClipInPlace(clip) {
  if (!clip) return null;
  const inPlace = clip.clone();
  // The GLB includes a J_Root translation track in every clip. The game moves the
  // enemy's outer root itself, so retaining root motion in the looping Skitter clip
  // would make the mesh surge forward and snap backwards every half-second.
  inPlace.tracks = inPlace.tracks.filter((track) =>
    !/J_Root.*(?:position|translation)$/i.test(track.name));
  inPlace.resetDuration();
  return inPlace;
}

function buildAnimationSet(mixer, clips) {
  const idleClip = findNamedClip(clips, 'Idle', ['idle']);
  const moveClip = makeLocomotionClipInPlace(
    findNamedClip(clips, 'Skitter', ['skitter', 'crawl', 'walk', 'run', 'move'])
  );
  const alertClip = findNamedClip(clips, 'Alert', ['alert', 'notice', 'threat']);
  const attackClip = findNamedClip(clips, 'Attack_Lunge', ['attack', 'lunge', 'bite', 'strike']);
  const deathClip = findNamedClip(clips, 'Death', ['death', 'die', 'dead']);

  return {
    idle: idleClip ? mixer.clipAction(idleClip) : null,
    move: moveClip ? mixer.clipAction(moveClip) : null,
    alert: alertClip ? mixer.clipAction(alertClip) : null,
    attack: attackClip ? mixer.clipAction(attackClip) : null,
    death: deathClip ? mixer.clipAction(deathClip) : null
  };
}

function installDebugApi(enemy) {
  const install = () => {
    if (!window.game) return false;
    window.game.getSkitterEnemy = () => enemy;
    window.game.damageSkitter = (amount = 25) => enemy.damage(amount);
    window.game.respawnSkitter = () => enemy.respawn();
    window.game.getSkitterAnimations = () => [...enemy.animationNames];
    window.game.alertSkitter = () => enemy.alert();
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
  modelBounds.getSize(originalModelSize);
  const originalLength = Math.max(originalModelSize.x, originalModelSize.y, originalModelSize.z, 0.001);
  visual.scale.multiplyScalar(TARGET_MODEL_LENGTH / originalLength);
  visual.updateMatrixWorld(true);
  modelBounds.setFromObject(visual);
  visual.position.y -= modelBounds.min.y;
  visual.updateMatrixWorld(true);
  modelBounds.setFromObject(visual);
  modelBounds.getSize(modelSize);

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
  const animationNames = (gltf.animations || []).map((clip) => clip.name);
  const actions = buildAnimationSet(mixer, gltf.animations || []);
  const faceAttach = visual.getObjectByName('ATTACH_Face') || null;
  const mouthAttach = visual.getObjectByName('ATTACH_Mouth') || null;

  console.info('Skitter GLB inspected', {
    animationNames,
    originalSizeMetres: originalModelSize.toArray(),
    runtimeSizeMetres: modelSize.toArray(),
    forwardAxis: '+Z',
    faceAttach: faceAttach?.name || null,
    mouthAttach: mouthAttach?.name || null
  });

  let activeAction = null;
  let alerted = false;
  let dead = false;
  let reactionLock = 0;
  let alertLock = 0;
  let attackLock = 0;
  let attackCooldown = 0;

  function playAction(action, {
    once = false,
    fade = 0.16,
    force = false,
    timeScale = 1
  } = {}) {
    if (!action || (!force && action === activeAction)) return;
    const previous = activeAction;
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(timeScale);
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

  function alert({ announce = true } = {}) {
    if (dead || alerted) return false;
    alerted = true;
    if (actions.alert) {
      alertLock = Math.min(1.2, actions.alert.getClip().duration);
      playAction(actions.alert, { once: true, fade: 0.08, force: true });
    }
    if (announce) setStatus('The skitter noticed you · it is staying in the hallway');
    return true;
  }

  const combatTarget = registerCombatTarget(root, {
    maxHealth: MAX_HEALTH,
    hitRadius: 0.48,
    hitOffset: [0, 0.32, 0],
    onDamage(event) {
      if (!alerted) alert({ announce: false });
      if (event.health > 0) {
        // This GLB has no dedicated hurt clip. Alert is the closest readable recoil,
        // played fast and briefly so bullets do not freeze it for the full 1.2 seconds.
        reactionLock = actions.alert ? 0.28 : 0.12;
        if (actions.alert) {
          playAction(actions.alert, {
            once: true,
            fade: 0.04,
            force: true,
            timeScale: 2.2
          });
        }
        setStatus(`Skitter hit · ${Math.ceil(event.health)}/${event.maxHealth} health`);
      }
    },
    onDeath() {
      dead = true;
      reactionLock = 0;
      alertLock = 0;
      attackLock = 0;
      playAction(actions.death, { once: true, fade: 0.08, force: true });
      setStatus('Skitter killed · hallway temporarily less horrible');
    }
  });

  function respawn() {
    combatTarget.reset();
    dead = false;
    alerted = false;
    reactionLock = 0;
    alertLock = 0;
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
    faceAttach,
    mouthAttach,
    modelSize: modelSize.clone(),
    combatTarget,
    movementBounds,
    damage(amount = 25) {
      return combatTarget.damage(amount, { source: 'debug', cooldownMs: 0 });
    },
    alert,
    respawn,
    isDead: () => dead,
    isAlerted: () => alerted,
    update(dt) {
      mixer.update(dt);
      if (dead || !camera) return;

      reactionLock = Math.max(0, reactionLock - dt);
      alertLock = Math.max(0, alertLock - dt);
      attackLock = Math.max(0, attackLock - dt);
      attackCooldown = Math.max(0, attackCooldown - dt);

      camera.getWorldPosition(playerPosition);
      playerPosition.y = floorY;
      const distanceToPlayer = root.position.distanceTo(playerPosition);
      if (!alerted && distanceToPlayer <= AGGRO_DISTANCE) alert();

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

      if (reactionLock > 0 || alertLock > 0 || attackLock > 0) return;

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

  root.userData.enemy = enemy;
  installDebugApi(enemy);
  setStatus('Skitter loaded in the dark hallway · it cannot cross into the apartment');
  return enemy;
}
