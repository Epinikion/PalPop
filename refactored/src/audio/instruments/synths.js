export function createSynths({ audio, audioGraph, audioMath }) {
  /* bass: octave-up saw for phone speakers + pure sub sine. subOnly=long sub notes (intro / break) */
  function eBass(t, n, d, acc, vol, subOnly) {
    const sources = [],
      f = audioMath.midi(n),
      sub = audio.context.createOscillator(),
      sg = audio.context.createGain(),
      g = audio.context.createGain();
    sub.type = 'sine';
    sub.frequency.value = f;
    sg.gain.value = subOnly ? 1 : 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, d * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
    sub.connect(sg);
    sg.connect(g);
    if (subOnly) {
      const h = audio.context.createOscillator(),
        hg = audio.context.createGain();
      h.type = 'sine';
      h.frequency.value = f * 2;
      hg.gain.value = 0.22;
      h.connect(hg);
      hg.connect(g);
      h.start(t);
      h.stop(t + d + 0.06);
      sources.push(h);
    } else {
      const o = audio.context.createOscillator(),
        lp = audio.context.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = f * 2;
      lp.type = 'lowpass';
      lp.Q.value = 5;
      lp.frequency.setValueAtTime(acc ? 1900 : 1100, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + d);
      o.connect(lp);
      lp.connect(g);
      o.start(t);
      o.stop(t + d + 0.06);
      sources.push(o);
    }
    g.connect(audio.graph.song.bass);
    sub.start(t);
    sub.stop(t + d + 0.06);
    audio.stemFlash.bass = 0.14;
    audioGraph.releaseVoice(sub, g, sources);
  }
  function eAcid(t, n, d, acc, slideFrom, cut, vol) {
    const f = audioMath.midi(n),
      o = audio.context.createOscillator(),
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    o.type = audioMath.hashRand(Math.floor(t / 8), 42) < 0.3 ? 'square' : 'sawtooth';
    if (slideFrom) {
      o.frequency.setValueAtTime(audioMath.midi(slideFrom), t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.055);
    } else o.frequency.value = f;
    lp.type = 'lowpass';
    lp.Q.value = 8 + 4 * audioMath.hashRand(Math.floor(t / 16), 43);
    lp.frequency.setValueAtTime(cut * (acc ? 2.3 : 1), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.3), t + d * 0.9);
    const v = vol * (acc ? 1.5 : 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.setValueAtTime(v, t + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.02);
    p.pan.value = -0.15;
    o.connect(lp);
    lp.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.acidSh);
    audioGraph.feed(p, 0.16, 0.05);
    o.start(t);
    o.stop(t + d + 0.05);
    audio.stemFlash.synth = 0.12;
    audioGraph.releaseVoice(o, p);
  }
  function ePad(t, notes, d, vol, bright) {
    const sources = [],
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(bright ? 1800 : 900, t);
    lp.frequency.linearRampToValueAtTime(bright ? 3600 : 1700, t + d * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.5);
    g.gain.setValueAtTime(vol, t + d - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7);
    notes.forEach((n, i) => {
      for (const det of [-11, 11]) {
        const o = audio.context.createOscillator(),
          p = audio.context.createStereoPanner();
        o.type = 'sawtooth';
        o.frequency.value = audioMath.midi(n);
        o.detune.value = det + i * 1.7;
        p.pan.value = (det > 0 ? 1 : -1) * (i % 2 ? 0.5 : 0.3);
        o.connect(p);
        p.connect(lp);
        o.start(t);
        o.stop(t + d + 0.75);
        sources.push(o);
      }
    });
    lp.connect(g);
    g.connect(audio.graph.song.mel);
    audioGraph.feed(g, 0.12, 0.4);
    audio.stemFlash.synth = 0.2;
    audioGraph.releaseVoice(sources[0], g, sources.slice(1));
  }
  function ePluck(t, n, v, pan, len) {
    const f = audioMath.midi(n),
      o = audio.context.createOscillator(),
      o2 = audio.context.createOscillator(),
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    o.type = 'sawtooth';
    o2.type = 'square';
    o.frequency.value = f;
    o2.frequency.value = f * 1.006;
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(Math.min(8500, f * 7), t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    p.pan.value = pan;
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.mel);
    audioGraph.feed(p, 0.4, 0.14);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.1);
    o2.stop(t + len + 0.1);
    audio.stemFlash.synth = 0.12;
    audioGraph.releaseVoice(o, g, [o2, p]);
  }
  function eLead(t, n, len, v) {
    const f = audioMath.midi(n),
      o = audio.context.createOscillator(),
      o2 = audio.context.createOscillator(),
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    o.type = 'sawtooth';
    o2.type = 'triangle';
    o.frequency.value = f;
    o2.frequency.value = f;
    o.detune.value = 7;
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(Math.min(7000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(3200, f * 3), t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.setValueAtTime(v, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.16);
    p.pan.value = 0.12;
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.mel);
    audioGraph.feed(p, 0.42, 0.24);
    o.start(t);
    o2.start(t);
    o.stop(t + len + 0.2);
    o2.stop(t + len + 0.2);
    audio.stemFlash.synth = 0.16;
    audioGraph.releaseVoice(o, g, [o2, p]);
  }
  function eStab(t, notes, v, bright) {
    const sources = [],
      lp = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(bright ? 2600 : 1600, t);
    lp.frequency.exponentialRampToValueAtTime(520, t + 0.26);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    notes.forEach((n, i) => {
      for (const det of [-8, 8]) {
        const o = audio.context.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = audioMath.midi(n);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + 0.4);
        sources.push(o);
      }
    });
    p.pan.value = (audioMath.hashRand(Math.floor(t * 100)) - 0.5) * 0.5;
    lp.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.mel);
    audioGraph.feed(p, 0.55, 0.12);
    audio.stemFlash.synth = 0.16;
    audioGraph.releaseVoice(sources[0], g, sources.slice(1).concat(p));
  }
  return { eBass, eAcid, ePad, ePluck, eLead, eStab };
}
