function flagsMatch(requiredFlags, flags) {
  if (!requiredFlags) return true;
  if (Array.isArray(requiredFlags)) return requiredFlags.every((name) => Boolean(flags[name]));
  return Object.entries(requiredFlags).every(([name, value]) => flags[name] === value);
}

function timeMatches(event, state) {
  if (event.earliestDay && state.day < event.earliestDay) return false;
  if (event.latestDay && state.day > event.latestDay) return false;
  if (event.earliestTime !== undefined && state.minuteOfDay < event.earliestTime) return false;
  if (event.latestTime !== undefined && state.minuteOfDay > event.latestTime) return false;
  return true;
}

export function createEventScheduler({ gameState, events = [], onError = console.error }) {
  if (!gameState) throw new Error('createEventScheduler requires gameState');

  const registry = new Map();
  const triggering = new Set();
  let dirty = true;
  const unsubscribe = gameState.subscribe(() => { dirty = true; });
  for (const event of events) register(event);

  function register(event) {
    if (!event?.id || typeof event.id !== 'string') throw new Error('Scheduled events require a string id');
    registry.set(event.id, { once: true, ...event });
    dirty = true;
    return () => {
      registry.delete(event.id);
      dirty = true;
    };
  }

  function eligible(event, state) {
    if (event.once !== false && state.completedEvents.includes(event.id)) return false;
    if (event.repeat === 'daily' && state.eventData[event.id]?.lastTriggeredDay === state.day) return false;
    if (event.requiredPhase && state.storyPhase !== event.requiredPhase) return false;
    if (!flagsMatch(event.requiredFlags, state.flags)) return false;
    if (!timeMatches(event, state)) return false;
    if (typeof event.when === 'function' && !event.when(state)) return false;
    return true;
  }

  function trigger(event, context, state = gameState.read()) {
    if (triggering.has(event.id)) return false;
    triggering.add(event.id);
    try {
      event.onTrigger?.({ state, gameState, scheduler: api, ...context });
      if (event.repeat === 'daily') {
        gameState.setEventData(event.id, { lastTriggeredDay: state.day });
      } else if (event.once !== false) {
        gameState.completeEvent(event.id);
      }
      return true;
    } catch (error) {
      onError(`Event "${event.id}" failed`, error);
      return false;
    } finally {
      triggering.delete(event.id);
    }
  }

  function update(context = {}) {
    if (!dirty) return;
    dirty = false;
    const state = gameState.read();
    for (const event of registry.values()) {
      if (eligible(event, state)) trigger(event, context, state);
    }
  }

  function triggerById(id, context = {}) {
    const event = registry.get(id);
    return event ? trigger(event, context) : false;
  }

  const api = {
    register,
    update,
    triggerById,
    has: (id) => registry.has(id),
    list: () => [...registry.values()],
    dispose: unsubscribe
  };

  return api;
}
