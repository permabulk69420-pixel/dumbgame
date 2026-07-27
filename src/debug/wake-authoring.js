import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { writePublishedWakeSetup } from '../story/wake-sequence.js?v=4';

const MARKER_DEFINITIONS = Object.freeze([
  {
    key: 'lying',
    label: 'LYING · LOOKING UP',
    colour: 0x6fd5ff,
    height: 0.82,
    minY: 0.45,
    maxY: 1.05,
    offset: [-4.0, -0.7],
    pitch: Math.PI / 2
  },
  {
    key: 'sitting',
    label: 'SITTING',
    colour: 0xffc96f,
    height: 1.15,
    minY: 0.85,
    maxY: 1.45,
    offset: [-3.2, -0.7],
    pitch: 0
  },
  {
    key: 'standing',
    label: 'STANDING · 1.65 M GAMEPLAY HEIGHT',
    colour: 0x7dffad,
    height: 1.65,
    minY: 1.65,
    maxY: 1.65,
    offset: [-2.45, -0.7],
    pitch: 0
  }
]);

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

function createCanvasTexture({ title, subtitle = '', accent = '#8bdcff', width = 1024, height = 256 }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, width, height);
  roundedRect(context, 8, 8, width - 16, height - 16, 34);
  context.fillStyle = 'rgba(9, 14, 18, 0.94)';
  context.fill();
  context.lineWidth = 7;
  context.strokeStyle = accent;
  context.stroke();

  context.fillStyle = '#f2f8fb';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '800 58px system-ui, sans-serif';
  context.fillText(title, width / 2, subtitle ? height * 0.39 : height / 2);

  if (subtitle) {
    context.fillStyle = '#b6c5cc';
    context.font = '600 31px system-ui, sans-serif';
    context.fillText(subtitle, width / 2, height * 0.72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createLabelSprite(text, colour) {
  const accent = `#${colour.toString(16).padStart(6, '0')}`;
  const texture = createCanvasTexture({ title: text, accent, width: 1024, height: 220 });
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  // These labels are visual only. THREE.Sprite raycasting expects a camera,
  // while the VR placement ray is controller-based, so exclude them entirely.
  sprite.raycast = () => {};
  sprite.scale.set(0.86, 0.185, 1);
  sprite.renderOrder = 10010;
  sprite.userData.disposables = [texture, material];
  return sprite;
}

function createPoseMarker(definition, spawn) {
  const root = new THREE.Group();
  root.name = `WakeMarker_${definition.key}`;
  root.position.set(
    spawn.x + definition.offset[0],
    definition.height,
    spawn.z + definition.offset[1]
  );
  root.userData.wakePoseKey = definition.key;

  const poseAnchor = new THREE.Group();
  poseAnchor.name = `Wake_${definition.key[0].toUpperCase()}${definition.key.slice(1)}_Anchor`;
  poseAnchor.rotation.x = definition.pitch;
  root.add(poseAnchor);

  const material = new THREE.MeshBasicMaterial({
    color: definition.colour,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
    depthTest: false,
    toneMapped: false
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), material);
  head.scale.set(0.82, 1.05, 0.9);
  head.renderOrder = 10000;
  poseAnchor.add(head);

  const direction = new THREE.Vector3(0, 0, -1);
  const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), 0.48, definition.colour, 0.12, 0.07);
  arrow.line.material.depthTest = false;
  arrow.cone.material.depthTest = false;
  arrow.line.renderOrder = 10001;
  arrow.cone.renderOrder = 10001;
  poseAnchor.add(arrow);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.012, 8, 36),
    new THREE.MeshBasicMaterial({
      color: definition.colour,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
      toneMapped: false
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 10000;
  root.add(ring);

  const label = createLabelSprite(definition.label, definition.colour);
  label.position.set(0, 0.32, 0);
  root.add(label);

  return { root, poseAnchor, material, ring, label };
}

function createPanel({ spawn, placement, onPreview, onPublish }) {
  const root = new THREE.Group();
  root.name = 'WakeAuthoringPanel';
  root.position.set(spawn.x, 1.46, spawn.z - 1.35);

  const backingMaterial = new THREE.MeshStandardMaterial({
    color: 0x10171c,
    roughness: 0.68,
    metalness: 0.08
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.68, 0.045), backingMaterial);
  backing.castShadow = false;
  root.add(backing);

  const titleTexture = createCanvasTexture({
    title: 'WAKE AUTHORING',
    subtitle: 'STANDING HEIGHT LOCKED · LYING/SITTING ADJUSTABLE',
    accent: '#8bdcff',
    width: 1024,
    height: 300
  });
  const titleMaterial = new THREE.MeshBasicMaterial({
    map: titleTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const title = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.25), titleMaterial);
  title.position.set(0, 0.19, 0.026);
  root.add(title);

  const cleanups = [];
  const buttonResources = [];

  function addButton(label, subtitle, y, accent, action) {
    const texture = createCanvasTexture({ title: label, subtitle, accent, width: 1024, height: 300 });
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.20), material);
    mesh.name = `WakeAuthoring_${label.replaceAll(' ', '_')}`;
    mesh.position.set(0, y, 0.029);
    root.add(mesh);

    cleanups.push(placement.registerUseInteraction(mesh, {
      id: `wake-authoring-${label.toLowerCase().replaceAll(' ', '-')}`,
      label,
      begin() {
        action();
        return false;
      }
    }));
    buttonResources.push({ mesh, texture, material });
  }

  addButton('PREVIEW OPENING', 'Run the three-pose blink sequence', -0.045, '#ffcb78', onPreview);
  addButton('PUBLISH TO STORY', 'Save these marker positions for New Story', -0.255, '#82efad', onPublish);

  placement.registerPlaceable(root, 'wake-authoring-panel', {
    allowVertical: true,
    minY: 0.65,
    maxY: 2.25,
    confineToBounds: true
  });

  return {
    root,
    dispose() {
      for (const cleanup of cleanups) cleanup();
      placement.unregisterPlaceable(root);
      root.removeFromParent();
      backing.geometry.dispose();
      backingMaterial.dispose();
      title.geometry.dispose();
      titleMaterial.dispose();
      titleTexture.dispose();
      for (const resource of buttonResources) {
        resource.mesh.geometry.dispose();
        resource.material.dispose();
        resource.texture.dispose();
      }
    }
  };
}

export function createWakeAuthoring({
  scene,
  renderer,
  placement,
  house,
  wakeSequence,
  statusElement = null
}) {
  const markers = {};
  const roots = [];
  let visible = true;

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  for (const definition of MARKER_DEFINITIONS) {
    const marker = createPoseMarker(definition, house.spawn);
    scene.add(marker.root);
    placement.registerPlaceable(marker.root, `wake-marker-${definition.key}`, {
      allowVertical: true,
      minY: definition.minY,
      maxY: definition.maxY,
      confineToBounds: true
    });

    // Old saves could contain absurd heights from before the marker limits existed.
    // Preserve X/Z and rotation, but clamp the authored eye height into the valid range.
    marker.root.position.y = THREE.MathUtils.clamp(marker.root.position.y, definition.minY, definition.maxY);
    marker.root.updateMatrixWorld(true);

    markers[definition.key] = marker;
    roots.push(marker.root);
  }

  function captureSetup() {
    const poses = {};
    for (const definition of MARKER_DEFINITIONS) {
      const anchor = markers[definition.key].poseAnchor;
      anchor.updateWorldMatrix(true, false);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      anchor.getWorldPosition(position);
      anchor.getWorldQuaternion(quaternion);
      poses[definition.key] = {
        position: position.toArray(),
        quaternion: quaternion.normalize().toArray()
      };
    }
    return { version: 1, updatedAt: new Date().toISOString(), poses };
  }

  function setVisible(value) {
    visible = Boolean(value);
    for (const root of roots) root.visible = visible;
    panel.root.visible = visible;
    return visible;
  }

  function preview() {
    if (!renderer.xr.isPresenting) {
      setStatus('Enter VR before previewing the wake sequence.');
      return false;
    }

    setVisible(false);
    const started = wakeSequence.start(captureSetup(), {
      preview: true,
      onComplete: () => setVisible(true)
    });
    if (!started) setVisible(true);
    return started;
  }

  function publish() {
    try {
      const saved = writePublishedWakeSetup(captureSetup());
      setStatus('Wake setup published · standing gameplay height is locked to 1.65 m.');
      return saved;
    } catch (error) {
      console.error('Wake setup could not be published.', error);
      setStatus('Wake setup could not be published.');
      return null;
    }
  }

  const panel = createPanel({
    spawn: house.spawn,
    placement,
    onPreview: preview,
    onPublish: publish
  });
  scene.add(panel.root);
  roots.push(panel.root);

  return {
    update() {},
    captureSetup,
    preview,
    publish,
    setVisible,
    isVisible: () => visible,
    markers,
    dispose() {
      wakeSequence.cancel();
      panel.dispose();
      for (const definition of MARKER_DEFINITIONS) {
        const marker = markers[definition.key];
        placement.unregisterPlaceable(marker.root);
        marker.root.removeFromParent();
        marker.root.traverse((object) => {
          object.geometry?.dispose?.();
          if (object.material && object !== marker.label) object.material.dispose?.();
        });
        const disposables = marker.label.userData.disposables || [];
        for (const disposable of disposables) disposable.dispose?.();
      }
    }
  };
}
