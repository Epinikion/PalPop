import { createAudioMath } from './math.js';
import { sweepFor } from './sweep.js';

/** Balance of this arrangement's voices; drum hits are normalised, so these are plain gains. */
const LEVEL = {
  kick: 0.62,
  clap: 0.5,
  rim: 0.26,
  hat: 0.28,
  open: 0.26,
  shaker: 0.14,
  ride: 0.14,
  tom: 0.18,
  ping: 0.09,
  blast: 0.14,
  snare: 0.18,
  crash: 0.2,
  rumble: 0.44,
  reese: 0.2,
  stab: 0.2,
  atmos: 0.2,
  pad: 0.1,
};
/** The kick's fundamental follows the key, folded into a range where it still punches. */
const kickHz = (audioMath, note) => Math.min(60, Math.max(40.5, audioMath.midi(note)));

export function createAudioWarehouse({
  audio,
  audioComposition,
  audioInstruments,
  audioMath = createAudioMath(audio),
}) {
  function scheduleWarehouseStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      section = audioComposition.sectionAt(bar),
      session = audioComposition.chapterFor(section.cyc),
      chord = audioComposition.chordFor(bar, section.sec, section.cyc),
      pattern = session.patterns,
      s16 = session.s16,
      ts = t + (si % 2 ? session.swing * s16 : 0),
      intro = section.sec === 'INTRO',
      groove = section.sec === 'GROOVE',
      build = section.sec === 'BUILD',
      rest = section.sec === 'BREAK',
      outro = section.sec === 'OUTRO',
      peak = section.sec === 'PEAK' || section.sec === 'FINAL',
      final = section.sec === 'FINAL',
      progress = Math.min(1, (section.bs + si / 16) / section.len),
      dropout = build && section.bs === section.len - 1 && si >= 12,
      phraseEnd = bar % 8 === 7,
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.005,
      voicing = chord.notes.slice(0, 3),
      tonic = chord.bass,
      root = 28 + ((session.pc - 4 + 12) % 12);
    audio.bar = bar;
    audio.section = section.sec;
    if (si % 4 === 0 && !dropout) audioInstruments.eSweep(t, sweepFor(section.sec, progress));
    if (si === 0) audioInstruments.eSpace(t, rest ? 1.7 : build ? 1.25 : peak ? 0.85 : 1);

    // --- the floor: kick, then everything that moves around it ---
    const floor = !rest && !dropout && !(outro && section.bs >= 3);
    if (floor) {
      if (si % 4 === 0)
        audioInstruments.eKitKick(
          t,
          (intro ? 0.82 : peak ? 1 : 0.92) * LEVEL.kick,
          intro ? 0.45 : peak ? 0.78 : 0.65,
          kickHz(audioMath, root),
          peak ? 1 : 0,
        );
      if (si % 4 === 2 && !(intro && section.bs < 2))
        audioInstruments.eKitHat(
          ts + drift,
          true,
          (intro ? 0.6 : peak ? 1 : 0.85) * LEVEL.open * (0.9 + 0.2 * human(1)),
          0.2,
        );
      const velocity = pattern.hats[si];
      if (velocity && !(intro && section.bs < 4) && !outro)
        audioInstruments.eKitHat(
          ts + drift,
          false,
          velocity * (intro ? 0.6 : groove ? 0.8 : 1) * LEVEL.hat * (0.85 + 0.3 * human(2)),
          -0.25 + (si % 4) * 0.15,
        );
      if ((si === 4 || si === 12) && !intro && !outro)
        audioInstruments.eKitClap(
          t + drift,
          (peak ? 1 : 0.8) * LEVEL.clap * (0.92 + 0.16 * human(4)),
        );
      if (pattern.rim.includes(si) && ((groove && section.bs >= 4 && bar % 2 === 1) || peak))
        audioInstruments.eKitRim(ts, LEVEL.rim * (0.8 + 0.4 * human(5)), si % 2 ? 0.35 : -0.35);
      if (peak && si % 2 === 1)
        audioInstruments.eKitShaker(ts + drift, LEVEL.shaker * (0.7 + 0.5 * human(6)), -0.3);
      // Percussion on its own cycle drifts against the bar: the hypnotic part.
      const slot = step % pattern.percCycle;
      if (pattern.percSteps.includes(slot) && ((groove && section.bs >= 4) || peak || build))
        audioInstruments.eKitTom(
          ts,
          LEVEL.tom * (peak ? 1 : 0.7),
          pattern.percSteps.indexOf(slot) % 3,
          pattern.percSteps.indexOf(slot) % 2 ? 0.4 : -0.4,
        );
      if (peak && pattern.metal.includes(si))
        audioInstruments.eKitPing(
          ts,
          72 + session.pc + session.mode.s[pattern.ping[(bar * 3 + si) % 8] % 7] + (final ? 12 : 0),
          LEVEL.ping * (0.7 + 0.5 * human(7)),
          si % 2 ? 0.5 : -0.5,
        );
      if (peak && si % 4 === 2 && section.bs % 8 >= 4)
        audioInstruments.eKitRide(ts, LEVEL.ride, 0.3);
      if (peak && si === 10 && bar % 4 === 3) audioInstruments.eKitBlast(ts, LEVEL.blast, 0.2);
      // Builds quicken a snare roll into the drop.
      if (build && progress >= 0.3) {
        const interval = progress >= 0.85 ? 1 : progress >= 0.65 ? 2 : 4;
        if (si % interval === 0)
          audioInstruments.eKitSnare(
            ts,
            LEVEL.snare * (0.5 + progress * 0.6),
            0.92 + progress * 0.3,
          );
      }
      // Phrase-end fill: a short snare run and falling toms.
      if ((groove || peak) && phraseEnd && si >= 10) {
        if (si === 10 || si === 13 || si === 15)
          audioInstruments.eKitSnare(
            ts,
            LEVEL.snare * (0.7 + (si - 10) * 0.05),
            1 + (si - 10) * 0.03,
          );
        if (si === 12 || si === 14) audioInstruments.eKitTom(ts, LEVEL.tom, si === 12 ? 2 : 1);
      }
    }

    // --- low end: the rolling bass and the rumble between the kicks ---
    if (!rest && !dropout && !(outro && section.bs >= 3) && !(intro && section.bs < 4)) {
      const rolling =
        pattern.bass.includes(si) && !(groove && section.bs < 2) && !(build && progress > 0.8);
      if (rolling) {
        const leap = human(8) < 0.12 ? 12 : human(9) < 0.1 ? 7 : 0;
        audioInstruments.eReese(
          ts,
          tonic + leap,
          s16 * (si % 4 === 3 ? 0.7 : 0.9),
          LEVEL.reese * (si % 4 === 3 ? 1.15 : 0.9),
          560 + 520 * (0.5 + 0.5 * Math.sin(step / 53)) + (peak ? 250 : 0),
        );
      }
      if (si % 4 === 1 && !(groove && section.bs < 1))
        audioInstruments.eRumble(ts, tonic, s16 * 3.6, LEVEL.rumble);
    }

    // --- harmony and atmosphere, kept sparse so the drums stay in charge ---
    if (!dropout) {
      if (peak && pattern.stab.includes(si) && bar % 2 === 1)
        audioInstruments.eStab(ts, voicing, LEVEL.stab, false);
      if ((rest || outro) && si === 0 && bar % 2 === 0)
        audioInstruments.ePad(t, voicing, s16 * 30, LEVEL.pad, false);
      if (rest && si % 8 === 4 && section.bs >= 2)
        audioInstruments.eKitPing(
          ts,
          72 + session.pc + session.mode.s[pattern.ping[(bar + si) % 8] % 7],
          LEVEL.ping * 0.8,
          si === 4 ? -0.4 : 0.4,
        );
      if (si === 0 && bar % 2 === 0 && (rest || peak || (groove && section.bs >= 4)))
        audioInstruments.eAtmos(
          t,
          32 * s16,
          LEVEL.atmos * (rest ? 1.6 : 0.7),
          320 + 260 * ((bar / 2) % 4),
        );
    }

    // --- transitions ---
    if (si === 0) {
      if (build && section.bs === Math.max(0, section.len - 3))
        audioInstruments.eRiser(t, (section.len - section.bs - 1) * 16 * s16 + 12 * s16, 0.05);
      if (peak && section.bs === 0) {
        audioInstruments.eKitCrash(t, LEVEL.crash);
        audioInstruments.eImpact(t, 0.45);
      } else if (peak && section.bs % 8 === 0) audioInstruments.eKitCrash(t, LEVEL.crash * 0.6);
      if (groove && section.bs === 0) audioInstruments.eKitCrash(t, LEVEL.crash * 0.5);
      if (rest && section.bs === 0) {
        audioInstruments.eImpact(t, 0.3);
        audioInstruments.eDownlifter(t, 16 * s16 * 2, 0.06);
      }
    }
    // Every 64 bars the track hands over to fresh material, like a DJ mixing into the next record.
    if (si === 0 && bar > 0 && bar % 64 === 0) audioInstruments.eImpact(t, 0.25);
    if (si === 8 && bar % 64 === 63) audioInstruments.eSwell(t, 8 * s16, 0.06);
    // A reverse swell lands exactly where the last bar before a drop goes quiet.
    if (build && section.bs === section.len - 1 && si === 4)
      audioInstruments.eSwell(t, 8 * s16, 0.07);
    if (rest && section.bs === section.len - 1 && si === 8)
      audioInstruments.eSwell(t, 8 * s16, 0.06);
  }
  return { scheduleWarehouseStep };
}
