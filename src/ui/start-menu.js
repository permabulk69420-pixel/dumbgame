export const MODE_STORAGE_KEYS = Object.freeze({
  storyState: 'dumbgame-game-state-story-v1',
  storyPlacements: 'dumbgame-object-placements-story-v1',
  creativeState: 'dumbgame-game-state-creative-v1',
  creativePlacements: 'dumbgame-object-placements-creative-v1'
});

const LEGACY_KEYS = Object.freeze({
  state: 'dumbgame-game-state-v1',
  placements: 'dumbgame-object-placements-v1'
});

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The game still starts when storage is unavailable.
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // A fresh in-memory session is still usable.
  }
}

function migrateLegacySaves() {
  const oldState = safeGet(LEGACY_KEYS.state);
  const oldPlacements = safeGet(LEGACY_KEYS.placements);

  if (!safeGet(MODE_STORAGE_KEYS.storyState) && oldState) {
    safeSet(MODE_STORAGE_KEYS.storyState, oldState);
  }

  if (!safeGet(MODE_STORAGE_KEYS.storyPlacements) && oldPlacements) {
    safeSet(MODE_STORAGE_KEYS.storyPlacements, oldPlacements);
  }

  // Creative mode begins with the apartment layout the user was already testing,
  // but receives its own independent placement save from this point onward.
  if (!safeGet(MODE_STORAGE_KEYS.creativePlacements) && oldPlacements) {
    safeSet(MODE_STORAGE_KEYS.creativePlacements, oldPlacements);
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function selectStartMode({ loadingElement = null } = {}) {
  migrateLegacySaves();

  const menu = document.getElementById('start-menu');
  if (!menu) {
    if (loadingElement) loadingElement.hidden = false;
    return { mode: 'story', action: 'continue-story' };
  }

  const continueButton = menu.querySelector('[data-start-action="continue-story"]');
  const hasStorySave = Boolean(safeGet(MODE_STORAGE_KEYS.storyState));
  if (continueButton) {
    continueButton.disabled = !hasStorySave;
    continueButton.title = hasStorySave ? 'Continue the current story save' : 'No story save exists yet';
  }

  const selection = await new Promise((resolve) => {
    for (const button of menu.querySelectorAll('[data-start-action]')) {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        resolve(button.dataset.startAction);
      }, { once: true });
    }
  });

  let mode = 'story';
  if (selection === 'creative-build') mode = 'creative';

  if (selection === 'new-story') {
    safeRemove(MODE_STORAGE_KEYS.storyState);
    safeRemove(MODE_STORAGE_KEYS.storyPlacements);
  }

  document.body.dataset.gameMode = mode;
  menu.classList.add('is-closing');
  await wait(180);
  menu.remove();
  if (loadingElement) loadingElement.hidden = false;

  return { mode, action: selection };
}
