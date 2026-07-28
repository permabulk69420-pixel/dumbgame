import { createPerformanceHud as createBasePerformanceHud } from './performance-hud.js?base=1';

export function createPerformanceHud(options = {}) {
  const creativeMode = Boolean(options.controllerModes?.isDecorationAllowed?.());
  const hud = createBasePerformanceHud({
    ...options,
    visibleByDefault: creativeMode && options.visibleByDefault !== false
  });

  const panel = options.scene?.getObjectByName?.('PerformanceHUD');
  if (panel) panel.userData.ignoreLaser = true;

  return hud;
}
