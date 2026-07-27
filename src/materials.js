import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from './config.js?v=10';

const FLOOR_TEXTURE_SIZE = 1024;
const FALLBACK_FLOOR_TILE_METRES = 8;
const GENERATED_FLOOR_TILE_METRES = 2.6;
const GENERATED_FLOOR_URL = './assets/textures/floor/oak_floor_basecolor.png?v=1';

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

function fallbackOakTextures() {
  const size = FLOOR_TEXTURE_SIZE;
  const colourCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughnessCanvas = makeCanvas(size, size);
  const colourCtx = colourCanvas.getContext('2d');
  const bumpCtx = bumpCanvas.getContext('2d');
  const roughnessCtx = roughnessCanvas.getContext('2d');
  const rng = seededRandom(0x0a4c2026);
  const rows = 48;
  const rowHeight = size / rows;
  const seam = 1.35;
  const palette = [
    [151, 126, 94],
    [142, 116, 86],
    [163, 136, 101],
    [132, 108, 82],
    [156, 129, 96],
    [146, 121, 91]
  ];

  colourCtx.fillStyle = '#49392d';
  colourCtx.fillRect(0, 0, size, size);
  bumpCtx.fillStyle = 'rgb(58,58,58)';
  bumpCtx.fillRect(0, 0, size, size);
  roughnessCtx.fillStyle = 'rgb(239,239,239)';
  roughnessCtx.fillRect(0, 0, size, size);

  for (let row = 0; row < rows; row++) {
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
      const gradient = colourCtx.createLinearGradient(px, py, px, py + ph);
      gradient.addColorStop(0, colourString(base, tint - 5));
      gradient.addColorStop(0.25, colourString(base, tint + 7));
      gradient.addColorStop(0.78, colourString(base, tint + 1));
      gradient.addColorStop(1, colourString(base, tint - 6));
      colourCtx.fillStyle = gradient;
      colourCtx.fillRect(px, py, pw, ph);

      const bumpValue = Math.round(126 + (rng() - 0.5) * 9);
      bumpCtx.fillStyle = `rgb(${bumpValue},${bumpValue},${bumpValue})`;
      bumpCtx.fillRect(px, py, pw, ph);

      const roughValue = Math.round(198 + rng() * 23);
      roughnessCtx.fillStyle = `rgb(${roughValue},${roughValue},${roughValue})`;
      roughnessCtx.fillRect(px, py, pw, ph);

      const grainCount = Math.max(5, Math.round(pw / 36));
      for (let grain = 0; grain < grainCount; grain++) {
        const gy = py + 3 + rng() * Math.max(2, ph - 6);
        const gx = px + rng() * pw;
        const length = 20 + rng() * Math.min(95, pw * 0.38);
        const wave = (rng() - 0.5) * 2.5;

        colourCtx.strokeStyle = `rgba(55,35,22,${0.035 + rng() * 0.075})`;
        colourCtx.lineWidth = 0.7;
        colourCtx.beginPath();
        colourCtx.moveTo(gx, gy);
        colourCtx.bezierCurveTo(gx + length * 0.35, gy + wave, gx + length * 0.72, gy - wave,
          Math.min(px + pw, gx + length), gy + wave * 0.35);
        colourCtx.stroke();

        bumpCtx.strokeStyle = `rgba(112,112,112,${0.28 + rng() * 0.28})`;
        bumpCtx.lineWidth = 0.75;
        bumpCtx.beginPath();
        bumpCtx.moveTo(gx, gy);
        bumpCtx.lineTo(Math.min(px + pw, gx + length), gy + wave * 0.3);
        bumpCtx.stroke();
      }

      x += plankLength;
    }
  }

  const repeatX = HOUSE.width / FALLBACK_FLOOR_TILE_METRES;
  const repeatY = HOUSE.depth / FALLBACK_FLOOR_TILE_METRES;
  return {
    colour: textureFromCanvas(colourCanvas, { repeatX, repeatY, anisotropy: 8 }),
    bump: textureFromCanvas(bumpCanvas, { repeatX, repeatY, colour: false, anisotropy: 8 }),
    roughness: textureFromCanvas(roughnessCanvas, { repeatX, repeatY, colour: false, anisotropy: 8 })
  };
}

function floorRepeats() {
  return {
    x: HOUSE.width / GENERATED_FLOOR_TILE_METRES,
    y: HOUSE.depth / GENERATED_FLOOR_TILE_METRES
  };
}

function configureFloorTexture(texture, colour = true) {
  const repeat = floorRepeats();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat.x, repeat.y);
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function deriveFloorMaps(image) {
  const sourceWidth = image.naturalWidth || image.width || FLOOR_TEXTURE_SIZE;
  const sourceHeight = image.naturalHeight || image.height || FLOOR_TEXTURE_SIZE;
  const size = Math.max(256, Math.min(FLOOR_TEXTURE_SIZE, sourceWidth, sourceHeight));
  const sourceCanvas = makeCanvas(size, size);
  const blurCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughnessCanvas = makeCanvas(size, size);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
  const bumpCtx = bumpCanvas.getContext('2d');
  const roughnessCtx = roughnessCanvas.getContext('2d');

  sourceCtx.drawImage(image, 0, 0, size, size);
  blurCtx.filter = 'blur(4px)';
  blurCtx.drawImage(sourceCanvas, 0, 0);
  blurCtx.filter = 'none';

  const source = sourceCtx.getImageData(0, 0, size, size);
  const blurred = blurCtx.getImageData(0, 0, size, size);
  const bump = bumpCtx.createImageData(size, size);
  const roughness = roughnessCtx.createImageData(size, size);

  for (let index = 0; index < source.data.length; index += 4) {
    const luminance = source.data[index] * 0.2126 + source.data[index + 1] * 0.7152 + source.data[index + 2] * 0.0722;
    const blurredLuminance = blurred.data[index] * 0.2126 + blurred.data[index + 1] * 0.7152 + blurred.data[index + 2] * 0.0722;
    const detail = luminance - blurredLuminance;
    const bumpValue = THREE.MathUtils.clamp(Math.round(128 + detail * 1.18 + (luminance - 128) * 0.07), 20, 236);
    const roughValue = THREE.MathUtils.clamp(Math.round(225 + Math.abs(detail) * 0.34 + (128 - luminance) * 0.055), 198, 246);

    bump.data[index] = bumpValue;
    bump.data[index + 1] = bumpValue;
    bump.data[index + 2] = bumpValue;
    bump.data[index + 3] = 255;

    roughness.data[index] = roughValue;
    roughness.data[index + 1] = roughValue;
    roughness.data[index + 2] = roughValue;
    roughness.data[index + 3] = 255;
  }

  bumpCtx.putImageData(bump, 0, 0);
  roughnessCtx.putImageData(roughness, 0, 0);
  return {
    bump: configureFloorTexture(new THREE.CanvasTexture(bumpCanvas), false),
    roughness: configureFloorTexture(new THREE.CanvasTexture(roughnessCanvas), false)
  };
}

function loadGeneratedFloorTexture(floor, fallback) {
  const loader = new THREE.TextureLoader();
  loader.load(
    GENERATED_FLOOR_URL,
    (colourTexture) => {
      try {
        configureFloorTexture(colourTexture, true);
        const derived = deriveFloorMaps(colourTexture.image);
        floor.map = colourTexture;
        floor.bumpMap = derived.bump;
        floor.roughnessMap = derived.roughness;
        floor.bumpScale = 0.018;
        floor.roughness = 1;
        floor.name = 'Generated_Matte_Oak_Floor';
        floor.userData.floorStyle = 'generated-oak-image-v1';
        floor.userData.textureUrl = GENERATED_FLOOR_URL;
        floor.needsUpdate = true;

        fallback.colour.dispose();
        fallback.bump.dispose();
        fallback.roughness.dispose();
      } catch (error) {
        colourTexture.dispose();
        console.warn('Generated floor texture loaded but its material maps could not be derived.', error);
      }
    },
    undefined,
    (error) => {
      console.warn('Generated floor texture could not load; keeping the procedural oak fallback.', error);
    }
  );
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
  const timberFloor = fallbackOakTextures();
  const roof = roofTexture();

  const floor = new THREE.MeshStandardMaterial({
    name: 'Procedural_Matte_Oak_Floor_Fallback',
    map: timberFloor.colour,
    bumpMap: timberFloor.bump,
    bumpScale: 0.021,
    roughnessMap: timberFloor.roughness,
    roughness: 0.98,
    metalness: 0
  });
  floor.userData.floorStyle = 'procedural-matte-oak-fallback';
  loadGeneratedFloorTexture(floor, timberFloor);

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
