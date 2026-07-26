import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const DEFAULT_SLIDERS = Object.freeze([
  { nodeName: 'Drawer_Bottom', travel: 0.42, label: 'bottom drawer' },
  { nodeName: 'Drawer_Mid', travel: 0.42, label: 'middle drawer' },
  { nodeName: 'Drawer_Top', travel: 0.42, label: 'top drawer' },
  { nodeName: 'KeyboardTray', travel: 0.28, label: 'keyboard tray' }
]);

export function registerSlidingDeskInteractions({
  desk,
  placement,
  drawerAnimations,
  sliders = DEFAULT_SLIDERS,
  statusElement = null
}) {
  if (!desk || !placement?.registerGrabInteraction || !drawerAnimations) {
    throw new Error('registerSlidingDeskInteractions requires desk, placement and drawerAnimations');
  }

  const disposers = [];

  for (const config of sliders) {
    const node = desk.getObjectByName(config.nodeName);
    if (!node) {
      console.warn(`Sliding interaction skipped: ${config.nodeName} was not found in ComputerDesk.glb`);
      continue;
    }

    const dispose = placement.registerGrabInteraction(node, {
      id: `computer-desk:${config.nodeName}`,
      label: config.label,

      begin({ controller }) {
        const controllerStart = new THREE.Vector3();
        const controllerPosition = new THREE.Vector3();
        const slideAxisWorld = new THREE.Vector3(0, 0, -1);
        const parentWorldQuaternion = new THREE.Quaternion();

        node.parent?.getWorldQuaternion(parentWorldQuaternion);
        slideAxisWorld.applyQuaternion(parentWorldQuaternion).normalize();
        controller.getWorldPosition(controllerStart);

        if (statusElement) {
          statusElement.textContent = `Grip and pull the ${config.label} · release grip to leave it in place`;
        }

        return {
          controllerStart,
          controllerPosition,
          slideAxisWorld,
          startAmount: drawerAnimations.getAmount(config.nodeName),
          nodeName: config.nodeName,
          travel: config.travel
        };
      },

      update({ controller, context }) {
        controller.getWorldPosition(context.controllerPosition);

        const controllerTravel = context.controllerPosition
          .sub(context.controllerStart)
          .dot(context.slideAxisWorld);

        const amount = context.startAmount + controllerTravel / context.travel;
        drawerAnimations.setAmount(context.nodeName, amount);
      },

      end() {
        drawerAnimations.save();
        if (statusElement) {
          statusElement.textContent =
            'Grip drawers to pull them · A/X toggles pointing for buttons · B/Y is temporary decorating';
        }
      }
    });

    disposers.push(dispose);
  }

  return {
    dispose() {
      for (const dispose of disposers) dispose();
    }
  };
}
