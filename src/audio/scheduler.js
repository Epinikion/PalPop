/** Gameplay accents reuse the arrangement's voices, so they follow its mix levels. */
const STAB_ACCENT = 0.3;
/** How long a set that opens with a recorded song waits for it to load, at most (ms). */
const RECORD_WAIT = 5000;

/**
 * How far ahead the scheduler plans notes. A late tick means the page was busy (a slow phone, a
 * heavy frame): the look-ahead then widens to cover that gap so the music never starves, and it
 * relaxes again while ticks arrive on time. `gap` is the time since the previous tick.
 */
export function adaptLook(look, gap, base, max = 0.6, tick = 0.035) {
  if (!(gap > 0) || gap > 1.5) return look; // first tick, or the page was suspended
  if (gap > tick * 2.5) return Math.min(max, Math.max(look, gap + 0.12));
  return Math.max(base, look - gap * 0.02);
}

export function createAudioScheduler({
  audio,
  audioComposition,
  audioGraph,
  audioInstruments,
  arrangements,
}) {
  /* ---------- scheduler ---------- */
  function nextBeatTime(now) {
    const k = Math.ceil(audioComposition.stepAt(now - audio.songStart) / 4 - 1e-6) * 4;
    return audio.songStart + audioComposition.secondsAt(Math.max(0, k));
  }
  function musicTick() {
    if (
      !audio.context ||
      !audio.graph ||
      !audio.session ||
      audio.context.state !== 'running' ||
      !audio.playing ||
      audio.playing.waiting
    ) {
      audio.lastTick = -1;
      return;
    }
    const now = audio.context.currentTime,
      S = audio.session;
    audio.look = adaptLook(
      audio.look || audioComposition.LOOK,
      audio.lastTick >= 0 ? now - audio.lastTick : 0,
      audioComposition.LOOK,
    );
    audio.lastTick = now;
    if (audio.nextStepTime < now) {
      const k = Math.max(0, Math.ceil(audioComposition.stepAt(now + 0.015 - audio.songStart)));
      audio.step = k;
      audio.nextStepTime = audio.songStart + audioComposition.secondsAt(k);
    }
    const on = audio.enabled && audio.volume > 0;
    if (on) {
      while (audio.nextStepTime < now + audio.look) {
        arrangements[audio.session.style](audio.step, audio.nextStepTime);
        audio.step++;
        audio.nextStepTime = audio.songStart + audioComposition.secondsAt(audio.step);
      }
      if (audio.pendingFx.length) {
        audio.pendingFx.length = 0;
        const tb = nextBeatTime(now + 0.35),
          st = Math.max(now + 0.02, tb - 0.55);
        audioInstruments.eRiser(st, tb - st, 0.12);
        audioInstruments.eImpact(tb, 0.6);
        audioInstruments.eCrash(tb, 0.09, false);
      }
      // Coalesce cascade rewards into one short reply per beat; never queue melodic runs.
      if (audio.pendingHits.length && now >= audio.lastRewardTime) {
        const e = audio.pendingHits.splice(0)[0],
          tb = nextBeatTime(now + 0.02),
          chord = audioComposition.chordFor(audioComposition.barAt(tb - audio.songStart));
        audio.lastRewardTime = tb + S.spb;
        audioInstruments.eRave(tb, chord.notes.slice(0, 3), S.s16 * 1.5, STAB_ACCENT, {
          style: S.voices,
          filter: 0.7,
        });
        if (e.combo >= 4) audioInstruments.eClap(tb + S.s16 * 2, 0.05);
      }
    } else {
      audio.pendingHits.length = 0;
      audio.pendingFx.length = 0;
    }
  }
  function startScheduler() {
    if (audio.worker || audio.timer) return;
    try {
      const src =
        'let id=0;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};';
      const workerURL = URL.createObjectURL(
        new Blob([src], {
          type: 'text/javascript',
        }),
      );
      try {
        audio.worker = new Worker(workerURL);
      } finally {
        URL.revokeObjectURL(workerURL);
      }
      audio.worker.onmessage = musicTick;
      audio.worker.onerror = () => {
        try {
          audio.worker.terminate();
        } catch (e) {}
        audio.worker = null;
        audio.timer = setInterval(musicTick, 35);
      };
      audio.worker.postMessage(35);
    } catch (e) {
      audio.worker = null;
      audio.timer = setInterval(musicTick, 35);
    }
  }
  function stopScheduler() {
    audio.worker?.terminate();
    clearInterval(audio.timer);
    audio.worker = null;
    audio.timer = null;
  }
  function startSong(fresh, seedOverride) {
    if (!audio.context || !audio.graph) return;
    if (fresh !== false || !audio.session) {
      audio.seed = seedOverride !== undefined ? seedOverride : (Math.random() * 0xffffffff) >>> 0;
      audio.session = audioComposition.composeSession(audio.seed);
    }
    audioGraph.newSongBuses();
    const t = audio.context.currentTime + 0.08,
      S = audio.session;
    audio.graph.dA.delayTime.value = audio.graph.dB.delayTime.value = S.spb * 0.75;
    audio.graph.song.out.gain.setValueAtTime(0, audio.context.currentTime);
    audio.graph.song.out.gain.linearRampToValueAtTime(1, t + 0.18);
    audio.songStart = t;
    audio.nextStepTime = t;
    audio.step = 0;
    audio.bar = 0;
    audio.section = 'INTRO';
    audio.key = null;
    audio.playing = {
      live: true,
    };
    audio.dangerLevel = 0;
    audio.dangerActive = false;
    audio.pendingFx.length = 0;
    audio.pendingHits.length = 0;
    audio.palCues.length = 0;
    audio.lyricCues.length = 0;
    audio.beats.length = 0;
    audio.environmentKey = '';
    audio.lastRewardTime = -Infinity;
    audio.graph.gLP.frequency.cancelScheduledValues(t);
    audio.graph.gLP.frequency.setValueAtTime(20000, t);
    audio.graph.gG.gain.cancelScheduledValues(t);
    audio.graph.gG.gain.setValueAtTime(1, t);
    // A set that opens with a recorded song gives it a moment to load, so the song starts with its
    // first bar instead of joining under way; the clock starts when it is ready.
    if (audioComposition.timeline().track(0).record) {
      const playing = audio.playing,
        ready = arrangements[S.style]?.prepare?.(0, 0);
      if (ready) {
        playing.waiting = true;
        const wait = new Promise((resolve) => setTimeout(resolve, RECORD_WAIT));
        Promise.race([ready.catch(() => {}), wait]).then(() => {
          if (audio.playing !== playing) return;
          playing.waiting = false;
          audio.songStart = audio.nextStepTime = audio.context.currentTime + 0.08;
          audio.step = 0;
        });
      }
    }
    startScheduler();
  }
  /* reactive mix: called every frame; only touches AudioParams when the target changes */
  return { startSong, musicTick, stopScheduler };
}
