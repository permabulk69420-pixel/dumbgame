# Generic Modern Desktop Tower — GLB Node Manifest

## File

- **Asset:** `modern_desktop_tower.glb`
- **Format:** binary glTF 2.0 (`.glb`)
- **Unit scale:** 1 unit = 1 metre
- **Up axis:** +Y
- **Front direction:** -Z
- **Root node:** `Computer_Tower`
- **Root origin:** bottom centre on the desk-contact plane
- **Root scale:** 1, 1, 1
- **Overall exported bounds:** 0.1884 m wide × 0.4224 m deep × 0.4250 m high
- **Approximate real dimensions:** 188.4 mm wide × 422.4 mm deep × 425.0 mm high
- **Geometry budget:** 3,556 vertices / 3,956 triangles
- **UVs:** every mesh includes non-missing UV coordinates
- **Materials:** standard PBR materials packed directly into the GLB
- **External textures:** none
- **Animations / interaction logic:** none baked

## Hierarchy

```text
Computer_Tower
├─ Tower_Body
├─ Tower_FrontPanel
├─ Tower_LeftSidePanel
├─ Tower_RightSidePanel
├─ Tower_Feet
├─ Tower_FrontVent
├─ Tower_FrontIO
├─ Tower_PowerButton
├─ Tower_PowerLED
├─ Tower_DiscTray
├─ Tower_DiscEjectButton
├─ Tower_DiscLED
├─ Tower_RearPanel
├─ Tower_RearFanGrille
└─ Tower_RearIO
```

The root moves the complete tower. Interactive controls and the optical tray remain separate from the static chassis.

## Node and interaction manifest

| Node | Purpose | Pivot / origin | Local interaction axis | Suggested use |
|---|---|---|---|---|
| `Computer_Tower` | Moves the entire tower | Bottom centre at `(0, 0, 0)` | Translate/rotate root as required | Place beside or beneath the desk; all parts follow |
| `Tower_Body` | Main bevelled chassis shell | Static root-relative mesh | None | No direct animation |
| `Tower_FrontPanel` | Separate satin front fascia | Static root-relative mesh | None | No direct animation |
| `Tower_PowerButton` | Power on/off control | Centre of the circular button | Translate local **+Z** | Press inward about **1.2–1.8 mm**, then spring back |
| `Tower_PowerLED` | Power/status light | Centre of LED lens | None | Change emissive intensity/colour for off, standby and on |
| `Tower_DiscTray` | Real retractable optical tray with hidden shelf | Flush front-centre of the tray | Translate local **-Z** | Eject approximately **0.105–0.120 m** outward; retract to rest position |
| `Tower_DiscEjectButton` | Optical-drive eject control | Centre of small circular button | Translate local **+Z** | Press inward about **0.8–1.2 mm** |
| `Tower_DiscLED` | Optical-drive activity light | Centre of LED lens | None | Pulse or toggle emissive intensity during drive access |
| `Tower_FrontIO` | Static USB/audio port geometry | Root-relative | None | Optional raycast target if ports become usable later |
| `Tower_FrontVent` | Lower front air intake slats | Root-relative | None | Static |
| `Tower_LeftSidePanel` / `Tower_RightSidePanel` | Removable-looking side covers | Root-relative | None | Static; may be hidden later for an internal-view mode |
| `Tower_RearPanel` / `Tower_RearFanGrille` / `Tower_RearIO` | Believable rear casing, fan and ports | Root-relative | None | Static |
| `Tower_Feet` | Four desk-contact feet | Bottom surfaces at Y = 0 | None | Static |

## Materials

| Material | Main assignment | PBR intent |
|---|---|---|
| `Tower_CharcoalShell` | Body and side panels | Dark powder-coated chassis, slight metallic response |
| `Tower_SatinFront` | Front fascia | Satin black moulded polymer |
| `Tower_DarkTrim` | Vent slats, feet, tray, grille | Very dark rough polymer/rubber |
| `Tower_Buttons` | Power and eject buttons | Slightly lighter tactile plastic |
| `Tower_RearMetal` | Rear panel | Exposed dark steel-like finish |
| `Tower_PortInterior` | USB/audio/rear port recesses | Near-black high-roughness interior |
| `Tower_PowerLED` | `Tower_PowerLED` | Emissive-capable blue lens |
| `Tower_DiskLED` | `Tower_DiscLED` | Emissive-capable amber activity lens |

## Three.js implementation notes

```js
const tower = gltf.scene.getObjectByName('Computer_Tower');
const powerButton = gltf.scene.getObjectByName('Tower_PowerButton');
const powerLED = gltf.scene.getObjectByName('Tower_PowerLED');
const discTray = gltf.scene.getObjectByName('Tower_DiscTray');
const ejectButton = gltf.scene.getObjectByName('Tower_DiscEjectButton');
const discLED = gltf.scene.getObjectByName('Tower_DiscLED');
```

- The tower front points toward **-Z**.
- Cache each interactive node's rest transform immediately after loading.
- Button travel is local **+Z**, because pressing the front controls moves them inward toward the chassis.
- Tray ejection is local **-Z**, directly out of the front face.
- Do not scale an individual interactive node to simulate a press; translate it so raycasting and proportions remain stable.
- LED materials are emissive-capable. Change `material.emissiveIntensity`, and optionally `material.emissive`, for state feedback.
- The optical tray shelf is intentionally stored inside the case when retracted so it becomes visible during ejection. It is not an accidental duplicate or hidden internal chassis surface.
- Node names are tower-prefixed to avoid collisions when this asset is loaded alongside the monitor and mouse.
