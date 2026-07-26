import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const SAMPLE_WINDOW_MS = 500;
const PANEL_WIDTH = 0.34;
const PANEL_HEIGHT = 0.17;

const tempPosition = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const localOffset = new THREE.Vector3(0.02, 0.11, -0.15);

function formatCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value || 0));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

export function createPerformanceHud({
  scene,
  camera,
  renderer,
  grips,
  controllerModes,
  visibleByDefault = true
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 320;
  const context = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    material
  );
  panel.name = 'PerformanceHUD';
  panel.renderOrder = 10000;
  panel.visible = false;
  scene.add(panel);

  let enabled = Boolean(visibleByDefault);
  let sampleStart = 0;
  let sampleFrames = 0;
  let fps = 0;
  let frameMs = 0;
  let targetHz = 72;

  function draw() {
    const budgetMs = 1000 / targetHz;
    const healthy = fps >= targetHz - 1.5;
    const close = fps >= targetHz * 0.9;
    const accent = healthy ? '#78e58f' : close ? '#ffd36a' : '#ff7777';

    context.clearRect(0, 0, canvas.width, canvas.height);
    roundedRect(context, 10, 10, 620, 300, 28);
    context.fillStyle = 'rgba(8, 12, 15, 0.88)';
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = accent;
    context.stroke();

    context.fillStyle = '#eef7fb';
    context.font = '700 42px system-ui, sans-serif';
    context.fillText('QUEST PERFORMANCE', 38, 64);

    context.fillStyle = accent;
    context.font = '800 78px system-ui, sans-serif';
    context.fillText(`${fps.toFixed(1)} FPS`, 36, 150);

    context.fillStyle = '#c9d8df';
    context.font = '600 31px system-ui, sans-serif';
    context.fillText(`Target ${targetHz} Hz  •  ${frameMs.toFixed(1)} ms / ${budgetMs.toFixed(1)} ms`, 38, 205);

    const info = renderer.info;
    context.fillStyle = '#9fb2bc';
    context.font = '500 28px system-ui, sans-serif';
    context.fillText(
      `Draws ${info.render.calls}  •  Tris ${formatCount(info.render.triangles)}  •  Textures ${info.memory.textures}`,
      38,
      258
    );

    texture.needsUpdate = true;
  }

  function reset(time = performance.now()) {
    sampleStart = time;
    sampleFrames = 0;
    fps = 0;
    frameMs = 0;
    targetHz = renderer.xr.getSession()?.frameRate || 72;
    draw();
  }

  function update(time) {
    const presenting = renderer.xr.isPresenting;
    panel.visible = enabled && presenting;
    if (!panel.visible) return;

    const leftIndex = controllerModes?.states?.findIndex((state) => state.handedness === 'left') ?? -1;
    const leftGrip = leftIndex >= 0 ? grips[leftIndex] : null;
    if (!leftGrip) {
      panel.visible = false;
      return;
    }

    tempPosition.copy(localOffset);
    leftGrip.localToWorld(tempPosition);
    panel.position.copy(tempPosition);
    camera.getWorldPosition(cameraPosition);
    panel.lookAt(cameraPosition);

    const sessionRate = renderer.xr.getSession()?.frameRate;
    if (sessionRate) targetHz = Math.round(sessionRate);

    if (!sampleStart) sampleStart = time;
    sampleFrames += 1;
    const elapsed = time - sampleStart;
    if (elapsed >= SAMPLE_WINDOW_MS) {
      fps = sampleFrames * 1000 / elapsed;
      frameMs = elapsed / sampleFrames;
      sampleStart = time;
      sampleFrames = 0;
      draw();
    }
  }

  draw();

  return {
    update,
    reset,
    setVisible(value) {
      enabled = Boolean(value);
      panel.visible = enabled && renderer.xr.isPresenting;
      return enabled;
    },
    isVisible: () => enabled,
    dispose() {
      panel.removeFromParent();
      panel.geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}
