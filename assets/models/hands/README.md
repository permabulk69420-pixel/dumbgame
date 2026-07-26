# VR Hands (three.js / WebXR)

Put these files in this folder:

- `LeftHand.glb`
- `RightHand.glb`

Two rigged hands, corrected and exported to GLB.

| | |
|---|---|
| Triangles | 1200 per hand |
| Vertices | 734 / 728 |
| Joints | 24 per hand |
| Skin influences | max 4 per vertex, weights normalised |
| Units | metres, real scale (18.5 cm wrist to fingertip) |
| Origin | wrist joint, at (0,0,0) |
| Orientation | fingers point −Z, palm faces −Y |
| File size | ~82 KB each |
| Textures | none (flat PBR material, UVs intact if you want to texture later) |

Bone names follow the Meta hand-tracking convention (`b_l_index1`, `b_r_thumb2`, …),
so they line up with hand-tracking joint data if you add that later.

## Animation clips

Five clips, each exactly **1 second, rest → full pose**. Don't play them — scrub them.
Set `action.time` to your analog input (0..1) and you get the whole range of the pose.

`Open` · `Grip` · `Fist` · `Point` · `Pinch`

The rest pose (t=0) is a relaxed hand, which works as an idle without any clip playing.

## Usage

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('./LeftHand.glb');
const hand = gltf.scene;

const mixer = new THREE.AnimationMixer(hand);
const actions = {};
for (const clip of gltf.animations) {
  const a = mixer.clipAction(clip);
  a.play();
  a.paused = true;   // we scrub manually
  a.weight = 0;
  actions[clip.name] = a;
}

// Show one pose at `amount` (0..1)
let current = null;
function setPose(name, amount) {
  if (current && current !== name) actions[current].weight = 0;
  current = name;
  const a = actions[name];
  a.weight = 1;
  a.time = THREE.MathUtils.clamp(amount, 0, 1);
}

// Wrist is at the origin, so parent straight to the grip space
const grip = renderer.xr.getControllerGrip(0);
grip.add(hand);

// Per frame
function update(dt, gamepad) {
  if (gamepad) {
    const trigger = gamepad.buttons[0]?.value ?? 0;
    const squeeze = gamepad.buttons[1]?.value ?? 0;
    // This mapping is illustrative only. The game should define its own pose behaviour.
    setPose(squeeze > 0.05 ? 'Grip' : 'Point', squeeze > 0.05 ? squeeze : 1 - trigger);
  }

  // Required every frame, even while actions are paused and scrubbed.
  mixer.update(dt);
}
```

`mixer.update(dt)` must be called every frame or the paused actions silently remain frozen in the rest pose.

The example trigger/squeeze mapping is only an API demonstration, not the intended control design for the game.

## Notes

- Backface culling is on and winding is correct, so leave `side: THREE.FrontSide`.
- The material is a plain skin-tone PBR. Override `baseColorFactor` or assign your own
  material for a horror look — the UVs are unwrapped and unused, so a texture will map fine.
- `b_l_grip` / `b_r_grip` is an empty joint sitting in the middle of the grasp volume.
  Parent held objects to it and they'll sit in the hand correctly.
