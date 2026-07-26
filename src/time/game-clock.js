const MINUTES_PER_DAY = 1440;

export function createGameClock({
  gameState,
  realSecondsPerDay = 30 * 60,
  initialTimeScale = 1,
  initiallyPaused = false
}) {
  if (!gameState) throw new Error('createGameClock requires gameState');

  let timeScale = Math.max(0, Number(initialTimeScale) || 0);
  let paused = Boolean(initiallyPaused);
  let pendingMinutes = 0;

  function update(dt, active = true) {
    if (!active || paused || timeScale <= 0 || !Number.isFinite(dt) || dt <= 0) return;
    pendingMinutes += dt * (MINUTES_PER_DAY / Math.max(1, realSecondsPerDay)) * timeScale;
    if (pendingMinutes < 0.1) return;
    gameState.advanceMinutes(pendingMinutes);
    pendingMinutes = 0;
  }

  function setTime(day, hour, minute = 0) {
    pendingMinutes = 0;
    return gameState.setTime(day, clampHour(hour) * 60 + clampMinute(minute));
  }

  function skipMinutes(minutes) {
    pendingMinutes = 0;
    return gameState.advanceMinutes(minutes);
  }

  function sleepToNextDay(hour = 8, minute = 0) {
    pendingMinutes = 0;
    return gameState.advanceToNextDay(hour, minute);
  }

  function setTimeScale(value) {
    timeScale = Math.max(0, Number(value) || 0);
    return timeScale;
  }

  function setPaused(value) {
    paused = Boolean(value);
    return paused;
  }

  function formatTime(minuteOfDay = gameState.read().minuteOfDay) {
    const totalMinutes = Math.floor(((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  function getPeriod(minuteOfDay = gameState.read().minuteOfDay) {
    const minute = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (minute >= 6 * 60 && minute < 9 * 60) return 'morning';
    if (minute >= 9 * 60 && minute < 17 * 60) return 'day';
    if (minute >= 17 * 60 && minute < 20 * 60) return 'evening';
    return 'night';
  }

  return {
    update,
    setTime,
    skipMinutes,
    sleepToNextDay,
    setTimeScale,
    setPaused,
    formatTime,
    getPeriod,
    get timeScale() { return timeScale; },
    get paused() { return paused; }
  };
}

function clampHour(value) {
  return Math.max(0, Math.min(23, Math.floor(Number(value) || 0)));
}

function clampMinute(value) {
  return Math.max(0, Math.min(59, Math.floor(Number(value) || 0)));
}
