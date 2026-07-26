import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { ASSETS } from '../config.js';
import { loadGLB, prepareModel } from '../asset-loader.js';
import { registerPassiveInteraction, registerPressable } from '../interactions/pressable.js';

const LAYOUT = Object.freeze({
  monitor: [0.14, 0.75, 0.16],
  mouse: [0.52, 0.75, -0.10],
  tower: [0.84, 0, 0.04]
});

export async function loadComputerSetup({
  desk,
  gameState = null,
  statusElement = null
}) {
  const entries = [
    ['monitor', ASSETS.monitor],
    ['keyboard', ASSETS.keyboard],
    ['mouse', ASSETS.mouse],
    ['tower', ASSETS.computerTower]
  ];

  const settled = await Promise.allSettled(
    entries.map(async ([key, url]) => {
      const gltf = await loadGLB(url);
      const root = prepareModel(gltf.scene);
      root.name = `${key}-asset`;
      return [key, root, gltf];
    })
  );

  const roots = {};
  const gltfs = {};

  settled.forEach((result, index) => {
    const [key, url] = entries[index];
    if (result.status === 'fulfilled') {
      const [, root, gltf] = result.value;
      roots[key] = root;
      gltfs[key] = gltf;
    } else {
      console.error(`Computer asset failed to load: ${url}`, result.reason);
    }
  });

  attachAssetsToDesk(desk, roots);
  prepareSpecialMaterials(roots);

  const disposers = [];
  let screenOn = Boolean(gameState?.read?.().flags?.computerPoweredOn);
  let discTrayOpen = Boolean(gameState?.read?.().flags?.computerDiscTrayOpen);

  const nodes = {
    screen: roots.monitor?.getObjectByName('Screen_Display') || null,
    monitorPower: roots.monitor?.getObjectByName('PowerButton') || null,
    monitorLed: roots.monitor?.getObjectByName('PowerLED') || null,
    monitorMenu: roots.monitor?.getObjectByName('Control_Menu') || null,
    monitorUp: roots.monitor?.getObjectByName('Control_Up') || null,
    monitorDown: roots.monitor?.getObjectByName('Control_Down') || null,

    keyEnter: roots.keyboard?.getObjectByName('Key_Enter') || null,
    keyEscape: roots.keyboard?.getObjectByName('Key_Escape') || null,

    mouseLeft: roots.mouse?.getObjectByName('Mouse_LeftButton') || null,
    mouseRight: roots.mouse?.getObjectByName('Mouse_RightButton') || null,

    towerPower: roots.tower?.getObjectByName('Tower_PowerButton') || null,
    towerLed: roots.tower?.getObjectByName('Tower_PowerLED') || null,
    discTray: roots.tower?.getObjectByName('Tower_DiscTray') || null,
    discEject: roots.tower?.getObjectByName('Tower_DiscEjectButton') || null
  };

  const discTrayRestZ = nodes.discTray?.position.z ?? 0;

  function emitInput(type, value, source = null) {
    window.dispatchEvent(new CustomEvent('dumbgame:computer-input', {
      detail: { type, value, source }
    }));
  }

  function applyPowerState() {
    applyScreenState(nodes.screen, screenOn);
    applyLedState(nodes.monitorLed, screenOn, 2.8);
    applyLedState(nodes.towerLed, screenOn, 2.4);
  }

  function togglePower() {
    screenOn = !screenOn;
    applyPowerState();
    gameState?.setFlag?.('computerPoweredOn', screenOn);
    emitInput('power', screenOn);
    if (statusElement) {
      statusElement.textContent = screenOn ? 'Computer powered on' : 'Computer powered off';
    }
  }

  function applyDiscTrayState() {
    if (!nodes.discTray) return;
    nodes.discTray.position.z = discTrayRestZ + (discTrayOpen ? -0.112 : 0);
    nodes.discTray.updateMatrix();
  }

  function toggleDiscTray() {
    discTrayOpen = !discTrayOpen;
    applyDiscTrayState();
    gameState?.setFlag?.('computerDiscTrayOpen', discTrayOpen);
    emitInput('disc-tray', discTrayOpen);
  }

  applyPowerState();
  applyDiscTrayState();

  function registerInteractions(placement) {
    const add = (dispose) => disposers.push(dispose);

    add(registerPressable({
      placement,
      node: nodes.monitorPower,
      id: 'computer:monitor-power',
      label: 'monitor power',
      translationAxis: [0, 0, 1],
      translationDistance: 0.0015,
      statusElement,
      onPress: togglePower
    }));

    add(registerPressable({
      placement,
      node: nodes.towerPower,
      id: 'computer:tower-power',
      label: 'computer power',
      translationAxis: [0, 0, 1],
      translationDistance: 0.0015,
      statusElement,
      onPress: togglePower
    }));

    add(registerPressable({
      placement,
      node: nodes.discEject,
      id: 'computer:disc-eject',
      label: 'disc eject',
      translationAxis: [0, 0, 1],
      translationDistance: 0.001,
      statusElement,
      onPress: toggleDiscTray
    }));

    for (const [node, key] of [
      [nodes.keyEnter, 'Enter'],
      [nodes.keyEscape, 'Escape']
    ]) {
      add(registerPressable({
        placement,
        node,
        id: `computer:key-${key.toLowerCase()}`,
        label: `${key} key`,
        translationAxis: [0, -1, 0],
        translationDistance: 0.004,
        statusElement,
        onPress: () => emitInput('key', key, node)
      }));
    }

    for (const [node, button] of [
      [nodes.mouseLeft, 'left'],
      [nodes.mouseRight, 'right']
    ]) {
      add(registerPressable({
        placement,
        node,
        id: `computer:mouse-${button}`,
        label: `${button} mouse button`,
        rotationAxis: [1, 0, 0],
        rotationAngle: THREE.MathUtils.degToRad(-2),
        statusElement,
        onPress: () => emitInput('mouse-button', button, node)
      }));
    }

    for (const [node, control] of [
      [nodes.monitorMenu, 'menu'],
      [nodes.monitorUp, 'up'],
      [nodes.monitorDown, 'down']
    ]) {
      add(registerPressable({
        placement,
        node,
        id: `computer:monitor-${control}`,
        label: `monitor ${control}`,
        translationAxis: [0, 0, 1],
        translationDistance: 0.0012,
        statusElement,
        onPress: () => emitInput('monitor-control', control, node)
      }));
    }

    add(registerPassiveInteraction({
      placement,
      node: nodes.screen,
      id: 'computer:screen',
      label: () => screenOn ? 'Computer screen' : 'The monitor is off',
      statusElement,
      onSelect: ({ hit }) => {
        emitInput('screen-select', {
          powered: screenOn,
          uv: hit.uv ? [hit.uv.x, hit.uv.y] : null
        }, nodes.screen);
      }
    }));

    return () => dispose();
  }

  function dispose() {
    while (disposers.length) {
      const disposeInteraction = disposers.pop();
      disposeInteraction?.();
    }
  }

  return {
    roots,
    gltfs,
    nodes,
    registerInteractions,
    update() {},
    dispose
  };
}

function attachAssetsToDesk(desk, roots) {
  if (roots.monitor) {
    roots.monitor.position.set(...LAYOUT.monitor);
    desk.add(roots.monitor);
  }

  if (roots.mouse) {
    roots.mouse.position.set(...LAYOUT.mouse);
    desk.add(roots.mouse);
  }

  if (roots.tower) {
    roots.tower.position.set(...LAYOUT.tower);
    desk.add(roots.tower);
  }

  if (roots.keyboard) {
    const tray = desk.getObjectByName('KeyboardTray');
    if (tray) {
      tray.updateWorldMatrix(true, true);
      const trayBounds = new THREE.Box3().setFromObject(tray);
      const topCentreWorld = trayBounds.getCenter(new THREE.Vector3());
      topCentreWorld.y = trayBounds.max.y;

      const topCentreLocal = tray.worldToLocal(topCentreWorld.clone());
      tray.add(roots.keyboard);
      roots.keyboard.position.copy(topCentreLocal);
      roots.keyboard.position.y += 0.003;
      roots.keyboard.position.z -= 0.01;
    } else {
      roots.keyboard.position.set(0.10, 0.64, -0.08);
      desk.add(roots.keyboard);
    }
  }

  desk.updateWorldMatrix(true, true);
}

function prepareSpecialMaterials(roots) {
  for (const name of ['Screen_Display', 'PowerLED', 'Tower_PowerLED']) {
    const node = roots.monitor?.getObjectByName(name)
      || roots.tower?.getObjectByName(name);
    cloneMaterials(node);
  }

  const glass = roots.monitor?.getObjectByName('Screen_Glass');
  glass?.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });

  const screen = roots.monitor?.getObjectByName('Screen_Display');
  screen?.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
}

function cloneMaterials(node) {
  node?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
  });
}

function forEachMaterial(node, callback) {
  node?.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) callback(material);
  });
}

function applyScreenState(screen, on) {
  forEachMaterial(screen, (material) => {
    material.color?.setHex(on ? 0x10263a : 0x02070c);
    if (material.emissive) {
      material.emissive.setHex(on ? 0x163a59 : 0x000000);
      material.emissiveIntensity = on ? 0.85 : 0;
    }
    material.needsUpdate = true;
  });
}

function applyLedState(led, on, intensity) {
  forEachMaterial(led, (material) => {
    if (material.emissive) material.emissiveIntensity = on ? intensity : 0.03;
    material.needsUpdate = true;
  });
}
