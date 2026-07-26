# Generic Modern Desktop Mouse — GLB Node Manifest

## File

- **Asset:** `modern_desktop_mouse.glb`
- **Format:** binary glTF 2.0 (`.glb`)
- **Unit scale:** 1 unit = 1 metre
- **Up axis:** +Y
- **Front direction:** -Z
- **Root node:** `Mouse`
- **Root origin:** bottom centre on the desk-contact plane
- **Root scale:** 1, 1, 1
- **Overall exported bounds:** 0.0676 m wide × 0.1230 m long × 0.0445 m high
- **Approximate real dimensions:** 123.0 mm long × 67.6 mm wide × 44.5 mm high
- **Geometry budget:** 2,220 vertices / 4,344 triangles
- **Textures:** none required; all PBR material definitions are packed inside the GLB
- **UVs:** every mesh includes UV coordinates
- **Animations:** none baked

## Hierarchy

```text
Mouse
├─ Mouse_Body
├─ Mouse_LeftButton
├─ Mouse_RightButton
├─ Mouse_Wheel
├─ Mouse_WheelButton
└─ Mouse_LED
```

All interactive parts remain separate nodes and are not merged into `Mouse_Body`.

## Node and interaction manifest

| Node | Purpose | Pivot / origin | Local interaction axis | Suggested motion |
|---|---|---|---|---|
| `Mouse` | Moves the entire mouse over the desk surface | Bottom centre at `(0, 0, 0)` | Translate local/world X and Z | Map root X/Z movement to cursor movement; keep Y at desk height |
| `Mouse_Body` | Static ergonomic shell and simple underside | Root-relative static mesh | None | No direct animation |
| `Mouse_LeftButton` | Separate left click panel | Rear hinge line of the left panel | Rotate around local X | Press with approximately **-1.5° to -2.5°** X rotation, then spring back |
| `Mouse_RightButton` | Separate right click panel | Rear hinge line of the right panel | Rotate around local X | Press with approximately **-1.5° to -2.5°** X rotation, then spring back |
| `Mouse_Wheel` | Rubber scroll wheel | Exact wheel axle centre | Rotate around local X; translate local -Y for click | Scroll by changing local X rotation; wheel click travel about **0.8–1.2 mm** downward |
| `Mouse_WheelButton` | Visible wheel rocker/cradle and optional click target | Same axle-centred pivot as the wheel | Translate local -Y | Move downward with `Mouse_Wheel` during middle click |
| `Mouse_LED` | Status / power indicator | Centre of the top LED lens | None | Change emissive intensity or colour in Three.js |

### Wheel-click implementation note

`Mouse_Wheel` and `Mouse_WheelButton` are direct children of `Mouse` to preserve the requested hierarchy. For a middle click, translate **both nodes** together along local **-Y**. The wheel itself remains axle-centred, so rolling still uses local X rotation without remodelling.

## Materials

| Material | Assigned nodes | PBR intent |
|---|---|---|
| `Mouse_MatteCharcoal` | `Mouse_Body` | Near-black matte polymer, low metallic, high roughness |
| `Mouse_ButtonGraphite` | `Mouse_LeftButton`, `Mouse_RightButton` | Slightly lighter polymer for readable panel separation |
| `Mouse_WheelRubber` | `Mouse_Wheel` | Dark rough rubber with restrained geometric tread |
| `Mouse_WheelMechanism` | `Mouse_WheelButton` | Dark internal plastic / rocker |
| `Mouse_StatusLED` | `Mouse_LED` | Emissive-capable blue status lens with alpha blending |

No logos, branding, baked cursor movement, hidden sensor internals, external textures or interaction logic are included.

## Three.js implementation notes

```js
const mouse = gltf.scene.getObjectByName('Mouse');
const leftButton = gltf.scene.getObjectByName('Mouse_LeftButton');
const rightButton = gltf.scene.getObjectByName('Mouse_RightButton');
const wheel = gltf.scene.getObjectByName('Mouse_Wheel');
const wheelButton = gltf.scene.getObjectByName('Mouse_WheelButton');
const led = gltf.scene.getObjectByName('Mouse_LED');
```

- The asset front points toward **-Z**.
- Move `Mouse.position.x` and `Mouse.position.z` to slide the full asset over a desk.
- Cache each interactive node's rest transform before animating.
- Use a small negative local-X rotation for left/right button presses.
- Increment `Mouse_Wheel.rotation.x` for scroll motion.
- For middle click, apply the same small local-Y offset to both `Mouse_Wheel` and `Mouse_WheelButton`.
- The LED material is emissive-capable; changing `material.emissiveIntensity` is sufficient for on/off states.
