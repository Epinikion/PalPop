import { INDIE_FORMS } from './songs/indie-composition.js';
import { createSinger } from './singer.js';
import { createAudioMath } from './math.js';
import { sweepFor } from './sweep.js';

/** Which vocal part each section sings. */
const KIND = {
  INTRO: 'intro',
  VERSE: 'verse',
  PRE: 'pre',
  CHORUS: 'chorus',
  BREAK: 'bridge',
  OUTRO: 'outro',
};
/** The kick sits on G#1: low enough to carry the sub, and the major third of the key. */
const KICK_HZ = 52;
/** Balance of this arrangement's voices against one another. */
const LEVEL = {
  kick: 0.88,
  bass: 1.5,
  clap: 2.1,
  hat: 1.6,
  chord: 1.3,
  keys: 1.3,
  piano: 1.6,
  pluck: 1.3,
  pad: 1,
  voice: 1,
};
/** The vocal leads this style: the voice sits further forward than in the house arrangement. */
const LEAD = { intro: 0.3, verse: 0.46, pre: 0.5, chorus: 0.58, bridge: 0.48, outro: 0.3 };
/** Chord-stab rhythms in sixteenth steps: dotted shapes that push against the straight kick. */
const STABS = {
  chorus: [0, 3, 6, 8, 11, 14],
  verse: [3, 6, 11, 14],
  pre: [0, 6, 12],
};

/**
 * Indie dance: a straight kick with a deep pump, a round bass that plays only between the kicks,
 * dotted electric-piano chords and a voice that carries the song. Long grooves, one real
 * breakdown without the kick, and a quiet outro.
 */
export function createAudioIndie({
  audio,
  audioComposition,
  audioInstruments,
  audioMath = createAudioMath(audio),
}) {
  const singer = createSinger({
    audio,
    audioComposition,
    audioInstruments,
    forms: INDIE_FORMS,
    lead: LEAD,
  });
  function scheduleIndieStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      section = audioComposition.sectionAt(bar),
      session = audioComposition.chapterFor(section.cyc),
      chord = audioComposition.chordFor(bar, section.sec, section.cyc),
      s16 = session.s16,
      ts = t + (si % 2 ? session.swing * s16 : 0),
      kind = KIND[section.sec] || 'verse',
      intro = kind === 'intro',
      verse = kind === 'verse',
      pre = kind === 'pre',
      chorus = kind === 'chorus',
      bridge = kind === 'bridge',
      outro = kind === 'outro',
      progress = Math.min(1, (section.bs + si / 16) / section.len),
      dropout = pre && section.bs === section.len - 1 && si >= 12,
      phraseEnd = section.bs % 8 === 7,
      occurrence = singer.occurrenceOf(section.cyc, section.sec, (bar % 64) - section.bs),
      final = chorus && occurrence > 0,
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.006,
      voicing = chord.notes.slice(0, 3),
      root = chord.bass + 12,
      // The breakdown is a good deal quieter than the groove: the record's drops 6 dB over it.
      hush = bridge ? 0.42 : 1;
    audio.bar = bar;
    audio.section = section.sec;
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0)
      audioInstruments.eSpace(t, bridge ? 1.7 : pre ? 1.2 : chorus ? 0.9 : outro ? 1.4 : 1);

    // --- drums: the kick never stops until the breakdown and the end ---
    const kick = !dropout && !bridge && !(outro && section.bs >= 2),
      full = (verse && section.bs >= 2) || pre || chorus;
    if (kick) {
      if (si % 4 === 0)
        audioInstruments.eKick(
          t,
          (intro || outro ? 0.44 : chorus ? 0.58 : 0.52) * LEVEL.kick,
          intro || outro ? 0.36 : chorus ? 0.6 : 0.55,
          0,
          KICK_HZ,
          chorus ? 1 : 0,
        );
      if ((si === 4 || si === 12) && full)
        audioInstruments.eClap(t, (chorus ? 0.16 : 0.11) * LEVEL.clap);
      // The open hat on the off-beat is the engine of the groove; closed hats fill between.
      if (si % 4 === 2 && !(intro && section.bs < 1) && !outro)
        audioInstruments.eHat(
          ts + drift,
          true,
          (chorus ? 0.075 : verse ? 0.06 : 0.04) * (0.9 + 0.2 * human(1)) * LEVEL.hat,
          0.22,
        );
      else if (
        si % 2 === 1 &&
        (chorus || verse || pre) &&
        audioMath.hashRand(Math.floor(bar / 2) * 16 + si, 21) < (chorus ? 0.65 : 0.4)
      )
        audioInstruments.eHat(ts + drift, false, 0.032 * (0.8 + 0.4 * human(2)) * LEVEL.hat, -0.25);
      if ((chorus || verse || pre || audio.feverOn) && si % 2 === 1)
        audioInstruments.eShaker(
          ts + drift,
          (chorus ? 0.024 : 0.016) * (0.8 + 0.4 * human(4)),
          -0.3,
        );
      // A ride on the off-beat keeps the top end continuous between the hats, as on a record.
      if (chorus && si % 4 === 2) audioInstruments.eRide(ts + drift, 0.03 * LEVEL.hat, 0.3);
      if (pre && progress >= 0.35) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.02 + progress * 0.024, 0.9 + progress * 0.35);
      }
      if ((chorus || verse) && phraseEnd && si >= 12 && si % 2 === 0)
        audioInstruments.eSnare(ts, 0.026 + (si - 12) * 0.004, 0.95 + (si - 12) * 0.04);
    }

    // --- bass: only between the kicks, root and fifth, a step up at the end of each loop ---
    if (!dropout && !bridge && !(outro && section.bs >= 2) && !(intro && section.bs < 2)) {
      if (si % 4 === 2) {
        const slot = (si - 2) / 4,
          turn = section.bs % 4 === 3,
          note = slot < 2 ? root : slot === 2 || !turn ? root + 7 : root + 12;
        audioInstruments.eWarmBass(
          ts,
          note,
          s16 * 3.4,
          (pre ? 0.2 : chorus ? 0.26 : 0.23) * LEVEL.bass,
          pre ? 0.3 + progress * 0.5 : chorus ? 0.65 : 0.45,
        );
      }
    } else if (bridge && si === 0)
      // The breakdown keeps one long note under the pads: the low end thins out but never leaves.
      audioInstruments.eWarmBass(t, root, 15 * s16, 0.09 * LEVEL.bass, 0.2);

    // --- harmony: dotted electric-piano stabs, piano, pads ---
    if (!dropout) {
      const rhythm = STABS[chorus ? 'chorus' : pre ? 'pre' : verse ? 'verse' : ''];
      if (rhythm && rhythm.includes(si) && !(verse && section.bs < 2)) {
        // Two takes a few cents apart, one in each ear, make the keys wide the way a chorus does.
        const level =
            (chorus ? 0.2 : pre ? 0.15 : 0.13) * LEVEL.keys * (si === 0 || si === 8 ? 1.15 : 1),
          color = 0.45 + progress * 0.3;
        audioInstruments.eRhodes(ts + drift, voicing, s16 * 1.8, level * 0.72, color, -0.42, -5);
        audioInstruments.eRhodes(
          ts + drift + 0.004,
          voicing,
          s16 * 1.8,
          level * 0.72,
          color,
          0.42,
          5,
        );
      }
      if ((intro && section.bs >= 2) || outro || bridge) {
        // Broken-chord piano carries the intro, the breakdown and the outro.
        if (si % 2 === 0) {
          const slot = (si / 2) % 4,
            pick = [0, 2, 1, 2][slot];
          audioInstruments.eFestivalPiano(
            ts + drift,
            [voicing[pick] + (pick === 2 && !bridge ? 12 : 0)],
            s16 * 3.5,
            (slot === 0 ? 0.28 : 0.2) * LEVEL.piano * (outro ? 0.7 : 1) * hush,
            0.35 + progress * 0.3,
            4,
          );
        }
        if (si === 0 && bar % 2 === 0)
          audioInstruments.ePad(t, voicing, s16 * 30, 0.06 * LEVEL.pad * hush, true);
      }
      // A held E under the chords, the pedal the song keeps coming back to.
      if (si === 0 && (bridge || chorus) && bar % 2 === 0)
        audioInstruments.ePad(t, [52, 59, 64], s16 * 30, 0.035 * LEVEL.pad * hush, false);
      if (pre && si % 4 === 0)
        audioInstruments.eFestivalPiano(
          ts,
          voicing,
          s16 * 3,
          0.24 * LEVEL.piano,
          0.5 + progress * 0.3,
        );
      if ((pre || bridge) && progress >= 0.3 && si % 2 === 1)
        audioInstruments.eSawPluck(
          ts,
          [voicing[(si >> 1) % 3] + 12 + (pre && progress > 0.65 ? 12 : 0)],
          s16 * 1.4,
          (0.07 + progress * 0.07) * LEVEL.pluck,
          0.4 + progress * 0.4,
          (si % 4 === 1 ? -1 : 1) * 0.3,
        );
      if (pre && progress >= 0.5 && si % (progress >= 0.8 ? 2 : 4) === 2)
        audioInstruments.eFestivalChord(
          ts,
          voicing,
          s16 * 1.2,
          (0.09 + progress * 0.1) * LEVEL.chord,
          progress,
        );
      if (chorus) {
        // A sustained chord that the pump makes breathe, and a bright pluck answering the voice.
        if (si === 0)
          audioInstruments.eFestivalChord(t, voicing, s16 * 15, 0.06 * LEVEL.chord, session.color);
        if (final && si % 4 === 3)
          audioInstruments.eSawPluck(
            ts + drift,
            [voicing[(si >> 2) % 3] + 24],
            s16 * 1.5,
            0.07 * LEVEL.pluck,
            0.8,
            (si % 8 === 3 ? -1 : 1) * 0.35,
          );
      }
    }

    // --- voices ---
    singer.sing({
      t,
      ts,
      si,
      section,
      session,
      kind,
      occurrence,
      human,
      voicing,
      dropout,
      level: LEVEL.voice * hush,
    });

    // --- transitions ---
    if (si === 0) {
      if (pre && section.bs === Math.max(0, section.len - 3))
        audioInstruments.eRiser(t, (section.len - section.bs - 1) * 16 * s16 + 12 * s16, 0.045);
      if (chorus && section.bs === 0) {
        audioInstruments.eCrash(t, 0.07, true);
        audioInstruments.eImpact(t, occurrence === 0 ? 0.4 : 0.45);
      } else if ((chorus || verse) && section.bs % 8 === 0 && section.bs > 0)
        audioInstruments.eCrash(t, 0.04, false);
      if (bridge && section.bs === 0) {
        audioInstruments.eImpact(t, 0.28);
        audioInstruments.eDownlifter(t, 16 * s16 * 2, 0.06);
      }
    }
    // Every 64 bars the song hands over to fresh material, like a DJ mixing into the next track.
    if (si === 0 && bar > 0 && bar % 64 === 0) audioInstruments.eImpact(t, 0.25);
    if (si === 8 && bar % 64 === 63) audioInstruments.eSwell(t, 8 * s16, 0.06);
    if (pre && section.bs === section.len - 1 && si === 4)
      audioInstruments.eSwell(t, 8 * s16, 0.07);
    if (bridge && section.bs === section.len - 1 && si === 8)
      audioInstruments.eSwell(t, 8 * s16, 0.06);
  }
  return { scheduleIndieStep, getPhraseCacheSize: singer.phraseCount };
}
