import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js';
import { loadGLB, prepareModel } from '../asset-loader.js';

const SLIDE_REST_Z = -0.004;
const SLIDE_REAR_Z = 0.026;
const PISTOL_GRIP_ROLL = Math.PI;
const TRIGGER_TRAVEL = THREE.MathUtils.degToRad(18);
const MAG_RELEASE_TRAVEL = 0.0025;
const MAG_SEATED_POSITION = Object.freeze([0, 0.079, 0.0395]);
const MAG_INSERT_DISTANCE = 0.115;
const GRAVITY = 7.5;
const FIRE_TRIGGER_THRESHOLD = 0.76;
const FIRE_TRIGGER_RESET = 0.18;
const FIRE_COOLDOWN = 0.11;
const MUZZLE_FLASH_DURATION = 0.045;
const MUZZLE_LIGHT_INTENSITY = 180;

const tempPosition = new THREE.Vector3();
const tempPositionB = new THREE.Vector3();
const tempMatrix = new THREE.Matrix4();

function relativeMatrix(root, locator) {
  root.updateWorldMatrix(true, true);
  locator.updateWorldMatrix(true, false);
  return new THREE.Matrix4()
    .copy(root.matrixWorld)
    .invert()
    .multiply(locator.matrixWorld);
}

function attachLocatorToGrip(root, locatorMatrix, grip) {
  // Make the exported locator coincide with the WebXR grip origin.
  grip.add(root);
  tempMatrix.copy(locatorMatrix).invert();
  tempMatrix.decompose(root.position, root.quaternion, root.scale);
  root.updateMatrixWorld(true);
}

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Pistol GLB is missing required node: ${name}`);
  return node;
}

function settleOnFloor(root, floorY, velocity, dt, bounds) {
  velocity.y -= GRAVITY * dt;
  root.position.addScaledVector(velocity, dt);
  root.updateWorldMatrix(true, true);
  bounds.setFromObject(root);

  if (bounds.min.y <= floorY) {
    root.position.y += floorY - bounds.min.y;
    velocity.set(0, 0, 0);
    root.updateMatrixWorld(true);
    return true;
  }
  return false;
}

function pulseHand(controllerModes, handedness, strength = 0.58, duration = 52) {
  const gamepad = controllerModes?.getState?.(handedness)?.inputSource?.gamepad;
  const actuator = gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator;
  try {
    if (actuator?.pulse) {
      const result = actuator.pulse(strength, duration);
      result?.catch?.(() => {});
    } else if (actuator?.playEffect) {
      const result = actuator.playEffect('dual-rumble', {
        duration,
        strongMagnitude: strength,
        weakMagnitude: strength * 0.62
      });
      result?.catch?.(() => {});
    }
  } catch {
    // Firing still works on runtimes without controller haptics.
  }
}

function createMuzzleFlash(muzzlePoint) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffc56b,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  const flash = new THREE.Group();
  flash.name = 'Runtime_MuzzleFlash';
  flash.position.z = -0.035;
  flash.visible = false;

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), material);
  core.scale.set(0.72, 0.72, 2.5);
  flash.add(core);

  const flareA = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.048), material.clone());
  flareA.rotation.z = Math.PI * 0.25;
  flash.add(flareA);

  const flareB = flareA.clone();
  flareB.rotation.y = Math.PI * 0.5;
  flareB.rotation.z = -Math.PI * 0.22;
  flash.add(flareB);

  const light = new THREE.PointLight(0xffad55, 0, 3.2, 2);
  light.name = 'Runtime_MuzzleLight';
  light.position.set(0, 0, -0.025);
  light.castShadow = false;

  muzzlePoint.add(flash, light);
  return { flash, light };
}

function createGunshotAudio() {
  let context = null;
  let master = null;

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    context = new AudioContextClass();
    master = context.createDynamicsCompressor();
    master.threshold.value = -10;
    master.knee.value = 12;
    master.ratio.value = 5;
    master.attack.value = 0.001;
    master.release.value = 0.16;
    master.connect(context.destination);
    return context;
  }

  function noiseBuffer(ctx, duration, decay) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const envelope = Math.exp(-t / decay);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    return buffer;
  }

  return function playGunshot() {
    const ctx = ensureContext();
    if (!ctx || !master) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const pitchVariation = 0.96 + Math.random() * 0.08;

    const crack = ctx.createBufferSource();
    crack.buffer = noiseBuffer(ctx, 0.105, 0.018);
    crack.playbackRate.value = pitchVariation;
    const crackHighpass = ctx.createBiquadFilter();
    crackHighpass.type = 'highpass';
    crackHighpass.frequency.value = 620;
    const crackLowpass = ctx.createBiquadFilter();
    crackLowpass.type = 'lowpass';
    crackLowpass.frequency.value = 9500;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.72, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    crack.connect(crackHighpass).connect(crackLowpass).connect(crackGain).connect(master);
    crack.start(now);
    crack.stop(now + 0.11);

    const thump = ctx.createOscillator();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(165 * pitchVariation, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.28, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(thumpGain).connect(master);
    thump.start(now);
    thump.stop(now + 0.105);

    const tail = ctx.createBufferSource();
    tail.buffer = noiseBuffer(ctx, 0.24, 0.075);
    tail.playbackRate.value = 0.92 + Math.random() * 0.1;
    const tailBand = ctx.createBiquadFilter();
    tailBand.type = 'bandpass';
    tailBand.frequency.value = 1050;
    tailBand.Q.value = 0.72;
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.18, now + 0.012);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    tail.connect(tailBand).connect(tailGain).connect(master);
    tail.start(now + 0.008);
    tail.stop(now + 0.25);
  };
}

export async function loadPistol({
  scene,
  placement,
  grips,
  controllerModes = null,
  floorY = 0,
  statusElement = null
}) {
  const gltf = await loadGLB(ASSETS.pistol);
  const modelRoot = prepareModel(gltf.scene, { castShadow: true, receiveShadow: false });
  modelRoot.name = 'RuntimePistol';

  const pistol = modelRoot.getObjectByName('Pistol') || modelRoot;
  const gripPoint = requireNode(modelRoot, 'Grip_Point');
  const slide = requireNode(modelRoot, 'Pistol_Slide');
  const trigger = requireNode(modelRoot, 'Pistol_Trigger');
  const magazine = requireNode(modelRoot, 'Pistol_Magazine');
  const magazineGripPoint = requireNode(modelRoot, 'Magazine_Grip_Point');
  const magazineWellPoint = requireNode(modelRoot, 'Magazine_Well_Point');
  const magazineRelease = requireNode(modelRoot, 'Magazine_Release');
  const muzzlePoint = requireNode(modelRoot, 'Muzzle_Point');

  // The palm socket is correct spatially, but its roll is opposite the pistol locator.
  // Rotate the empty locator—not the tracked hand—so the slide sits above the fist.
  gripPoint.rotateZ(PISTOL_GRIP_ROLL);

  const pistolGripMatrix = relativeMatrix(modelRoot, gripPoint);
  const magazineGripMatrix = relativeMatrix(magazine, magazineGripPoint);
  const triggerRestX = trigger.rotation.x;
  const releaseRestX = magazineRelease.position.x;
  const slideRestX = slide.position.x;
  const slideRestY = slide.position.y;
  const muzzleEffect = createMuzzleFlash(muzzlePoint);
  const playGunshot = createGunshotAudio();

  // Temporary test position on the computer desk. It remains upright so it is easy to target.
  modelRoot.position.set(3.82, floorY + 0.79, 5.62);
  modelRoot.rotation.set(0, Math.PI * 0.5, 0);
  scene.add(modelRoot);

  const pistolVelocity = new THREE.Vector3();
  const magazineVelocity = new THREE.Vector3();
  const pistolBounds = new THREE.Box3();
  const magazineBounds = new THREE.Box3();

  let holder = null;
  let magazineHolder = null;
  let pistolFalling = false;
  let magazineSeated = true;
  let magazineFalling = false;
  let slideReturning = false;
  let slideHeld = false;
  let releaseAnimation = 0;
  let triggerLatched = false;
  let fireCooldown = 0;
  let muzzleFlashTime = 0;
  let unregisterSlide = null;
  let unregisterMagazine = null;

  const getGrip = (handedness) => {
    const index = controllerModes?.states?.findIndex((state) => state.handedness === handedness) ?? -1;
    return index >= 0 ? grips[index] : null;
  };

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  function fireShot() {
    if (!holder || fireCooldown > 0) return;
    fireCooldown = FIRE_COOLDOWN;

    if (!magazineSeated) {
      pulseHand(controllerModes, holder.handedness, 0.12, 24);
      setStatus('Click · magazine missing');
      return;
    }

    muzzleFlashTime = MUZZLE_FLASH_DURATION;
    muzzleEffect.flash.visible = true;
    muzzleEffect.flash.rotation.z = Math.random() * Math.PI;
    const randomScale = 0.88 + Math.random() * 0.34;
    muzzleEffect.flash.scale.setScalar(randomScale);
    muzzleEffect.light.intensity = MUZZLE_LIGHT_INTENSITY;

    if (!slideHeld) {
      slide.position.set(slideRestX, slideRestY, SLIDE_REAR_Z);
      slideReturning = true;
    }

    pulseHand(controllerModes, holder.handedness);
    playGunshot();
  }

  function disableSlideInteraction() {
    unregisterSlide?.();
    unregisterSlide = null;
    slideHeld = false;
  }

  function enableSlideInteraction() {
    if (unregisterSlide) return;
    unregisterSlide = placement.registerGrabInteraction(slide, {
      id: 'pistol-slide',
      label: 'pistol slide',
      begin({ handedness }) {
        if (!holder || holder.handedness === handedness) return false;
        const grip = getGrip(handedness);
        if (!grip) return false;

        grip.getWorldPosition(tempPosition);
        pistol.worldToLocal(tempPosition);
        slideReturning = false;
        slideHeld = true;
        setStatus('Pull the slide rearward · release grip to let it snap forward');
        return {
          grip,
          startGripZ: tempPosition.z,
          startSlideZ: slide.position.z
        };
      },
      update({ context }) {
        context.grip.getWorldPosition(tempPosition);
        pistol.worldToLocal(tempPosition);
        const delta = tempPosition.z - context.startGripZ;
        slide.position.set(
          slideRestX,
          slideRestY,
          THREE.MathUtils.clamp(context.startSlideZ + delta, SLIDE_REST_Z, SLIDE_REAR_Z)
        );
      },
      end() {
        slideHeld = false;
        slideReturning = true;
        setStatus('Pistol held · trigger fires · A/X releases magazine · other grip pulls slide');
      }
    });
  }

  function disableMagazineInteraction() {
    unregisterMagazine?.();
    unregisterMagazine = null;
  }

  function seatMagazine() {
    disableMagazineInteraction();
    pistol.add(magazine);
    magazine.position.fromArray(MAG_SEATED_POSITION);
    magazine.quaternion.identity();
    magazine.scale.set(1, 1, 1);
    magazine.updateMatrixWorld(true);
    magazineSeated = true;
    magazineFalling = false;
    magazineHolder = null;
    magazineVelocity.set(0, 0, 0);
    setStatus('Magazine inserted');
  }

  function enableMagazineInteraction() {
    if (unregisterMagazine) return;
    unregisterMagazine = placement.registerGrabInteraction(magazine, {
      id: 'pistol-magazine',
      label: 'pistol magazine',
      begin({ handedness }) {
        if (magazineSeated || magazineHolder) return false;
        const grip = getGrip(handedness);
        if (!grip) return false;
        magazineHolder = { handedness, grip };
        magazineFalling = false;
        attachLocatorToGrip(magazine, magazineGripMatrix, grip);
        setStatus('Magazine held · release grip near the pistol grip to insert it');
        return { handedness };
      },
      end({ handedness }) {
        if (magazineHolder?.handedness !== handedness) return;
        scene.attach(magazine);
        magazineHolder = null;

        magazine.getWorldPosition(tempPosition);
        magazineWellPoint.getWorldPosition(tempPositionB);
        if (tempPosition.distanceTo(tempPositionB) <= MAG_INSERT_DISTANCE) {
          seatMagazine();
          return;
        }

        magazineFalling = true;
        magazineVelocity.set(0, -0.15, 0);
        setStatus('Magazine dropped · grip it and bring it to the pistol grip to reinsert');
      }
    });
  }

  function ejectMagazine() {
    if (!magazineSeated) return;
    scene.attach(magazine);
    magazineSeated = false;
    magazineFalling = true;
    magazineVelocity.set(0, -0.35, 0);
    enableMagazineInteraction();
    setStatus('Magazine released · grip it to pick it up');
  }

  function pressMagazineRelease() {
    releaseAnimation = 1;
    ejectMagazine();
  }

  const unregisterPistol = placement.registerGrabInteraction(modelRoot, {
    id: 'pistol-grip',
    label: 'pistol',
    begin({ handedness }) {
      if (holder) return false;
      const grip = getGrip(handedness);
      if (!grip) return false;

      holder = { handedness, grip };
      pistolFalling = false;
      pistolVelocity.set(0, 0, 0);
      triggerLatched = false;
      controllerModes?.setPointing?.(handedness, false);
      attachLocatorToGrip(modelRoot, pistolGripMatrix, grip);
      enableSlideInteraction();
      setStatus('Pistol held · trigger fires · A/X releases magazine · other grip pulls slide');
      return { handedness };
    },
    end({ handedness }) {
      if (holder?.handedness !== handedness) return;
      scene.attach(modelRoot);
      holder = null;
      triggerLatched = false;
      disableSlideInteraction();
      pistolFalling = true;
      pistolVelocity.set(0, -0.1, 0);
      setStatus('Pistol dropped · point at it and hold grip to pick it up');
    }
  });

  function update(dt) {
    fireCooldown = Math.max(0, fireCooldown - dt);

    if (holder) {
      const modeState = controllerModes?.getState?.(holder.handedness);
      const triggerAmount = THREE.MathUtils.clamp(
        modeState?.inputSource?.gamepad?.buttons?.[0]?.value ?? 0,
        0,
        1
      );
      trigger.rotation.x = triggerRestX - TRIGGER_TRAVEL * triggerAmount;

      if (triggerAmount >= FIRE_TRIGGER_THRESHOLD && !triggerLatched) {
        triggerLatched = true;
        fireShot();
      } else if (triggerAmount <= FIRE_TRIGGER_RESET) {
        triggerLatched = false;
      }

      if (modeState?.primaryPressed) {
        controllerModes?.setPointing?.(holder.handedness, false);
        pressMagazineRelease();
      }
    } else {
      trigger.rotation.x = triggerRestX;
      triggerLatched = false;
    }

    if (muzzleFlashTime > 0) {
      muzzleFlashTime = Math.max(0, muzzleFlashTime - dt);
      const flashRatio = muzzleFlashTime / MUZZLE_FLASH_DURATION;
      muzzleEffect.light.intensity = MUZZLE_LIGHT_INTENSITY * flashRatio * flashRatio;
      muzzleEffect.flash.visible = muzzleFlashTime > 0;
    } else {
      muzzleEffect.flash.visible = false;
      muzzleEffect.light.intensity = 0;
    }

    if (slideReturning) {
      const alpha = 1 - Math.exp(-34 * dt);
      slide.position.z = THREE.MathUtils.lerp(slide.position.z, SLIDE_REST_Z, alpha);
      slide.position.x = slideRestX;
      slide.position.y = slideRestY;
      if (Math.abs(slide.position.z - SLIDE_REST_Z) < 0.00015) {
        slide.position.z = SLIDE_REST_Z;
        slideReturning = false;
      }
    }

    if (releaseAnimation > 0) {
      releaseAnimation = Math.max(0, releaseAnimation - dt * 7.5);
      magazineRelease.position.x = releaseRestX - MAG_RELEASE_TRAVEL * releaseAnimation;
    } else {
      magazineRelease.position.x = releaseRestX;
    }

    if (pistolFalling) {
      pistolFalling = !settleOnFloor(modelRoot, floorY, pistolVelocity, dt, pistolBounds);
    }

    if (!magazineSeated && !magazineHolder && magazineFalling) {
      magazineFalling = !settleOnFloor(magazine, floorY, magazineVelocity, dt, magazineBounds);
    }
  }

  return {
    root: modelRoot,
    update,
    isHeld: () => Boolean(holder),
    isMagazineSeated: () => magazineSeated,
    fire: fireShot,
    dispose() {
      unregisterPistol();
      disableSlideInteraction();
      disableMagazineInteraction();
      modelRoot.removeFromParent();
      if (!magazineSeated) magazine.removeFromParent();
    }
  };
}
