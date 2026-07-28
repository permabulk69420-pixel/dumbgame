# Basic_Apartment_Ceiling_Light.glb

## Asset summary
- **Style:** basic flush-mount apartment “oyster” ceiling light
- **Format:** binary glTF 2.0 / GLB
- **Scale:** 1 unit = 1 metre
- **Dimensions:** **0.320 m diameter × 0.102 m drop**
- **Triangle count:** **3,328**
- **Coordinate system:** +Y up
- **Root node:** `CeilingLight`
- **Root origin:** ceiling-contact centre at `(0,0,0)`
- **Fixture extends:** downward along local `-Y`
- **Root scale:** `(1,1,1)`
- **Negative scales:** none
- **Animations:** none
- **Scripts/gameplay logic:** none

## Exact hierarchy
```text
CeilingLight
├─ CeilingLight_Base
├─ CeilingLight_Rim
├─ CeilingLight_Inner
├─ Light_Diffuser
├─ Ceiling_Mount_Point
├─ Light_Origin
└─ Light_Aim_Point
```

## Node purposes
- `CeilingLight_Base`
  - Static ceiling-contact housing

- `CeilingLight_Rim`
  - Static white outer trim

- `CeilingLight_Inner`
  - Static inner recess behind the diffuser

- `Light_Diffuser`
  - Separate frosted visible dome
  - Uses `CeilingLight_Diffuser_Frosted`
  - Emissive-capable material, exported with emissive output disabled
  - The game may enable or disable emissive colour/intensity directly

- `Ceiling_Mount_Point`
  - Empty locator at `(0.000, 0.000, 0.000)` m
  - Use for snapping the fixture to the ceiling

- `Light_Origin`
  - Empty locator at `(0.000, -0.078, 0.000)` m
  - Attach the actual Three.js `PointLight` or `SpotLight` here
  - Downward direction is local `-Y`

- `Light_Aim_Point`
  - Empty locator at `(0.000, -1.078, 0.000)` m
  - Optional point directly below the fixture for aiming a spotlight

## Suggested switch behaviour
```js
roomLight.visible = isOn;
roomLight.intensity = isOn ? 2.0 : 0.0;

const diffuser = ceilingLight.getObjectByName('Light_Diffuser');
diffuser.material.emissive.set(isOn ? 0xfff2cf : 0x000000);
diffuser.material.emissiveIntensity = isOn ? 1.4 : 0.0;
```

The GLB contains no switching logic. The wall switch can control one or several instances in Three.js.

## Materials
- `CeilingLight_Rim_White`
- `CeilingLight_Base_White`
- `CeilingLight_Diffuser_Frosted`
- `CeilingLight_Inner_Shadow`

All materials are opaque Three.js-compatible PBR materials with no external textures.

## Verification
- Root node and hierarchy verified after export
- Ceiling-contact origin fixed at `(0,0,0)`
- `Light_Diffuser` remains separate
- `Light_Origin` and `Light_Aim_Point` are empty locators
- Root scale verified as `(1,1,1)`
- No negative scales
- No baked animations or scripts
- Suitable for Three.js/WebXR and standalone Quest 3
