import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE } from './config.js?v=10';

const FLOOR_TEXTURE_SIZE = 1024;
const GENERATED_FLOOR_TILE_METRES = 2.6;
const GENERATED_FLOOR_URL = './assets/textures/floor/oak_floor_basecolor.png?v=1';

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
    const luminance = source.data[index] * 0.2126
      + source.data[index + 1] * 0.7152
      + source.data[index + 2] * 0.0722;
    const blurredLuminance = blurred.data[index] * 0.2126
      + blurred.data[index + 1] * 0.7152
      + blurred.data[index + 2] * 0.0722;
    const detail = luminance - blurredLuminance;
    const bumpValue = THREE.MathUtils.clamp(
      Math.round(128 + detail * 1.18 + (luminance - 128) * 0.07),
      20,
      236
    );
    const roughValue = THREE.MathUtils.clamp(
      Math.round(225 + Math.abs(detail) * 0.34 + (128 - luminance) * 0.055),
      198,
      246
    );

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

function loadGeneratedFloorTexture(floor) {
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
        floor.color.setHex(0xffffff);
        floor.bumpScale = 0.018;
        floor.roughness = 1;
        floor.name = 'Generated_Matte_Oak_Floor';
        floor.userData.floorStyle = 'generated-oak-image-v1';
        floor.userData.textureUrl = GENERATED_FLOOR_URL;
        floor.needsUpdate = true;
      } catch (error) {
        colourTexture.dispose();
        console.warn('Generated floor texture loaded but its material maps could not be derived.', error);
      }
    },
    undefined,
    (error) => {
      console.warn('Generated floor texture could not load; keeping the flat oak fallback.', error);
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
  const roof = roofTexture();

  const floor = new THREE.MeshStandardMaterial({
    name: 'Flat_Oak_Floor_Fallback',
    color: 0xa98255,
    roughness: 0.96,
    metalness: 0
  });
  floor.userData.floorStyle = 'flat-oak-fallback';
  loadGeneratedFloorTexture(floor);

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
