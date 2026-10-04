/** Gameplay accents reuse the arrangement's voices, so they follow its mix levels. */
const PIANO_ACCENT = 1.8;
const STAB_ACCENT = 2.2;

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
    const k = Math.ceil((now - audio.songStart) / audio.session.spb);
    return audio.songStart + k * audio.session.spb;
  }
  function musicTick() {
    if (
      !audio.context ||
      !audio.graph ||
      !audio.session ||
      audio.context.state !== 'running' ||
      !audio.playing
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
      const k = Math.max(0, Math.ceil((now + 0.015 - audio.songStart) / S.s16));
      audio.step = k;
      audio.nextStepTime = audio.songStart + k * S.s16;
    }
    const on = audio.enabled && audio.volume > 0;
    if (on) {
      while (audio.nextStepTime < now + audio.look) {
        arrangements[audio.session.style](audio.step, audio.nextStepTime);
        audio.step++;
        audio.nextStepTime = audio.songStart + audio.step * S.s16;
      }
      if (audio.pendingFx.length) {
        audio.pendingFx.length = 0;
        const tb = nextBeatTime(now + 0.35),
          st = Math.max(now + 0.02, tb - 0.55);
        if (
          S.style === 'festival' ||
          S.style === 'vocal' ||
          S.style === 'indie' ||
          S.style === 'trance'
        ) {
          const bar = Math.max(0, Math.floor((tb - audio.songStart) / (S.spb * 4))),
            section = audioComposition.sectionAt(bar),
            chord = audioComposition.chordFor(bar, section.sec, section.cyc);
          audioInstruments.eFestivalPiano(
            tb,
            chord.notes.slice(0, 3),
            S.spb * 0.5,
            0.15 * PIANO_ACCENT,
          );
        } else if (S.style === 'dance') {
          const bar = Math.max(0, Math.floor((tb - audio.songStart) / (S.spb * 4))),
            SA = audioComposition.sectionAt(bar),
            ch = audioComposition.chordFor(bar, SA.sec, SA.cyc);
          audioInstruments.eDanceChord(tb, ch.notes, S.spb * 0.8, 0.065);
        } else {
          audioInstruments.eRiser(st, tb - st, 0.12);
          audioInstruments.eImpact(tb, 0.6);
          audioInstruments.eCrash(tb, 0.09, false);
        }
      }
      // Coalesce cascade rewards into one short reply per beat; never queue melodic runs.
      if (audio.pendingHits.length && now >= audio.lastRewardTime) {
        const e = audio.pendingHits.splice(0)[0],
          tb = nextBeatTime(now + 0.02),
          bar = Math.max(0, Math.floor((tb - audio.songStart) / (S.spb * 4))),
          section = audioComposition.sectionAt(bar),
          chord = audioComposition.chordFor(bar, section.sec, section.cyc);
        audio.lastRewardTime = tb + S.spb;
        if (
          S.style === 'festival' ||
          S.style === 'vocal' ||
          S.style === 'indie' ||
          S.style === 'trance'
        )
          audioInstruments.eFestivalPiano(
            tb,
            chord.notes.slice(0, 3),
            S.s16 * 1.5,
            0.17 * PIANO_ACCENT,
          );
        else if (S.style === 'dance')
          audioInstruments.eDanceChord(tb, chord.notes.slice(0, 3), S.s16 * 0.8, 0.16, 0.5);
        else audioInstruments.eStab(tb, chord.notes.slice(0, 3), 0.065 * STAB_ACCENT, false);
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
      audio.chapters.clear();
    }
    audioGraph.newSongBuses();
    const t = audio.context.currentTime + 0.08,
      S = audio.session;
    audio.graph.dA.delayTime.value = audio.graph.dB.delayTime.value = S.spb * 0.75;
    if (audio.graph.song && audio.graph.song.rumD)
      audio.graph.song.rumD.delayTime.value = Math.min(0.9, S.s16 * 2);
    audio.graph.song.out.gain.setValueAtTime(0, audio.context.currentTime);
    audio.graph.song.out.gain.linearRampToValueAtTime(1, t + 0.18);
    audio.songStart = t;
    audio.nextStepTime = t;
    audio.step = 0;
    audio.bar = 0;
    audio.section = 'INTRO';
    audio.playing = {
      live: true,
    };
    audio.dangerLevel = 0;
    audio.dangerActive = false;
    audio.pendingFx.length = 0;
    audio.pendingHits.length = 0;
    audio.environmentKey = '';
    audio.lastDanceAccent = -Infinity;
    audio.lastRewardTime = -Infinity;
    audio.graph.gLP.frequency.cancelScheduledValues(t);
    audio.graph.gLP.frequency.setValueAtTime(20000, t);
    audio.graph.gG.gain.cancelScheduledValues(t);
    audio.graph.gG.gain.setValueAtTime(1, t);
    startScheduler();
  }
  /* reactive mix: called every frame; only touches AudioParams when the target changes */
  return { startSong, musicTick, stopScheduler };
}
