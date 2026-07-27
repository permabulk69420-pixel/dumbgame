# Basic_Wall_Light_Switch.glb

## Asset summary

- **Format:** binary glTF 2.0 / GLB
- **Scale:** 1 unit = 1 metre
- **Measured dimensions:** **0.0740 m wide × 0.1160 m high × 0.0244 m deep**
- **Triangle count:** **484**
- **Coordinate system:** +Y up; visible/front side faces local -Z
- **Root node:** `LightSwitch`
- **Root origin:** `(0,0,0)`, bottom-centre of the wall-contact plane
- **Root scale:** `(1,1,1)`
- **Negative scales:** none
- **Animations:** none
- **Scripts/gameplay logic:** none

## Exact hierarchy

```text
LightSwitch
├─ Switch_Plate
├─ Switch_Recess
├─ Switch_Toggle
│  └─ Switch_Interaction_Point
├─ Switch_Screws
└─ Wall_Mount_Point
```

## Switch interaction

- **Movable node:** `Switch_Toggle`
- **Pivot:** centre of the rocker/hinge
- **Pivot local position:** `(0.0000, 0.0580, -0.0123)` m
- **Rotation axis:** local `X`
- **Imported/default state:** ON
- **ON rotation:** `+12°` around local X
- **OFF rotation:** `-12°` around local X
- **Total travel:** `24°`
- **ON:** upper half pressed inward toward the wall
- **OFF:** lower half pressed inward toward the wall

```js
switchToggle.rotation.x = THREE.MathUtils.degToRad(isOn ? 12 : -12);
```

## Locator nodes

- **`Switch_Interaction_Point`**
  - Empty child of `Switch_Toggle`
  - Moves automatically with the rocker
  - Local position `(0.0000, 0.0000, -0.0075)` m

- **`Wall_Mount_Point`**
  - Empty child of `LightSwitch`
  - Local position `(0.0000, 0.0580, 0.0000)` m
  - Centre of the wall-contact surface

## Materials

- `Switch_Plate_OffWhite`
- `Switch_Rocker_OffWhite`
- `Switch_Recess_Shadow`
- `Switch_Screw_Metal`

All materials are opaque standard PBR materials with no external textures.

## Verification

- `Switch_Toggle` is separate from the plate and recess
- `Switch_Interaction_Point` verified as a child of `Switch_Toggle`
- Rocker pivot verified at the hinge centre
- Local X verified as the flick axis
- Front orientation verified as local -Z
- Root scale verified as `(1,1,1)`
- No negative scales
- No baked animation or scripts
- Suitable for Three.js/WebXR and standalone Quest 3
