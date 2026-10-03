import { TRACK_IDS } from './catalog.js';
import { store } from '../core/storage.js';
export function createAudioReactions({
  audio,
  audioComposition,
  audioInstruments,
  audioRuntime,
  audioScheduler,
  gameAudio,
  game,
}) {
  /* reactive mix: called every frame; only touches AudioParams when the target changes */
  function musicReact(dt) {
    if (!audio.context || !audio.graph || !audio.graph.song) return;
    const playing = game.phase === 'play',
      ended = game.phase === 'dying' || game.phase === 'over',
      frozen = game.iceTime > 0 && playing;
    audio.dangerLevel =
      game.danger && playing
        ? Math.min(1, audio.dangerLevel + dt * 3)
        : Math.max(0, audio.dangerLevel - dt * 1.2);
    audio.dangerActive = audio.dangerLevel > 0.5;
    if (audio.feverOn && !audio.previousFever) audio.pendingFx.push(1);
    audio.previousFever = audio.feverOn;
    const key = ended ? 'e' : frozen ? 'f' : 'n';
    if (key !== audio.environmentKey) {
      audio.environmentKey = key;
      const t = audio.context.currentTime;
      audio.graph.gLP.frequency.setTargetAtTime(
        ended ? 4200 : frozen ? 900 : 20000,
        t,
        ended ? 0.35 : 0.08,
      );
      audio.graph.gG.gain.setTargetAtTime(ended ? 0.78 : 1, t, ended ? 0.6 : 0.1);
    }
    const mel =
      audio.session.style === 'festival' || audio.session.style === 'vocal'
        ? audio.dangerActive
          ? 3500
          : 9000 + Math.min(1, audio.hype) * 1500 + (audio.feverOn ? 500 : 0)
        : audio.session.style === 'dance'
          ? audio.dangerActive
            ? 3200
            : 8200 + Math.min(1, audio.hype) * 1500 + (audio.feverOn ? 800 : 0)
          : audio.dangerActive
            ? 1700
            : Math.max(audio.feverOn || game.goldTime > 0 ? 14000 : 9500, 9500 + audio.hype * 5000);
    if (audio.graph.song.melTarget !== mel) {
      audio.graph.song.melTarget = mel;
      audio.graph.song.melLP.frequency.setTargetAtTime(mel, audio.context.currentTime, 0.15);
    }
  }
  function setTrack(i) {
    if (!TRACK_IDS.includes(i) || i === audio.trackId) return;
    audio.trackId = i;
    store.set('musicTrack', audio.trackId);
    audio.hype = 0;
    audio.previousFever = audio.feverOn;
    if (audio.context) audioScheduler.startSong(true);
    audioRuntime.applyAudio();
  }
  function resetLiveMusic() {
    audio.hype = 0;
    audio.dangerLevel = 0;
    audio.dangerActive = false;
    audio.previousFever = false;
    audio.pendingFx.length = 0;
    audio.pendingHits.length = 0;
    gameAudio?.reset();
  }
  function reactToMerge(tier, combo, x = 60) {
    if (game.phase !== 'play') return;
    gameAudio?.play('merge', { tier, combo, x });
    audio.hype = Math.min(1, audio.hype + 0.07 + Math.min(combo, 5) * 0.025);
    // Physical feedback is immediate. Only significant chains add a beat-aligned musical reply.
    if (
      audio.session &&
      audio.playing &&
      audio.enabled &&
      audio.volume > 0 &&
      (combo >= 3 || tier >= 6)
    ) {
      const previous = audio.pendingHits[0];
      if (!previous || combo + tier > previous.combo + previous.tier)
        audio.pendingHits[0] = { tier, combo };
    }
  }
  function reactToEvent(kind, detail) {
    if (kind === 'over') {
      audio.pendingHits.length = 0;
      audio.pendingFx.length = 0;
      audio.hype = 0;
    }
    return gameAudio?.play(kind, detail);
  }
  /* ==== end techno engine v4 ==== */

  /* ---- UI glue: only writes to the DOM when text actually changes ---- */
  return {
    musicReact,
    resetLiveMusic,
    reactToMerge,
    setTrack,
    reactToEvent,
  };
}
