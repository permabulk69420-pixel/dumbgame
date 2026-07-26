# Keyboard.glb — node and interaction manifest

## Asset summary
- **Format:** binary glTF 2.0 (`Keyboard.glb`), with the legend atlas embedded in the GLB.
- **Coordinate system:** 1 unit = 1 metre; +Y up; keyboard front faces -Z.
- **Measured overall bounds:** **0.452 m W × 0.158 m D × 0.0347 m H**.
- **Root origin:** `(0, 0, 0)`, at the bottom centre of the four-point desk-contact footprint.
- **Root transform:** translation `(0,0,0)`, rotation identity, scale `(1,1,1)`.
- **Triangle count:** **6,334 triangles** total.
- **Key count:** 104 physical keycaps; 102 are combined in `Keyboard_StaticKeys`.
- **Animations:** none baked.
- **Legend orientation:** atlas UVs are corrected for the defined -Z viewing/front direction; legends read normally from desk position.

## Exact hierarchy
```text
Keyboard
├─ Keyboard_Body
├─ Keyboard_StaticKeys
├─ Key_Escape
├─ Key_Enter
├─ LED_CapsLock
├─ LED_NumLock
└─ LED_ScrollLock
```

## Nodes, pivots and interaction axes
- **Keyboard** — master movement/root node. Move and rotate the whole keyboard through this node.
- **Keyboard_Body** — fixed wedge-shaped casing plus four rubber desk feet. Does not move during key presses.
- **Keyboard_StaticKeys** — one combined mesh containing all non-interactive keycaps and their atlas-mapped legend quads.
- **Key_Escape** — pivot at the keycap's bottom-centre/stem position; local axes equal world axes. Press **0.003–0.005 m along local -Y**; recommended travel `0.004 m`.
- **Key_Enter** — main alphanumeric Enter only. Pivot at the keycap's bottom-centre/stem position; local axes equal world axes. Press **0.003–0.005 m along local -Y**; recommended travel `0.004 m`.
- **LED_CapsLock**, **LED_NumLock**, **LED_ScrollLock** — independent lens nodes. Their material can be swapped, dimmed or have `emissiveIntensity` changed at runtime.

No interactive node has rotation or scale baked into its transform, so local -Y remains the direct press axis in Three.js.

## Materials
- `Keyboard_Casing` — charcoal PBR casing, restrained metallic response, medium roughness.
- `Keyboard_Keycaps` — neutral charcoal keycap PBR material shared by static and interactive keys.
- `Keyboard_Legends` — transparent PBR decal material using one packed `Keyboard_Legend_Atlas` PNG.
- `Keyboard_LED_Green` — emissive-capable green indicator material.
- `Keyboard_Rubber` — dark high-roughness desk-foot material.

## Runtime notes
- Raycast `Key_Escape` and `Key_Enter` directly, then animate each node's `position.y` from its stored rest value to `restY - 0.004` and back.
- The numeric keypad Enter key is deliberately part of `Keyboard_StaticKeys`; only the main Enter key is interactive.
- The atlas texture and all materials are embedded; there are no external texture dependencies.
