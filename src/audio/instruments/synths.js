import { createSupersaw } from './supersaw.js';
export function createSynths({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });
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
  /* Wide saw pad; `bright` opens the filter for breakdowns and builds. */
  /**
   * The four melodic voices of the techno styles are detuned saw stacks, swept by a resonant filter and
   * saturated: wide, buzzing and a little different every time, the way an analog synth sounds.
   */
  function ePad(t, notes, d, vol, bright) {
    superSaw(t, notes, d, vol * 2.4, {
      voices: 5,
      detune: 1.1,
      width: 0.9,
      hp: 150,
      cut: bright ? [2400, 5200] : [1300, 2600],
      fall: d * 0.8,
      q: 0.9,
      attack: 0.5,
      sustain: 1,
      release: 0.7,
      delaySend: 0.12,
      reverbSend: 0.4,
      drive: 1.5,
      drift: 4,
    });
  }
  function ePluck(t, n, v, pan, len) {
    const f = audioMath.midi(n);
    superSaw(t, [n], len, v * 2.6, {
      voices: 3,
      detune: 0.9,
      width: 0.6,
      hp: 260,
      cut: [Math.min(8500, f * 9), f * 1.6],
      fall: len,
      q: 4.5,
      attack: 0.003,
      sustain: 0.15,
      release: 0.06,
      delaySend: 0.4,
      reverbSend: 0.14,
      pan,
      pulse: true,
      drive: 2.2,
      drift: 3,
    });
  }
  function eLead(t, n, len, v) {
    const f = audioMath.midi(n);
    superSaw(t, [n], len, v * 2.6, {
      voices: 3,
      detune: 0.8,
      width: 0.35,
      hp: 180,
      cut: [Math.min(7500, f * 9), Math.min(3400, f * 3.2)],
      fall: len,
      q: 2.2,
      attack: 0.008,
      sustain: 0.9,
      release: 0.16,
      delaySend: 0.42,
      reverbSend: 0.24,
      pan: 0.12,
      drive: 2,
      drift: 3,
    });
  }
  function eStab(t, notes, v, bright) {
    superSaw(t, notes, 0.3, v * 2.6, {
      voices: 5,
      detune: 0.9,
      width: 0.7,
      hp: 220,
      cut: [bright ? 5400 : 3600, 600],
      fall: 0.26,
      q: 3.4,
      attack: 0.004,
      sustain: 0.22,
      release: 0.14,
      delaySend: 0.55,
      reverbSend: 0.14,
      pan: (audioMath.hashRand(Math.floor(t * 100)) - 0.5) * 0.5,
      drive: 2.4,
      drift: 3,
    });
  }
  return { eBass, eAcid, ePad, ePluck, eLead, eStab };
}
