import { composeDancePhrase } from './songs/dance-composition.js';
export function createAudioDance({ audio, audioComposition, audioInstruments }) {
  const phrases = new Map();
  function phraseFor(seed, index) {
    const key = `${seed}:${index}`;
    if (!phrases.has(key)) {
      phrases.set(key, composeDancePhrase(seed, index));
      if (phrases.size > 4) phrases.delete(phrases.keys().next().value);
    }
    return phrases.get(key);
  }
  function scheduleDanceStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      section = audioComposition.sectionAt(bar),
      session = audioComposition.chapterFor(section.cyc),
      chord = audioComposition.chordFor(bar, section.sec, section.cyc);
    const phrase = phraseFor(session.seed, Math.floor(bar / 8)),
      s16 = session.s16,
      ts = t + (si % 2 ? s16 * session.swing : 0);
    const peak = section.sec === 'PEAK' || section.sec === 'FINAL',
      rest = section.sec === 'BREAK',
      build = section.sec === 'BUILD',
      intro = section.sec === 'INTRO';
    const progress = Math.min(1, (section.bs + si / 16) / Math.max(1, section.len)),
      energy = Math.min(1, audio.hype || 0),
      fever = audio.feverOn && !rest,
      tone = Math.min(
        1,
        0.45 * phrase.bassColor + (build ? progress * 0.4 : peak ? 0.3 : 0.1) + energy * 0.15,
      );
    const phraseEnd = bar % 8 === 7,
      dropout = build && section.bs === section.len - 1 && si >= 12;
    audio.bar = bar;
    audio.section = section.sec;
    if ((!rest || section.bs >= section.len - 2) && !dropout) {
      // A pronounced sidechain pulse drives both the bass and synth buses.
      if (si % 4 === 0) audioInstruments.eKick(t, 0.49, peak ? 0.62 : 0.52, 0);
      if (si === 4 || si === 12)
        audioInstruments.eClap(t, (peak ? 0.18 : 0.14) * (si === 12 ? phrase.drumAccent : 1));
      if (si % 4 === 2) audioInstruments.eHat(ts, true, peak ? 0.085 : 0.065, -0.2, 0.25);
      else if (!intro && phrase.hatMask[si]) audioInstruments.eHat(ts, false, 0.042, 0.25, 0.5);
      if ((peak || fever) && si % 2 === 1) audioInstruments.eShaker(ts, 0.026, -0.3, 0.4);
      if (!intro && (si === phrase.percussion || (phraseEnd && si === 15)))
        audioInstruments.ePerc(ts, 'tick', 0.045, phrase.pan, chord.notes[0]);
      if (phraseEnd && si >= 12 && si % 2 === 0) {
        if (phrase.fill === 'snare') audioInstruments.eSnare(ts, 0.045 + (si - 12) * 0.008, 1);
        else if (phrase.fill === 'clap') audioInstruments.eClap(ts, 0.055);
        else audioInstruments.ePerc(ts, 'conga', 0.06, -phrase.pan);
      }
      if (build && progress > 0.5 && si === 15 && bar % 2 === 1)
        audioInstruments.eSnare(ts, 0.04 * progress, 1);
    }
    if (!dropout) {
      const bass = phrase.bass[si];
      if (!rest && bass && (!intro || si % 4 === 2))
        audioInstruments.eDanceBass(
          ts,
          chord.bass + (bar % 4 === 3 ? bass.interval : 0),
          s16 * bass.gate,
          build ? 0.21 - progress * 0.055 : 0.22,
          tone,
        );
      if (rest && si === 0) audioInstruments.ePad(t, chord.notes, s16 * 14, 0.055, false);
      if (
        phrase.chordActive &&
        phrase.chords.includes(si) &&
        (!intro || section.bs >= 2) &&
        (peak || (rest ? si === 0 && section.bs % 2 === 0 : bar % 4 !== 3))
      )
        audioInstruments.eDanceChord(
          ts,
          chord.notes.slice(0, 3).map((n) => n + 12),
          s16 * (rest ? 2.5 : 1.1),
          rest ? 0.12 : peak ? 0.38 : 0.31,
          Math.min(1, session.color * 0.5 + (build ? progress * 0.4 : 0.15) + energy * 0.15),
          -phrase.pan,
        );
      const note = phrase.melody.find((event) => event[0] === (bar % 8) * 16 + si);
      // Short mid-register replies alternate with chord-only passages and breakdown space.
      if (note && phrase.leadActive && !intro && !rest && (peak || build || bar % 4 >= 2)) {
        const degree = chord.deg + note[1],
          n = 48 + session.pc + session.mode.s[degree % 7] + 12 * Math.floor(degree / 7);
        audioInstruments.eDanceLead(
          ts,
          n,
          Math.min(0.32, note[2] * s16 * 0.75),
          (peak ? 0.25 : 0.2) * note[3],
          phrase.leadColor,
          phrase.pan,
        );
      }
    }
    if (si === 0 && build && section.bs === section.len - 2)
      audioInstruments.eRiser(t, 32 * s16 - 0.06, 0.045);
    if (si === 0 && peak && section.bs === 0) audioInstruments.eCrash(t, 0.05, false);
  }
  return { scheduleDanceStep, getPhraseCacheSize: () => phrases.size };
}
