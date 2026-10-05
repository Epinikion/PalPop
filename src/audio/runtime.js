import { createAudioOutput, SFX_GAIN } from './output.js';
import { BASS_DEFAULT } from './state.js';
export function createAudioRuntime({
  audio,
  audioGraph,
  audioScheduler,
  onSettingsChange = () => {},
}) {
  const listeners = new AbortController();
  let silentURL = null;
  function initAudio() {
    if (audio.context) {
      if (audio.context.state !== 'running') {
        try {
          const pr = audio.context.resume();
          if (pr && pr.catch) pr.catch(() => {});
        } catch (e) {}
      }
      if (!audio.playing) audioScheduler.startSong();
      return;
    }
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      audio.context = new A();
      audio.master = createAudioOutput(audio.context);
      audio.noiseBuf = audio.context.createBuffer(
        1,
        audio.context.sampleRate,
        audio.context.sampleRate,
      );
      const nd = audio.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      audioGraph.buildMusicGraph();
      applyAudio();
      audioScheduler.startSong();
    } catch (e) {
      audio.context = null;
    }
  }
  /* ---- iOS / Safari audio unlock ----
   1) Web Audio is muted by the iPhone silent switch unless the page uses the "playback" audio session
      (navigator.audioSession, iOS 16.4+) - fallback: a looping silent <audio> element.
   2) An AudioContext only starts inside a real gesture (touchend / click). pointerdown does NOT count on iOS,
      so we listen for the gesture events globally and keep doing it (iOS can "interrupt" the context again). */

  function silentWavURL() {
    const n = 8000,
      b = new Uint8Array(44 + n),
      d = new DataView(b.buffer),
      w = (o, t) => {
        for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i);
      };
    w(0, 'RIFF');
    d.setUint32(4, 36 + n, true);
    w(8, 'WAVEfmt ');
    d.setUint32(16, 16, true);
    d.setUint16(20, 1, true);
    d.setUint16(22, 1, true);
    d.setUint32(24, 8000, true);
    d.setUint32(28, 8000, true);
    d.setUint16(32, 1, true);
    d.setUint16(34, 8, true);
    w(36, 'data');
    d.setUint32(40, n, true);
    b.fill(128, 44);
    silentURL = URL.createObjectURL(
      new Blob([b], {
        type: 'audio/wav',
      }),
    );
    return silentURL;
  }
  function setPlaybackSession(inGesture) {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback')
        navigator.audioSession.type = 'playback';
    } catch (e) {}
    if (!inGesture || navigator.audioSession) return;
    try {
      if (!audio.silentEl) {
        audio.silentEl = new Audio(silentWavURL());
        audio.silentEl.loop = true;
        audio.silentEl.preload = 'auto';
        audio.silentEl.setAttribute('playsinline', '');
        audio.silentEl.setAttribute('aria-hidden', 'true');
      }
      if (audio.silentEl.paused) {
        const pr = audio.silentEl.play();
        if (pr && pr.catch) pr.catch(() => {});
      }
    } catch (e) {}
  }
  function unlockAudio() {
    setPlaybackSession(true);
    if (audio.context && audio.context.state === 'running') return;
    initAudio();
    if (!audio.context) return;
    try {
      const pr = audio.context.resume();
      if (pr && pr.catch) pr.catch(() => {});
    } catch (e) {}
    try {
      const s = audio.context.createBufferSource();
      s.buffer = audio.context.createBuffer(1, 1, 22050);
      s.connect(audio.context.destination);
      s.start(0);
    } catch (e) {}
  }
  setPlaybackSession(false);
  ['touchend', 'pointerup', 'click', 'keydown'].forEach((ev) =>
    document.addEventListener(ev, unlockAudio, {
      capture: true,
      passive: true,
      signal: listeners.signal,
    }),
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!audio.context) return;
      if (document.hidden) {
        try {
          audio.context.suspend();
        } catch (e) {}
      } else if (audio.context.state !== 'running') {
        try {
          const pr = audio.context.resume();
          if (pr && pr.catch) pr.catch(() => {});
        } catch (e) {}
      }
    },
    { signal: listeners.signal },
  );
  function applyAudio() {
    if (audio.context) {
      const t = audio.context.currentTime;
      audio.musG.gain.setTargetAtTime(audio.enabled ? (audio.volume / 100) * 0.72 : 0, t, 0.06);
      audio.bassShelf.gain.setTargetAtTime((audio.bassAmount / 100) * 3, t, 0.08);
      audio.recordShelf?.gain.setTargetAtTime(
        ((audio.bassAmount - BASS_DEFAULT) / 100) * 3,
        t,
        0.08,
      );
      audio.sfxG.gain.setTargetAtTime(
        audio.enabled ? (audio.effectsVolume / 100) * SFX_GAIN : 0,
        t,
        0.025,
      );
    }
    onSettingsChange();
  }
  function destroy() {
    listeners.abort();
    audioScheduler.stopScheduler();
    audio.silentEl?.pause();
    if (silentURL) URL.revokeObjectURL(silentURL);
    if (audio.context) audio.context.close().catch(() => {});
    audio.context = null;
    audio.playing = null;
  }
  /* A session holds its key and tempo; every other musical choice depends on (seed, bar, layer),
     and gameplay adds temporary accents and energy on top. */
  return { applyAudio, initAudio, destroy };
}
