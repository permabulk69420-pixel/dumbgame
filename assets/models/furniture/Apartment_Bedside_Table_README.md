# Apartment Bedside Table — GLB Asset README

## Files

- `assets/models/furniture/Apartment_Bedside_Table.glb`
- `assets/models/furniture/Apartment_Bedside_Table_README.md`

## Asset summary

A reusable modern bedside table designed to match the apartment queen bed. It combines a dark-walnut body and recessed base with a charcoal drawer front, a small satin-black pull and a broad open lower cubby. The outside silhouette uses restrained rounded corners rather than a stylised or exaggerated shape.

The upper drawer is a separate articulated assembly. No animation is baked.

## Coordinate system and placement

- Units: **1 unit = 1 metre**
- Up direction: **+Y**
- Front / bedside interaction direction: **local -Z**
- Rear / wall direction: **local +Z**
- Root node: `BedsideTableAssembly`
- Root origin: floor level at the horizontal centre of the nominal cabinet footprint
- Root transform: position `(0, 0, 0)`, rotation `(0, 0, 0)`, scale `(1, 1, 1)`
- Negative scales: **none**

## Exact measured bounds

Measured after reloading the final binary GLB:

- Minimum: `(-0.3200, 0.0000, -0.2580) m`
- Maximum: `(0.3200, 0.6200, 0.2400) m`
- Complete visible size: **0.6400 m wide × 0.4980 m deep × 0.6200 m high**

Nominal cabinet envelope, excluding the slightly projecting drawer pull:

- Width: `0.640 m`
- Depth: `0.480 m`
- Height: `0.620 m`
- Top surface height: `0.620 m`
- Open-cubby clear width: approximately `0.536 m`
- Open-cubby clear height: approximately `0.174 m`
- Drawer-front size: `0.540 × 0.165 × 0.028 m`

## Exact hierarchy

```text
BedsideTableAssembly
├─ CabinetBody
├─ OpenShelf
├─ Base_Wood
├─ DrawerPivot
│  ├─ Drawer
│  ├─ DrawerFront
│  ├─ DrawerPull
│  ├─ Drawer_Grab_Anchor
│  └─ Drawer_Collision
├─ Top_Surface_Anchor
├─ Shelf_Centre_Anchor
├─ Cable_Access_Anchor
├─ Drawer_Open_Stop
├─ Table_Collision
└─ Bedside_Approach_Anchor
```

## Drawer interaction

`DrawerPivot` is an empty identity-rotation and identity-scale transform at the closed drawer centre.

- Closed local position: `(0.000, 0.460, -0.040) m`
- Translation axis: local **-Z**
- Usable travel: **0.300 m**
- Fully open pivot position: `(0.000, 0.460, -0.340) m`
- `Drawer_Open_Stop`: `(0.000, 0.460, -0.340) m`, fixed beneath `BedsideTableAssembly`
- `Drawer_Grab_Anchor`: `(0.000, 0.000, -0.228) m`, local to `DrawerPivot`

Translating `DrawerPivot` toward local `-Z` moves only `Drawer`, `DrawerFront`, `DrawerPull`, `Drawer_Grab_Anchor` and `Drawer_Collision`. The cabinet, shelf, base and fixed locators remain stationary.

`Drawer_Collision` contains an `extras.halfExtents` descriptor of `(0.270, 0.083, 0.184) m`.

## Placement and runtime locators

Positions are local to `BedsideTableAssembly` unless otherwise stated:

- `Top_Surface_Anchor`: `(0.000, 0.622, 0.000) m`
- `Shelf_Centre_Anchor`: `(0.000, 0.252, -0.015) m`
- `Cable_Access_Anchor`: `(0.000, 0.252, 0.231) m`
- `Drawer_Open_Stop`: `(0.000, 0.460, -0.340) m`
- `Table_Collision`: `(0.000, 0.310, 0.000) m`
- `Bedside_Approach_Anchor`: `(0.000, 0.000, -0.720) m`

`Table_Collision` contains an `extras.halfExtents` descriptor of `(0.320, 0.310, 0.240) m` for a simple static box collider.

## Materials

Exactly three primary PBR materials are used:

1. `Table_Wood_Dark`
   - dark walnut body, shelves, drawer box and recessed base
   - non-metallic wood response
   - subtle grain and roughness variation
2. `Table_Charcoal`
   - softly textured charcoal drawer front matching the bed upholstery palette
   - non-metallic, high roughness
3. `Table_Metal_Satin`
   - shallow drawer pull
   - satin black metallic response

No transparency, clearcoat, transmission or displacement is used.

## Embedded textures

Each material uses an embedded **512 × 512** texture set:

- base-colour PNG
- tangent-space normal PNG
- packed ORM PNG:
  - R = ambient occlusion
  - G = roughness
  - B = metallic

Total embedded images: **9**.

All textures are packed into binary GLB buffer views. There are **no external texture files or image URIs**.

## Geometry and performance

- Total triangles: **1,996**
- Total render meshes: **6**
- Index format: **16-bit unsigned integers on every mesh**
- Tangents: included for all render meshes
- No subdivision modifiers
- No skeletal rig or morph targets
- No baked animation
- No negative scales

Triangle distribution:

- `CabinetBody`: 524
- `OpenShelf`: 320
- `Base_Wood`: 672
- `Drawer`: 128
- `DrawerFront`: 192
- `DrawerPull`: 160

Rounded silhouettes use real geometry where it matters at close VR distance. Fine wood grain, textile weave and surface roughness variation are carried by PBR textures rather than excessive micro-geometry.

## Validation performed

The finished GLB was reloaded and checked after writing:

- GLB header and chunk lengths are valid.
- `BedsideTableAssembly` is the only scene root and has an identity transform.
- All documented nodes are present.
- The exact drawer hierarchy was verified.
- The fixed cabinet is not beneath `DrawerPivot`.
- Moving `DrawerPivot` affects only the drawer assembly.
- Every embedded image uses a binary buffer view; no external URIs exist.
- Every mesh index accessor uses unsigned 16-bit indices.
- Every mesh index is within its vertex range.
- All vertex values are finite.
- No node has a negative scale.
- The file independently reloads through `trimesh` as six render meshes.
- Reloaded triangle count matches the source count: **{triangles:,}**.
- Reloaded measured bounds match the values documented above.

## Assumptions and design choices

- A compact but not undersized `0.64 m`-wide table was chosen to sit naturally beside the `1.72 m`-wide upholstered queen bed.
- The charcoal drawer front deliberately echoes the bed frame and headboard, while dark walnut links it to the bed plinth and feet.
- The open lower shelf is left unobstructed for books, a small console, headphones or environmental clutter.
- The cable locator marks the rear of the cubby; it is a runtime reference rather than a physically cut circular hole.
- Drawer opening, grab constraints, collision response and audio remain runtime systems.
