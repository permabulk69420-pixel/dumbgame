import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js?v=8';
import { loadGLB, prepareModel } from '../asset-loader.js?v=2';
import { registerBedsideColliders } from '../physics/apartment-colliders.js?v=1';

const DRAWER_CLOSED_Z = -0.040;
const DRAWER_OPEN_Z = -0.340;
const DRAWER_TRAVEL = 0.300;
const BUTTON_TRAVEL = 0.004;
const DRAWER_EVENT_ID = 'bedside-table-drawer';
const ALARM_FLAG = 'bedroomAlarmEnabled';

const tempControllerPosition = new THREE.Vector3();

function requireNode(root, name) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`Bedroom bedside asset is missing required node: ${name}`);
  return node;
}

function formatTime(minuteOfDay = 0) {
  const wholeMinute = Math.floor(minuteOfDay) % 1440;
  const hour = Math.floor(wholeMinute / 60).toString().padStart(2, '0');
  const minute = (wholeMinute % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function cloneNodeMaterials(node) {
  node.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
  });
}

function createClockDisplay(timeDisplay) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.center.set(0.5, 0.5);
  texture.rotation = Math.PI;

  cloneNodeMaterials(timeDisplay);
  timeDisplay.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.map = texture;
      if ('emissive' in material) {
        material.emissive.setHex(0xff1c0c);
        material.emissiveMap = texture;
        material.emissiveIntensity = 2.6;
      }
      material.needsUpdate = true;
    }
  });

  let displayedText = '';
  function draw(text) {
    if (!context || text === displayedText) return;
    displayedText = text;
    context.fillStyle = '#050100';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 132px monospace';
    context.shadowColor = '#ff2a12';
    context.shadowBlur = 22;
    context.fillStyle = '#ff3018';

    // The GLB display surface reverses the horizontally arranged readout after
    // its required 180-degree correction. Mirror the completed canvas text once
    // so the hour/minute sides and every digit face the player correctly.
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.fillText(text, canvas.width * 0.5, canvas.height * 0.54);
    context.restore();

    texture.needsUpdate = true;
  }

  return {
    draw,
    dispose() {
      texture.dispose();
    }
  };
}

function prepareAlarmIndicator(indicator) {
  cloneNodeMaterials(indicator);
  return (enabled) => {
    indicator.visible = true;
    indicator.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if ('emissive' in material) material.emissive.setHex(enabled ? 0xff2a16 : 0x000000);
        if ('emissiveIntensity' in material) material.emissiveIntensity = enabled ? 3.5 : 0;
        if ('opacity' in material) {
          material.transparent = true;
          material.opacity = enabled ? 1 : 0.28;
        }
        material.needsUpdate = true;
      }
    });
  };
}

export async function loadBedsideSetup({
  scene,
  placement,
  physics = null,
  floorY = 0,
  gameState = null,
  statusElement = null
}) {
  const tableGltf = await loadGLB(ASSETS.bedsideTable);
  const tableRoot = prepareModel(tableGltf.scene, { castShadow: false, receiveShadow: true });
  tableRoot.name = 'ApartmentBedsideTable';

  const drawerPivot = requireNode(tableRoot, 'DrawerPivot');
  const topAnchor = requireNode(tableRoot, 'Top_Surface_Anchor');

  tableRoot.position.set(-6.55, floorY, -6.35);
  tableRoot.rotation.y = Math.PI;
  scene.add(tableRoot);

  const savedDrawerAmount = THREE.MathUtils.clamp(
    gameState?.read?.().eventData?.[DRAWER_EVENT_ID]?.amount ?? 0,
    0,
    1
  );
  let drawerAmount = savedDrawerAmount;
  drawerPivot.position.z = THREE.MathUtils.lerp(DRAWER_CLOSED_Z, DRAWER_OPEN_Z, drawerAmount);

  placement.registerPlaceable(tableRoot, 'bedroom-bedside-table', { floorY });
  const physicsHandle = registerBedsideColliders(physics, tableRoot, drawerPivot);

  const unregisterDrawer = placement.registerGrabInteraction(drawerPivot, {
    id: 'bedside-table-drawer',
    label: 'bedside drawer',
    begin({ controller }) {
      const controllerStart = new THREE.Vector3();
      const slideAxisWorld = new THREE.Vector3(0, 0, -1);
      const parentWorldQuaternion = new THREE.Quaternion();
      drawerPivot.parent?.getWorldQuaternion(parentWorldQuaternion);
      slideAxisWorld.applyQuaternion(parentWorldQuaternion).normalize();
      controller.getWorldPosition(controllerStart);
      if (statusElement) statusElement.textContent = 'Grip and pull the bedside drawer · release it wherever you leave it';
      return { controllerStart, slideAxisWorld, startAmount: drawerAmount };
    },
    update({ controller, context }) {
      controller.getWorldPosition(tempControllerPosition);
      const travel = tempControllerPosition
        .sub(context.controllerStart)
        .dot(context.slideAxisWorld);
      drawerAmount = THREE.MathUtils.clamp(context.startAmount + travel / DRAWER_TRAVEL, 0, 1);
      drawerPivot.position.z = THREE.MathUtils.lerp(DRAWER_CLOSED_Z, DRAWER_OPEN_Z, drawerAmount);
    },
    end() {
      gameState?.setEventData?.(DRAWER_EVENT_ID, { amount: drawerAmount });
      if (statusElement) statusElement.textContent = 'Bedside drawer released';
    }
  });

  const clockGltf = await loadGLB(ASSETS.alarmClock);
  const clockRoot = prepareModel(clockGltf.scene, { castShadow: false, receiveShadow: true });
  clockRoot.name = 'ApartmentAlarmClock';
  const timeDisplay = requireNode(clockRoot, 'TimeDisplay');
  const alarmIndicator = requireNode(clockRoot, 'AlarmArmedIndicator');
  const alarmButtonPivot = requireNode(clockRoot, 'AlarmButtonPivot');
  const alarmButton = requireNode(clockRoot, 'AlarmButton');

  topAnchor.add(clockRoot);
  clockRoot.position.set(0, 0.006, -0.025);
  clockRoot.rotation.set(0, 0, 0);

  const display = createClockDisplay(timeDisplay);
  const setAlarmIndicator = prepareAlarmIndicator(alarmIndicator);
  const buttonRestY = alarmButtonPivot.position.y;
  let buttonPressed = false;
  let alarmEnabled = Boolean(gameState?.read?.().flags?.[ALARM_FLAG]);

  function applyAlarmState() {
    setAlarmIndicator(alarmEnabled);
  }

  function toggleAlarm() {
    alarmEnabled = !alarmEnabled;
    gameState?.setFlag?.(ALARM_FLAG, alarmEnabled);
    applyAlarmState();
    if (statusElement) {
      statusElement.textContent = alarmEnabled
        ? 'Alarm armed · point and press the top button to switch it off'
        : 'Alarm off · point and press the top button to arm it';
    }
  }

  const unsubscribeState = gameState?.subscribe?.((state) => {
    display.draw(formatTime(state.minuteOfDay));
    const nextAlarmEnabled = Boolean(state.flags?.[ALARM_FLAG]);
    if (nextAlarmEnabled !== alarmEnabled) {
      alarmEnabled = nextAlarmEnabled;
      applyAlarmState();
    }
  }, { immediate: true }) || (() => {});

  const unregisterAlarmButton = placement.registerUseInteraction(alarmButton, {
    id: 'alarm-clock-button',
    label: 'alarm button',
    begin() {
      buttonPressed = true;
      toggleAlarm();
      return {};
    },
    end() {
      buttonPressed = false;
    }
  });

  applyAlarmState();

  return {
    root: tableRoot,
    table: tableRoot,
    clock: clockRoot,
    drawer: drawerPivot,
    isAlarmEnabled: () => alarmEnabled,
    setAlarmEnabled(enabled) {
      alarmEnabled = Boolean(enabled);
      gameState?.setFlag?.(ALARM_FLAG, alarmEnabled);
      applyAlarmState();
    },
    update(dt) {
      const targetY = buttonRestY - (buttonPressed ? BUTTON_TRAVEL : 0);
      alarmButtonPivot.position.y = THREE.MathUtils.damp(
        alarmButtonPivot.position.y,
        targetY,
        buttonPressed ? 34 : 24,
        dt
      );
    },
    dispose() {
      physicsHandle?.dispose?.();
      unregisterAlarmButton();
      unregisterDrawer();
      unsubscribeState();
      display.dispose();
      placement.unregisterPlaceable(tableRoot);
      tableRoot.removeFromParent();
    }
  };
}
