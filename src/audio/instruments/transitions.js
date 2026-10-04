/** Keeps the kit's crash at the loudness the noise crash had in the arrangements' mixes. */
const CRASH_GAIN = 2.7;

export function createTransitions({ audio, audioGraph, audioMath, kit }) {
  /* acid zap: quick resonant pitch-down squeal as a sparse peak accent */
  function eZap(t, v) {
    const o = audio.context.createOscillator(),
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.24);
    lp.type = 'lowpass';
    lp.Q.value = 14;
    lp.frequency.setValueAtTime(5400, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.24);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(lp);
    lp.connect(g);
    g.connect(audio.graph.song.acidSh);
    audioGraph.feed(g, 0.3, 0.1);
    o.start(t);
    o.stop(t + 0.32);
    audio.stemFlash.synth = 0.14;
    audioGraph.releaseVoice(o, g);
  }
  /** Stereo noise: two decorrelated slices of the noise buffer, panned apart. */
  function noisePair(t, dur, width) {
    const nodes = [],
      sources = [];
    const mix = audio.context.createGain();
    for (const [side, offset] of [
      [-1, 0.05],
      [1, 0.55],
    ]) {
      const source = audioGraph.nsrc(t, dur, offset),
        position = audio.context.createStereoPanner();
      position.pan.value = side * width;
      source.connect(position);
      position.connect(mix);
      sources.push(source);
      nodes.push(position);
    }
    return { mix, sources, nodes };
  }
  /** Rising tension: filtered noise, a detuned saw sweep and a reverb tail. */
  function eRiser(t, dur, v) {
    const noise = noisePair(t, dur + 0.05, 0.6),
      band = audio.context.createBiquadFilter(),
      bright = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      sources = [],
      extra = [];
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(350, t);
    band.frequency.exponentialRampToValueAtTime(9500, t + dur);
    bright.type = 'highpass';
    bright.frequency.setValueAtTime(600, t);
    bright.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * 1.5, t + dur * 0.96);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    noise.mix.connect(band);
    noise.mix.connect(bright);
    band.connect(g);
    bright.connect(g);
    g.connect(audio.graph.song.dry);
    const tone = audio.context.createGain(),
      hp = audio.context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    tone.gain.setValueAtTime(0.0001, t);
    tone.gain.exponentialRampToValueAtTime(v * 0.4, t + dur * 0.96);
    tone.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    for (const detune of [-14, 0, 14]) {
      const o = audio.context.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + dur);
      o.connect(hp);
      o.start(t);
      o.stop(t + dur + 0.05);
      sources.push(o);
    }
    hp.connect(tone);
    tone.connect(audio.graph.song.dry);
    audioGraph.feed(g, 0, 0.12);
    extra.push(...noise.sources.slice(1), ...noise.nodes, noise.mix, band, bright, tone, hp);
    extra.push(...sources.slice(1));
    audioGraph.releaseVoice(noise.sources[0], g, extra);
    audioGraph.releaseVoice(sources[0], tone);
  }
  /** Reverse-cymbal swell that lands exactly on `t + dur`. */
  function eSwell(t, dur, v) {
    const noise = noisePair(t, dur + 0.04, 0.7),
      hp = audio.context.createBiquadFilter(),
      g = audio.context.createGain();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1800, t);
    hp.frequency.exponentialRampToValueAtTime(6500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    noise.mix.connect(hp);
    hp.connect(g);
    g.connect(audio.graph.song.dry);
    audioGraph.feed(g, 0, 0.16);
    audio.stemFlash.drums = 0.1;
    audioGraph.releaseVoice(noise.sources[0], g, [
      ...noise.sources.slice(1),
      ...noise.nodes,
      noise.mix,
      hp,
    ]);
  }
  /** Falling noise wash after a drop, so the energy settles instead of simply stopping. */
  function eDownlifter(t, dur, v) {
    const noise = noisePair(t, dur + 0.05, 0.5),
      band = audio.context.createBiquadFilter(),
      g = audio.context.createGain();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(7500, t);
    band.frequency.exponentialRampToValueAtTime(260, t + dur);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.mix.connect(band);
    band.connect(g);
    g.connect(audio.graph.song.dry);
    audioGraph.feed(g, 0, 0.2);
    audioGraph.releaseVoice(noise.sources[0], g, [
      ...noise.sources.slice(1),
      ...noise.nodes,
      noise.mix,
      band,
    ]);
  }
  /** Crash cymbal from the kit: `long` rings for a couple of seconds, otherwise a short splash. */
  function eCrash(t, v, long) {
    kit.eKitCrash(t, v * CRASH_GAIN, long);
  }
  function eImpact(t, v) {
    const o = audio.context.createOscillator(),
      g = audio.context.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g);
    g.connect(audio.graph.song.dry);
    o.start(t);
    o.stop(t + 0.95);
    const s = audioGraph.nsrc(t, 0.7, 0.2),
      f = audio.context.createBiquadFilter(),
      ng = audio.context.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    ng.gain.setValueAtTime(v * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    s.connect(f);
    f.connect(ng);
    ng.connect(audio.graph.song.dry);
    audioGraph.feed(ng, 0, 0.25);
    audioGraph.releaseVoice(o, g);
    audioGraph.releaseVoice(s, ng);
  }
  /**
   * DJ-style filter move on the whole dry mix: call per step during builds with a rising
   * frequency, and with a low value on the drop. Cheap enough to schedule every few steps.
   */
  function eSweep(t, hz) {
    const sweep = audio.graph.song.sweep;
    if (sweep) sweep.frequency.setTargetAtTime(hz, t, 0.03);
  }
  /**
   * Section-wide echo and reverb level: breakdowns open into a larger room, drops tighten up.
   * `wet` scales every voice's send; 1 leaves the voices' own balance untouched.
   */
  function eSpace(t, wet) {
    const { rv, dl } = audio.graph.song;
    if (rv) rv.gain.setTargetAtTime(wet, t, 0.3);
    if (dl) dl.gain.setTargetAtTime(Math.min(1.5, 0.5 + wet * 0.5), t, 0.3);
  }
  /* Dance voices use low resonance and short, restrained effect sends. */
  return { eZap, eRiser, eSwell, eDownlifter, eCrash, eImpact, eSweep, eSpace };
}
