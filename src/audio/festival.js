import { composeFestivalPhrase } from './songs/festival-composition.js';
import { createAudioMath } from './math.js';
import { sweepFor } from './sweep.js';

/** Balance of this arrangement's voices against one another. */
const LEVEL = {
  kick: 1,
  bass: 1.5,
  clap: 1.2,
  hat: 1,
  lead: 1.6,
  chord: 1.7,
  piano: 1.8,
  pluck: 1.5,
};

export function createAudioFestival({
  audio,
  audioComposition,
  audioInstruments,
  audioMath = createAudioMath(audio),
}) {
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
      groove = section.sec === 'GROOVE',
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
      dropout = build && section.bs === section.len - 1 && si >= 12,
      phraseEnd = bar % 8 === 7,
      // Tiny deterministic timing and velocity drift keeps hats and plucks from sounding machined.
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.006,
      voicing = chord.notes.slice(0, 3),
      // Move the entire theme together, preserving its melodic contour in higher keys.
      root = 60 + session.pc - (session.pc > 7 ? 12 : 0),
      pitchOf = (degree) => root + session.mode.s[degree % 7] + Math.floor(degree / 7) * 12;
    audio.bar = bar;
    audio.section = section.sec;
    // DJ-style filter move on the whole mix: opens through the intro, closes up through builds.
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0) audioInstruments.eSpace(t, rest ? 1.7 : build ? 1.25 : peak ? 0.9 : 1);
    if (!rest && !dropout) {
      if (si % 4 === 0)
        audioInstruments.eKick(
          t,
          (intro ? 0.44 : peak ? 0.55 : build ? 0.46 : 0.5) * LEVEL.kick,
          intro ? 0.4 : peak ? 0.7 : 0.58,
          0,
          audioInstruments.kickTuning(session.pc),
          peak ? 1 : 0,
        );
      if (!intro && (si === 4 || si === 12))
        audioInstruments.eClap(t, (peak ? 0.17 : 0.12) * LEVEL.clap);
      if (!build && si % 4 === 2)
        audioInstruments.eHat(
          ts + drift,
          true,
          (intro ? 0.032 : peak ? 0.075 : 0.058) * (0.9 + 0.2 * human(1)) * LEVEL.hat,
          0.22,
          0.3,
        );
      else if (!intro && phrase.hatMask[si])
        audioInstruments.eHat(
          ts + drift,
          false,
          0.03 * (0.8 + 0.4 * human(2)) * LEVEL.hat,
          -0.25,
          0.6,
        );
      if ((peak || audio.feverOn) && si % 2 === 1)
        audioInstruments.eShaker(ts + drift, 0.022 * (0.8 + 0.4 * human(4)), -0.3, 0.45);
      if (phrase.bass.includes(si) && (!intro || section.bs >= 2))
        audioInstruments.eDanceBass(
          ts,
          chord.bass,
          s16 * 1.5,
          (build ? 0.2 - progress * 0.08 : 0.23) * LEVEL.bass,
          build ? progress * 0.65 : 0.65,
        );
      if (build && progress >= 0.35) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.022 + progress * 0.026, 0.9 + progress * 0.35);
      }
      // Phrase-end fill: a quickening snare run into the next eight bars.
      if ((peak || groove) && phraseEnd && si >= 10 && (si === 10 || si >= 12))
        audioInstruments.eSnare(ts, 0.03 + (si - 10) * 0.007, 0.95 + (si - 10) * 0.05);
    }
    if (!dropout) {
      const note = phrase.melody.find(
          (event) => event[0] === ((peak ? section.bs : bar) % 8) * 16 + si,
        ),
        hook = peak && note;
      // Piano carries quieter passages and answers the hook in every eighth bar.
      if (!rest && phrase.piano.includes(si) && !hook && (!peak || bar % 4 === 3 || si === 6))
        audioInstruments.eFestivalPiano(
          ts,
          voicing,
          s16 * 2.5,
          0.32 * LEVEL.piano,
          build ? progress * 0.7 : 0.65,
        );
      if (rest && si % 2 === 0) {
        // Broken-chord piano: low, high, middle, high - the breakdown's heartbeat. Once the theme
        // enters it stays in the left hand, below the melody.
        const slot = (si / 2) % 4,
          pick = [0, 2, 1, 2][slot];
        audioInstruments.eFestivalPiano(
          ts,
          [voicing[pick] + (pick === 2 && section.bs < 2 ? 12 : 0)],
          s16 * 3.5,
          (slot === 0 ? 0.3 : 0.22) * LEVEL.piano,
          0.35 + progress * 0.35,
          4,
        );
      }
      // The breakdown replays the hook on piano, so the song stays recognisable while it breathes.
      if (rest && note && section.bs >= 2) {
        audioInstruments.eFestivalPiano(
          ts,
          [pitchOf(note[1])],
          s16 * Math.max(2, note[2]),
          0.34 * note[3] * LEVEL.piano,
          0.7,
        );
      }
      if (rest && si === 0 && section.bs % 2 === 0)
        audioInstruments.ePad(t, voicing, s16 * 30, 0.06, true);
      if (rest && si % 2 === 1 && section.bs >= 2)
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
      if (build && progress >= 0.5 && si % (progress >= 0.8 ? 2 : 4) === 2)
        audioInstruments.eFestivalChord(
          ts,
          voicing,
          s16 * 1.2,
          (0.1 + progress * 0.12) * LEVEL.chord,
          progress,
        );
      if (peak && si === 2 && bar % 4 !== 3)
        audioInstruments.eFestivalChord(ts, voicing, s16 * 2.4, 0.2 * LEVEL.chord, color);
      // Sustained chord pad: sidechain pumping gives the drop its breathing body.
      if ((peak || groove) && si === 0 && bar % 2 === 0)
        audioInstruments.eFestivalChord(
          t,
          voicing,
          s16 * 30,
          (peak ? 0.1 : 0.06) * LEVEL.chord,
          peak ? color : 0.3,
        );
      if (groove && (si === 6 || si === 14) && bar % 2 === 1)
        audioInstruments.eSawPluck(
          ts,
          [voicing[si === 6 ? 2 : 1] + 12],
          s16 * 2,
          0.1 * LEVEL.pluck,
          0.5,
          si === 6 ? 0.3 : -0.3,
        );
      if (section.sec === 'FINAL' && si % 4 === 3)
        audioInstruments.eSawPluck(
          ts + drift,
          [voicing[(si >> 2) % 3] + 24],
          s16 * 1.5,
          0.08 * LEVEL.pluck,
          0.8,
          (si % 8 === 3 ? -1 : 1) * 0.35,
        );
      if (hook)
        audioInstruments.eFestivalLead(
          ts,
          pitchOf(note[1]),
          note[2] * s16 * 0.85,
          0.24 * note[3] * LEVEL.lead,
          color,
        );
    }
    if (si === 0) {
      // A build's riser covers its last bars and lands on the beat before the drop.
      if (build && section.bs === Math.max(0, section.len - 3))
        audioInstruments.eRiser(t, (section.len - section.bs - 1) * 16 * s16 + 12 * s16, 0.05);
      if (peak && section.bs === 0) {
        audioInstruments.eCrash(t, 0.075, true);
        audioInstruments.eImpact(t, 0.45);
      } else if (peak && section.bs % 8 === 0) audioInstruments.eCrash(t, 0.045, false);
      if (groove && section.bs === 0) audioInstruments.eCrash(t, 0.04, false);
      if (rest && section.bs === 0) {
        audioInstruments.eImpact(t, 0.3);
        audioInstruments.eDownlifter(t, 16 * s16 * 2, 0.06);
      }
    }
    // Every 64 bars the song hands over to fresh material, like a DJ mixing into the next track.
    if (si === 0 && bar > 0 && bar % 64 === 0) audioInstruments.eImpact(t, 0.25);
    if (si === 8 && bar % 64 === 63) audioInstruments.eSwell(t, 8 * s16, 0.06);
    // A reverse-cymbal swell lands exactly where the final bar goes quiet.
    if (build && section.bs === section.len - 1 && si === 4)
      audioInstruments.eSwell(t, 8 * s16, 0.07);
    if (peak && phraseEnd && si === 8 && audioComposition.sectionAt(bar + 1).sec !== section.sec)
      audioInstruments.eSwell(t, 8 * s16, 0.06);
  }
  return { scheduleFestivalStep, getPhraseCacheSize: () => phrases.size };
}
