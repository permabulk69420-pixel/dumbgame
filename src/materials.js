import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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

function woodTexture() {
  return canvasTexture(512, 512, (ctx, width, height) => {
    ctx.fillStyle = '#886f5c';
    ctx.fillRect(0, 0, width, height);
    const plankHeight = 64;
    for (let y = 0; y < height; y += plankHeight) {
      ctx.fillStyle = y % (plankHeight * 2) === 0 ? '#907760' : '#816956';
      ctx.fillRect(0, y, width, plankHeight - 2);
      ctx.strokeStyle = 'rgba(50,32,22,.30)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + plankHeight - 2);
      ctx.lineTo(width, y + plankHeight - 2);
      ctx.stroke();
      const joint = (y / plankHeight) % 2 === 0 ? 120 : 380;
      ctx.strokeStyle = 'rgba(55,35,24,.22)';
      ctx.beginPath();
      ctx.moveTo(joint, y);
      ctx.lineTo(joint, y + plankHeight - 2);
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const x = Math.random() * width;
        const yy = y + 8 + Math.random() * (plankHeight - 18);
        ctx.strokeStyle = `rgba(65,42,28,${0.04 + Math.random() * 0.07})`;
        ctx.beginPath();
        ctx.moveTo(x - 18, yy);
        ctx.bezierCurveTo(x - 5, yy - 3, x + 7, yy + 3, x + 22, yy);
        ctx.stroke();
      }
    }
  }, 5, 5);
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
  const timberFloor = woodTexture();
  const roof = roofTexture();

  return {
    outer: new THREE.MeshStandardMaterial({ map: plaster, color: 0xffffff, roughness: 0.94 }),
    inner: new THREE.MeshStandardMaterial({ map: innerPlaster, color: 0xffffff, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: timberFloor, color: 0xffffff, roughness: 0.82 }),
    foundation: new THREE.MeshStandardMaterial({ color: 0x454a4c, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.72 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x4b3a2e, roughness: 0.86 }),
    roof: new THREE.MeshStandardMaterial({ map: roof, color: 0xffffff, roughness: 0.9 }),
    gutter: new THREE.MeshStandardMaterial({ color: 0x3e464a, roughness: 0.7, metalness: 0.18 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xb9d7df,
      roughness: 0.12,
      transparent: true,
      opacity: 0.34,
      transmission: 0.22,
      side: THREE.DoubleSide
    }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.96 }),
    downlight: new THREE.MeshStandardMaterial({ color: 0xe8e5df, roughness: 0.45, metalness: 0.2 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x59694f, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 1 })
  };
}
