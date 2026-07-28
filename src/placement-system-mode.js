import { createPlacementSystem as createBasePlacementSystem } from './placement-system.js?base=1';

function collectNewLineObjects(parent, before) {
  if (!parent?.children) return [];
  return parent.children.filter((child) =>
    !before.has(child) && (child.isLine || child.isLineSegments)
  );
}

export function createPlacementSystem(options = {}) {
  const sceneChildrenBefore = new Set(options.scene?.children || []);
  const controllerChildrenBefore = new Map(
    (options.controllers || []).map((controller) => [controller, new Set(controller.children || [])])
  );

  const system = createBasePlacementSystem(options);
  const visualHelpers = [
    ...collectNewLineObjects(options.scene, sceneChildrenBefore),
    ...(options.controllers || []).flatMap((controller) =>
      collectNewLineObjects(controller, controllerChildrenBefore.get(controller) || new Set())
    )
  ];

  for (const helper of visualHelpers) {
    helper.userData.ignoreLaser = true;
    if (!helper.name) helper.name = 'PlacementVisualHelper';
  }

  // Creative mode needs authoring rays and bounds. Story mode keeps all of the
  // interaction logic, but removes the large wire boxes and controller rays.
  let helpersVisible = Boolean(options.controllerModes?.isDecorationAllowed?.());

  function applyVisibility() {
    if (helpersVisible) return;
    for (const helper of visualHelpers) helper.visible = false;
  }

  applyVisibility();
  const baseUpdate = system.update.bind(system);

  return {
    ...system,
    update(dt) {
      baseUpdate(dt);
      applyVisibility();
    },
    setVisualHelpersVisible(value) {
      helpersVisible = Boolean(value);
      applyVisibility();
      return helpersVisible;
    },
    areVisualHelpersVisible: () => helpersVisible
  };
}
