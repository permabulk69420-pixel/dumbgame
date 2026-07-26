# Apartment_Entry_Door.glb

Game-ready articulated apartment entrance door asset for metre-scale VR/WebXR use.

## Files

- `Apartment_Entry_Door.glb` — binary glTF 2.0 model with all textures embedded.
- `Apartment_Entry_Door_README.md` — this specification and validation record.

## Coordinate system and rest pose

- Units: **1 unit = 1 metre**.
- Up direction: **+Y**.
- Corridor/front side: **local -Z**.
- Apartment/interior side: **local +Z**.
- Root origin: floor level at the horizontal centre of the complete frame.
- `DoorAssembly` transform: position `(0, 0, 0)`, rotation quaternion `(0, 0, 0, 1)`, scale `(1, 1, 1)`.
- All nodes use positive identity scale. There are **no negative scales**.
- Closed rest pose has no baked door-opening animation.

## Exact measured bounds

Measurements below were read back from the exported GLB accessors after export.

| Item | Minimum XYZ | Maximum XYZ | Size XYZ |
|---|---:|---:|---:|
| Complete rendered asset | `(-0.685800, 0.000000, -0.096000)` | `(0.685800, 2.160000, 0.096000)` | `(1.371600, 2.160000, 0.192000)` |
| `DoorFrame` | `(-0.685800, 0.000000, -0.096000)` | `(0.685800, 2.160000, 0.096000)` | `(1.371600, 2.160000, 0.192000)` |
| `DoorLeaf` node, including moving hinge hardware | `(-0.635000, 0.012000, -0.033000)` | `(0.635000, 2.117000, 0.054500)` | `(1.270000, 2.105000, 0.087500)` |

Design dimensions of the timber leaf slab itself:

- Door leaf width: **1.270000 m**.
- Door leaf height: **2.105000 m**.
- Door leaf thickness: **0.050000 m**.
- Door leaf bottom: **Y = 0.012000 m**.
- Door leaf top: **Y = 2.117000 m**.
- Complete outer frame width: **1.371600 m**.
- Complete outer frame height: **2.160000 m**.
- Structural jamb width per side: **0.050800 m**.

The overall rendered depth includes frame casing and lever hardware, so it is deeper than the 0.050 m timber leaf slab.

## Exact hierarchy

```text
DoorAssembly
├─ DoorFrame
├─ DoorPivot
│  ├─ DoorLeaf
│  ├─ HandlePivot_Inside
│  │  └─ Handle_Inside
│  ├─ HandlePivot_Outside
│  │  └─ Handle_Outside
│  ├─ Deadbolt_Inside
│  ├─ Deadbolt_Outside
│  ├─ Peephole
│  ├─ Latch
│  ├─ Latch_Point
│  └─ Door_Collision_FreeEdge
└─ Closed_Stop
```

No additional glTF nodes are present.

## Interaction transforms and locators

All positions below are exact local translations stored in the GLB.

| Node | Parent | Local position XYZ (m) | Purpose |
|---|---|---:|---|
| `DoorPivot` | `DoorAssembly` | `(-0.635000, 0.000000, 0.000000)` | Empty transform on the vertical hinge line at floor level. |
| `HandlePivot_Inside` | `DoorPivot` | `(1.115000, 1.010000, 0.000000)` | Empty spindle-axis pivot for the interior lever. |
| `HandlePivot_Outside` | `DoorPivot` | `(1.115000, 1.010000, 0.000000)` | Empty spindle-axis pivot for the corridor lever. |
| `Latch_Point` | `DoorPivot` | `(1.284000, 1.010000, 0.000000)` | Tip of the fully extended latch. |
| `Door_Collision_FreeEdge` | `DoorPivot` | `(1.270000, 0.000000, 0.000000)` | Floor-level free-edge locator for moving collision. |
| `Closed_Stop` | `DoorAssembly` | `(0.635000, 0.000000, 0.000000)` | Fixed closed-position locator on the frame side. |

Additional hardware node positions:

- `Deadbolt_Inside` and `Deadbolt_Outside`: `(1.115000, 1.310000, 0.000000)` relative to `DoorPivot`.
- `Peephole`: `(0.635000, 1.560000, 0.000000)` relative to `DoorPivot`.
- `Latch`: `(1.270000, 1.010000, 0.000000)` relative to `DoorPivot`.

### Door opening

- Viewed from the corridor/local -Z side, the hinge is on the left and the leaf extends toward local +X.
- The door opens inward toward local +Z.
- Apply a **negative local-Y rotation** to `DoorPivot`; approximately **-90 degrees** gives a fully open inward pose.
- `DoorFrame` and `Closed_Stop` are not descendants of `DoorPivot`, so they remain fixed.

### Handles

- Both handle pivots have identity rotation and scale in the rest pose.
- Rotation axis: **local Z**.
- With the supplied lever orientation, approximately **+32 degrees around local Z** moves the lever downward.
- `HandlePivot_Inside` moves only `Handle_Inside`.
- `HandlePivot_Outside` moves only `Handle_Outside`.

### Latch

- Retraction axis: **local -X**.
- Usable retraction travel: **0.014000 m**.
- Rest position is fully extended.
- Recommended runtime retracted translation: `Latch.position.x = 1.256000` if setting absolute position in `DoorPivot` space, or translate the node by `-0.014000` m on local X.
- `Latch_Point` remains a fixed reference for the fully extended tip.

## Geometry and performance

- Total triangle count: **16,336 triangles**.
- glTF primitive mode: triangles.
- Smooth high-segment silhouettes are used for levers, roses, lock cylinders, peephole and hinge barrels.
- Timber/frame edges use real chamfer geometry; fine grain, painted texture and brushed-metal detail are carried by packed normal maps.
- No subdivision modifiers, hidden source meshes, duplicated scene nodes, transparency, displacement, clearcoat or transmission.
- Materials are single-sided with correct exported normals and winding.
- Intended for standalone Quest 3 and WebXR close-range viewing.

## Materials

Exactly three primary PBR materials are used:

1. `Door_Walnut`
   - Dark/medium walnut base colour.
   - Non-metallic.
   - Varied medium roughness.
   - Shared 2048 atlas base-colour, tangent-space normal and ORM maps.
2. `Frame_Painted`
   - Warm off-white aged paint.
   - Non-metallic.
   - Higher roughness with restrained colour variation.
   - Uses the painted region of the same 2048 atlas and the same packed map set.
3. `Door_Metal`
   - Brushed/satin metal hardware.
   - Metallic.
   - Moderate satin roughness.
   - Separate 512 base-colour, tangent-space normal and ORM maps.

`ORM` channel packing follows glTF convention:

- R = ambient occlusion.
- G = roughness.
- B = metallic.

## Packed textures

All six PNG images are embedded in GLB buffer views; there are no external texture files or image URIs.

| Texture | Resolution | Use |
|---|---:|---|
| `Door_Surface_BaseColor_2048` | 2048 × 2048 | Shared walnut/paint atlas base colour. |
| `Door_Surface_Normal_2048` | 2048 × 2048 | Shared tangent-space normal atlas. |
| `Door_Surface_ORM_2048` | 2048 × 2048 | Shared AO/roughness/metallic atlas. |
| `Door_Metal_BaseColor_512` | 512 × 512 | Brushed metal base colour. |
| `Door_Metal_Normal_512` | 512 × 512 | Brushed metal tangent-space normal. |
| `Door_Metal_ORM_512` | 512 × 512 | Metal AO/roughness/metallic. |

## Validation performed after export

The completed GLB was reloaded from disk and checked programmatically.

- GLB header/version/chunk lengths valid.
- Independent `trimesh` reload: **loaded 9 geometries / 18 graph nodes**.
- Required node-name set matches exactly; no extra nodes.
- Required parent/child hierarchy matches exactly.
- Outer `DoorFrame` dimensions re-measure as **1.371600 × 2.160000 m**.
- Rotating `DoorPivot` by -90 degrees around local Y moves the complete moving leaf subtree while `DoorFrame` remains unchanged.
- Rotating `HandlePivot_Inside` by +32 degrees around local Z moves only `Handle_Inside`; the outside handle remains unchanged.
- Rotating `HandlePivot_Outside` by +32 degrees around local Z moves only `Handle_Outside`; the inside handle remains unchanged.
- Translating `Latch` by -0.014000 m on local X retracts its exported bounds by exactly 0.014000 m.
- Every node scale is positive `(1, 1, 1)`.
- Every image is stored by embedded buffer view; none uses an external URI.

## Assumptions and minor design choices

- The intentionally wide VR-comfort opening uses a **1.270 m** leaf, inside the requested 1.25–1.28 m range.
- A small **0.012 m** bottom clearance is used; the remaining top allowance is occupied by the frame/header arrangement.
- `Closed_Stop` is placed at the closed free-edge floor position `(0.635, 0, 0)` rather than offsetting it onto one stop face; this makes it directly useful as a closed-pose target for runtime logic.
- No animation clips are included. Runtime code owns `DoorPivot`, both handle pivots and latch translation.

## File integrity

- GLB byte size: **3,970,384 bytes**.
- SHA-256: `1749e2d28ab4241030af1d59a888137e1072fbcfda6c75a84f2a2e3af7c5a408`
