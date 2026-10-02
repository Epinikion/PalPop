export function createDance({ audio, audioGraph, audioMath }) {
  function eDanceBass(t, n, d, v, color = 0.5) {
    const sub = audio.context.createOscillator(),
      saw = audio.context.createOscillator(),
      subGain = audio.context.createGain(),
      sawGain = audio.context.createGain(),
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain();
    sub.type = 'sine';
    sub.frequency.value = audioMath.midi(n);
    saw.type = 'sawtooth';
    saw.frequency.value = audioMath.midi(n + 12);
    saw.detune.value = -3;
    subGain.gain.value = 0.48;
    sawGain.gain.value = 0.9;
    filter.type = 'lowpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(850 + color * 1900, t);
    filter.frequency.exponentialRampToValueAtTime(350 + color * 650, t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(v * 0.45, t + d * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.025);
    sub.connect(subGain);
    subGain.connect(gain);
    saw.connect(sawGain);
    sawGain.connect(filter);
    filter.connect(gain);
    gain.connect(audio.graph.song.bass);
    sub.start(t);
    saw.start(t);
    sub.stop(t + d + 0.06);
    saw.stop(t + d + 0.06);
    audioGraph.releaseVoice(sub, gain, [saw, sawGain, subGain, filter]);
    audio.stemFlash.bass = 0.14;
  }
  function eDanceChord(t, notes, d, v, color = 0.5, pan = -0.15) {
    const sources = [],
      spread = [],
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      panner = audio.context.createStereoPanner();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(1800 + color * 3000, t);
    filter.frequency.exponentialRampToValueAtTime(650 + color * 550, t + d + 0.12);
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, t);
    const level = v / Math.sqrt(notes.length * 2);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.004);
    gain.gain.setValueAtTime(level * 0.8, t + Math.max(0.012, d * 0.45));
    gain.gain.exponentialRampToValueAtTime(level * 0.22, t + d);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
    for (const n of notes)
      for (const detune of [-9, 9]) {
        const oscillator = audio.context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = audioMath.midi(n);
        oscillator.detune.value = detune;
        const position = audio.context.createStereoPanner();
        position.pan.value = detune < 0 ? -0.55 : 0.55;
        oscillator.connect(position);
        position.connect(filter);
        spread.push(position);
        oscillator.start(t);
        oscillator.stop(t + d + 0.22);
        sources.push(oscillator);
      }
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(audio.graph.song.mel);
    audioGraph.feed(panner, 0.07, 0.07);
    audioGraph.releaseVoice(sources[0], panner, sources.slice(1).concat(spread, filter, gain));
    audio.stemFlash.synth = 0.16;
  }
  function eDanceLead(t, n, d, v, color = 0.5, pan = 0.1) {
    const sources = [],
      spread = [],
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      panner = audio.context.createStereoPanner();
    filter.type = 'lowpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(1800 + color * 3200, t);
    filter.frequency.exponentialRampToValueAtTime(450 + color * 650, t + d + 0.07);
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, t);
    const level = v / Math.sqrt(3);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.003);
    gain.gain.setValueAtTime(level * 0.75, t + Math.max(0.008, d * 0.4));
    gain.gain.exponentialRampToValueAtTime(level * 0.18, t + d);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1);
    for (const detune of [-11, 0, 11]) {
      const oscillator = audio.context.createOscillator();
      oscillator.type = color < 0.35 && detune === 0 ? 'square' : 'sawtooth';
      oscillator.frequency.value = audioMath.midi(n);
      oscillator.detune.value = detune;
      const position = audio.context.createStereoPanner();
      position.pan.value = (detune / 11) * 0.4;
      oscillator.connect(position);
      position.connect(filter);
      spread.push(position);
      oscillator.start(t);
      oscillator.stop(t + d + 0.14);
      sources.push(oscillator);
    }
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(audio.graph.song.mel);
    audioGraph.feed(panner, 0.09, 0.05);
    audioGraph.releaseVoice(sources[0], panner, sources.slice(1).concat(spread, filter, gain));
    audio.stemFlash.synth = 0.14;
  }
  return { eDanceBass, eDanceChord, eDanceLead };
}
