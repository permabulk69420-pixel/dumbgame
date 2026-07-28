import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const targets = new Set();
const raycaster = new THREE.Raycaster();
const rayDirection = new THREE.Vector3();
const targetBox = new THREE.Box3();
const targetSphere = new THREE.Sphere();
const sweepLine = new THREE.Line3();
const closestPoint = new THREE.Vector3();

function getTargetSphere(target) {
  if (Number.isFinite(target.hitRadius) && target.hitRadius > 0) {
    target.root.getWorldPosition(targetSphere.center);
    targetSphere.center.add(target.hitOffset);
    targetSphere.radius = target.hitRadius;
    return targetSphere;
  }

  targetBox.setFromObject(target.root);
  if (targetBox.isEmpty()) return null;
  targetBox.getBoundingSphere(targetSphere);
  return targetSphere;
}

function applyDamage(target, amount, hit = {}) {
  if (!target || target.dead || !Number.isFinite(amount) || amount <= 0) return null;

  const now = performance.now();
  const source = hit.source || 'unknown';
  const cooldown = Math.max(0, hit.cooldownMs ?? 0);
  const previousHit = target.lastHits.get(source) ?? -Infinity;
  if (now - previousHit < cooldown) return null;
  target.lastHits.set(source, now);

  target.health = Math.max(0, target.health - amount);
  const event = {
    ...hit,
    amount,
    health: target.health,
    maxHealth: target.maxHealth,
    target: target.root
  };

  target.onDamage?.(event);
  if (target.health <= 0 && !target.dead) {
    target.dead = true;
    target.onDeath?.(event);
  }
  return event;
}

export function registerCombatTarget(root, {
  maxHealth = 100,
  hitRadius = null,
  hitOffset = [0, 0.25, 0],
  onDamage = null,
  onDeath = null
} = {}) {
  if (!root) throw new Error('Combat target requires a Three.js root object.');

  const target = {
    root,
    maxHealth,
    health: maxHealth,
    hitRadius,
    hitOffset: new THREE.Vector3().fromArray(hitOffset),
    onDamage,
    onDeath,
    dead: false,
    lastHits: new Map()
  };
  targets.add(target);
  root.userData.combatTarget = target;

  return {
    get health() { return target.health; },
    get maxHealth() { return target.maxHealth; },
    isDead: () => target.dead,
    damage: (amount, hit) => applyDamage(target, amount, hit),
    reset() {
      target.health = target.maxHealth;
      target.dead = false;
      target.lastHits.clear();
    },
    dispose() {
      targets.delete(target);
      if (root.userData.combatTarget === target) delete root.userData.combatTarget;
    }
  };
}

export function fireHitscan({
  origin,
  direction,
  damage = 34,
  maxDistance = 45,
  source = 'pistol'
}) {
  if (!origin || !direction) return null;

  rayDirection.copy(direction).normalize();
  raycaster.set(origin, rayDirection);
  raycaster.near = 0.025;
  raycaster.far = maxDistance;

  let nearest = null;
  for (const target of targets) {
    if (target.dead || !target.root.visible) continue;
    const intersections = raycaster.intersectObject(target.root, true);
    const hit = intersections[0];
    if (!hit || (nearest && hit.distance >= nearest.hit.distance)) continue;
    nearest = { target, hit };
  }

  if (!nearest) return null;
  const event = applyDamage(nearest.target, damage, {
    source,
    cooldownMs: 70,
    point: nearest.hit.point.clone(),
    normal: nearest.hit.face?.normal?.clone() || null,
    distance: nearest.hit.distance
  });
  return event ? { ...event, object: nearest.hit.object } : null;
}

export function sweepCombatSphere({
  start,
  end,
  radius = 0.09,
  damage = 30,
  source = 'melee',
  cooldownMs = 320,
  minimumTargetRadius = 0.18
}) {
  if (!start || !end) return null;

  sweepLine.start.copy(start);
  sweepLine.end.copy(end);
  let nearest = null;

  for (const target of targets) {
    if (target.dead || !target.root.visible) continue;
    const sphere = getTargetSphere(target);
    if (!sphere) continue;
    sweepLine.closestPointToPoint(sphere.center, true, closestPoint);
    const distance = closestPoint.distanceTo(sphere.center);
    const combinedRadius = radius + Math.max(minimumTargetRadius, sphere.radius * 0.72);
    if (distance > combinedRadius) continue;
    const travelDistance = sweepLine.start.distanceTo(closestPoint);
    if (!nearest || travelDistance < nearest.travelDistance) {
      nearest = {
        target,
        travelDistance,
        point: closestPoint.clone(),
        distance
      };
    }
  }

  if (!nearest) return null;
  return applyDamage(nearest.target, damage, {
    source,
    cooldownMs,
    point: nearest.point,
    distance: nearest.distance
  });
}

export function getCombatTargetCount() {
  return targets.size;
}
