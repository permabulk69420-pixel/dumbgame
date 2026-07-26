# Furniture assets

Put the desk file in this folder as:

- `ComputerDesk.glb`

# Asset conventions

Everything is built to these rules so props are interchangeable.

- **Units:** metres, 1:1 with the world.
- **Up axis:** +Y. **Facing:** −Z is the front of a prop (the side you approach).
- **Origin:** floor level, centred on the footprint. Props sit at y=0, so set position
  directly on the floor with no offset.
- **Materials:** flat PBR base colours, no textures yet. UVs are unwrapped, so textures
  can be added later without touching geometry.

## ComputerDesk.glb

1.40 W × 0.68 D × 0.75 H m · 348 tris · 5 nodes

| Node | Notes |
|---|---|
| `Desk_Body` | static: top, pedestal carcass, leg panel, modesty panel, plinth |
| `Drawer_Bottom` / `Drawer_Mid` / `Drawer_Top` | real drawer boxes — front, sides, base, back |
| `KeyboardTray` | sliding tray |

The pedestal is a **hollow carcass**, so an open drawer reveals an actual interior
rather than solid material. Drawers travel 0.42 m of their 0.56 m depth (25% stays
in the carcass, so they can't fall out). Tray travels 0.28 m.

### Clips

`Drawer_Bottom_Open` · `Drawer_Mid_Open` · `Drawer_Top_Open` · `KeyboardTray_Open` · `All_Open`

Same convention as the hands: each clip is **1 second, closed → open**. Scrub it,
don't play it — set `action.time` to how far open you want the drawer.

```js
const gltf = await loader.loadAsync('./ComputerDesk.glb');
scene.add(gltf.scene);
const mixer = new THREE.AnimationMixer(gltf.scene);

const drawers = {};
for (const clip of gltf.animations) {
  const a = mixer.clipAction(clip);
  a.play();
  a.paused = true;
  a.clampWhenFinished = true;
  drawers[clip.name] = a;
}

// 0 = shut, 1 = fully out. Drive from a grab/pull interaction.
function setDrawer(name, amount) {
  drawers[name + '_Open'].time = THREE.MathUtils.clamp(amount, 0, 1);
}

// Required every frame even though the actions are paused.
mixer.update(dt);
```

For a horror beat, scrub a drawer open slowly on a timer rather than snapping it —
`amount += dt * 0.15` reads as something pushing it from inside.

For direct grabbing, inspect the final GLB hierarchy first. A hit on any child of a drawer
can resolve back to that drawer node, then controller movement along the drawer's local
slide axis can drive the scrub amount.
