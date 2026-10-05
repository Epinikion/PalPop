import { createAudioMath } from '../math.js';
import { sweepFor } from '../sweep.js';
import { stemsFor } from '../stems.js';
import { vocalsFor } from '../vocals.js';
import { STYLES } from './styles.js';

/** Which kit kick each style uses. */
const KICKS = { clean: 0, punch: 1, hard: 2, round: 3 };
/** Each melodic layer's filter range: 0 in the automation is the low end, 1 the high end (Hz). */
const RANGE = {
  bass: [90, 4000],
  hook: [260, 16000],
  arp: [300, 14000],
  stab: [300, 12000],
  pad: [220, 12000],
};
/** How much of each layer goes to the echo and the reverb, at a reverb setting of 1. */
const SENDS = {
  bass: [0, 0],
  hook: [0.22, 0.32],
  arp: [0.34, 0.3],
  stab: [0.12, 0.3],
  pad: [0.05, 0.42],
};
const cutoff = (layer, v) => {
  const [low, high] = RANGE[layer];
  return low * (high / low) ** Math.max(0, Math.min(1, v));
};

/**
 * Plays a generated set. The drums are struck live from the kit, step by step; the melodic layers
 * are loops rendered ahead of time (`stems.js`), started at the bar where they come in and shaped
 * as they play by each layer's filter and sends, the way a producer automates a track.
 */
export function createAudioGen(
  { audio, audioComposition, audioInstruments: I, audioMath = createAudioMath(audio) },
  id,
) {
  const style = STYLES[id],
    { mix } = style,
    stems = stemsFor(audio),
    vocals = style.vocal ? vocalsFor(audio) : null;

  /** Gets the rendered loops of the tracks around a bar going. */
  function warm(bar) {
    const timeline = audioComposition.timeline(),
      { index, local } = timeline.locate(bar),
      track = timeline.track(index),
      ready = [stems.prepare(audio.session, track)];
    if (vocals && audio.context?.decodeAudioData) ready.push(vocals.load(audio.context));
    if (local >= track.length - 40)
      ready.push(stems.prepare(audio.session, timeline.track(index + 1)));
    return Promise.all(ready);
  }

  function startBar(plan, t) {
    const session = audio.session,
      timeline = audioComposition.timeline(),
      track = timeline.track(plan.track),
      barTime = 16 * session.s16,
      song = audio.graph.song;
    warm(plan.bar);

    // Loops that come in (or start over) in this bar.
    for (const entry of plan.stems) {
      const buffer = stems.get(session, track, entry.stem),
        layer = song.layers?.[entry.layer];
      if (!buffer || !layer) continue;
      const source = audio.context.createBufferSource(),
        fader = audio.context.createGain(),
        span = entry.bars * barTime,
        stop = entry.ends ? t + span + 0.06 : t + span + 1.5;
      source.buffer = buffer;
      source.connect(fader);
      fader.connect(layer.input);
      if (entry.ends) {
        fader.gain.setValueAtTime(1, t + span - 0.03);
        fader.gain.linearRampToValueAtTime(0, t + span + 0.05);
      }
      source.start(t, entry.offset * barTime);
      source.stop(Math.min(stop, t + buffer.duration - entry.offset * barTime));
      source.onended = () => {
        source.disconnect();
        fader.disconnect();
      };
      if (entry.layer === 'bass') audio.stemFlash.bass = 0.2;
      else audio.stemFlash.synth = 0.2;
    }

    // Sung phrases: each file starts a little before its bar, so breaths and first consonants land
    // ahead of the beat as a singer's do. The harmony, where there is one, sits under the lead.
    if (vocals && song.vocal)
      for (const cue of plan.vocals)
        for (const [name, level] of [
          [cue.phrase, 1],
          [cue.harmony, 0.55],
        ]) {
          const buffer = name && vocals.get(audio.context, name);
          if (!buffer) continue;
          const source = audio.context.createBufferSource(),
            gain = audio.context.createGain(),
            at = t - style.vocal.pre;
          source.buffer = buffer;
          gain.gain.value = level;
          source.connect(gain);
          gain.connect(song.vocal);
          const offset = Math.max(0, audio.context.currentTime - at);
          source.start(Math.max(at, audio.context.currentTime), offset);
          source.onended = () => {
            source.disconnect();
            gain.disconnect();
          };
        }

    // Filter and send automation through the bar.
    const hype = Math.min(1, audio.hype || 0);
    if (song.layers)
      for (const [name, layer] of Object.entries(song.layers)) {
        // While the voice sings, the pads, arpeggio and stabs step back so the words stay clear.
        const space = plan.singing && name !== 'bass' ? 0.6 : 1;
        layer.input.gain.setTargetAtTime(style.stems[name] * space, t, 0.08);
        const [from, to] = plan.auto[name],
          boost = name === 'hook' || name === 'arp' ? 0.08 * hype : 0;
        layer.filter.frequency.setValueAtTime(cutoff(name, from + boost), t);
        layer.filter.frequency.linearRampToValueAtTime(cutoff(name, to + boost), t + barTime);
        const [echo, room] = SENDS[name];
        layer.dl.gain.setTargetAtTime(echo * (0.6 + 0.6 * plan.auto.reverb), t, 0.3);
        layer.rv.gain.setTargetAtTime(room * plan.auto.reverb, t, 0.3);
      }

    // Transitions.
    const fx = plan.fx,
      s16 = session.s16;
    if (fx.riser) I.eRiser(t, fx.riser * barTime - 2 * s16, 0.05);
    if (fx.crash) I.eCrash(t, fx.crash === 'long' ? 0.07 : 0.04, fx.crash === 'long');
    if (fx.impact) I.eImpact(t, 0.4);
    if (fx.downlifter) I.eDownlifter(t, 2 * barTime, 0.05);
    if (fx.swell) I.eSwell(t + 8 * s16, 8 * s16, 0.06);
    I.eSpace(t, plan.sec === 'BREAK' ? 1.6 : plan.sec === 'BUILD' ? 1.25 : 1);
    if (song.vocalRv) song.vocalRv.gain.setTargetAtTime(0.18 + 0.3 * plan.auto.reverb, t, 0.3);
  }

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16,
      session = audio.session,
      plan = audioComposition.planAt(bar),
      s16 = session.s16,
      ts = t + (si % 2 ? session.swing * s16 : 0),
      human = (salt) => audioMath.hashRand(step, salt),
      drift = (human(3) - 0.5) * 0.004,
      d = plan.drums;
    audio.bar = bar;
    audio.section = plan.sec;
    audio.key = plan.key;
    if (si === 0) startBar(plan, t);
    if (plan.singing && vocals?.get(audio.context, 'chorus')) audio.stemFlash.vocal = 0.25;
    if (si % 4 === 0 && !(plan.dropout && si >= 12))
      I.eSweep(t, sweepFor(plan.sec, (plan.bs + si / 16) / plan.len));

    if (d.kick[si] > 0)
      I.eKick(
        t,
        0.62 * mix.kick * d.kick[si],
        0.55,
        plan.on.rumble ? style.sound.rumble : 0,
        I.kickTuning(plan.key.pc) * 2 ** ((style.sound.tune || 0) / 12),
        KICKS[style.sound.kick],
      );
    if (d.clap[si] > 0) I.eClap(t + drift * 0.5, 0.17 * mix.clap * d.clap[si]);
    if (d.open[si] > 0) I.eHat(ts + drift, true, 0.1 * mix.open * d.open[si], 0.18);
    if (d.hat[si] > 0)
      I.eHat(
        ts + drift,
        false,
        0.16 * mix.hat * d.hat[si] * (0.85 + 0.3 * human(1)),
        si % 4 < 2 ? -0.22 : 0.22,
      );
    if (d.ride[si] > 0) I.eRide(ts + drift, 0.24 * mix.ride * d.ride[si], 0.3);
    if (d.perc[si] > 0) perc(ts + drift, d.perc[si], si);
    if (d.snare[si] > 0) I.eSnare(ts, 0.05 * d.snare[si], 0.95 + 0.4 * plan.progress);
    if (d.tom[si] > 0) I.eTom(ts, 200 - 14 * (si - 12), 0.14 * d.tom[si]);
  }

  /** Percussion between the drums, in each style's colour. */
  function perc(t, v, si) {
    const side = si % 4 < 2 ? -0.35 : 0.35;
    if (id === 'rave') {
      if (si % 3 === 0) I.eTom(t, 150 + 20 * (si % 4), 0.1 * mix.perc * v);
      else I.ePerc(t, 'tick', 0.08 * mix.perc * v, side);
    } else if (id === 'melodic')
      I.ePerc(t, si % 5 === 0 ? 'conga' : 'tick', 0.07 * mix.perc * v, side);
    else I.eShaker(t, 0.07 * mix.perc * v, side);
  }

  scheduleStep.prepare = (from, to) => {
    const ready = [];
    for (let bar = Math.floor(from); bar <= to; bar += 8) ready.push(warm(bar));
    return Promise.all(ready);
  };
  return { scheduleStep };
}
