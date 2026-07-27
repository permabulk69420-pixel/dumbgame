# Apartment Wooden Bat

A reusable, realistic wooden baseball bat made for close-range VR interaction,
standalone Quest 3 and WebXR.

## Files

- `Apartment_Wooden_Bat.glb`
- `Apartment_Wooden_Bat_README.md`

All geometry, materials and textures are packed inside the binary GLB. No external
texture files are required.

## Coordinate system and placement

- Units: **1 unit = 1 metre**
- Root node: `WoodenBat`
- Root transform: position `(0,0,0)`, rotation `(0,0,0)`, scale `(1,1,1)`
- Bat longitudinal axis: local **+Y**, from the handle toward the barrel
- Preferred palm-facing/reference direction: local **-Z**
- Root origin: centre of `GripPoint_Main`
- No negative scales
- No baked animation

The root is deliberately located at the main grab point instead of the geometric centre,
making direct VR hand/controller attachment straightforward.

## Exact measured bounds

Measured after reloading the exported GLB:

- Minimum: `(-0.034500, -0.120000, -0.034500)`
- Maximum: `(0.034500, 0.720000, 0.034500)`
- Overall size: `0.069000 × 0.840000 × 0.069000 m`
- Overall length: approximately **0.840 m**
- Maximum barrel diameter: approximately **0.069 m**
- Triangle count: **4,096**

## Hierarchy

```text
WoodenBat
├─ Bat_Wood
├─ Grip_Wrap
├─ GripPoint_Main
├─ GripPoint_Secondary
├─ Bat_Tip
├─ Bat_Butt
├─ Impact_Point
└─ Bat_Collision
```

`WoodenBat` is the true GLB scene root. There is no unnecessary exporter-level
`world` node.

## Exact interaction-node positions

All positions are local to `WoodenBat`.

| Node | Local position (m) | Purpose |
|---|---:|---|
| `GripPoint_Main` | `(0.000, 0.000, 0.000)` | Main one-hand VR grab point |
| `GripPoint_Secondary` | `(0.000, 0.105, 0.000)` | Optional second-hand support grip |
| `Bat_Tip` | `(0.000, 0.720, 0.000)` | Barrel-tip locator |
| `Bat_Butt` | `(0.000, -0.120, 0.000)` | Handle-knob locator |
| `Impact_Point` | `(0.000, 0.570, -0.0345)` | Approximate barrel sweet spot |
| `Bat_Collision` | `(0.000, 0.300, 0.000)` | Runtime collision-shape locator |

## VR grip convention

Both grip locators have identity rotation and unit scale.

Recommended attachment:

- align the hand/controller grip direction with bat local **+Y**;
- treat local **-Z** as the palm-facing direction;
- permit either hand to grab `GripPoint_Main`;
- use `GripPoint_Secondary` for optional two-handed orientation;
- let the primary hand drive the object root;
- use the secondary hand to influence rotation rather than parenting the bat twice.

The wrapped handle extends approximately from local `Y = -0.054 m` to
`Y = 0.160 m`.

## Collision recommendation

`Bat_Collision` is an empty locator because glTF has no universal engine-independent
collision primitive.

Recommended runtime collider:

- capsule aligned along local +Y;
- centre near `(0, 0.300, 0)`;
- covered length approximately `0.840 m`;
- maximum radius approximately `0.0345 m`.

For finer collision, use a narrow handle capsule and a slightly wider barrel capsule.
Use swept collision or continuous collision detection during fast swings.

`Impact_Point` marks a useful barrel strike/effect location, but full physical hit
testing should use the bat collider rather than only this point.

## Geometry

- Realistic 84 cm baseball-bat proportions
- Smooth 64-segment turned wooden silhouette
- Rounded knob and tapered handle
- Natural transition into the barrel
- Restrained carved groove near the upper barrel
- Separate close-fitting wrapped grip
- Correct outward normals and winding
- No subdivision modifier
- No hidden duplicate mesh
- **16-bit mesh indices throughout**

## Materials

1. `Bat_Wood`
   - walnut-stained ash appearance
   - non-metallic
   - satin roughness with subtle variation
   - longitudinal grain and restrained impact wear

2. `Grip_Wrap`
   - charcoal-black leather/rubber appearance
   - diagonal overlap detail
   - non-metallic and moderately rough

## Embedded textures

All six PNG maps are packed inside the GLB.

### Bat_Wood — 1024 × 1024

- Base colour
- Tangent-space normal
- Metallic-roughness

### Grip_Wrap — 512 × 512

- Base colour
- Tangent-space normal
- Metallic-roughness

Core glTF packing is used for metallic-roughness maps:

- green channel = roughness
- blue channel = metallic

There is no transparency, displacement, clearcoat, transmission or external texture.

## Runtime interaction flow

1. Detect a direct-hand or ray interaction with the bat collider.
2. Snap the chosen hand/controller to `GripPoint_Main`.
3. Align the bat's local +Y axis with the controller's grip axis.
4. Optionally attach the other hand to `GripPoint_Secondary`.
5. Drive impact physics with a swept capsule or physics body.
6. Use `Impact_Point` for sound, particles and haptic placement near the sweet spot.

## Validation performed

The finished GLB was reloaded and checked for:

- valid GLB 2.0 container
- `WoodenBat` as the actual scene root
- complete hierarchy
- exact locator transforms, including matrix-based glTF transforms
- 16-bit mesh index buffers
- six embedded PNG textures
- no negative scales
- successful independent `trimesh` reload
- measured bounds and triangle count

## Assumptions

- This is a realistic game prop, not a regulation-certified sporting model.
- The dark handle wrap was included for stronger close-VR readability and clearer grip
  placement while retaining a fully wooden bat body.
- Runtime grabbing, physics, impact sounds and haptics are intentionally not baked into
  the asset.
