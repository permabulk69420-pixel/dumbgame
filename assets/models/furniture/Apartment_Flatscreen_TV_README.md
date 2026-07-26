# Apartment Flatscreen TV — Game Asset README

## Files

- `assets/models/props/Apartment_Flatscreen_TV.glb`
- `assets/models/props/Apartment_Flatscreen_TV_README.md`

## Asset summary

A reusable, game-ready **75-inch-class 16:9 flatscreen television** intended for close VR viewing in a residential apartment. It has a slim matte-black body, low-reflection screen, realistic rear electronics housing, brushed-metal feet, one separate physical power button, a separately addressable status light, and a dedicated screen-content anchor for a future video or animated texture.

The GLB contains no baked playback or power animation. Runtime code should control the button press, status-light emission, and screen material/video texture.

## Coordinate system and placement

- Units: **1 unit = 1 metre**
- Up direction: **+Y**
- Front/viewer side: **local -Z**
- Rear/wall side: **local +Z**
- Root origin: **floor level at the horizontal centre between the two feet**
- `TV_Assembly` root transform: position `(0, 0, 0)`, rotation `(0, 0, 0)`, scale `(1, 1, 1)`
- Negative scales: **none**

## Dimensions

Design dimensions:

- Nominal class: **75-inch**
- Body width: **1.700 m**
- Body height: **0.980 m**
- Body depth: **0.062 m**
- Body lower edge above floor: **0.100 m**
- Total height to top edge: **1.080 m**
- Active screen width: **1.645 m**
- Active screen height: **0.925 m**
- Overall foot depth: **0.300 m**

Exact measured exported bounds, including the feet and rear housing:

- Minimum: `(-0.85, 0, -0.162)` m
- Maximum: `(0.85, 1.08, 0.138)` m
- Overall measured size: `(1.7, 1.08, 0.3)` m

Measured named-mesh extents:

| Node | Minimum bounds (m) | Maximum bounds (m) | Size (m) |
|---|---:|---:|---:|
| `TV_Body` | `(-0.85, 0.1, -0.032)` | `(0.85, 1.08, 0.038)` | `(1.7, 0.98, 0.07)` |
| `Screen` | `(-0.8225, 0.1275, -0.0365)` | `(0.8225, 1.0525, -0.0305)` | `(1.645, 0.925, 0.006)` |
| `BackPanel` | `(-0.625, 0.25, 0.03)` | `(0.625, 0.93, 0.087)` | `(1.25, 0.68, 0.057)` |
| `Stand_Left` | `(-0.645, 0, -0.162)` | `(-0.555, 0.117226, 0.138)` | `(0.09, 0.117226, 0.3)` |
| `Stand_Right` | `(0.555, 0, -0.162)` | `(0.645, 0.117226, 0.138)` | `(0.09, 0.117226, 0.3)` |
| `PowerButton` | `(0.7775, 0.1065, -0.0386)` | `(0.7925, 0.1215, -0.0354)` | `(0.015, 0.015, 0.0032)` |
| `StatusLight` | `(0.738811, 0.110811, -0.03916)` | `(0.745189, 0.117189, -0.03564)` | `(0.006378, 0.006378, 0.00352)` |

## Exact hierarchy

```text
TV_Assembly
├─ TV_Body
├─ Screen
├─ BackPanel
├─ Stand_Left
├─ Stand_Right
├─ PowerButtonPivot
│  └─ PowerButton
├─ StatusLight
├─ PowerButton_Point
├─ Screen_Content_Anchor
├─ WallMount_Anchor
└─ TV_Collision_Centre
```

No additional helper nodes are required for interaction. Geometry is not baked together across the functional nodes.

## Interaction nodes and exact local positions

All positions below are local to `TV_Assembly`, except `PowerButton`, which is local to `PowerButtonPivot`.

| Node | Type | Exact local position (m) | Purpose |
|---|---|---:|---|
| `PowerButtonPivot` | Empty transform | `(0.785, 0.114, -0.037)` | Parent transform for the only physical power button. |
| `PowerButton` | Visible mesh | `(0, 0, 0)` | Pressable button mesh. |
| `PowerButton_Point` | Empty locator | `(0.785, 0.114, -0.039)` | Front interaction/raycast target point. |
| `StatusLight` | Visible mesh | `(0.742, 0.114, -0.0374)` | Separate status indicator lens; runtime may alter material emission. |
| `Screen_Content_Anchor` | Empty locator | `(0, 0.59, -0.0375)` | Centre point immediately in front of the active screen for a video plane, UI, or debugging. |
| `WallMount_Anchor` | Empty locator | `(0, 0.59, 0.066)` | Rear-centre wall-placement reference. |
| `TV_Collision_Centre` | Empty locator | `(0, 0.59, 0)` | Suggested centre for a simple box collider. |

### Power-button movement

- Press direction: **local +Z** — inward, away from the viewer and into the TV body.
- Suggested travel: **0.003 m**.
- Suggested behaviour: move `PowerButtonPivot` from Z `-0.037` to Z `-0.034`, then spring it back.
- `PowerButtonPivot` has identity rotation and scale in its rest state.
- Pressing the pivot moves **only** `PowerButton`.

### Suggested on/off state logic

The GLB deliberately leaves behaviour to runtime code:

1. Raycast or overlap-test `PowerButton_Point` / `PowerButton`.
2. Animate `PowerButtonPivot.position.z += 0.003` and return it.
3. Toggle a game-side `isOn` state.
4. When on, assign a video/canvas texture or animated material to `Screen`.
5. Set the `StatusLight` material emissive colour/intensity to a small green-white or blue-white glow.
6. When off, restore material `TV_Screen_Off` and set the status-light emission back to zero or a dim standby value.

The `Screen` node is a separate mesh, so replacing only its material or `map`/`emissiveMap` will not affect the bezel or body.

## Geometry and performance

- Triangle count: **3,768**
- Vertex count: **1,950**
- Smooth rounded screen/body corners use actual silhouette geometry.
- Fine surface character is supplied by normal and roughness maps rather than subdivision.
- No active modifiers.
- No transparent materials.
- No displacement, clearcoat, transmission, or expensive shader extensions.
- Intended for standalone Quest 3 and WebXR.

## Materials

| Material | Use | PBR behaviour |
|---|---|---|
| `TV_Body_Matte` | Body, bezel, rear housing | Near-black plastic; subtle normal grain; imperfect medium roughness; very low metallic response. |
| `TV_Screen_Off` | Active screen mesh | Near-black cool-tinted glass-like surface; low roughness; zero default emission; ready for runtime video or animated texture replacement. |
| `TV_Stand_Metal` | Left and right feet | Brushed/satin dark metal; high metallic response; restrained roughness variation. |
| `TV_Button_Matte` | Power button | Separate dark tactile control material. |
| `TV_Status_Light_Off` | Status lens | Separate non-emissive rest material; runtime should set emissive colour/intensity when powered. |

## Packed texture maps

All texture images are embedded inside the binary GLB. There are **no external texture files**.

| Material | Map | Resolution |
|---|---|---:|
| `TV_Body_Matte` | Base colour | 512 × 512 |
| `TV_Body_Matte` | Tangent-space normal | 512 × 512 |
| `TV_Body_Matte` | Metallic-roughness | 512 × 512 |
| `TV_Body_Matte` | Ambient occlusion | 512 × 512 |
| `TV_Screen_Off` | Base colour | 1024 × 1024 |
| `TV_Screen_Off` | Tangent-space normal | 1024 × 1024 |
| `TV_Screen_Off` | Metallic-roughness | 1024 × 1024 |
| `TV_Stand_Metal` | Base colour | 256 × 256 |
| `TV_Stand_Metal` | Tangent-space normal | 256 × 256 |
| `TV_Stand_Metal` | Metallic-roughness | 256 × 256 |

## Collision recommendation

For inexpensive room collision, create a box collider centred on `TV_Collision_Centre` with approximately:

- Width: **1.700 m**
- Height: **0.980 m**
- Depth: **0.066 m**

The feet can remain non-colliding unless the player can physically grab or push the television.

## Runtime screen animation notes

For Three.js/WebXR, assign the future `VideoTexture`, `CanvasTexture`, or procedural animation material directly to the mesh named `Screen`. Preserve its geometry and transform. Recommended settings for video content:

- `colorSpace = THREE.SRGBColorSpace`
- low or zero `roughness` while powered;
- modest `emissiveIntensity`, rather than an excessively bright unlit plane;
- keep the content 16:9 to avoid stretching;
- stop/pause the video source when the TV is off to save Quest CPU/GPU and decoder resources.

## Validation completed after export

The final binary GLB was reloaded and checked after writing:

- GLB 2.0 header and chunk lengths are valid.
- All required named nodes are present.
- `TV_Assembly` reloads with an identity root transform.
- `PowerButton` is the only descendant of `PowerButtonPivot`.
- A simulated local +Z button press therefore moves only the button.
- `Screen`, `StatusLight`, and `PowerButton` reload as separate visible meshes.
- Screen material can be replaced independently without changing the body.
- Status-light material can be changed independently.
- All texture images are embedded as GLB buffer views; no external URIs exist.
- No node has a negative scale or a negative transform determinant.
- Independent `trimesh` reload succeeded.

## Assumptions and deviations

- The user did not specify a diagonal size, mounting type, or exact cabinet placement, so the asset was designed as a **large 75-inch-class television with included feet**.
- The power control is placed visibly on the lower-right front bezel for reliable VR interaction, rather than hidden underneath the chassis.
- The status light is supplied in an unlit rest state because the requested on/off behaviour will be controlled later by runtime code.
- No speakers, logos, text, remote control, cable, or branded UI are included.

## File integrity

- SHA-256: `2d2ddef91747beb232a92049590c72515d4f168b151cfc69343b3e960b9613a5`
