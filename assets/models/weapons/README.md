# Weapon assets

Put weapon GLBs and their model-specific manifests in this folder.

## Expected pistol files

- `Pistol.glb`
- `Pistol_README.md`

## Shared conventions

- Binary glTF 2.0 (`.glb`)
- 1 unit = 1 metre
- +Y up
- Front/muzzle points toward local -Z
- Root scale `(1,1,1)`
- No negative scales
- Interactive parts remain separate nodes
- Empty hand, muzzle, magazine and interaction locators remain exported
- No baked gameplay scripts or interaction logic

The runtime filename stays stable as `Pistol.glb`; Git preserves prior revisions.