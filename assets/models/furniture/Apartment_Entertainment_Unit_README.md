# Apartment_Entertainment_Unit.glb

Reusable game-ready curved entertainment unit designed to accompany the existing 75-inch-class apartment television.

## Files

- `assets/models/furniture/Apartment_Entertainment_Unit.glb`
- `assets/models/furniture/Apartment_Entertainment_Unit_README.md`

## Design

A low modern entertainment cabinet with a restrained curved silhouette, satin-black lacquered body, dark open console bay, inset lower shelf, genuine cable pass-through, and two low dark-metal runners. It is deliberately unbranded and contains no electronics or decorative clutter.

The centre bay is open from the front/local **-Z** side and is sized for a game console, media player, controllers, or a small receiver. The supplied television fits on top with practical edge and depth clearance.

## Coordinate system

- Units: **1 unit = 1 metre**.
- Up direction: **+Y**.
- Front/viewer side: **local -Z**.
- Rear/wall side: **local +Z**.
- Root origin: floor level at the horizontal centre of the complete unit.
- `EntertainmentUnit_Assembly` root transform: position `(0, 0, 0)`, rotation quaternion `(0, 0, 0, 1)`, scale `(1, 1, 1)`.
- Negative scales: **none**.

## Exact measured exported bounds

These values were read back from the finished binary GLB after export.

- Minimum XYZ: `(-0.960000, 0.000000, -0.252000)` m
- Maximum XYZ: `(0.960000, 0.520000, 0.230000)` m
- Overall measured size: `(1.920000, 0.520000, 0.482000)` m

Design envelope:

- Width: **1.920 m**
- Height: **0.520 m**
- Depth: **0.460 m**
- Top slab thickness: **0.055 m**
- Feet/runners height: **0.040 m**

### Named mesh bounds

| Node | Minimum XYZ (m) | Maximum XYZ (m) | Size XYZ (m) |
|---|---:|---:|---:|
| `Cabinet_Shell` | `(-0.960000, 0.040000, -0.220000)` | `(0.960000, 0.465000, 0.210000)` | `(1.920000, 0.425000, 0.430000)` |
| `Top_Surface` | `(-0.960000, 0.465000, -0.252000)` | `(0.960000, 0.520000, 0.230000)` | `(1.920000, 0.055000, 0.482000)` |
| `Lower_Shelf` | `(-0.680000, 0.150000, -0.210000)` | `(0.680000, 0.180000, 0.195000)` | `(1.360000, 0.030000, 0.405000)` |
| `Back_Panel` | `(-0.680000, 0.180000, 0.196000)` | `(0.680000, 0.465000, 0.214000)` | `(1.360000, 0.285000, 0.018000)` |
| `Cable_Trim` | `(-0.110000, 0.265000, 0.191500)` | `(0.110000, 0.365000, 0.195500)` | `(0.220000, 0.100000, 0.004000)` |
| `Foot_Left` | `(-0.815000, 0.000000, -0.143500)` | `(-0.375000, 0.040000, 0.155500)` | `(0.440000, 0.040000, 0.299000)` |
| `Foot_Right` | `(0.375000, 0.000000, -0.143500)` | `(0.815000, 0.040000, 0.155500)` | `(0.440000, 0.040000, 0.299000)` |


## Open console bay

- Clear nominal width between side pods: **1.360 m**.
- Clear nominal height above shelf: **0.285 m**.
- Usable shelf depth: approximately **0.390 m**.
- Shelf top height: **Y = 0.180 m**.
- The bay is physically open at the front; no transparent or hidden front face is present.
- The back panel includes a real **0.200 × 0.080 m** opening centred at Y = **0.315 m**.

## Exact hierarchy

```text
EntertainmentUnit_Assembly
├─ Cabinet_Shell
├─ Top_Surface
├─ Lower_Shelf
├─ Back_Panel
├─ Cable_Trim
├─ Foot_Left
├─ Foot_Right
├─ Console_Bay_Anchor
├─ TV_Placement_Anchor
├─ Cable_Access_Anchor
└─ EntertainmentUnit_Collision
```

## Placement and gameplay locators

| Node | Exact local position (m) | Purpose |
|---|---:|---|
| `Console_Bay_Anchor` | `(0.000000, 0.180000, -0.035000)` | Floor/root point on the top of the open shelf for a console or media device. |
| `TV_Placement_Anchor` | `(0.000000, 0.520000, 0.000000)` | Centre point on the cabinet top. Parenting or positioning the TV root here places its feet on the top surface. |
| `Cable_Access_Anchor` | `(0.000000, 0.315000, 0.214000)` | Centre of the real rear cable opening. |
| `EntertainmentUnit_Collision` | `(0.000000, 0.260000, 0.000000)` | Suggested centre for a simple static box collider. |

The previously supplied TV is **1.700 m** wide with a **0.300 m** foot depth. Centred on `TV_Placement_Anchor`, this unit leaves approximately **0.110 m** clearance on each side and **0.080 m** nominal front/back depth clearance.

## Geometry and performance

- Triangle count: **3,488**.
- Vertex count: **3,694** across exported primitives.
- All index streams use 16-bit `UNSIGNED_SHORT` indices for broad mobile-viewer compatibility.
- Curves are real silhouette geometry, not opacity cards.
- Top, pods, base, shelf and feet use real chamfered edges.
- No subdivision modifier, animation, skin, morph target, transparency, displacement, clearcoat, or transmission.
- Intended for standalone Quest 3 and WebXR close-range use.

## Materials

Exactly three PBR materials are used:

1. `Entertainment_Unit_Black`
   - Satin near-black cabinet lacquer/plastic composite.
   - Non-metallic with restrained mottling and fine grain.
2. `Entertainment_Unit_Interior`
   - Slightly softer, rougher dark finish used in the shelf and inner back panel.
3. `Entertainment_Unit_Metal`
   - Dark brushed/satin metal used on the low runners and cable trim.

Material names in the exported GLB: `Entertainment_Unit_Black, Entertainment_Unit_Interior, Entertainment_Unit_Metal`.

## Packed textures

All textures are PNG images embedded inside GLB buffer views. There are **no external image files or URIs**.

- Cabinet base colour: **512 × 512**
- Cabinet tangent-space normal: **512 × 512**
- Cabinet ORM: **512 × 512**
- Metal base colour: **256 × 256**
- Metal tangent-space normal: **256 × 256**
- Metal ORM: **256 × 256**

ORM packing follows glTF convention:

- R = ambient occlusion
- G = roughness
- B = metallic

Embedded image records: **12**.

## Collision recommendation

For ordinary room collision, use one static box centred on `EntertainmentUnit_Collision` with approximately:

- Width: **1.920 m**
- Height: **0.520 m**
- Depth: **0.460 m**

For placing a physical console, optionally add a separate thin shelf collider matching `Lower_Shelf`. The cable opening and decorative trim do not need collision.

## Validation completed after export

- GLB 2.0 header and chunk lengths verified.
- Export reloaded and parsed from disk after writing.
- `EntertainmentUnit_Assembly` confirmed as the true single scene root.
- Root transform confirmed identity.
- All required mesh and locator node names confirmed.
- All textures confirmed packed as GLB buffer views with no external URIs.
- All material factors confirmed valid glTF values.
- No negative scales found.
- All mesh index accessors confirmed 16-bit.
- The rear cable aperture was checked and contains no back-panel vertices in its clear opening.
- `TV_Placement_Anchor`, `Console_Bay_Anchor`, and `Cable_Access_Anchor` positions were read back and confirmed exactly.
- Independent `trimesh` reload succeeded with 7 geometries and 13 graph nodes.

## Assumptions and deviations

- No exact cabinet dimensions were specified, so the width and depth were chosen specifically to suit the existing 75-inch TV while keeping the silhouette plausible in a residential apartment.
- The phrase “black curved one” was interpreted as a low satin-black cabinet with softly bowed front edges, rounded side pods, and no ornate handles.
- The console bay is one broad open space rather than several tiny compartments, making it easier to place fictional or real-sized game hardware later.
- No drawers or cabinet doors are animated; the side pods are fixed shell geometry.
- No branded console, remote, cables, text, speakers, or accessories are included.

## File integrity

- SHA-256: `c0b2e6616fc97ef8b01e025ec0369c7c1acc516bdde78a5ae839b9b0b76a084e`
- File size: **258,144 bytes**
