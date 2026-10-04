import { composeFestivalPhrase } from './songs/festival-composition.js';
import { createAudioMath } from './math.js';
import { sweepFor } from './sweep.js';

/** Balance of this arrangement's voices against one another. */
const LEVEL = {
  kick: 0.8,
  bass: 1.5,
  clap: 1.2,
  hat: 1,
  lead: 1.6,
  wall: 1.7,
  pluck: 1.5,
  piano: 1.8,
};
/** How hard the bass leans on each sixteenth after a kick; the last one pulls into the next kick. */
const ROLL = [0, 0.55, 0.7, 1];
/** Accents of a three-three-two gate across eight sixteenths. */
const GATE = [1, 0.8, 0.8, 1, 0.8, 0.8, 1, 0.8];

/**
 * Rolling, bright trance: a four-on-the-floor kick, a bass that rolls through the sixteenths
 * after every kick, hats on every sixteenth, and a wall of supersaw (a sustained chord and a
 * sixteenth arpeggio) that never leaves a gap in the middle of the mix. The kick ducks the bass
 * hard and the synths barely, so the wall stays wide open.
 */
export function createAudioTrance({
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
  function scheduleTranceStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      beat = si >> 2,
      sub = si & 3,
      section = audioComposition.sectionAt(bar),
      session = audioComposition.chapterFor(section.cyc),
      chord = audioComposition.chordFor(bar, section.sec, section.cyc),
      s16 = session.s16,
      peak = section.sec === 'PEAK' || section.sec === 'FINAL',
      final = section.sec === 'FINAL',
      groove = section.sec === 'GROOVE',
      build = section.sec === 'BUILD',
      rest = section.sec === 'BREAK',
      intro = section.sec === 'INTRO',
      progress = Math.min(1, (section.bs + si / 16) / section.len),
      phraseIndex = peak
        ? section.cyc * 8 + (final ? 2 : 0) + Math.floor(section.bs / 8)
        : Math.floor(bar / 8),
      phrase = phraseFor(session.seed, phraseIndex),
      color = Math.min(0.9, session.color + (peak ? 0.1 : 0)),
      dropout = build && section.bs === section.len - 1 && si >= 12,
      phraseEnd = bar % 8 === 7,
      // Tiny deterministic timing and velocity drift keeps hats and plucks from sounding machined.
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.004,
      ts = t + drift,
      voicing = chord.notes.slice(0, 3),
      root = 60 + session.pc - (session.pc > 7 ? 12 : 0),
      pitchOf = (degree) => root + session.mode.s[degree % 7] + Math.floor(degree / 7) * 12,
      pan = sub % 2 ? 0.3 : -0.3;
    audio.bar = bar;
    audio.section = section.sec;
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0) audioInstruments.eSpace(t, rest ? 1.6 : build ? 1.2 : peak ? 0.9 : 1);

    // --- the floor: kick, clap, hats and the rolling bass ---
    if (!rest && !dropout && !(intro && section.bs < 1)) {
      if (si % 4 === 0)
        audioInstruments.eKick(
          t,
          (intro ? 0.45 : peak ? 0.58 : 0.52) * LEVEL.kick,
          intro ? 0.35 : peak ? 0.6 : 0.5,
          0,
          audioInstruments.kickTuning(session.pc),
          3,
        );
      if (!intro && (si === 4 || si === 12))
        audioInstruments.eClap(t, (peak ? 0.16 : 0.11) * LEVEL.clap);
      if (sub === 2) {
        if (!build || progress < 0.7)
          audioInstruments.eHat(
            ts,
            true,
            (intro ? 0.034 : peak ? 0.07 : 0.055) * (0.9 + 0.2 * human(1)) * LEVEL.hat,
            0.22,
          );
      } else if (!intro && (peak || build || sub % 2 === 1)) {
        const level = peak ? 1 : build ? 0.55 + progress * 0.45 : 0.7;
        audioInstruments.eHat(
          ts,
          false,
          0.03 * session.hats[sub] * level * (0.8 + 0.4 * human(2)) * LEVEL.hat,
          pan,
        );
      }
      if (peak && sub % 2 === 1)
        audioInstruments.eShaker(ts, 0.02 * (0.8 + 0.4 * human(4)), -pan, 0.45);
      // The bass plays the sixteenths between the kicks and leans into the next one.
      if (sub > 0 && (!intro || section.bs >= 2) && (!build || progress >= 0.2)) {
        const leap = sub === 3 && session.leaps.includes(beat) ? 12 : 0,
          weight = peak ? 1 : groove ? 0.85 : 0.65;
        audioInstruments.eDanceBass(
          ts,
          chord.bass + leap,
          s16 * 1.35,
          0.265 * ROLL[sub] * weight * LEVEL.bass,
          build ? 0.3 + progress * 0.4 : 0.5,
        );
      }
      if (build && progress >= 0.35) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.022 + progress * 0.026, 0.9 + progress * 0.35);
      }
      // Phrase-end fill: a quickening snare run into the next eight bars.
      if ((peak || groove) && phraseEnd && si >= 10 && (si === 10 || si >= 12))
        audioInstruments.eSnare(ts, 0.03 + (si - 10) * 0.007, 0.95 + (si - 10) * 0.05);
    }

    // --- the wall: sustained chord and a sixteenth arpeggio, with the hook on top ---
    if (!dropout) {
      const note = phrase.melody.find(
          (event) => event[0] === ((peak ? section.bs : bar) % 8) * 16 + si,
        ),
        hook = peak && note,
        arp = (shift, level, gate = 1) => {
          const index = session.arp[si];
          audioInstruments.eTranceArp(
            ts,
            voicing[index % 3] + 12 * (1 + Math.floor(index / 3) + shift),
            s16 * 2.1,
            level * gate * LEVEL.pluck,
            color,
            pan,
          );
        };
      if (si === 0 && bar % 2 === 0) {
        if (peak) audioInstruments.eTranceChord(t, voicing, s16 * 31, 0.18 * LEVEL.wall, color);
        else if (groove)
          audioInstruments.eTranceChord(t, voicing, s16 * 31, 0.08 * LEVEL.wall, 0.4);
        else if (intro) audioInstruments.eTranceChord(t, voicing, s16 * 31, 0.07 * LEVEL.wall, 0.3);
        else if (rest) audioInstruments.eTranceChord(t, voicing, s16 * 31, 0.1 * LEVEL.wall, 0.35);
        else if (build && progress >= 0.35)
          audioInstruments.eTranceChord(
            t,
            voicing,
            s16 * 31,
            (0.05 + progress * 0.07) * LEVEL.wall,
            progress,
          );
      }
      if (peak) arp(final && si % 4 === 3 ? 1 : 0, 0.115, GATE[si % 8]);
      else if (groove && si % 2 === 0) arp(0, 0.06, GATE[si % 8]);
      else if (intro && si % 4 === 2) arp(0, 0.06);
      else if (build && progress >= 0.3 && si % 2 === 0)
        arp(progress > 0.65 ? 1 : 0, 0.05 + progress * 0.06);
      else if (rest && section.bs >= 2 && si % 2 === 1) arp(0, 0.06 + progress * 0.04);
      if (rest && si % 2 === 0) {
        // Broken-chord piano: low, high, middle, high, the breakdown's heartbeat.
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
      if (rest && note && section.bs >= 2)
        audioInstruments.eFestivalPiano(
          ts,
          [pitchOf(note[1])],
          s16 * Math.max(2, note[2]),
          0.34 * note[3] * LEVEL.piano,
          0.7,
        );
      if (rest && si === 0 && section.bs % 2 === 0)
        audioInstruments.ePad(t, voicing, s16 * 30, 0.06, true);
      if (build && progress >= 0.5 && si % (progress >= 0.8 ? 2 : 4) === 2)
        audioInstruments.eFestivalChord(
          ts,
          voicing,
          s16 * 1.2,
          (0.1 + progress * 0.12) * LEVEL.wall,
          progress,
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

    // --- structure: risers, crashes, impacts and the hand-over to the next chapter ---
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
  return { scheduleTranceStep, getPhraseCacheSize: () => phrases.size };
}
