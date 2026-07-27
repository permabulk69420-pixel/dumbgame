const PRIMARY_FACE_BUTTON = 4;   // Quest A / X in the xr-standard mapping.
const SECONDARY_FACE_BUTTON = 5; // Quest B / Y in the xr-standard mapping.
const THUMBSTICK_BUTTON = 3;

export function createControllerModes({
  controllers,
  statusElement = null,
  allowDecoration = true,
  decorationEnabledByDefault = true,
  decorationToggleHoldSeconds = 0.75
}) {
  const states = controllers.map((controller) => ({
    controller,
    inputSource: null,
    handedness: '',
    pointing: false,
    primaryDown: false,
    primaryPressed: false,
    primaryReleased: false,
    secondaryDown: false,
    secondaryPressed: false,
    secondaryReleased: false,
    thumbstickDown: false
  }));

  const decorationAllowed = Boolean(allowDecoration);
  let decorationMode = decorationAllowed && Boolean(decorationEnabledByDefault);
  let decorationToggleHold = 0;
  let decorationToggleLatched = false;

  const setStatus = (text) => {
    if (statusElement) statusElement.textContent = text;
  };

  for (const state of states) {
    state.controller.addEventListener('connected', (event) => {
      state.inputSource = event.data;
      state.handedness = event.data.handedness || '';
    });

    state.controller.addEventListener('disconnected', () => {
      state.inputSource = null;
      state.handedness = '';
      state.pointing = false;
      state.primaryDown = false;
      state.secondaryDown = false;
      state.thumbstickDown = false;
    });
  }

  function setPointing(handedness, enabled) {
    const state = getState(handedness);
    if (!state) return false;
    state.pointing = Boolean(enabled);
    setStatus(state.pointing
      ? `${capitalise(handedness)} hand pointing · trigger uses buttons and screens`
      : `${capitalise(handedness)} hand returned to grab mode`);
    return state.pointing;
  }

  function togglePointing(handedness) {
    const state = getState(handedness);
    if (!state) return false;
    return setPointing(handedness, !state.pointing);
  }

  function setDecorationMode(enabled) {
    if (!decorationAllowed) {
      decorationMode = false;
      return false;
    }

    decorationMode = Boolean(enabled);
    setStatus(decorationMode
      ? 'Decorating mode ON · hold B/Y to move whole furniture · hold both stick-clicks to turn it off'
      : 'Decorating mode OFF · grip grabs objects · A/X toggles pointing · trigger uses controls');
    return decorationMode;
  }

  function update(dt) {
    for (const state of states) {
      const buttons = state.inputSource?.gamepad?.buttons || [];
      const primary = Boolean(buttons[PRIMARY_FACE_BUTTON]?.pressed);
      const secondary = Boolean(buttons[SECONDARY_FACE_BUTTON]?.pressed);
      const thumbstick = Boolean(buttons[THUMBSTICK_BUTTON]?.pressed);

      state.primaryPressed = primary && !state.primaryDown;
      state.primaryReleased = !primary && state.primaryDown;
      state.secondaryPressed = secondary && !state.secondaryDown;
      state.secondaryReleased = !secondary && state.secondaryDown;

      state.primaryDown = primary;
      state.secondaryDown = secondary;
      state.thumbstickDown = thumbstick;

      if (state.primaryPressed && state.handedness) togglePointing(state.handedness);
    }

    if (!decorationAllowed) return;

    const connected = states.filter((state) => state.inputSource);
    const bothSticks = connected.length >= 2 && connected.every((state) => state.thumbstickDown);

    if (bothSticks) {
      decorationToggleHold += dt;
      if (!decorationToggleLatched && decorationToggleHold >= decorationToggleHoldSeconds) {
        decorationToggleLatched = true;
        setDecorationMode(!decorationMode);
      }
    } else {
      decorationToggleHold = 0;
      decorationToggleLatched = false;
    }
  }

  function getState(handedness) {
    return states.find((state) => state.handedness === handedness) || null;
  }

  function isPointing(handedness) {
    return Boolean(getState(handedness)?.pointing);
  }

  function isDecorationMode() {
    return decorationAllowed && decorationMode;
  }

  function isDecorationAllowed() {
    return decorationAllowed;
  }

  return {
    update,
    states,
    getState,
    isPointing,
    setPointing,
    togglePointing,
    isDecorationAllowed,
    isDecorationMode,
    setDecorationMode
  };
}

function capitalise(value = '') {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Controller';
}
