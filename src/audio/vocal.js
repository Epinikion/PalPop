import { VOCAL_FORMS } from './songs/vocal-composition.js';
import { createSinger, LEAD } from './singer.js';
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
/** Balance of this arrangement's voices against one another. */
const LEVEL = {
  kick: 0.75,
  bass: 1.4,
  clap: 1.1,
  hat: 1,
  chord: 1.5,
  piano: 1.7,
  pluck: 1.4,
  voice: 1,
};

export function createAudioVocal({
  audio,
  audioComposition,
  audioInstruments,
  audioMath = createAudioMath(audio),
}) {
  const singer = createSinger({
    audio,
    audioComposition,
    audioInstruments,
    forms: VOCAL_FORMS,
    lead: LEAD,
  });
  function scheduleVocalStep(step, t) {
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
      half = Math.floor(section.bs / 8),
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.006,
      voicing = chord.notes.slice(0, 3);
    audio.bar = bar;
    audio.section = section.sec;
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0)
      audioInstruments.eSpace(t, bridge ? 1.6 : pre ? 1.2 : chorus ? 0.9 : outro ? 1.3 : 1);

    // --- drums ---
    const drums = !dropout && !bridge && !(intro && section.bs < 2) && !(outro && section.bs >= 2);
    if (drums) {
      if (si % 4 === 0)
        audioInstruments.eKick(
          t,
          (intro || outro ? 0.4 : chorus ? 0.55 : verse ? 0.47 : 0.5) * LEVEL.kick,
          intro || outro ? 0.32 : chorus ? 0.66 : 0.5,
          0,
          audioInstruments.kickTuning(session.pc),
          chorus ? 1 : 0,
        );
      if ((si === 4 || si === 12) && (chorus || pre || (verse && section.bs >= 2)))
        audioInstruments.eClap(t, (chorus ? 0.15 : 0.1) * LEVEL.clap);
      if (si % 4 === 2 && !pre)
        audioInstruments.eHat(
          ts + drift,
          true,
          (chorus ? 0.07 : verse ? 0.05 : 0.032) * (0.9 + 0.2 * human(1)) * LEVEL.hat,
          0.22,
          0.3,
        );
      else if (
        (chorus || verse || pre) &&
        si % 2 === 1 &&
        audioMath.hashRand(Math.floor(bar / 2) * 16 + si, 21) < (chorus ? 0.6 : 0.35)
      )
        audioInstruments.eHat(
          ts + drift,
          false,
          0.03 * (0.8 + 0.4 * human(2)) * LEVEL.hat,
          -0.25,
          0.6,
        );
      if ((chorus || audio.feverOn) && si % 2 === 1)
        audioInstruments.eShaker(ts + drift, 0.02 * (0.8 + 0.4 * human(4)), -0.3, 0.45);
      if (pre && progress >= 0.35) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.7 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eSnare(ts, 0.02 + progress * 0.024, 0.9 + progress * 0.35);
      }
      if (chorus && phraseEnd && si >= 10 && (si === 10 || si >= 12))
        audioInstruments.eSnare(ts, 0.028 + (si - 10) * 0.006, 0.95 + (si - 10) * 0.05);
    }

    // --- bass ---
    if (!dropout && !bridge) {
      if (chorus || pre) {
        const pattern = section.bs % 4 === 3 ? [2, 6, 9, 14] : [2, 6, 10, 14];
        if (pattern.includes(si))
          audioInstruments.eDanceBass(
            ts,
            chord.bass,
            s16 * 1.6,
            (pre ? 0.18 : 0.22) * LEVEL.bass,
            pre ? progress * 0.6 : 0.6,
          );
      } else if (verse) {
        if (si === 0 || si === 6 || (si === 10 && section.bs % 2 === 1))
          audioInstruments.eDanceBass(ts, chord.bass, s16 * 4, 0.19 * LEVEL.bass, 0.35);
      } else if (si === 0 && ((intro && section.bs >= 2) || (outro && section.bs < 2)))
        audioInstruments.eBass(t, chord.bass, 14 * s16, false, 0.15, true);
    }

    // --- harmony: piano, pads, plucks ---
    if (!dropout) {
      if (!chorus && !pre && si % 2 === 0) {
        // Broken-chord piano carries the verses, the intro, the bridge and the outro.
        const slot = (si / 2) % 4,
          pick = [0, 2, 1, 2][slot];
        audioInstruments.eFestivalPiano(
          ts + drift,
          [voicing[pick] + (pick === 2 && !bridge ? 12 : 0)],
          s16 * 3.5,
          (slot === 0 ? 0.28 : 0.2) * (verse ? 0.8 : 1) * LEVEL.piano * (outro ? 0.7 : 1),
          0.35 + progress * 0.3,
          4,
        );
      }
      if (pre && si % 4 === 0)
        audioInstruments.eFestivalPiano(
          ts,
          voicing,
          s16 * 3,
          0.26 * LEVEL.piano,
          0.5 + progress * 0.3,
        );
      if ((intro || outro || bridge) && si === 0 && bar % 2 === 0)
        audioInstruments.ePad(t, voicing, s16 * 30, 0.06, true);
      if (verse && (si === 6 || si === 14) && section.bs % 2 === 1)
        audioInstruments.eSawPluck(
          ts,
          [voicing[si === 6 ? 2 : 1] + 12],
          s16 * 2,
          0.09 * LEVEL.pluck,
          0.5,
          si === 6 ? 0.3 : -0.3,
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
        // Sustained chord pad (the sidechain makes it breathe) plus a syncopated stab and piano.
        if (si === 0)
          audioInstruments.eFestivalChord(t, voicing, s16 * 15, 0.06 * LEVEL.chord, session.color);
        if ((si === 2 || si === 10) && section.bs % 4 !== 3)
          audioInstruments.eFestivalChord(ts, voicing, s16 * 2, 0.15 * LEVEL.chord, session.color);
        if (si === 0 || si === 6)
          audioInstruments.eFestivalPiano(ts, voicing, s16 * 4, 0.26 * LEVEL.piano, 0.6, 4);
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
      level: LEVEL.voice,
    });

    // --- transitions ---
    if (si === 0) {
      if (pre && section.bs === Math.max(0, section.len - 3))
        audioInstruments.eRiser(t, (section.len - section.bs - 1) * 16 * s16 + 12 * s16, 0.045);
      if (chorus && section.bs === 0) {
        audioInstruments.eCrash(t, 0.07, true);
        audioInstruments.eImpact(t, occurrence === 0 ? 0.4 : 0.45);
      } else if (chorus && section.bs % 8 === 0) audioInstruments.eCrash(t, 0.04, false);
      if (bridge && section.bs === 0) {
        audioInstruments.eImpact(t, 0.28);
        audioInstruments.eDownlifter(t, 16 * s16 * 2, 0.06);
      }
    }
    // Every 64 bars the song hands over to fresh material, like a DJ mixing into the next track.
    if (si === 0 && bar > 0 && bar % 64 === 0) audioInstruments.eImpact(t, 0.25);
    if (si === 8 && bar % 64 === 63) audioInstruments.eSwell(t, 8 * s16, 0.06);
    // A reverse-cymbal swell lands exactly where the last bar before a chorus goes quiet.
    if (pre && section.bs === section.len - 1 && si === 4)
      audioInstruments.eSwell(t, 8 * s16, 0.07);
    if (bridge && section.bs === section.len - 1 && si === 8)
      audioInstruments.eSwell(t, 8 * s16, 0.06);
  }
  return { scheduleVocalStep, getPhraseCacheSize: singer.phraseCount };
}
