export function createDrums({ audio, audioGraph, audioMath }) {
  /* ---------- voices ---------- */
  /* Kick: pitch-dropping sine body into a shared soft clipper, plus a short click. `tone` > 1 is boomier. */
  function eKick(t, v, duck, rum, tone = 1) {
    const o = audio.context.createOscillator(),
      g = audio.context.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(62, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.3 * tone);
    g.gain.setValueAtTime(0.0001, t);
    v *= 0.62; // the drive stage adds level; keep the kick a partner of the mix, not its owner
    g.gain.exponentialRampToValueAtTime(v, t + 0.0015);
    g.gain.setTargetAtTime(0.0001, t + 0.035, 0.07 * tone);
    o.connect(g);
    g.connect(audio.graph.song.drive || audio.graph.song.dry);
    o.start(t);
    o.stop(t + 0.42 * tone);
    if (rum > 0 && audio.graph.song.rum) {
      const rg = audio.context.createGain();
      rg.gain.value = rum * 0.55;
      g.connect(rg);
      rg.connect(audio.graph.song.rum);
      g._sends = [rg];
    }
    const c = audioGraph.nsrc(t, 0.03, 0.1),
      f = audio.context.createBiquadFilter(),
      cg = audio.context.createGain();
    f.type = 'highpass';
    f.frequency.value = 3200;
    cg.gain.setValueAtTime(0.16, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
    c.connect(f);
    f.connect(cg);
    cg.connect(audio.graph.song.dry);
    if (duck > 0) {
      // Instant dip, then an exponential recovery that breathes with the tempo.
      const d = audio.graph.song.duck.gain;
      d.setValueAtTime(1 - duck, t);
      d.setTargetAtTime(1, t + 0.012, 0.075);
      // Vocals only breathe with the kick: a third of the synths' dip, so words stay in front.
      const voice = audio.graph.song.voxDuck;
      if (voice) {
        voice.gain.setValueAtTime(1 - duck * 0.3, t);
        voice.gain.setTargetAtTime(1, t + 0.012, 0.09);
      }
    }
    audio.stemFlash.kick = 0.16;
    audioGraph.releaseVoice(o, g);
    audioGraph.releaseVoice(c, cg);
  }
  function eHat(t, open, v, pan, off) {
    const s = audioGraph.nsrc(t, (open ? 0.24 : 0.06) + 0.02, off),
      f = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    f.type = 'highpass';
    f.frequency.value = open ? 5600 : 7400;
    f.Q.value = 0.9;
    p.pan.value = pan;
    v *= 3;
    g.gain.setValueAtTime(v, t);
    if (open) {
      // Two-stage decay: a bright strike, then a longer, quieter wash.
      g.gain.exponentialRampToValueAtTime(v * 0.38, t + 0.045);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.dry);
    if (open) audioGraph.feed(p, 0.1, 0.05);
    audio.stemFlash.drums = 0.12;
    audioGraph.releaseVoice(s, p);
  }
  function eShaker(t, v, pan, off) {
    const s = audioGraph.nsrc(t, 0.07, off),
      f = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    f.type = 'bandpass';
    f.frequency.value = 7600;
    f.Q.value = 0.9;
    p.pan.value = pan;
    v *= 2.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    s.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(audio.graph.song.dry);
    audioGraph.releaseVoice(s, p);
  }
  function eClap(t, v) {
    v *= 3;
    for (let k = 0; k < 4; k++) {
      const at = t + k * 0.012,
        s = audioGraph.nsrc(at, 0.22, 0.05 + k * 0.07),
        f = audio.context.createBiquadFilter(),
        g = audio.context.createGain();
      f.type = 'bandpass';
      f.frequency.value = 1350 + 250 * k;
      f.Q.value = 0.75;
      g.gain.setValueAtTime(v * (k < 3 ? 0.8 : 1), at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (k < 3 ? 0.02 : 0.19));
      s.connect(f);
      f.connect(g);
      g.connect(audio.graph.song.dry);
      if (k === 3) audioGraph.feed(g, 0.07, 0.24);
      audioGraph.releaseVoice(s, g);
    }
    audio.stemFlash.drums = 0.18;
  }
  /* Snare: noisy body with a bright sizzle and a short pitched shell; `pitch` tunes rolls upward. */
  function eSnare(t, v, pitch = 1) {
    v *= 2.6;
    const s = audioGraph.nsrc(t, 0.2, 0.2),
      f = audio.context.createBiquadFilter(),
      sizzle = audio.context.createBiquadFilter(),
      sizzleGain = audio.context.createGain(),
      g = audio.context.createGain(),
      o = audio.context.createOscillator(),
      og = audio.context.createGain();
    f.type = 'bandpass';
    f.frequency.value = 2200 * pitch;
    f.Q.value = 0.7;
    sizzle.type = 'highpass';
    sizzle.frequency.value = 6000;
    sizzleGain.gain.value = 0.45;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.type = 'triangle';
    o.frequency.setValueAtTime(205 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(135, t + 0.08);
    og.gain.setValueAtTime(v * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    s.connect(f);
    s.connect(sizzle);
    sizzle.connect(sizzleGain);
    sizzleGain.connect(g);
    f.connect(g);
    g.connect(audio.graph.song.dry);
    o.connect(og);
    og.connect(audio.graph.song.dry);
    o.start(t);
    o.stop(t + 0.13);
    audioGraph.feed(g, 0, 0.14);
    audio.stemFlash.drums = 0.14;
    audioGraph.releaseVoice(s, g, [sizzle, sizzleGain]);
    audioGraph.releaseVoice(o, og);
  }
  function eTom(t, f0, v) {
    const o = audio.context.createOscillator(),
      g = audio.context.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g);
    g.connect(audio.graph.song.dry);
    audioGraph.feed(g, 0, 0.06);
    o.start(t);
    o.stop(t + 0.27);
    audio.stemFlash.drums = 0.14;
    audioGraph.releaseVoice(o, g);
  }
  function ePerc(t, kind, v, pan, n = 60) {
    const p = audio.context.createStereoPanner(),
      g = audio.context.createGain();
    p.pan.value = pan;
    g.connect(p);
    p.connect(audio.graph.song.dry);
    if (kind === 'tick') {
      const s = audioGraph.nsrc(t, 0.04, 0.3),
        f = audio.context.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 4800;
      f.Q.value = 2.5;
      g.gain.setValueAtTime(v * 1.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      s.connect(f);
      f.connect(g);
      audioGraph.releaseVoice(s, p, [g]);
    } else if (kind === 'blip') {
      /* Tuned FM metal: a short, glassy machine accent between the drums. */
      const f0 = audioMath.midi(n + 12),
        o = audio.context.createOscillator(),
        mod = audio.context.createOscillator(),
        depth = audio.context.createGain();
      o.type = 'sine';
      o.frequency.value = f0;
      mod.frequency.value = f0 * 1.414;
      depth.gain.setValueAtTime(f0 * 1.8, t);
      depth.gain.exponentialRampToValueAtTime(f0 * 0.025, t + 0.19);
      mod.connect(depth);
      depth.connect(o.frequency);
      o.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * 0.85, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.start(t);
      mod.start(t);
      o.stop(t + 0.28);
      mod.stop(t + 0.28);
      audioGraph.releaseVoice(o, p, [g, mod, depth]);
    } else {
      const o = audio.context.createOscillator(),
        f0 = kind === 'conga' ? 340 : 920;
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v * (kind === 'conga' ? 1.6 : 1.1), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'conga' ? 0.14 : 0.1));
      o.connect(g);
      o.start(t);
      o.stop(t + 0.17);
      audioGraph.releaseVoice(o, p, [g]);
    }
    audioGraph.feed(g, kind === 'blip' ? 0.3 : 0.12, 0.1);
  }
  /* 909-style ride: metallic noise ping for peak/final phrases */
  /* 909-style ride: metallic noise ping for peak/final phrases */
  function eRide(t, v, pan) {
    const s = audioGraph.nsrc(t, 0.5, 0.15),
      f = audio.context.createBiquadFilter(),
      hp = audio.context.createBiquadFilter(),
      g = audio.context.createGain(),
      p = audio.context.createStereoPanner();
    f.type = 'bandpass';
    f.frequency.value = 9200;
    f.Q.value = 0.7;
    hp.type = 'highpass';
    hp.frequency.value = 5400;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    const o = audio.context.createOscillator(),
      og = audio.context.createGain();
    o.type = 'triangle';
    o.frequency.value = 5860;
    og.gain.setValueAtTime(v * 0.55, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(f);
    f.connect(g);
    o.connect(og);
    og.connect(g);
    g.connect(hp);
    hp.connect(p);
    p.pan.value = pan;
    p.connect(audio.graph.song.dry);
    audioGraph.feed(p, 0.07, 0.12);
    o.start(t);
    o.stop(t + 0.2);
    audio.stemFlash.drums = 0.1;
    audioGraph.releaseVoice(s, p, [o]);
  }
  /* acid zap: quick resonant pitch-down squeal as a sparse peak accent */
  return { eKick, eHat, eShaker, eClap, eSnare, eTom, ePerc, eRide };
}
