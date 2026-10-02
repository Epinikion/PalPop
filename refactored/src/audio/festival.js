import { composeFestivalPhrase } from './songs/festival-composition.js';

export function createAudioFestival({ audio, audioComposition, audioInstruments }) {
  const phrases = new Map();
  function phraseFor(seed, index) {
    const key = `${seed}:${index}`;
    if (!phrases.has(key)) {
      phrases.set(key, composeFestivalPhrase(seed, index));
      if (phrases.size > 4) phrases.delete(phrases.keys().next().value);
    }
    return phrases.get(key);
  }
  function scheduleFestivalStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      section = audioComposition.sectionAt(bar),
      session = audioComposition.chapterFor(section.cyc),
      chord = audioComposition.chordFor(bar, section.sec, section.cyc),
      s16 = session.s16,
      ts = t + (si % 2 ? session.swing * s16 : 0),
      peak = section.sec === 'PEAK' || section.sec === 'FINAL',
      build = section.sec === 'BUILD',
      rest = section.sec === 'BREAK',
      intro = section.sec === 'INTRO',
      progress = Math.min(1, (section.bs + si / 16) / section.len),
      energy = Math.min(1, audio.hype || 0),
      phraseIndex = peak
        ? section.cyc * 8 + (section.sec === 'FINAL' ? 2 : 0) + Math.floor(section.bs / 8)
        : Math.floor(bar / 8),
      phrase = phraseFor(session.seed, phraseIndex),
      color = Math.min(0.85, phrase.color + (peak ? 0.1 : 0) + energy * 0.08),
      dropout = build && section.bs === section.len - 1 && si >= 12;
    audio.bar = bar;
    audio.section = section.sec;
    if (!rest && !dropout) {
      if (si % 4 === 0 && (!intro || si % 8 === 0))
        audioInstruments.eKick(
          t,
          intro ? 0.3 : peak ? 0.53 : build ? 0.4 : 0.48,
          peak ? 0.66 : 0.55,
          0,
        );
      if (!intro && (si === 4 || si === 12)) audioInstruments.eClap(t, peak ? 0.17 : 0.11);
      if (!intro && !build && si % 4 === 2)
        audioInstruments.eHat(ts, true, peak ? 0.075 : 0.055, 0.22, 0.3);
      else if (!intro && phrase.hatMask[si]) audioInstruments.eHat(ts, false, 0.027, -0.25, 0.6);
      if (((peak && bar % 4 === 2) || audio.feverOn) && si % 2 === 1)
        audioInstruments.eShaker(ts, 0.024, -0.3, 0.45);
      if (phrase.bass.includes(si) && (!intro || section.bs >= 2))
        audioInstruments.eDanceBass(
          ts,
          chord.bass,
          s16 * 1.5,
          build ? 0.2 - progress * 0.08 : 0.23,
          build ? progress * 0.65 : 0.65,
        );
      if (build && progress >= 0.5) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.025 + progress * 0.025, 0.9 + progress * 0.15);
      }
      if (peak && bar % 8 === 7 && (si === 10 || si === 14)) audioInstruments.eSnare(ts, 0.045, 1);
    }
    if (!dropout) {
      const voicing = chord.notes.slice(0, 3),
        note = phrase.melody.find(
          (event) => event[0] === ((peak ? section.bs : bar) % 8) * 16 + si,
        ),
        hook = peak && note;
      // Piano carries quieter passages and answers the hook in every eighth bar.
      if (
        (rest ? si === 0 : phrase.piano.includes(si)) &&
        !hook &&
        (!peak || bar % 4 === 3 || si === 6)
      )
        audioInstruments.eFestivalPiano(
          ts,
          voicing,
          s16 * (rest ? 5 : 2.5),
          rest ? 0.29 : 0.32,
          build ? progress * 0.7 : 0.65,
        );
      if (rest && si === 0 && section.bs % 2 === 0)
        audioInstruments.ePad(t, voicing, s16 * 14, 0.04, false);
      if (peak && si === 2 && bar % 4 !== 3)
        audioInstruments.eFestivalChord(ts, voicing, s16 * 2.4, 0.22, color);
      if (hook) {
        // Move the entire theme together, preserving its melodic contour in higher keys.
        const root = 60 + session.pc - (session.pc > 7 ? 12 : 0),
          n = root + session.mode.s[note[1] % 7] + Math.floor(note[1] / 7) * 12;
        audioInstruments.eFestivalLead(ts, n, note[2] * s16 * 0.85, 0.24 * note[3], color);
      }
    }
    if (build && si === 0 && section.bs === section.len - 2)
      audioInstruments.eRiser(t, 32 * s16 - session.spb, 0.045);
    if (peak && si === 0 && section.bs === 0) audioInstruments.eCrash(t, 0.065, false);
  }
  return { scheduleFestivalStep, getPhraseCacheSize: () => phrases.size };
}
