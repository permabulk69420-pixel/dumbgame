# Generic Modern 23–24 Inch Desktop Monitor — GLB Manifest

## File

- **Asset:** `modern_flat_monitor_24in.glb`
- **Format:** binary glTF 2.0 (`.glb`)
- **Units:** 1 unit = 1 metre
- **Up:** +Y
- **Front:** -Z
- **Root origin:** bottom centre of the complete monitor/base
- **Root scale:** 1, 1, 1
- **External textures:** none
- **Geometry:** 934 triangles, 2,802 exported vertices

## Overall dimensions

| Measurement | Metres |
|---|---:|
| Width | 0.540 |
| Height | 0.422 |
| Depth | 0.205 |

World bounds at the neutral pose:

- Minimum: X -0.2700, Y 0.0000, Z -0.1175
- Maximum: X 0.2700, Y 0.4220, Z 0.0875

The active display is **0.514 m × 0.289 m**, 16:9, approximately **23.22 inches diagonal**.

## Functional hierarchy

```text
Monitor
├─ Monitor_Base
└─ Monitor_Swivel
   ├─ Monitor_Stand
   └─ Monitor_Body
      ├─ Screen_Display
      ├─ Screen_Glass
      ├─ PowerButton
      ├─ PowerLED
      ├─ Control_Menu
      ├─ Control_Up
      └─ Control_Down
```

`Monitor_Swivel` is the vertical swivel pivot. `Monitor_Body` is the tilt pivot at the real stand hinge, so tilting the body also carries the screen, glass, LED and controls.

## Node manifest

| Node | Type / purpose | Pivot | Interaction axis |
|---|---|---|---|
| `Monitor` | Root transform | Bottom centre at world 0,0,0 | None |
| `Monitor_Base` | Static weighted base mesh | Root bottom centre | None |
| `Monitor_Swivel` | Swivel collar mesh and parent pivot | Centre of vertical axle, Y=0.018 m | Local **+Y** rotation; suggested range -45° to +45° |
| `Monitor_Stand` | Static stand mesh inside swivel group | Inherits swivel axle | None |
| `Monitor_Body` | Rear casing/bezel mesh and tilt parent | True horizontal hinge axle at stand head | Local **+X** rotation; suggested range -5° to +20° |
| `Screen_Display` | Replaceable active display plane | Centre of active panel | Front normal local **-Z**; direct raycast target |
| `Screen_Glass` | Subtle transparent perimeter glass edge | Centre of active panel | Non-interactive; active centre is intentionally open so it cannot block screen raycasts |
| `PowerButton` | Separate circular pressable mesh | Button centre | Translate inward on local **+Z**, suggested travel 0.0015 m |
| `PowerLED` | Separate emissive-capable indicator | LED centre | No movement |
| `Control_Menu` | Separate pressable menu key | Key centre | Translate inward on local **+Z**, suggested travel 0.0012 m |
| `Control_Up` | Separate pressable up key | Key centre | Translate inward on local **+Z**, suggested travel 0.0012 m |
| `Control_Down` | Separate pressable down key | Key centre | Translate inward on local **+Z**, suggested travel 0.0012 m |

Interaction metadata is also stored in each node's glTF `extras` and appears in Three.js as `object.userData` after `GLTFLoader` import.

## Materials

| Material | Used by | PBR notes |
|---|---|---|
| `Monitor_Matte_Charcoal` | Body and base | Low-metallic, medium-roughness dark polymer finish |
| `Screen_Display_Replaceable` | `Screen_Display` | Plain dark PBR material; no image, logo, reflection or baked desktop |
| `Screen_Glass_Subtle` | `Screen_Glass` | Transparent BLEND material; narrow perimeter geometry only |
| `Button_SoftTouch` | Power and control buttons | Non-metallic soft-touch finish |
| `PowerLED_Emissive` | `PowerLED` | Standard emissive material with `KHR_materials_emissive_strength` |
| `Stand_Satin_Metal` | Stand and swivel collar | Satin metallic finish |

All materials are packed inside the GLB. No external image files are referenced.

## Screen replacement

`Screen_Display` is a completely separate mesh with a single simple 0–1 UV layout:

- bottom-left: 0,0
- top-left: 0,1
- top-right: 1,1
- bottom-right: 1,0

Its front-facing normals point toward local/world **-Z** in the neutral pose. The plane sits slightly forward of the internal front panel to avoid z-fighting. Replace only its material with your `THREE.MeshBasicMaterial`, `THREE.MeshStandardMaterial`, or other material using a `THREE.CanvasTexture`.

## Runtime notes

- The glass node is a very thin perimeter layer rather than a full-screen quad, so normal centre-screen raycasts hit `Screen_Display` directly.
- Do not scale interactive child nodes during animation. Translate buttons on their local +Z axis and rotate the two pivot nodes on their documented local axes.
- The GLB contains no baked animations or interaction scripts.
- All exported node scales are 1,1,1; no negative scales are used.
