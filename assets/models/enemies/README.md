# Enemy models

## Skitter creature

The active enemy model is:

`assets/models/enemies/skitter_creature.glb`

The supplied GLB has been inspected and currently contains:

- 2,343 vertices across five mesh primitives
- 4,366 triangles
- 31-joint skinned rig
- authored dimensions of approximately 0.24 m wide, 0.18 m high and 0.40 m long
- forward direction along local +Z
- attachment nodes named `ATTACH_Face` and `ATTACH_Mouth`

The five embedded animation clips are:

1. `Idle` — 4.0 seconds
2. `Skitter` — 0.5 seconds
3. `Alert` — 1.2 seconds
4. `Attack_Lunge` — 0.75 seconds
5. `Death` — 1.6 seconds

The runtime loader scales the creature to approximately 0.95 m long, removes root motion from the looping `Skitter` clip, and maps the clips by their exact names. There is no dedicated hurt animation, so a shortened, accelerated `Alert` animation is used as the temporary hit reaction.

The creature spawns near the dark right-hand end of the extended corridor, detects the player at close range, and is clamped behind the apartment entrance boundary. The pistol and wooden bat both damage it through the shared combat-target system.

Useful browser-console commands:

- `game.getSkitterEnemy()`
- `game.getSkitterAnimations()`
- `game.alertSkitter()`
- `game.damageSkitter(25)`
- `game.respawnSkitter()`
