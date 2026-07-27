const SHARED_PLACEMENT_KEY = 'dumbgame-object-placements-shared-v1';

export const MODE_STORAGE_KEYS = Object.freeze({
  storyState: 'dumbgame-game-state-story-v1',
  storyPlacements: SHARED_PLACEMENT_KEY,
  creativeState: 'dumbgame-game-state-creative-v1',
  creativePlacements: SHARED_PLACEMENT_KEY,
  publishedPlacements: 'dumbgame-object-placements-published-v1'
});

const LEGACY_KEYS = Object.freeze({
  state: 'dumbgame-game-state-v1',
  placements: 'dumbgame-object-placements-v1',
  storyPlacements: 'dumbgame-object-placements-story-v1',
  creativePlacements: 'dumbgame-object-placements-creative-v1'
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
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // A fresh in-memory session is still usable.
  }
}

export function publishCreativeLayout(placements = {}) {
  const clean = placements && typeof placements === 'object' ? placements : {};
  const serialised = JSON.stringify(clean);
  safeSet(MODE_STORAGE_KEYS.publishedPlacements, serialised);
  safeSet(SHARED_PLACEMENT_KEY, serialised);
  return JSON.parse(serialised);
}

export function readPublishedLayout() {
  const value = safeGet(MODE_STORAGE_KEYS.publishedPlacements);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function migrateLegacySaves() {
  const oldState = safeGet(LEGACY_KEYS.state);
  const oldPlacements = safeGet(LEGACY_KEYS.placements);
  const oldCreativePlacements = safeGet(LEGACY_KEYS.creativePlacements);
  const oldStoryPlacements = safeGet(LEGACY_KEYS.storyPlacements);

  if (!safeGet(MODE_STORAGE_KEYS.storyState) && oldState) {
    safeSet(MODE_STORAGE_KEYS.storyState, oldState);
  }

  // Prefer the most recently used Creative layout, then Story, then the original legacy save.
  if (!safeGet(SHARED_PLACEMENT_KEY)) {
    const layout = oldCreativePlacements || oldStoryPlacements || oldPlacements;
    if (layout) safeSet(SHARED_PLACEMENT_KEY, layout);
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
    // Reset narrative progress but preserve the apartment layout authored in Creative Build.
    safeRemove(MODE_STORAGE_KEYS.storyState);
  }

  document.body.dataset.gameMode = mode;
  menu.classList.add('is-closing');
  await wait(180);
  menu.remove();
  if (loadingElement) loadingElement.hidden = false;

  return { mode, action: selection };
}
