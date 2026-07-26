# Computer assets

Place the computer GLB files in this folder using these exact filenames:

```text
Monitor.glb
Keyboard.glb
Mouse.glb
ComputerTower.glb
```

`ComputerTower.glb` is optional unless the game ends up needing a separate tower.

## Shared conventions

- Binary GLB
- 1 unit = 1 metre
- +Y is up
- Front of each prop faces -Z
- Applied transforms; root scale `1,1,1`
- No negative scale
- Clear, stable node names
- Interactive parts remain separate from the static body
- Standard Three.js-compatible PBR materials
- Textures packed into the GLB when used
- Efficient enough for standalone Quest 3

## Required interaction nodes

### Monitor.glb

```text
Monitor
├─ Monitor_Body
├─ Screen_Display
├─ Screen_Glass
├─ PowerButton
├─ PowerLED
├─ Control_Menu
├─ Control_Up
├─ Control_Down
├─ Monitor_Stand
├─ Monitor_Swivel
└─ Monitor_Base
```

`Screen_Display` must be a separate mesh with clean 0–1 UVs and a replaceable material. Do not bake an image, desktop, logo or reflection into it.

### Keyboard.glb

```text
Keyboard
├─ Keyboard_Body
├─ Key_*
├─ LED_NumLock
├─ LED_CapsLock
└─ LED_ScrollLock
```

Every usable key should be a separately named node. Keys will be moved directly in Three.js along local `-Y`; individual baked key animations are unnecessary.

### Mouse.glb

```text
Mouse
├─ Mouse_Body
├─ Mouse_LeftButton
├─ Mouse_RightButton
├─ Mouse_Wheel
├─ Mouse_WheelButton
└─ Mouse_LED
```

The mouse root origin should sit at the bottom centre of its desk-contact footprint. Button and wheel pivots must support pressing and wheel rotation.

## Loading

Uploading files here does not automatically add them to the scene. Their paths must be added to `src/config.js` and registered by the relevant asset module before they appear in-game.
