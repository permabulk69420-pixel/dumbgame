# Two_Seat_Black_Leather_Couch.glb

## Asset summary

- **Format:** binary glTF 2.0 / GLB
- **Scale:** 1 unit = 1 metre
- **Measured dimensions:** **1.6198 m wide × 0.8525 m deep × 0.8266 m high**
- **Measured bounds:** min `(-0.80991, 0.00000, -0.40924)`; max `(0.80991, 0.82665, 0.44322)`
- **Triangle count:** **9,944**
- **Coordinate system:** +Y up; couch front faces local -Z
- **Root node:** `Couch`
- **Root origin:** `(0,0,0)`, floor-contact centre of the couch footprint
- **Root scale:** `(1,1,1)`
- **Negative scales:** none
- **Animations:** none
- **Scripts/gameplay logic:** none

## Exact hierarchy

```text
Couch
├─ Couch_Base
├─ Couch_LeftArm
├─ Couch_RightArm
├─ Couch_Back
├─ Couch_Seat_Left
├─ Couch_Seat_Right
├─ Couch_BackCushion_Left
├─ Couch_BackCushion_Right
├─ Couch_Underside
├─ Couch_Legs
├─ Couch_Piping
├─ Seat_Point_Left
└─ Seat_Point_Right
```

## Materials

- `Leather_Black`: main charcoal-black upholstery; roughness `0.43`
- `Leather_Black_Dark`: darker base and rear structure; roughness `0.50`
- `Leather_Seam`: restrained cushion piping; roughness `0.62`
- `Leg_Black_Metal`: satin black feet; metallic `0.72`, roughness `0.31`
- `Underside_Black_Fabric`: simple rough underside panel

The leather base-colour texture and tangent-space normal texture are packed inside the GLB. There are no external texture files.

## Nodes and pivots

All visible parts are static named mesh nodes under `Couch`. Their geometry is authored directly in couch-root coordinates, so transforms are frozen and their exported node transforms are identity.

- `Couch_Seat_Left` and `Couch_Seat_Right`: separate rounded seat cushions with a subtle centre sag
- `Couch_BackCushion_Left` and `Couch_BackCushion_Right`: separate slightly reclined back cushions
- `Seat_Point_Left`: empty locator at `(-0.315, 0.495, -0.080)` m
- `Seat_Point_Right`: empty locator at `(0.315, 0.495, -0.080)` m

The two seat locators contain no geometry or logic; they are optional future player/NPC seating references.

## Verification

- Front orientation verified as local -Z
- Floor contact verified at local Y = `0`
- Root scale verified as `(1,1,1)`
- No negative scales
- Correct normals and winding
- UVs present on leather upholstery
- Packed base-colour and normal textures verified
- No baked animation or interaction logic
- Efficient for standalone Quest 3
