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
  const outlineHelpers = collectNewLineObjects(options.scene, sceneChildrenBefore);
  const pointerHelpers = (options.controllers || []).flatMap((controller) =>
    collectNewLineObjects(controller, controllerChildrenBefore.get(controller) || new Set())
  );

  for (const helper of [...outlineHelpers, ...pointerHelpers]) {
    helper.userData.ignoreLaser = true;
    if (!helper.name) helper.name = helper.isLineSegments
      ? 'PlacementOutlineHelper'
      : 'PlacementPointerHelper';
  }

  // Story mode keeps the useful controller pointer so the player can see which
  // object the grip ray has acquired, but suppresses the large wireframe bounds.
  // Creative mode retains both because the bounds are useful while authoring.
  let outlinesVisible = Boolean(options.controllerModes?.isDecorationAllowed?.());

  function applyOutlineVisibility() {
    if (outlinesVisible) return;
    for (const helper of outlineHelpers) helper.visible = false;
  }

  applyOutlineVisibility();
  const baseUpdate = system.update.bind(system);

  return {
    ...system,
    update(dt) {
      baseUpdate(dt);
      applyOutlineVisibility();
    },
    setVisualHelpersVisible(value) {
      outlinesVisible = Boolean(value);
      applyOutlineVisibility();
      return outlinesVisible;
    },
    areVisualHelpersVisible: () => outlinesVisible
  };
}
