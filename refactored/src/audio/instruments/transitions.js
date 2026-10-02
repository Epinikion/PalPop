export function createTransitions({ audio, audioGraph, audioMath }) {
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
  /* bass: octave-up saw for phone speakers + pure sub sine. subOnly=long sub notes (intro / break) */
  function eRiser(t, dur, v) {
    const s = audioGraph.nsrc(t, dur + 0.05),
      f = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      o = audio.context.createOscillator(),
      og = audio.context.createGain(),
      hp = audio.context.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(9500, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur * 0.96);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(1300, t + dur);
    hp.type = 'highpass';
    hp.frequency.value = 400;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(v * 0.32, t + dur * 0.96);
    og.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    s.connect(f);
    f.connect(g);
    g.connect(audio.graph.song.dry);
    o.connect(hp);
    hp.connect(og);
    og.connect(audio.graph.song.dry);
    o.start(t);
    o.stop(t + dur + 0.05);
    audioGraph.feed(g, 0, 0.1);
    audioGraph.releaseVoice(s, g);
    audioGraph.releaseVoice(o, og);
  }
  function eCrash(t, v, long) {
    const s = audioGraph.nsrc(t, long ? 2 : 1.2, 0.1),
      f = audio.context.createBiquadFilter(),
      g = audio.context.createGain();
    f.type = 'highpass';
    f.frequency.value = 5200;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (long ? 1.8 : 1));
    s.connect(f);
    f.connect(g);
    g.connect(audio.graph.song.dry);
    audioGraph.feed(g, 0, 0.3);
    audio.stemFlash.drums = 0.3;
    audioGraph.releaseVoice(s, g);
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
  /* Dance voices use low resonance and short, restrained effect sends. */
  return { eZap, eRiser, eCrash, eImpact };
}
