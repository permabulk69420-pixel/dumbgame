# Generic_Handheld_Torch_v2_forward_button.glb

## Revision

- The complete button assembly was moved toward the torch head so it no longer sits in the centre of the normal gripping area.
- `Grip_Point` remains unchanged.
- An optional baked animation named `PowerButton_Click` was added.
- The power button remains a separate movable node and can still be animated directly in Three.js.

## Asset summary

- **Format:** binary glTF 2.0 / GLB
- **Dimensions:** **0.045000 m W × 0.154600 m L × 0.045000 m H**
- **Triangle count:** **2,144**
- **Units:** 1 unit = 1 metre
- **Up:** +Y
- **Light/front direction:** local -Z
- **Root:** `Torch`
- **Root scale:** `(1,1,1)`
- **Negative scales:** none
- **Scripts/gameplay logic:** none

## Relevant hierarchy

```text
Torch
├─ Torch_Body
│  ├─ Button_Bezel
│  └─ PowerButton
├─ Torch_Grip
├─ Torch_Head
│  ├─ Torch_Bezel
│  ├─ Torch_Reflector
│  ├─ Torch_Lens
│  ├─ Torch_LED
│  └─ Light_Origin
└─ Grip_Point
```

## Power button

- **Node:** `PowerButton`
- **Rest local position:** `(0.000000, 0.039150, -0.026000)` m
- **Press axis:** local `-Y`
- **Press travel:** `0.0016` m
- **Fully pressed local position:** `(0.000000, 0.037550, -0.026000)` m
- `Button_Bezel` rest local position: `(0.000000, 0.038500, -0.026000)` m
- Both nodes were moved together, preserving their visual alignment.

## Optional button animation

- **Animation clip:** `PowerButton_Click`
- **Duration:** `0.180 s`
- **Keyframes:**
  - `0.000 s`: rest
  - `0.085 s`: fully pressed
  - `0.180 s`: returned to rest
- **Interpolation:** linear
- **Target:** `PowerButton.translation`
- The game may play this animation, ignore it, or animate `PowerButton.position.y` directly.

## VR and light locators

- **`Grip_Point`**
  - Unchanged
  - Local position: `(0.0, 0.0225, 0.013)`
  - Primary hand/controller alignment point

- **`Light_Origin`**
  - Unchanged
  - Local position: `(0.0, 0.0225, -0.081)`
  - Forward direction: local `-Z`
  - Attach the Three.js spotlight, beam mesh or raycast here

The revised GLB was reloaded and verified after export. The button position, animation target, grip locator and light locator all passed validation.
