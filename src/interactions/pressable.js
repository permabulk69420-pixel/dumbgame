import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

export function registerPressable({
  placement,
  node,
  id,
  label = node?.name || 'button',
  translationAxis = null,
  translationDistance = 0,
  rotationAxis = null,
  rotationAngle = 0,
  statusElement = null,
  onPress = null,
  onRelease = null
}) {
  if (!placement?.registerGrabInteraction || !node) return () => {};

  const restPosition = node.position.clone();
  const restQuaternion = node.quaternion.clone();
  const moveAxis = translationAxis
    ? new THREE.Vector3(...translationAxis).normalize()
    : null;
  const turnAxis = rotationAxis
    ? new THREE.Vector3(...rotationAxis).normalize()
    : null;
  const turnQuaternion = turnAxis
    ? new THREE.Quaternion().setFromAxisAngle(turnAxis, rotationAngle)
    : null;

  function restore() {
    node.position.copy(restPosition);
    node.quaternion.copy(restQuaternion);
    node.updateMatrix();
  }

  return placement.registerGrabInteraction(node, {
    id: id || `press:${node.uuid}`,
    label,

    begin(context) {
      restore();

      if (moveAxis && translationDistance) {
        node.position.addScaledVector(moveAxis, translationDistance);
      }
      if (turnQuaternion && rotationAngle) {
        node.quaternion.multiply(turnQuaternion);
      }

      node.updateMatrix();
      if (statusElement) statusElement.textContent = `${label} pressed`;
      onPress?.(context);
      return {};
    },

    end(context) {
      restore();
      onRelease?.(context);
    }
  });
}

export function registerPassiveInteraction({
  placement,
  node,
  id,
  label = node?.name || 'object',
  statusElement = null,
  onSelect = null
}) {
  if (!placement?.registerGrabInteraction || !node) return () => {};

  return placement.registerGrabInteraction(node, {
    id: id || `select:${node.uuid}`,
    label,

    begin(context) {
      const message = typeof label === 'function' ? label(context) : label;
      if (statusElement) statusElement.textContent = message;
      onSelect?.(context);
      return {};
    }
  });
}
