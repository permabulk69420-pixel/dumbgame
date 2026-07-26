# Apartment Queen Bed — GLB Asset README

## Files

- `assets/models/furniture/Apartment_Queen_Bed.glb`
- `assets/models/furniture/Apartment_Queen_Bed_README.md`

## Asset summary

A reusable, realistic modern queen bed intended for close-range VR use in the apartment scene. It uses a charcoal upholstered platform and segmented padded headboard, warm off-white bedding, a draped duvet, two separate pillows and a recessed dark-walnut plinth with four feet.

The bed is static. No animation is baked.

## Coordinate system and placement

- Units: **1 unit = 1 metre**
- Up direction: **+Y**
- Foot/front direction: **local -Z**
- Headboard direction: **local +Z**
- Root node: `BedAssembly`
- Root origin: floor level at the horizontal centre of the bed footprint
- Root transform: position `(0, 0, 0)`, identity rotation, scale `(1, 1, 1)`
- Negative scales: **none**

## Exact measured bounds

Measured after reloading the final binary GLB:

- Minimum: `(-0.8600, 0.0000, -1.0800) m`
- Maximum: `(0.8600, 1.1000, 1.1250) m`
- Complete visible size: **1.7200 m wide × 2.2050 m long × 1.1000 m high**

Nominal component dimensions:

- Upholstered frame: `1.720 × 2.160 × 0.300 m`
- Mattress: `1.530 × 2.030 × 0.245 m`
- Fitted-sheet cap: `1.535 × 2.035 × 0.018 m`
- Headboard envelope: approximately `1.720 × 0.920 × 0.140 m`, including padded front panels
- Mattress surface height: approximately `0.657 m`

The mattress dimensions correspond to a queen-size `1.53 × 2.03 m` sleeping surface.

## Exact hierarchy

```text
BedAssembly
├─ BedFrame
├─ BedBase_Wood
├─ Headboard
├─ Mattress
├─ FittedSheet
├─ Duvet
├─ Pillow_Left
├─ Pillow_Right
├─ Mattress_Surface_Anchor
├─ Sleep_Anchor
├─ Head_Anchor
├─ LeftSide_Approach
├─ RightSide_Approach
├─ Bed_Collision
└─ Blanket_Grab_Anchor
```

All visible geometry is directly beneath `BedAssembly`. Interaction and placement nodes are empty transforms.

## Interaction and placement node positions

All positions are local to `BedAssembly`:

- `Mattress_Surface_Anchor`: `(0.0, 0.657, 0.0)`
- `Sleep_Anchor`: `(0.0, 0.785, 0.47)`
- `Head_Anchor`: `(0.0, 0.785, 0.7)`
- `LeftSide_Approach`: `(-1.02, 0.0, 0.0)`
- `RightSide_Approach`: `(1.02, 0.0, 0.0)`
- `Bed_Collision`: `(0.0, 0.37, 0.0)`
- `Blanket_Grab_Anchor`: `(0.0, 0.69, -0.52)`

`Bed_Collision` contains an `extras.halfExtents` descriptor of `(0.86, 0.37, 1.11) m`. Runtime code can create a simple static box collider from that descriptor, or use custom collision geometry if closer mattress interaction is required.

`Sleep_Anchor` is positioned for a supine player pose with the head toward local `+Z` and feet toward local `-Z`. It is a reference locator only; runtime comfort offsets should still be applied per player.

## Materials

Exactly three primary PBR materials are used:

1. `Bed_Fabric_Charcoal`
   - upholstered frame and headboard
   - non-metallic
   - high fabric roughness
2. `Bedding_Warm_White`
   - mattress, sheet, duvet and pillows
   - non-metallic
   - double-sided to keep the open duvet surface robust across viewers
3. `Bed_Wood_Dark`
   - recessed plinth and feet
   - non-metallic dark-walnut finish

No transparency, clearcoat, transmission or displacement is used.

## Embedded textures

Each material uses an embedded **512 × 512** texture set:

- base colour PNG
- tangent-space normal PNG
- packed ORM PNG:
  - R = ambient occlusion
  - G = roughness
  - B = metallic

Total embedded images: **9**.

All textures are packed into the GLB through binary buffer views. There are **no external texture files or image URIs**.

## Geometry and performance

- Total triangles: **10,342**
- Total render meshes: **8**
- Index format: **16-bit unsigned integers on every mesh**
- Tangents: included for all textured meshes
- Normal maps: tangent-space
- No subdivision modifiers or runtime procedural geometry
- No negative scales
- No skeletal rig
- No morph targets
- No baked animation

Triangle distribution:

- `BedFrame`: 192
- `BedBase_Wood`: 208
- `Headboard`: 832
- `Mattress`: 224
- `FittedSheet`: 224
- `Duvet`: 5,782
- `Pillow_Left`: 1,440
- `Pillow_Right`: 1,440


The duvet is a smooth open cloth surface rather than a solid volume. The bedding material is double-sided, avoiding invisible reverse faces while keeping geometry economical. The remaining major components are closed meshes.

## UVs and shading

- Every render mesh has `TEXCOORD_0` UVs.
- Every render mesh includes vertex normals and four-component tangents.
- Rounded silhouettes use real geometry where it matters at VR viewing distance.
- Fine textile weave and wood grain are carried by packed PBR textures rather than excessive micro-geometry.
- The duvet uses smooth vertex normals and restrained geometric folds to avoid obvious faceting.

## Validation performed

The exported GLB was reloaded and checked after writing:

- GLB header, JSON chunk and binary chunk lengths are valid.
- `BedAssembly` is the only scene root and has an identity transform.
- All required nodes are present.
- All embedded images use binary buffer views; none reference external URIs.
- Every buffer view remains within the binary buffer bounds.
- Every index accessor uses unsigned 16-bit indices.
- Every mesh index is within its vertex range.
- All vertex values are finite.
- No node has a negative scale.
- The file independently reloads through `trimesh` as eight render meshes.
- Reloaded triangle count matches the source count: **10,342**.
- Reloaded measured visible bounds match the values documented above.

## Assumptions and deviations

- A modern queen bed was chosen because no specific bed size or visual theme was supplied.
- The upholstered frame and headboard use a restrained charcoal finish so the asset fits the existing modern apartment furniture without requiring a highly specific décor scheme.
- Bedding is intentionally made as separate named meshes, allowing later colour swaps, visibility changes, basic grabbing logic or replacement with simulated cloth.
- No deformation, blanket animation or sleeping animation is baked; those remain runtime systems.
