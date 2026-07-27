import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from './config.js?v=10';

const FLOOR_TEXTURE_SIZE = 1024;
const FLOOR_TILE_METRES = 8;
const FLOOR_PLANK_ROWS = 48;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function textureFromCanvas(canvas, {
  repeatX = 1,
  repeatY = 1,
  colour = true,
  anisotropy = 4
} = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  return textureFromCanvas(canvas, { repeatX, repeatY });
}

function plasterTexture(base) {
  return canvasTexture(256, 256, (ctx, width, height) => {
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = Math.floor((Math.random() - 0.5) * 9);
      image.data[i] = THREE.MathUtils.clamp(base[0] + grain, 0, 255);
      image.data[i + 1] = THREE.MathUtils.clamp(base[1] + grain, 0, 255);
      image.data[i + 2] = THREE.MathUtils.clamp(base[2] + grain, 0, 255);
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, 3, 3);
}

function colourString(rgb, adjustment = 0) {
  const values = rgb.map((channel) => THREE.MathUtils.clamp(Math.round(channel + adjustment), 0, 255));
  return `rgb(${values[0]},${values[1]},${values[2]})`;
}

function drawPlankGrain(ctx, rng, x, y, width, height, dark = true) {
  const lineCount = Math.max(5, Math.round(width / 34));
  ctx.lineWidth = 0.65;

  for (let line = 0; line < lineCount; line++) {
    const centreY = y + 4 + rng() * Math.max(2, height - 8);
    const alpha = 0.035 + rng() * 0.075;
    ctx.strokeStyle = dark
      ? `rgba(55,35,22,${alpha})`
      : `rgba(245,225,188,${alpha * 0.58})`;
    ctx.beginPath();
    ctx.moveTo(x, centreY);
    const segments = Math.max(3, Math.round(width / 80));
    for (let segment = 1; segment <= segments; segment++) {
      const px = x + width * (segment / segments);
      const py = centreY + (rng() - 0.5) * Math.min(4.5, height * 0.16);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function woodFloorTextures() {
  const size = FLOOR_TEXTURE_SIZE;
  const colourCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughnessCanvas = makeCanvas(size, size);
  const colourCtx = colourCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  const roughnessCtx = roughnessCanvas.getContext('2d');
  const rng = seededRandom(0x0a4c2026);

  // Dark seam values show through the tiny gaps between each board.
  colourCtx.fillStyle = '#49392d';
  colourCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = 'rgb(58,58,58)';
  bumpCtx.fillRect(0, 0, size, size);
  roughnessCtx.fillStyle = 'rgb(239,239,239)';
  roughnessCtx.fillRect(0, 0, size, size);

  const palette = [
    [151, 126, 94],
    [142, 116, 86],
    [163, 136, 101],
    [132, 108, 82],
    [156, 129, 96],
    [146, 121, 91]
  ];
  const rowHeight = size / FLOOR_PLANK_ROWS;
  const seam = 1.35;

  for (let row = 0; row < FLOOR_PLANK_ROWS; row++) {
    const rowTop = row * rowHeight;
    let x = 0;

    while (x < size - 0.5) {
      const remaining = size - x;
      const preferredLength = 155 + rng() * 185;
      let plankLength = Math.min(remaining, preferredLength);
      if (remaining - plankLength < 78) plankLength = remaining;

      const px = x + seam;
      const py = rowTop + seam;
      const pw = Math.max(1, plankLength - seam * 2);
      const ph = Math.max(1, rowHeight - seam * 2);
      const base = palette[Math.floor(rng() * palette.length)];
      const tint = (rng() - 0.5) * 14;
      const edgeTint = tint + (rng() - 0.5) * 7;
      const centreTint = tint + 4 + rng() * 5;

      const plankGradient = colourCtx.createLinearGradient(px, py, px, py + ph);
      plankGradient.addColorStop(0, colourString(base, edgeTint - 3));
      plankGradient.addColorStop(0.22, colourString(base, centreTint));
      plankGradient.addColorStop(0.78, colourString(base, tint + 2));
      plankGradient.addColorStop(1, colourString(base, edgeTint - 5));
      colourCtx.fillStyle = plankGradient;
      colourCtx.fillRect(px, py, pw, ph);

      const bumpValue = Math.round(126 + (rng() - 0.5) * 9);
      bumpCtx.fillStyle = `rgb(${bumpValue},${bumpValue},${bumpValue})`;
      bumpCtx.fillRect(px, py, pw, ph);

      const roughnessValue = Math.round(197 + rng() * 24);
      roughnessCtx.fillStyle = `rgb(${roughnessValue},${roughnessValue},${roughnessValue})`;
      roughnessCtx.fillRect(px, py, pw, ph);

      drawPlankGrain(colourCtx, rng, px, py, pw, ph, true);
      drawPlankGrain(colourCtx, rng, px, py, pw, ph, false);

      const grainCount = Math.max(5, Math.round(pw / 42));
      for (let grain = 0; grain < grainCount; grain++) {
        const gy = py + 3 + rng() * Math.max(2, ph - 6);
        const gx = px + rng() * pw;
        const length = 18 + rng() * Math.min(85, pw * 0.32);
        const bumpShade = Math.round(119 + rng() * 15);
        bumpCtx.strokeStyle = `rgba(${bumpShade},${bumpShade},${bumpShade},0.52)`;
        bumpCtx.lineWidth = 0.75;
        bumpCtx.beginPath();
        bumpCtx.moveTo(gx, gy);
        bumpCtx.bezierCurveTo(
          gx + length * 0.28,
          gy + (rng() - 0.5) * 2.4,
          gx + length * 0.7,
          gy + (rng() - 0.5) * 2.4,
          Math.min(px + pw, gx + length),
          gy + (rng() - 0.5) * 1.5
        );
        bumpCtx.stroke();

        const roughShade = Math.round(182 + rng() * 45);
        roughnessCtx.strokeStyle = `rgba(${roughShade},${roughShade},${roughShade},0.34)`;
        roughnessCtx.lineWidth = 1;
        roughnessCtx.beginPath();
        roughnessCtx.moveTo(gx, gy);
        roughnessCtx.lineTo(Math.min(px + pw, gx + length), gy + (rng() - 0.5) * 1.8);
        roughnessCtx.stroke();
      }

      // Sparse, restrained knots: enough to stop repetition looking synthetic without
      // turning the apartment into a rustic log cabin.
      if (pw > 145 && rng() < 0.16) {
        const knotX = px + pw * (0.2 + rng() * 0.6);
        const knotY = py + ph * (0.3 + rng() * 0.4);
        const radiusX = 3.5 + rng() * 5.5;
        const radiusY = 1.7 + rng() * 2.8;

        colourCtx.save();
        colourCtx.translate(knotX, knotY);
        colourCtx.scale(1, radiusY / radiusX);
        const knotGradient = colourCtx.createRadialGradient(0, 0, 0.5, 0, 0, radiusX);
        knotGradient.addColorStop(0, 'rgba(58,38,25,0.62)');
        knotGradient.addColorStop(0.5, 'rgba(84,53,31,0.38)');
        knotGradient.addColorStop(1, 'rgba(91,59,38,0)');
        colourCtx.fillStyle = knotGradient;
        colourCtx.beginPath();
        colourCtx.arc(0, 0, radiusX, 0, Math.PI * 2);
        colourCtx.fill();
        colourCtx.restore();

        bumpCtx.fillStyle = 'rgba(88,88,88,0.52)';
        bumpCtx.beginPath();
        bumpCtx.ellipse(knotX, knotY, radiusX, radiusY, 0, 0, Math.PI * 2);
        bumpCtx.fill();

        roughnessCtx.fillStyle = 'rgba(235,235,235,0.42)';
        roughnessCtx.beginPath();
        roughnessCtx.ellipse(knotX, knotY, radiusX * 1.35, radiusY * 1.35, 0, 0, Math.PI * 2);
        roughnessCtx.fill();
      }

      x += plankLength;
    }
  }

  // Fine pores and wear break up broad colour fields when viewed closely in VR.
  for (let speck = 0; speck < 10500; speck++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const alpha = 0.012 + rng() * 0.026;
    colourCtx.fillStyle = rng() > 0.54
      ? `rgba(255,239,207,${alpha})`
      : `rgba(54,37,25,${alpha})`;
    colourCtx.fillRect(x, y, 1 + (rng() > 0.94 ? 1 : 0), 1);
  }

  const repeatX = HOUSE.width / FLOOR_TILE_METRES;
  const repeatY = HOUSE.depth / FLOOR_TILE_METRES;
  return {
    colour: textureFromCanvas(colourCanvas, { repeatX, repeatY, anisotropy: 8 }),
    bump: textureFromCanvas(bumpCanvas, { repeatX, repeatY, colour: false, anisotropy: 8 }),
    roughness: textureFromCanvas(roughnessCanvas, { repeatX, repeatY, colour: false, anisotropy: 8 })
  };
}

function roofTexture() {
  return canvasTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#403e3b';
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? '#484642' : '#3b3a37';
      ctx.fillRect(0, y, width, 29);
      ctx.strokeStyle = 'rgba(15,15,15,.35)';
      ctx.beginPath();
      ctx.moveTo(0, y + 29);
      ctx.lineTo(width, y + 29);
      ctx.stroke();
      const offset = y % 64 === 0 ? 0 : 32;
      for (let x = offset; x < width; x += 64) {
        ctx.strokeStyle = 'rgba(20,20,20,.25)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 29);
        ctx.stroke();
      }
    }
  }, 5, 8);
}

export function createMaterials() {
  const plaster = plasterTexture([218, 213, 204]);
  const innerPlaster = plasterTexture([203, 197, 187]);
  const timberFloor = woodFloorTextures();
  const roof = roofTexture();

  const floor = new THREE.MeshStandardMaterial({
    name: 'Procedural_Matte_Oak_Floor',
    map: timberFloor.colour,
    bumpMap: timberFloor.bump,
    bumpScale: 0.021,
    roughnessMap: timberFloor.roughness,
    roughness: 0.98,
    metalness: 0
  });
  floor.userData.floorStyle = 'procedural-matte-oak-v2';

  return {
    outer: new THREE.MeshStandardMaterial({ map: plaster, color: 0xffffff, roughness: 0.94 }),
    inner: new THREE.MeshStandardMaterial({ map: innerPlaster, color: 0xffffff, roughness: 0.95 }),
    floor,
    foundation: new THREE.MeshStandardMaterial({ color: 0x454a4c, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.72 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.86 }),
    roof: new THREE.MeshStandardMaterial({ map: roof, color: 0xffffff, roughness: 0.9 }),
    gutter: new THREE.MeshStandardMaterial({ color: 0x3e464a, roughness: 0.7, metalness: 0.18 }),

    // Physical transmission forced an extra scene render for every XR frame. A lightly
    // tinted standard transparent pane looks almost identical here without that pass.
    glass: new THREE.MeshStandardMaterial({
      color: 0x9fc5cf,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
      side: THREE.FrontSide
    }),

    ceiling: new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.96 }),
    downlight: new THREE.MeshStandardMaterial({
      color: 0xe8e5df,
      emissive: 0xffd89a,
      emissiveIntensity: 0.55,
      roughness: 0.45,
      metalness: 0.2
    }),
    grass: new THREE.MeshStandardMaterial({ color: 0x59694f, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 1 })
  };
}
