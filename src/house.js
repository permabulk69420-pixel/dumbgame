import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { HOUSE, SCALE } from './config.js';

export function createHouse(scene, MAT) {
  const { width: WIDTH, depth: DEPTH, wallHeight: WALL_H,
    wallThickness: WALL_T, slabHeight: SLAB_H } = HOUSE;

  const xL = -WIDTH / 2;
  const xR = WIDTH / 2;
  const zF = -DEPTH / 2;
  const zB = DEPTH / 2;
  const xBedroomWall = xL + 14 * SCALE;
  const xHallWall = xBedroomWall + 4 * SCALE;
  const zBedroomOne = zF + 10 * SCALE;
  const zBedroomTwo = zF + 20 * SCALE;
  const zLivingKitchen = zF + 16 * SCALE;

  const house = new THREE.Group();
  house.name = 'Apartment';
  scene.add(house);
  const collisionSegments = [];
  const jointQueue = new Map();

  function box(w, h, d, x, y, z, material, cast = true, parent = house) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // The playable apartment stays at local-floor height. The heavy slab and building
  // mass below it sell the fact that this is a mid-rise floor rather than a ground house.
  box(WIDTH + 0.55, 0.34, DEPTH + 0.55, 0, -0.17, 0, MAT.foundation);
  box(WIDTH, SLAB_H, DEPTH, 0, SLAB_H / 2, 0, MAT.floor);
  box(WIDTH + 1.2, 18, DEPTH + 1.2, 0, -9.34, 0, MAT.foundation, false);

  function pointAlong(x1, z1, x2, z2, distance) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    return { x: x1 + dx / length * distance, z: z1 + dz / length * distance };
  }

  function addCollision(x1, z1, x2, z2) {
    collisionSegments.push({ x1, z1, x2, z2 });
  }

  function queueJoint(x, z, material) {
    const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
    if (!jointQueue.has(key) || material === MAT.outer) jointQueue.set(key, { x, z, material });
  }

  function addWallBox(x1, z1, x2, z2, height = WALL_H, y = SLAB_H, material = MAT.outer) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.005 || height < 0.005) return null;
    const mesh = box(length + 0.045, height, WALL_T, (x1 + x2) / 2, y + height / 2,
      (z1 + z2) / 2, material);
    mesh.rotation.y = -Math.atan2(dz, dx);
    return mesh;
  }

  function addStrip(x1, z1, x2, z2, y, height, depth, material, side = 0) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.005) return;
    const nx = -dz / length;
    const nz = dx / length;
    const mesh = box(length + 0.03, height, depth,
      (x1 + x2) / 2 + nx * side, y, (z1 + z2) / 2 + nz * side, material, false);
    mesh.rotation.y = -Math.atan2(dz, dx);
  }

  function addBaseboardSegment(x1, z1, x2, z2, exterior) {
    const offset = WALL_T / 2 + 0.018;
    const y = SLAB_H + 0.065;
    addStrip(x1, z1, x2, z2, y, 0.13, 0.035, MAT.trim, offset);
    if (!exterior) addStrip(x1, z1, x2, z2, y, 0.13, 0.035, MAT.trim, -offset);
  }

  function addCrownRun(x1, z1, x2, z2, exterior) {
    const offset = WALL_T / 2 + 0.018;
    const y = SLAB_H + WALL_H - 0.055;
    addStrip(x1, z1, x2, z2, y, 0.11, 0.04, MAT.trim, offset);
    if (!exterior) addStrip(x1, z1, x2, z2, y, 0.11, 0.04, MAT.trim, -offset);
  }

  function addWindow(x1, z1, x2, z2, opening) {
    const centre = pointAlong(x1, z1, x2, z2, opening.at);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const group = new THREE.Group();
    group.position.set(centre.x, SLAB_H + opening.bottom + opening.height / 2, centre.z);
    group.rotation.y = -angle;

    const glass = new THREE.Mesh(new THREE.BoxGeometry(opening.width * 0.91, opening.height * 0.88, 0.03), MAT.glass);
    glass.castShadow = false;
    group.add(glass);

    const vGeo = new THREE.BoxGeometry(0.065, opening.height + 0.06, 0.11);
    const hGeo = new THREE.BoxGeometry(opening.width + 0.06, 0.065, 0.11);
    const left = new THREE.Mesh(vGeo, MAT.trim);
    left.position.x = -opening.width * 0.48;
    group.add(left);
    const right = left.clone();
    right.position.x = opening.width * 0.48;
    group.add(right);
    const top = new THREE.Mesh(hGeo, MAT.trim);
    top.position.y = opening.height * 0.5;
    group.add(top);
    const bottom = top.clone();
    bottom.position.y = -opening.height * 0.5;
    group.add(bottom);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.052, opening.height * 0.92, 0.08), MAT.trim);
    group.add(mullion);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(opening.width + 0.16, 0.055, 0.28), MAT.trim);
    sill.position.y = -opening.height * 0.5 - 0.035;
    group.add(sill);
    house.add(group);
  }

  function addDoorFrame(x1, z1, x2, z2, opening) {
    const centre = pointAlong(x1, z1, x2, z2, opening.at);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const group = new THREE.Group();
    group.position.set(centre.x, SLAB_H, centre.z);
    group.rotation.y = -angle;
    const postGeo = new THREE.BoxGeometry(0.095, opening.height + 0.05, 0.27);
    const left = new THREE.Mesh(postGeo, MAT.trim);
    left.position.set(-opening.width / 2, opening.height / 2, 0);
    group.add(left);
    const right = left.clone();
    right.position.x = opening.width / 2;
    group.add(right);
    const top = new THREE.Mesh(new THREE.BoxGeometry(opening.width + 0.095, 0.095, 0.27), MAT.trim);
    top.position.y = opening.height;
    group.add(top);
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(opening.width, 0.028, 0.24), MAT.timber);
    threshold.position.y = 0.015;
    threshold.receiveShadow = true;
    group.add(threshold);
    house.add(group);
  }

  function wallRun(x1, z1, x2, z2, openings = [], material = MAT.outer) {
    const exterior = material === MAT.outer;
    const length = Math.hypot(x2 - x1, z2 - z1);
    const sorted = [...openings].sort((a, b) => (a.at - a.width / 2) - (b.at - b.width / 2));
    queueJoint(x1, z1, material);
    queueJoint(x2, z2, material);
    addCrownRun(x1, z1, x2, z2, exterior);
    let cursor = 0;

    for (const opening of sorted) {
      const start = Math.max(0, opening.at - opening.width / 2);
      const end = Math.min(length, opening.at + opening.width / 2);
      if (start > cursor) {
        const a = pointAlong(x1, z1, x2, z2, cursor);
        const b = pointAlong(x1, z1, x2, z2, start);
        addWallBox(a.x, a.z, b.x, b.z, WALL_H, SLAB_H, material);
        addCollision(a.x, a.z, b.x, b.z);
        addBaseboardSegment(a.x, a.z, b.x, b.z, exterior);
      }

      const a = pointAlong(x1, z1, x2, z2, start);
      const b = pointAlong(x1, z1, x2, z2, end);
      if (opening.kind === 'door') {
        addWallBox(a.x, a.z, b.x, b.z, WALL_H - opening.height, SLAB_H + opening.height, material);
        addDoorFrame(x1, z1, x2, z2, opening);
      } else {
        addWallBox(a.x, a.z, b.x, b.z, opening.bottom, SLAB_H, material);
        const topStart = opening.bottom + opening.height;
        addWallBox(a.x, a.z, b.x, b.z, WALL_H - topStart, SLAB_H + topStart, material);
        addWindow(x1, z1, x2, z2, opening);
        addCollision(a.x, a.z, b.x, b.z);
        addBaseboardSegment(a.x, a.z, b.x, b.z, exterior);
      }
      cursor = end;
    }

    if (cursor < length) {
      const a = pointAlong(x1, z1, x2, z2, cursor);
      const b = pointAlong(x1, z1, x2, z2, length);
      addWallBox(a.x, a.z, b.x, b.z, WALL_H, SLAB_H, material);
      addCollision(a.x, a.z, b.x, b.z);
      addBaseboardSegment(a.x, a.z, b.x, b.z, exterior);
    }
  }

  const door = (at, width = 3 * SCALE) => ({ kind: 'door', at, width, height: 2.16 });
  const wide = (at, width = 4 * SCALE) => ({ kind: 'door', at, width, height: 2.35 });
  const windowGap = (at, width = 4 * SCALE, bottom = 0.86, height = 1.18) =>
    ({ kind: 'window', at, width, bottom, height });

  // The corridor-facing wall now has only the apartment entry. Exterior windows remain
  // on the other three sides, and the rear door becomes the balcony door.
  wallRun(xL, zF, xR, zF, [door(16 * SCALE, 3 * SCALE)]);
  wallRun(xR, zF, xR, zB, [windowGap(5 * SCALE), windowGap(13 * SCALE), windowGap(25 * SCALE)]);
  wallRun(xR, zB, xL, zB, [door(5 * SCALE, 3 * SCALE), windowGap(11 * SCALE), windowGap(26 * SCALE)]);
  wallRun(xL, zB, xL, zF, [windowGap(5 * SCALE), windowGap(16 * SCALE), windowGap(27 * SCALE)]);

  wallRun(xL, zBedroomOne, xBedroomWall, zBedroomOne, [], MAT.inner);
  wallRun(xL, zBedroomTwo, xBedroomWall, zBedroomTwo, [], MAT.inner);
  wallRun(xBedroomWall, zF, xBedroomWall, zB,
    [door(5.3 * SCALE), door(15.2 * SCALE), door(25.6 * SCALE)], MAT.inner);
  wallRun(xHallWall, zF, xHallWall, zB, [
    wide(4.4 * SCALE, 4.5 * SCALE), door(15 * SCALE, 3 * SCALE),
    door(21.6 * SCALE, 2.8 * SCALE), wide(27.5 * SCALE, 4.5 * SCALE)
  ], MAT.inner);
  wallRun(xHallWall + 6 * SCALE, zLivingKitchen, xR, zLivingKitchen,
    [wide(6.5 * SCALE, 5.5 * SCALE)], MAT.inner);

  const bathRight = xHallWall + 6 * SCALE;
  const bathFront = zF + 12 * SCALE;
  const bathBack = zF + 19 * SCALE;
  wallRun(xHallWall, bathFront, bathRight, bathFront, [], MAT.inner);
  wallRun(bathRight, bathFront, bathRight, bathBack, [], MAT.inner);
  wallRun(bathRight, bathBack, xHallWall, bathBack, [], MAT.inner);

  const laundryBack = zF + 25 * SCALE;
  wallRun(xHallWall, bathBack, xHallWall + 4.5 * SCALE, bathBack, [], MAT.inner);
  wallRun(xHallWall + 4.5 * SCALE, bathBack, xHallWall + 4.5 * SCALE, laundryBack, [], MAT.inner);
  wallRun(xHallWall + 4.5 * SCALE, laundryBack, xHallWall, laundryBack, [], MAT.inner);

  for (const joint of jointQueue.values()) {
    box(WALL_T + 0.055, WALL_H, WALL_T + 0.055, joint.x, SLAB_H + WALL_H / 2,
      joint.z, joint.material);
  }
  for (const [x, z] of [[xL, zF], [xR, zF], [xR, zB], [xL, zB]]) {
    box(0.13, WALL_H + 0.04, 0.13, x, SLAB_H + WALL_H / 2, z, MAT.trim);
  }

  const ceilingY = SLAB_H + WALL_H - 0.045;
  box(WIDTH - WALL_T * 1.2, 0.09, DEPTH - WALL_T * 1.2, 0, ceilingY, 0, MAT.ceiling, true);
  // Flat structural slab and a hint of the apartment above replace the suburban roof.
  box(WIDTH + 0.7, 0.32, DEPTH + 0.7, 0, ceilingY + 0.21, 0, MAT.foundation, true);

  function addDownlight(x, z, intensity = 24) {
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 18), MAT.downlight);
    fixture.position.set(x, ceilingY - 0.06, z);
    fixture.castShadow = false;
    house.add(fixture);
    const light = new THREE.PointLight(0xffe6b8, intensity, 8.5, 2);
    light.position.set(x, ceilingY - 0.18, z);
    light.castShadow = false;
    house.add(light);
  }

  addDownlight((xL + xBedroomWall) / 2, (zF + zBedroomOne) / 2, 20);
  addDownlight((xL + xBedroomWall) / 2, (zBedroomOne + zBedroomTwo) / 2, 20);
  addDownlight((xL + xBedroomWall) / 2, (zBedroomTwo + zB) / 2, 20);
  addDownlight((xHallWall + xR) / 2, (zF + zLivingKitchen) / 2, 28);
  addDownlight((xHallWall + xR) / 2, (zLivingKitchen + zB) / 2, 28);
  addDownlight((xBedroomWall + xHallWall) / 2, 0, 18);
  addDownlight((xHallWall + bathRight) / 2, (bathFront + bathBack) / 2, 18);
  addDownlight(xHallWall + 2.25 * SCALE, (bathBack + laundryBack) / 2, 16);

  function addApartmentCorridor() {
    const corridor = new THREE.Group();
    corridor.name = 'Apartment_Corridor';
    house.add(corridor);

    const extraWidth = 0.7;
    const minX = xL - extraWidth;
    const maxX = xR + extraWidth;
    const width = maxX - minX;
    const nearZ = zF - WALL_T * 0.45;
    const farZ = zF - 3.35;
    const depth = nearZ - farZ;
    const centreZ = (nearZ + farZ) / 2;

    box(width, 0.18, depth, 0, 0.05, centreZ, MAT.concrete, false, corridor);
    box(width, 0.22, depth, 0, ceilingY + 0.14, centreZ, MAT.foundation, true, corridor);
    box(width, WALL_H, WALL_T, 0, SLAB_H + WALL_H / 2, farZ, MAT.inner, true, corridor);
    box(WALL_T, WALL_H, depth, minX, SLAB_H + WALL_H / 2, centreZ, MAT.inner, true, corridor);
    box(WALL_T, WALL_H, depth, maxX, SLAB_H + WALL_H / 2, centreZ, MAT.inner, true, corridor);

    addCollision(minX, farZ, maxX, farZ);
    addCollision(minX, farZ, minX, nearZ);
    addCollision(maxX, farZ, maxX, nearZ);

    // Placeholder neighbouring apartment doors and lift doors make the hall readable now,
    // while leaving the whole area ready for later expansion into a proper shared level.
    const doorPanelZ = farZ + WALL_T / 2 + 0.022;
    for (const x of [-4.55, 3.25]) {
      box(1.08, 2.12, 0.055, x, SLAB_H + 1.06, doorPanelZ, MAT.timber, true, corridor);
      box(1.2, 0.07, 0.08, x, SLAB_H + 2.15, doorPanelZ + 0.01, MAT.trim, false, corridor);
    }

    const liftX = maxX - 1.35;
    box(2.15, 2.3, 0.06, liftX, SLAB_H + 1.15, doorPanelZ, MAT.gutter, true, corridor);
    box(0.035, 2.24, 0.075, liftX, SLAB_H + 1.15, doorPanelZ + 0.012, MAT.foundation, false, corridor);
    box(2.35, 0.09, 0.09, liftX, SLAB_H + 2.34, doorPanelZ + 0.01, MAT.trim, false, corridor);

    addDownlight(-WIDTH * 0.28, centreZ, 18);
    addDownlight(0, centreZ, 18);
    addDownlight(WIDTH * 0.28, centreZ, 18);
  }

  function addBalcony() {
    const balcony = new THREE.Group();
    balcony.name = 'Rear_Balcony';
    house.add(balcony);

    const width = 12 * SCALE;
    const depth = 2.45;
    const centreX = xR - 6 * SCALE;
    const minX = centreX - width / 2;
    const maxX = centreX + width / 2;
    const outerZ = zB + depth;
    const centreZ = zB + depth / 2;
    const railY = SLAB_H + 0.57;

    box(width, 0.18, depth, centreX, 0.05, centreZ, MAT.concrete, false, balcony);
    box(width + 0.18, 0.09, 0.09, centreX, SLAB_H + 1.13, outerZ, MAT.gutter, true, balcony);
    box(0.09, 1.08, 0.09, minX, railY, outerZ, MAT.gutter, true, balcony);
    box(0.09, 1.08, 0.09, maxX, railY, outerZ, MAT.gutter, true, balcony);

    const glassHeight = 0.86;
    const glassY = SLAB_H + glassHeight / 2 + 0.12;
    const outerGlass = box(width - 0.18, glassHeight, 0.035, centreX, glassY, outerZ - 0.025,
      MAT.glass, false, balcony);
    outerGlass.castShadow = false;
    for (const x of [minX, maxX]) {
      box(0.035, glassHeight, depth - 0.12, x, glassY, centreZ, MAT.glass, false, balcony);
      box(0.09, 0.09, depth, x, SLAB_H + 1.13, centreZ, MAT.gutter, true, balcony);
    }

    addCollision(minX, outerZ, maxX, outerZ);
    addCollision(minX, zB, minX, outerZ);
    addCollision(maxX, zB, maxX, outerZ);
  }

  function addCityView() {
    const city = new THREE.Group();
    city.name = 'LowPoly_City_View';
    scene.add(city);

    const streetLevel = -18.4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), MAT.foundation);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = streetLevel;
    ground.receiveShadow = true;
    city.add(ground);

    const towers = [
      [-34, -34, 11, 13, 25], [-17, -42, 9, 11, 32], [8, -46, 13, 10, 29],
      [29, -35, 12, 15, 36], [43, -10, 10, 12, 27], [39, 22, 14, 11, 34],
      [22, 40, 12, 14, 31], [-4, 45, 15, 12, 39], [-29, 36, 13, 15, 28],
      [-44, 10, 10, 13, 35], [18, 24, 8, 9, 22], [-20, 23, 9, 10, 24]
    ];

    for (let i = 0; i < towers.length; i++) {
      const [x, z, w, d, h] = towers[i];
      const material = i % 3 === 0 ? MAT.outer : i % 3 === 1 ? MAT.concrete : MAT.foundation;
      box(w, h, d, x, streetLevel + h / 2, z, material, true, city);

      // A few cheap bright bands read as windows from the apartment without needing textures.
      const bandCount = Math.max(2, Math.floor(h / 6));
      for (let band = 1; band < bandCount; band++) {
        const y = streetLevel + band * (h / bandCount);
        box(w + 0.035, 0.13, d + 0.035, x, y, z, MAT.trim, false, city);
      }
    }
  }

  addApartmentCorridor();
  addBalcony();
  addCityView();

  return {
    root: house,
    collisionSegments,
    floorY: SLAB_H,
    bounds: { minX: xL + WALL_T, maxX: xR - WALL_T, minZ: zF + WALL_T, maxZ: zB - WALL_T },
    spawn: new THREE.Vector3((xBedroomWall + xHallWall) / 2, 0, zF + 3.0),
    dimensions: { width: WIDTH, depth: DEPTH, wallHeight: WALL_H }
  };
}
