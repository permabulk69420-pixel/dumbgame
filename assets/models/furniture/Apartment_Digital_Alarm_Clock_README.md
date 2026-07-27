# Apartment Digital Alarm Clock — GLB Asset README

## Files

- `assets/models/props/Apartment_Digital_Alarm_Clock.glb`
- `assets/models/props/Apartment_Digital_Alarm_Clock_README.md`

## Asset summary

A reusable compact digital alarm clock designed to match the apartment bed and bedside table. It uses a softly rounded charcoal housing, a dark-walnut lower accent, a warm amber digital display and one broad top-mounted alarm toggle button.

The asset is prepared for runtime time display, alarm-state indication, button depression and positional alarm audio. No animation is baked.

## Coordinate system and placement

- Units: **1 unit = 1 metre**
- Up direction: **+Y**
- Front / readable display side: **local -Z**
- Rear / cable side: **local +Z**
- Root node: `AlarmClockAssembly`
- Root origin: bottom centre of the clock at table-surface level
- Root transform: position `(0, 0, 0)`, rotation `(0, 0, 0)`, scale `(1, 1, 1)`
- Negative scales: **none**

## Exact measured bounds

Measured after reloading the final GLB:

- Minimum: `(-0.1260, 0.0000, -0.0508) m`
- Maximum: `(0.1260, 0.1140, 0.0500) m`
- Complete visible size: **0.2520 m wide × 0.1008 m deep × 0.1140 m high**

Nominal dimensions:

- Walnut base: `0.252 × 0.100 × 0.012 m`
- Main housing: `0.240 × 0.090 × 0.092 m`
- Visible display slab: `0.196 × 0.052 × 0.004 m`
- Top button: `0.080 × 0.032 × 0.010 m`

## Exact hierarchy

```text
AlarmClockAssembly
├─ ClockBody
├─ WalnutBase
├─ TimeDisplay
├─ AlarmArmedIndicator
├─ AlarmButtonPivot
│  ├─ AlarmButton
│  └─ AlarmButton_Interaction
├─ Display_Content_Anchor
├─ AlarmButton_Pressed_Stop
├─ Alarm_Audio_Anchor
├─ Power_Cable_Anchor
├─ Clock_Collision
└─ Clock_Placement_Anchor
```

## Dynamic time display

`TimeDisplay` is a separate mesh with a dedicated material named `Clock_Time_Display`.

- Display centre: `(0.0000, 0.0570, -0.0470) m`
- Visible front surface: local `Z = -0.0490 m`
- Front normal: local `(0, 0, -1)`
- Display front topology: exactly **4 coplanar vertices and 2 triangles**
- UV range: full `0–1` rectangle
- Default packed display: `07:30`
- Recommended runtime canvas: `512 × 192 px` or another `8:3`-ish aspect ratio

For Three.js/WebXR, find `TimeDisplay`, clone its material if necessary, and replace `material.map` with a `CanvasTexture` containing the current time. For an LED look, assign the same canvas texture to `material.emissiveMap`, set a modest emissive colour/intensity, and set `needsUpdate = true`.

The default digits are texture content only; there is no digit geometry to rebuild or hide.

`Display_Content_Anchor` is at `(0.0000, 0.0570, -0.0491) m`, immediately in front of the display surface. It can also host a separate text plane or icon layer.

## Alarm toggle button

`AlarmButtonPivot` is an empty identity-rotation and identity-scale transform centred on the top button.

- Rest local position: `(0.0000, 0.1090, -0.0040) m`
- Press direction: local **-Y**
- Press travel: **0.004 m**
- Fully pressed local position: `(0.0000, 0.1050, -0.0040) m`
- Fixed stop node: `AlarmButton_Pressed_Stop` at `(0.0000, 0.1050, -0.0040) m`
- Runtime action: toggle the `alarmEnabled` state

Translating `AlarmButtonPivot` toward local `-Y` moves only:

- `AlarmButton`
- `AlarmButton_Interaction`

The body, display, indicator and fixed locators remain stationary.

`AlarmButton_Interaction` includes a box interaction descriptor with half-extents `(0.044, 0.010, 0.020) m`.

## Alarm-state indicator

`AlarmArmedIndicator` is a separate visible mesh at approximately `(-0.0860, 0.0760, -0.0498) m`.

- Default state: off
- Default emissive factor: `(0, 0, 0)`
- Suggested armed emissive colour: approximately `(1.0, 0.18, 0.025)`
- The indicator material is isolated from the time-display material, so changing its emissive state does not modify the clock digits.

## Runtime locators

Positions are local to `AlarmClockAssembly`:

- `Display_Content_Anchor`: `(0.0000, 0.0570, -0.0491) m`
- `AlarmButton_Pressed_Stop`: `(0.0000, 0.1050, -0.0040) m`
- `Alarm_Audio_Anchor`: `(0.0000, 0.0620, 0.0460) m`
- `Power_Cable_Anchor`: `(0.0000, 0.0280, 0.0500) m`
- `Clock_Collision`: `(0.0000, 0.0570, 0.0000) m`
- `Clock_Placement_Anchor`: `(0.0000, 0.0000, 0.0000) m`

`Clock_Collision` contains a box descriptor with half-extents `(0.126, 0.057, 0.050) m`.

## Materials

Four lightweight materials are used:

1. `Clock_Body_Charcoal`
   - softly textured charcoal polymer housing and button
   - non-metallic, moderately rough
2. `Clock_Walnut_Accent`
   - dark-walnut lower plinth matching the furniture palette
   - non-metallic wood response
3. `Clock_Time_Display`
   - separate opaque, non-metallic display material
   - no normal map, clearcoat or mirror-like metallic response
   - packed amber `07:30` texture used as both base colour and restrained emissive texture
4. `Clock_Alarm_Indicator`
   - isolated alarm-state lens material
   - emissive off by default and intended to be changed at runtime

No transparency, transmission, clearcoat or displacement is used.

## Embedded textures

Embedded images:

- `Clock_Body_Charcoal`: `512 × 512` base colour, tangent-space normal and packed ORM
- `Clock_Walnut_Accent`: `512 × 512` base colour, tangent-space normal and packed ORM
- `Clock_Time_Display`: `512 × 192` base/emissive PNG

Total embedded images: **7**.

ORM packing:

- R = ambient occlusion
- G = roughness
- B = metallic

All textures are stored inside binary GLB buffer views. There are **no external texture files or image URIs**.

## Geometry and performance

- Total triangles: **1,400**
- Render meshes: **5**
- Index format: **16-bit unsigned integers throughout**
- Tangents: included on every render mesh
- No subdivision modifiers
- No skeletal rig, morph targets or baked animation
- No negative scales

Triangle distribution:

- `ClockBody`: 928
- `WalnutBase`: 256
- `TimeDisplay`: 12
- `AlarmArmedIndicator`: 12
- `AlarmButton`: 192

The display is deliberately flat and simple. Fine plastic grain and walnut texture are carried by PBR maps rather than unnecessary micro-geometry.

## Validation performed

The exported binary was reloaded and checked before delivery:

- GLB header, JSON chunk and binary chunk lengths are valid.
- `AlarmClockAssembly` is the only scene root and has an identity transform.
- Every documented node is present.
- `AlarmButton` and `AlarmButton_Interaction` are the only children of `AlarmButtonPivot`.
- Pressing the pivot moves only the button assembly.
- `TimeDisplay` remains fixed beneath the root.
- The display front contains exactly two coplanar triangles with four vertices and identical local `-Z` normals.
- Every embedded image uses a binary buffer view; no external URI exists.
- Every mesh uses unsigned 16-bit indices and all indices are in range.
- No node has a negative scale.
- All bounds and vertex values are finite.
- Independent `trimesh` reload succeeds as five render meshes.
- Reloaded triangle count matches the source count: **1,400**.
- Reloaded bounds match the measurements documented above.

## Assumptions and runtime responsibilities

- The clock uses a warm amber LED-style display because it sits naturally with the dark walnut and charcoal bedroom furniture.
- The packed `07:30` texture is a useful default/fallback; real current-time updates remain a runtime feature.
- Alarm scheduling, saved alarm time, sound playback, button debouncing, haptics and state persistence are runtime systems.
- The single top button toggles alarm armed/disarmed. Setting the alarm time itself can later be handled by another interaction, a game menu or scripted story logic without changing this asset hierarchy.
