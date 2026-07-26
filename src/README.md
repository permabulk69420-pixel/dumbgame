# Source layout

- `main.js` — startup and frame loop only.
- `scene.js` — Three.js renderer, WebXR session, camera, rig, controllers and global light.
- `config.js` — world dimensions, scale, movement values and asset paths.
- `materials.js` — procedural textures and shared materials.
- `house.js` — fixed house geometry, trim, roof, lights and wall collision segments.
- `locomotion.js` — Quest thumbsticks, smooth turning and player collision.
- `placement-system.js` — reusable point/lock/move/place system with saved transforms.
- `asset-loader.js` — GLB loading and common mesh setup.
- `hands.js` — rigged hand loading and analog pose scrubbing. Mixer update is mandatory.
- `assets.js` — registers scene props such as the computer desk.
- `interactions/drawers.js` — drawer animation scrubbing; physical pulling can be added here.

The app remains a plain static GitHub Pages site. There is no npm or build step.
