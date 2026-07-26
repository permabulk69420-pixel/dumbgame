const DEFAULT_STORAGE_KEY = 'dumbgame-game-state-v1';
const MINUTES_PER_DAY = 1440;

const DEFAULT_STATE = Object.freeze({
  version: 1,
  day: 1,
  minuteOfDay: 8 * 60,
  storyPhase: 'day1_arrival',
  flags: {},
  completedEvents: [],
  eventData: {}
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normaliseTime(day, minuteOfDay) {
  const safeDay = Number.isFinite(day) ? Math.floor(day) : 1;
  const safeMinute = Number.isFinite(minuteOfDay) ? minuteOfDay : 0;
  const total = Math.max(0, (Math.max(1, safeDay) - 1) * MINUTES_PER_DAY + safeMinute);
  return {
    day: Math.floor(total / MINUTES_PER_DAY) + 1,
    minuteOfDay: total % MINUTES_PER_DAY
  };
}

function sanitise(raw = {}) {
  const time = normaliseTime(raw.day, raw.minuteOfDay);
  return {
    version: 1,
    day: time.day,
    minuteOfDay: time.minuteOfDay,
    storyPhase: typeof raw.storyPhase === 'string' ? raw.storyPhase : DEFAULT_STATE.storyPhase,
    flags: raw.flags && typeof raw.flags === 'object' && !Array.isArray(raw.flags) ? { ...raw.flags } : {},
    completedEvents: Array.isArray(raw.completedEvents)
      ? [...new Set(raw.completedEvents.filter((id) => typeof id === 'string'))]
      : [],
    eventData: raw.eventData && typeof raw.eventData === 'object' && !Array.isArray(raw.eventData)
      ? clone(raw.eventData)
      : {}
  };
}

export function createGameState({ storageKey = DEFAULT_STORAGE_KEY } = {}) {
  let state = clone(DEFAULT_STATE);
  const listeners = new Set();
  let saveTimer = null;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) state = sanitise(JSON.parse(stored));
  } catch (error) {
    console.warn('Game state could not be loaded; starting fresh.', error);
  }

  function persistNow() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Game state could not be saved.', error);
    }
  }

  function scheduleSave() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(persistNow, 3000);
  }

  function notify(reason) {
    scheduleSave();
    const snapshot = read();
    for (const listener of listeners) listener(snapshot, reason);
  }

  function read() {
    return clone(state);
  }

  function setTime(day, minuteOfDay, reason = 'time-set') {
    const previousDay = state.day;
    const next = normaliseTime(day, minuteOfDay);
    state.day = next.day;
    state.minuteOfDay = next.minuteOfDay;
    notify(state.day !== previousDay ? 'day-changed' : reason);
    return read();
  }

  function advanceMinutes(minutes) {
    if (!Number.isFinite(minutes) || minutes === 0) return read();
    return setTime(state.day, state.minuteOfDay + minutes, 'time-advanced');
  }

  function advanceToNextDay(hour = 8, minute = 0) {
    const target = clampHour(hour) * 60 + clampMinute(minute);
    return setTime(state.day + 1, target, 'slept-to-next-day');
  }

  function setStoryPhase(storyPhase) {
    if (typeof storyPhase !== 'string' || !storyPhase.trim() || state.storyPhase === storyPhase) return read();
    state.storyPhase = storyPhase;
    notify('story-phase-changed');
    return read();
  }

  function setFlag(name, value = true) {
    if (typeof name !== 'string' || !name.trim()) return read();
    if (state.flags[name] === value) return read();
    state.flags[name] = value;
    notify('flag-changed');
    return read();
  }

  function clearFlag(name) {
    if (!(name in state.flags)) return read();
    delete state.flags[name];
    notify('flag-cleared');
    return read();
  }

  function completeEvent(id) {
    if (typeof id !== 'string' || !id.trim() || state.completedEvents.includes(id)) return read();
    state.completedEvents.push(id);
    notify('event-completed');
    return read();
  }

  function setEventData(id, value) {
    if (typeof id !== 'string' || !id.trim()) return read();
    state.eventData[id] = clone(value ?? null);
    notify('event-data-changed');
    return read();
  }

  function reset() {
    state = clone(DEFAULT_STATE);
    persistNow();
    const snapshot = read();
    for (const listener of listeners) listener(snapshot, 'reset');
    return snapshot;
  }

  function subscribe(listener, { immediate = false } = {}) {
    listeners.add(listener);
    if (immediate) listener(read(), 'initial');
    return () => listeners.delete(listener);
  }

  function dispose() {
    persistNow();
    listeners.clear();
  }

  return {
    read,
    setTime,
    advanceMinutes,
    advanceToNextDay,
    setStoryPhase,
    setFlag,
    clearFlag,
    completeEvent,
    setEventData,
    subscribe,
    save: persistNow,
    reset,
    dispose
  };
}

function clampHour(value) {
  return Math.max(0, Math.min(23, Math.floor(Number(value) || 0)));
}

function clampMinute(value) {
  return Math.max(0, Math.min(59, Math.floor(Number(value) || 0)));
}
