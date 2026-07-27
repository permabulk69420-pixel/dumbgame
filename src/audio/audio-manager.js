const DEFAULT_VOLUMES = Object.freeze({
  master: 1,
  music: 0.72,
  narration: 1,
  sfx: 1
});

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clampPlaybackRate(value) {
  return Math.max(0.5, Math.min(2, Number(value) || 1));
}

export function createAudioManager({ wakeMusicUrl = null } = {}) {
  const volumes = { ...DEFAULT_VOLUMES };
  const tracks = new Set();

  function applyVolume(track) {
    track.element.volume = clampVolume(volumes.master * volumes[track.channel] * track.gain);
  }

  function createTrack(url, channel, {
    loop = false,
    gain = 1,
    playbackRate = 1,
    preservePitch = true
  } = {}) {
    if (!url) return null;
    const element = new Audio(url);
    element.preload = 'auto';
    element.loop = loop;
    element.crossOrigin = 'anonymous';
    element.playbackRate = clampPlaybackRate(playbackRate);
    if ('preservesPitch' in element) element.preservesPitch = preservePitch;
    if ('mozPreservesPitch' in element) element.mozPreservesPitch = preservePitch;
    if ('webkitPreservesPitch' in element) element.webkitPreservesPitch = preservePitch;
    const track = { element, channel, gain: clampVolume(gain) };
    tracks.add(track);
    applyVolume(track);
    return track;
  }

  const wakeMusic = createTrack(wakeMusicUrl, 'music');

  async function play(track, { restart = false } = {}) {
    if (!track) return false;
    if (restart) track.element.currentTime = 0;
    applyVolume(track);
    try {
      await track.element.play();
      return true;
    } catch (error) {
      console.warn('Audio playback could not start.', error);
      return false;
    }
  }

  function stop(track, { rewind = true } = {}) {
    if (!track) return false;
    track.element.pause();
    if (rewind) track.element.currentTime = 0;
    return true;
  }

  function playOneShot(url, channel, options = {}) {
    const track = createTrack(url, channel, options);
    if (!track) return false;
    track.element.addEventListener('ended', () => {
      tracks.delete(track);
      track.element.removeAttribute('src');
      track.element.load();
    }, { once: true });
    void play(track, { restart: true });
    return true;
  }

  function setVolume(channel, value) {
    if (!(channel in volumes)) return false;
    volumes[channel] = clampVolume(value);
    for (const track of tracks) applyVolume(track);
    return true;
  }

  return {
    playWakeMusic: (options) => play(wakeMusic, options),
    stopWakeMusic: (options) => stop(wakeMusic, options),
    playNarration: (url, options) => playOneShot(url, 'narration', options),
    playSfx: (url, options) => playOneShot(url, 'sfx', options),
    setVolume,
    getVolumes: () => ({ ...volumes }),
    dispose() {
      for (const track of tracks) {
        track.element.pause();
        track.element.removeAttribute('src');
        track.element.load();
      }
      tracks.clear();
    }
  };
}
