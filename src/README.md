# Source layout

- `main.js` — startup, system wiring and frame loop only.
- `scene.js` — Three.js renderer, WebXR session, camera, rig, controllers and named world lights.
- `config.js` — world dimensions, scale, movement, asset paths, interaction tuning and game-time tuning.
- `materials.js` — procedural textures and shared materials.
- `house.js` — fixed house geometry, trim, roof, interior lights and wall collision segments.
- `locomotion.js` — Quest thumbsticks, smooth turning and player collision.
- `input/controller-modes.js` — point-mode and temporary decorating-mode controller state.
- `placement-system.js` — separate use, gameplay-grab and temporary furniture-placement channels.
- `asset-loader.js` — GLB loading and common mesh setup.
- `hands.js` — rigged hand loading and pose scrubbing. Mixer update is mandatory.
- `assets.js` — loads the desk and delegates the complete computer workstation setup.
- `computer/computer-setup.js` — monitor, keyboard, mouse and tower loading, desk layout and basic controls.
- `interactions/pressable.js` — point-and-trigger buttons and screens.
- `interactions/drawers.js` — persistent drawer animation scrubbing.
- `interactions/sliding-grab.js` — grip-driven physical pulling for drawers and the keyboard tray.
- `state/game-state.js` — persistent day, time, story phase, flags and completed-event state.
- `time/game-clock.js` — game-time advancement, pausing, skipping and sleeping to the next day.
- `time/day-night-cycle.js` — sun, sky, fog, exposure and automatic interior-light changes.
- `story/event-scheduler.js` — conditional one-off or daily events based on day, time, phase and flags.

## Quest interaction controls

- A/X toggles Point mode for that hand.
- While pointing, trigger activates buttons, switches and screens.
- Grip grabs gameplay objects and pulls drawers/trays.
- Temporary decorating mode starts enabled; hold B/Y to move whole registered furniture.
- Hold both thumbstick clicks for 0.75 seconds to toggle decorating mode.

Decorating mode is deliberately separate from normal gameplay interaction and can later default to off without changing drawer, object-grab or button logic.

## Time and story rules

Game day/time and story phase are intentionally separate. A story phase may span several days, and one day may contain several phases.

The clock defaults to one full in-game day per 30 real minutes and only advances during an active XR session. These values are configured in `config.js`.

Future beds, computers, doors and story scripts can call the stable hooks exposed as `window.game`, including `setFlag`, `setStoryPhase`, `registerEvent`, `setTime`, `skipMinutes` and `sleepToNextDay`.

## Computer input hook

Physical computer controls dispatch `dumbgame:computer-input` browser events. Event details identify power changes, keyboard Enter/Escape, mouse buttons, monitor controls, optical-drive state and screen UV selections. The future computer UI can listen to this without changing the asset interaction code.

The app remains a plain static GitHub Pages site. There is no npm or build step.
