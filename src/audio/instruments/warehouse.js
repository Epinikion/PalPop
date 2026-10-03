const DRIVE = new Float32Array(1024);
for (let i = 0; i < DRIVE.length; i++) {
  const x = (i * 2) / (DRIVE.length - 1) - 1;
  DRIVE[i] = Math.tanh(x * 2.4) / Math.tanh(2.4);
}

/** Low-end and texture voices of the warehouse techno track. */
export function createWarehouse({ audio, audioGraph, audioMath }) {
  /**
   * Rumble: the low tail that sits between kicks. It swells after each kick and fades before the
   * next, on the bass bus, so the kick's sidechain carves it into a rolling pulse.
   */
  function eRumble(t, note, d, v) {
    const f = audioMath.midi(note),
      body = audio.context.createOscillator(),
      harmonic = audio.context.createOscillator(),
      harmonicGain = audio.context.createGain(),
      lowpass = audio.context.createBiquadFilter(),
      gain = audio.context.createGain();
    body.type = harmonic.type = 'sine';
    body.frequency.setValueAtTime(f * 1.06, t);
    body.frequency.exponentialRampToValueAtTime(f, t + d * 0.3);
    harmonic.frequency.value = f * 2;
    harmonicGain.gain.value = 0.22;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 170;
    lowpass.Q.value = 0.9;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + d * 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    body.connect(lowpass);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(audio.graph.song.bass);
    for (const oscillator of [body, harmonic]) {
      oscillator.start(t);
      oscillator.stop(t + d + 0.04);
    }
    audio.stemFlash.bass = 0.14;
    audioGraph.releaseVoice(body, gain, [harmonic, harmonicGain, lowpass]);
  }
  /**
   * Reese bass: two saws a few cents apart over a sub sine, saturated, with a filter that closes
   * over the note. The growl of rolling techno basslines.
   */
  function eReese(t, note, d, v, cut = 900, resonance = 2) {
    const f = audioMath.midi(note),
      sources = [],
      lowpass = audio.context.createBiquadFilter(),
      shaper = audio.context.createWaveShaper(),
      gain = audio.context.createGain(),
      sub = audio.context.createOscillator(),
      subGain = audio.context.createGain();
    for (const cents of [-9, 9]) {
      const saw = audio.context.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = f * 2;
      saw.detune.value = cents;
      saw.connect(lowpass);
      sources.push(saw);
    }
    sub.type = 'sine';
    sub.frequency.value = f;
    subGain.gain.value = 0.9;
    sub.connect(subGain);
    subGain.connect(shaper);
    lowpass.type = 'lowpass';
    lowpass.Q.value = resonance;
    lowpass.frequency.setValueAtTime(cut, t);
    lowpass.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.28), t + d);
    shaper.curve = DRIVE;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.008);
    gain.gain.setValueAtTime(v, t + d * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
    lowpass.connect(shaper);
    shaper.connect(gain);
    gain.connect(audio.graph.song.bass);
    for (const oscillator of [...sources, sub]) {
      oscillator.start(t);
      oscillator.stop(t + d + 0.06);
    }
    audio.stemFlash.bass = 0.14;
    audioGraph.releaseVoice(sources[0], gain, [sources[1], sub, subGain, lowpass, shaper]);
  }
  /** Warehouse air: slow-moving filtered noise in stereo, the sound of a big, empty room. */
  function eAtmos(t, d, v, hz = 500) {
    const left = audioGraph.nsrc(t, d + 0.05, 0.1),
      right = audioGraph.nsrc(t, d + 0.05, 0.6),
      leftPan = audio.context.createStereoPanner(),
      rightPan = audio.context.createStereoPanner(),
      mix = audio.context.createGain(),
      band = audio.context.createBiquadFilter(),
      gain = audio.context.createGain();
    leftPan.pan.value = -0.7;
    rightPan.pan.value = 0.7;
    band.type = 'bandpass';
    band.Q.value = 1.3;
    band.frequency.setValueAtTime(hz, t);
    band.frequency.exponentialRampToValueAtTime(hz * 2.4, t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + d * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    left.connect(leftPan);
    right.connect(rightPan);
    leftPan.connect(mix);
    rightPan.connect(mix);
    mix.connect(band);
    band.connect(gain);
    gain.connect(audio.graph.song.dry);
    audioGraph.feed(gain, 0, 0.45);
    audioGraph.releaseVoice(left, gain, [right, leftPan, rightPan, mix, band]);
  }
  return { eRumble, eReese, eAtmos };
}
