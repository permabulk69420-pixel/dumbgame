# Tool assets

Put handheld utility props and their model-specific manifests in this folder.

## Expected flashlight files

- `Flashlight.glb`
- `Flashlight_README.md`

## Shared conventions

- Binary glTF 2.0 (`.glb`)
- 1 unit = 1 metre
- +Y up
- Root scale `(1,1,1)`
- No negative scales
- Interactive parts remain separate nodes
- Export named hand-grip, power-button and light-emitter locators
- No baked gameplay scripts or interaction logic

The runtime filename stays stable as `Flashlight.glb`; Git preserves prior revisions.