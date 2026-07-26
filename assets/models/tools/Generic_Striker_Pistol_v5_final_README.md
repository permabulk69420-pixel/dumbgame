# Generic_Striker_Pistol_v5_final.glb

## Verified asset contract

- **Format:** binary glTF 2.0 / GLB
- **Visible dimensions:** **0.036150 m wide × 0.185620 m long × 0.138600 m high**
- **Visible bounds:** min `(-0.017700, -0.000000, -0.096580)`; max `(0.018450, 0.138600, 0.089040)`
- **Triangle count:** **6,144**
- **Units:** 1 unit = 1 metre
- **Up:** +Y
- **Muzzle/front:** local -Z
- **Root node:** `Pistol`
- **Root scale:** `(1,1,1)`
- **Negative scales:** none
- **Baked animations:** none
- **Scripts/gameplay logic:** none
- The original mesh/material binary is byte-for-byte unchanged from `Generic_Striker_Pistol_v4_clean_grip.glb`; this revision adds locator nodes and non-executable metadata only.

## Complete final hierarchy

```text
Pistol
├─ Pistol_Frame
├─ Pistol_Slide
│  ├─ Slide_Serrations
│  ├─ Ejection_Port
│  ├─ Chamber_Indicator
│  ├─ Guide_Rod
│  ├─ Front_Sight
│  ├─ Rear_Sight
│  ├─ Sight_Dots
│  ├─ Casing_Eject_Point
│  ├─ Aim_Point
│  ├─ Slide_Muzzle_Recess
│  ├─ Slide_Grab_Left
│  └─ Slide_Grab_Right
├─ Pistol_Barrel
│  ├─ Muzzle_Point
│  ├─ Chamber_Point
│  ├─ Muzzle_Crown
│  ├─ Muzzle_Bore_Wall
│  └─ Muzzle_Bore_Back
├─ Pistol_Trigger
│  └─ Trigger_Safety_Blade
├─ Pistol_Magazine
│  └─ Magazine_Grip_Point
├─ Magazine_Release
├─ Slide_Stop
├─ Takedown_Tabs
├─ Grip_Point
├─ SupportHand_Point
└─ Magazine_Well_Point
```

## Every locator transform

Positions and rotations are local to the listed parent. Quaternions use glTF/Three.js `(x, y, z, w)` order. Root-space positions are shown at the pistol's rest pose.

| Locator | Parent | Local position, m | Local quaternion | Local scale | Root-space position at rest, m |
|---|---|---:|---:|---:|---:|
| `Grip_Point` | `Pistol` | `(0.000000, 0.044000, 0.047000)` | `(-0.078459, 0.000000, 0.000000, 0.996917)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.044000, 0.047000)` |
| `SupportHand_Point` | `Pistol` | `(0.000000, 0.075000, -0.054000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.075000, -0.054000)` |
| `Muzzle_Point` | `Pistol_Barrel` | `(0.000000, 0.000000, -0.088500)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.118000, -0.094500)` |
| `Chamber_Point` | `Pistol_Barrel` | `(0.000000, 0.000000, 0.061000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.118000, 0.055000)` |
| `Aim_Point` | `Pistol_Slide` | `(0.000000, 0.021000, 0.072000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.139000, 0.068000)` |
| `Casing_Eject_Point` | `Pistol_Slide` | `(0.019000, 0.008000, 0.021000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.019000, 0.126000, 0.017000)` |
| `Magazine_Well_Point` | `Pistol` | `(0.000000, 0.079000, 0.040000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.079000, 0.040000)` |
| `Slide_Grab_Left` | `Pistol_Slide` | `(-0.022000, 0.002500, 0.048000)` | `(0.000000, 0.707107, 0.000000, 0.707107)` | `(1.000000, 1.000000, 1.000000)` | `(-0.022000, 0.120500, 0.044000)` |
| `Slide_Grab_Right` | `Pistol_Slide` | `(0.022000, 0.002500, 0.048000)` | `(0.000000, -0.707107, 0.000000, 0.707107)` | `(1.000000, 1.000000, 1.000000)` | `(0.022000, 0.120500, 0.044000)` |
| `Magazine_Grip_Point` | `Pistol_Magazine` | `(0.000000, -0.041000, 0.004000)` | `(0.000000, 0.000000, 0.000000, 1.000000)` | `(1.000000, 1.000000, 1.000000)` | `(0.000000, 0.038000, 0.043500)` |

### Locator parenting verification

- `Slide_Grab_Left` and `Slide_Grab_Right` are empty children of `Pistol_Slide`; they inherit all slide movement automatically.
- `Magazine_Grip_Point` is an empty child of `Pistol_Magazine`; it stays attached after the magazine is detached.
- `SupportHand_Point` is unchanged and remains the normal two-handed shooting support locator beneath the front frame.
- The new locator nodes contain no mesh, skin, camera or visible geometry.

## Exact slide movement

- **Node:** `Pistol_Slide`
- **Rest / fully-forward local position:** `(0.000000, 0.118000, -0.004000) m`
- **Maximum-rearward local position:** `(0.000000, 0.118000, 0.026000) m`
- **Exact travel:** **0.0300 m**
- **Rearward direction:** local **+Z**
- Set `Pistol_Slide.position.z` only within `-0.0040` to `0.0260` while retaining its X/Y rest values.
- No slide animation is baked.
- **Visual coverage verified:** at full travel the moving slide's front edge is at root-space Z `-0.066000` m. Unchanged `Pistol_Frame` and `Pistol_Barrel` geometry spans Z `-0.096580` to `0.089040` m, leaving the geometry beneath the rearward slide visually represented.

## Exact trigger movement

- **Node:** `Pistol_Trigger`
- **Rest rotation:** Euler XYZ `(0°, 0°, 0°)`; quaternion `(0,0,0,1)`
- **Axis:** local **X**
- **Pull direction:** negative local-X rotation
- **Fully pulled rotation:** Euler XYZ `(-18.0°, 0°, 0°)`
- **Fully pulled quaternion:** `(-0.156434, 0.000000, 0.000000, 0.987688)`
- **Recommended total rotation:** **18.0°**
- No trigger animation is baked.

## Exact magazine-release movement

- **Node:** `Magazine_Release`
- **Rest local position:** `(0.016500, 0.079000, 0.029000) m`
- **Press axis:** local **-X**
- **Recommended travel:** **0.0025 m**
- **Fully pressed local position:** `(0.014000, 0.079000, 0.029000) m`
- The release remains a separate movable mesh. Three.js decides when the magazine detaches.

## Exact slide-stop movement

- **Node:** `Slide_Stop`
- **Rest rotation:** Euler XYZ `(0°, 0°, 0°)`; quaternion `(0,0,0,1)`
- **Axis:** local **X**
- **Engage direction:** negative local-X rotation
- **Engaged rotation:** Euler XYZ `(-22.0°, 0°, 0°)`
- **Engaged quaternion:** `(-0.190809, 0.000000, 0.000000, 0.981627)`
- **Recommended range:** **22.0°**

## Magazine detachment and insertion

- `Pistol_Magazine` is a separate node with a separate mesh.
- **Fully seated local position:** `(0.000000, 0.079000, 0.039500) m`
- **Fully seated local rotation quaternion:** `(0.000000, 0.000000, 0.000000, 1.000000)`
- **Fully seated local scale:** `(1.000000, 1.000000, 1.000000)`
- It may be detached/reparented at runtime without removing or damaging any pistol-body geometry.
- `Magazine_Well_Point` is the insertion reference.
- `Magazine_Grip_Point` remains attached to the loose magazine.

## Interactive separation verification

The following were reloaded from the final GLB and confirmed as separate nodes:

- `Pistol_Slide`
- `Pistol_Trigger`
- `Trigger_Safety_Blade`
- `Pistol_Magazine`
- `Magazine_Release`
- `Slide_Stop`
- `Takedown_Tabs`
- `Grip_Point`
- `SupportHand_Point`
- `Muzzle_Point`
- `Aim_Point`
- `Casing_Eject_Point`
- `Magazine_Well_Point`
- `Slide_Grab_Left`
- `Slide_Grab_Right`
- `Magazine_Grip_Point`

All transforms, axes, empty-locator status and parent relationships were verified after exporting and reloading the final GLB.
