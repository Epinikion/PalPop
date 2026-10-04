import { composeDancePhrase } from './songs/dance-composition.js';
import { createAudioMath } from './math.js';
import { sweepFor } from './sweep.js';

/** Balance of this arrangement's voices against one another. */
const LEVEL = { kick: 1, bass: 1.5, clap: 1.2, hat: 1, lead: 1.5, chord: 0.9, pluck: 1.4 };

export function createAudioDance({
  audio,
  audioComposition,
  audioInstruments,
  audioMath = createAudioMath(audio),
}) {
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
      dropout = build && section.bs === section.len - 1 && si >= 12,
      // Tiny deterministic timing and velocity drift keeps hats and plucks from sounding machined.
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.006,
      voicing = chord.notes.slice(0, 3);
    audio.bar = bar;
    audio.section = section.sec;
    // DJ-style filter move on the whole mix: opens through the intro, closes up through builds.
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0) audioInstruments.eSpace(t, rest ? 1.7 : build ? 1.25 : peak ? 0.9 : 1);
    if ((!rest || section.bs >= section.len - 2) && !dropout) {
      // A pronounced sidechain pulse drives both the bass and synth buses.
      if (si % 4 === 0)
        audioInstruments.eKick(
          t,
          0.49 * LEVEL.kick,
          peak ? 0.66 : 0.55,
          0,
          audioInstruments.kickTuning(session.pc),
          1,
        );
      if (si === 4 || si === 12)
        audioInstruments.eClap(
          t,
          (peak ? 0.18 : 0.14) * (si === 12 ? phrase.drumAccent : 1) * LEVEL.clap,
        );
      if (si % 4 === 2)
        audioInstruments.eHat(
          ts + drift,
          true,
          (peak ? 0.085 : 0.065) * (0.9 + 0.2 * human(1)) * LEVEL.hat,
          -0.2,
          0.25,
        );
      else if (!intro && phrase.hatMask[si])
        audioInstruments.eHat(
          ts + drift,
          false,
          0.04 * (0.8 + 0.4 * human(2)) * LEVEL.hat,
          0.25,
          0.5,
        );
      if ((peak || fever) && si % 2 === 1)
        audioInstruments.eShaker(ts + drift, 0.026 * (0.8 + 0.4 * human(4)), -0.3, 0.4);
      if (!intro && (si === phrase.percussion || (phraseEnd && si === 15)))
        audioInstruments.ePerc(ts, 'tick', 0.045, phrase.pan, chord.notes[0]);
      if (phraseEnd && si >= 12 && si % 2 === 0) {
        if (phrase.fill === 'snare') audioInstruments.eSnare(ts, 0.045 + (si - 12) * 0.008, 1);
        else if (phrase.fill === 'clap') audioInstruments.eClap(ts, 0.055 * LEVEL.clap);
        else audioInstruments.ePerc(ts, 'conga', 0.06, -phrase.pan);
      }
      // Quickening snare roll that carries every build into its drop.
      if (build && progress >= 0.35) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.022 + progress * 0.026, 0.9 + progress * 0.35);
      }
    }
    if (!dropout) {
      const bass = phrase.bass[si];
      if (!rest && bass && (!intro || si % 4 === 2))
        audioInstruments.eDanceBass(
          ts,
          chord.bass + (bar % 4 === 3 ? bass.interval : 0),
          s16 * bass.gate,
          (build ? 0.21 - progress * 0.055 : 0.22) * LEVEL.bass,
          tone,
        );
      if (rest && si === 0) audioInstruments.ePad(t, chord.notes, s16 * 14, 0.07, true);
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
          (rest ? 0.12 : peak ? 0.38 : 0.31) * LEVEL.chord,
          Math.min(1, session.color * 0.5 + (build ? progress * 0.4 : 0.15) + energy * 0.15),
          -phrase.pan,
        );
      // Plucked saw arpeggios: sparkle for breakdowns, rising tension for builds.
      if (rest && si % 2 === 1 && section.bs >= 1)
        audioInstruments.eSawPluck(
          ts + drift,
          [voicing[(si >> 1) % 3] + 12 + (si % 4 === 3 ? 12 : 0)],
          s16 * 1.6,
          (0.09 + progress * 0.05) * LEVEL.pluck,
          0.45,
          (si % 4 === 1 ? -1 : 1) * 0.3,
        );
      if (build && progress >= 0.3 && si % 2 === 0)
        audioInstruments.eSawPluck(
          ts,
          [voicing[(si >> 1) % 3] + 12 + (progress > 0.65 ? 12 : 0)],
          s16 * 1.4,
          (0.08 + progress * 0.09) * LEVEL.pluck,
          0.4 + progress * 0.4,
          (si % 4 === 0 ? -1 : 1) * 0.3,
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
          (peak ? 0.25 : 0.2) * note[3] * LEVEL.lead,
          phrase.leadColor,
          phrase.pan,
        );
      }
    }
    if (si === 0) {
      if (build && section.bs === Math.max(0, section.len - 3))
        audioInstruments.eRiser(t, (section.len - section.bs - 1) * 16 * s16 + 12 * s16, 0.05);
      if (peak && section.bs === 0) {
        audioInstruments.eCrash(t, 0.065, true);
        audioInstruments.eImpact(t, 0.4);
      } else if (peak && section.bs % 8 === 0) audioInstruments.eCrash(t, 0.04, false);
      if (rest && section.bs === 0) {
        audioInstruments.eImpact(t, 0.28);
        audioInstruments.eDownlifter(t, 16 * s16 * 2, 0.06);
      }
    }
    // Every 64 bars the song hands over to fresh material, like a DJ mixing into the next track.
    if (si === 0 && bar > 0 && bar % 64 === 0) audioInstruments.eImpact(t, 0.25);
    if (si === 8 && bar % 64 === 63) audioInstruments.eSwell(t, 8 * s16, 0.06);
    // A reverse-cymbal swell lands exactly where the final bar goes quiet.
    if (build && section.bs === section.len - 1 && si === 4)
      audioInstruments.eSwell(t, 8 * s16, 0.07);
  }
  return { scheduleDanceStep, getPhraseCacheSize: () => phrases.size };
}
