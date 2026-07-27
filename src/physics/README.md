# Physics

The apartment uses Rapier as the shared rigid-body and collision layer.

- `physics-world.js` owns the Rapier world, fixed timestep, dynamic props, kinematic held objects and release velocity.
- `apartment-colliders.js` builds the apartment shell and reusable furniture colliders.
- Visual GLB geometry remains separate from simplified collision shapes.
- Loose props are dynamic, hand-held props are position-driven kinematic bodies, and placed furniture is kinematic so Creative Build movement stays synchronized.
- Moving drawers use hollow compound colliders rather than solid boxes, allowing loose props to be placed inside.

Prefer explicit collider locator nodes or documented collider dimensions for future GLBs. Use calculated visual bounds only as a fallback for simple props and flat support surfaces.
