import { createAudioMath } from '../math.js';
import { sweepFor } from '../sweep.js';
import { PROFILES } from './profiles.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Plays a generated song. The timeline says what happens in a bar (see `layers.js`); this turns it
 * into voice calls, one sixteenth at a time, on the clock the scheduler hands over. The profile's
 * `mix` and `sound` say how loud each layer is and how it is voiced.
 */
export function createAudioGen(
  { audio, audioComposition, audioInstruments: I, audioMath = createAudioMath(audio) },
  id,
) {
  const { mix, sound } = PROFILES[id];

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      session = audio.session,
      plan = audioComposition.planAt(bar),
      s16 = session.s16,
      ts = t + (si % 2 ? session.swing * s16 : 0),
      { sec, bs, len } = plan,
      gone = plan.dropout && si >= 12,
      heat = clamp01(audio.hype || 0),
      filter = clamp01(plan.filter + 0.25 * heat),
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.006,
      pan = (salt) => (human(salt) - 0.5) * 2;
    audio.bar = bar;
    audio.section = sec;
    if (si % 4 === 0 && !gone) I.eSweep(t, sweepFor(sec, plan.progress + si / 16 / len));
    if (si === 0)
      I.eSpace(t, sec === 'BREAK' ? 1.6 : sec === 'BUILD' ? 1.2 : sec === 'DROP' ? 0.9 : 1);

    // --- drums ---
    if (plan.kick[si] > 0)
      I.eKick(
        t,
        0.6 * mix.kick * plan.kick[si],
        sound.duck,
        0,
        I.kickTuning(session.pc) * 2 ** (sound.tune / 12),
        sound.kick,
      );
    if (!gone) {
      if (plan.clap[si] > 0) I.eClap(t, 0.2 * mix.clap * plan.clap[si]);
      if (plan.open[si] > 0) I.eHat(ts + drift, true, 0.1 * mix.open * plan.open[si], 0.22);
      else if (plan.hat[si] > 0)
        I.eHat(ts + drift, false, 0.07 * mix.hat * plan.hat[si], (si % 4 < 2 ? -1 : 1) * 0.25);
      if (plan.snare[si] > 0)
        I.eSnare(ts, 0.05 * mix.snare * plan.snare[si], 0.9 + 0.5 * plan.progress);
      for (const hit of plan.perc) if (hit.si === si) perc(hit, ts + drift);
    }

    // --- low end ---
    for (const note of plan.bass)
      if (note.si === si)
        I.eRoll(ts, note.note, s16 * (0.55 + 0.4 * note.len), 0.3 * mix.bass * note.vel, {
          color: 0.35 + 0.5 * filter,
        });

    // --- harmony and melody ---
    for (const hit of plan.stab)
      if (hit.si === si)
        I.eRave(ts + drift, hit.notes, s16 * (0.6 + 0.5 * hit.len), 0.11 * mix.stab * hit.vel, {
          style: sound.voices,
          filter,
          pan: pan(5) * 0.4,
        });
    for (const hit of plan.arp)
      if (hit.si === si)
        I.eArp(ts + drift, hit.note, s16 * hit.len, 0.1 * mix.arp * hit.vel * (1 + 0.3 * heat), {
          style: sound.voices,
          filter,
          pan: (si % 4 < 2 ? -1 : 1) * 0.35,
        });
    for (const hit of plan.acid)
      if (hit.si === si)
        I.eAcid(
          ts,
          hit.note,
          s16 * (hit.slide ? 1.25 : hit.len),
          hit.accent,
          hit.from,
          300 + 2200 * (0.2 + 0.8 * filter),
          0.075 * mix.acid * hit.vel,
        );
    for (const hit of plan.lead)
      if (hit.si === si)
        I.eAnthem(ts + drift, hit.note, s16 * hit.len * 0.95, 0.12 * mix.lead * hit.vel, {
          style: sound.voices,
          from: hit.from,
          filter,
        });
    if (si === 0 && plan.pad)
      I.ePad(
        t,
        plan.pad.notes,
        plan.pad.bars * 16 * s16,
        0.075 * mix.pad,
        sec === 'BREAK' || sec === 'DROP' || sec === 'BUILD',
      );

    // --- transitions ---
    const fx = plan.fx;
    if (si === 0) {
      if (fx.riser) I.eRiser(t, fx.riser * s16 - 4 * s16, 0.045);
      if (fx.crash) I.eCrash(t, fx.crash === 'long' ? 0.07 : 0.04, fx.crash === 'long');
      if (fx.impact) I.eImpact(t, fx.impact === 'soft' ? 0.28 : 0.45);
      if (fx.downlifter) I.eDownlifter(t, 32 * s16, 0.06);
    }
    if (si === 8 && fx.swell) I.eSwell(t, 8 * s16, 0.07);
    // Every so often the song hands over to fresh material with an impact, like a DJ mixing on.
    if (si === 0 && bar > 0 && bs === 0 && sec === 'GROOVE') I.eImpact(t, 0.25);
  }

  /** One percussion hit, voiced by its kind. */
  function perc(hit, at) {
    const v = hit.vel,
      side = (hit.si % 4 < 2 ? -1 : 1) * 0.35;
    if (hit.kind === 'rim') I.ePerc(at, 'tick', 0.1 * mix.perc * v, side);
    else if (hit.kind === 'tom') I.eTom(at, 140 + 90 * (hit.si % 3), 0.16 * mix.perc * v);
    else if (hit.kind === 'ping')
      I.eKitPing(at, 72 + audio.session.pc + 7 * (hit.si % 2), 0.08 * mix.perc * v, side);
    else if (hit.kind === 'shaker') I.eShaker(at, 0.03 * mix.perc * v, side);
    else if (hit.kind === 'ride') I.eRide(at, 0.12 * mix.perc * v, side);
    else if (hit.kind === 'blast') I.eKitBlast(at, 0.12 * mix.perc * v, side);
  }
  return { scheduleStep };
}
