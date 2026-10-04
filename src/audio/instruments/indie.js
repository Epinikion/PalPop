/**
 * The two voices that make the indie-dance style sound like itself: a soft, bell-edged electric
 * piano for the chord stabs and a round, short bass that plays between the kicks.
 */
export function createIndie({ audio, audioGraph, audioMath }) {
  /**
   * Electric piano by phase modulation: a body that mellows as the key rings, a short bright
   * "tine" at the attack, a gentle low-pass and a little stereo spread across the chord.
   */
  function eRhodes(t, notes, d, v, color = 0.5, pan = 0, cents = 0) {
    const ctx = audio.context,
      lowpass = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      position = ctx.createStereoPanner(),
      sources = [],
      extra = [lowpass, gain];
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.5;
    lowpass.frequency.value = 2400 + color * 3400;
    gain.gain.value = (v * 0.5) / Math.sqrt(notes.length);
    position.pan.value = pan;
    const ring = Math.min(2.2, d + 0.7);
    let longest = null,
      longestEnd = 0;
    notes.forEach((note, index) => {
      const at = t + index * 0.006,
        hz = audioMath.midi(note),
        carrier = ctx.createOscillator(),
        body = ctx.createOscillator(),
        tine = ctx.createOscillator(),
        env = ctx.createGain(),
        bodyDepth = ctx.createGain(),
        tineDepth = ctx.createGain(),
        end = at + ring;
      carrier.type = body.type = tine.type = 'sine';
      carrier.frequency.value = hz;
      carrier.detune.value = cents;
      body.frequency.value = hz;
      tine.frequency.value = hz * 14;
      // The body starts bright and settles within half a second; the tine is gone in 50 ms.
      bodyDepth.gain.setValueAtTime(hz * (0.8 + color), at);
      bodyDepth.gain.exponentialRampToValueAtTime(hz * 0.16, at + 0.5);
      tineDepth.gain.setValueAtTime(hz * 0.9, at);
      tineDepth.gain.exponentialRampToValueAtTime(0.01, at + 0.05);
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(1, at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.3, at + 0.55);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      body.connect(bodyDepth);
      bodyDepth.connect(carrier.frequency);
      tine.connect(tineDepth);
      tineDepth.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(lowpass);
      for (const source of [carrier, body, tine]) {
        source.start(at);
        source.stop(end + 0.03);
      }
      if (end > longestEnd) {
        longestEnd = end;
        longest = carrier;
      }
      sources.push(carrier, body, tine);
      extra.push(env, bodyDepth, tineDepth);
    });
    lowpass.connect(gain);
    gain.connect(position);
    position.connect(audio.graph.song.mel);
    audioGraph.feed(position, 0.12, 0.3);
    audioGraph.releaseVoice(
      longest,
      position,
      sources.filter((source) => source !== longest).concat(extra),
    );
    audio.stemFlash.synth = 0.2;
  }

  /**
   * A round, short bass: a sine with a soft second harmonic, saturated a little and closed by a
   * low-pass, so it fills the gap between two kicks without a hard edge. It sits on the bass bus,
   * which the kick ducks completely.
   */
  function eWarmBass(t, note, d, v, color = 0.5) {
    const ctx = audio.context,
      sine = ctx.createOscillator(),
      triangle = ctx.createOscillator(),
      sineGain = ctx.createGain(),
      triangleGain = ctx.createGain(),
      shaper = ctx.createWaveShaper(),
      lowpass = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      hz = audioMath.midi(note),
      end = t + d;
    sine.type = 'sine';
    sine.frequency.value = hz;
    triangle.type = 'triangle';
    triangle.frequency.value = hz * 2;
    sineGain.gain.value = 1;
    triangleGain.gain.value = 0.32 + color * 0.3;
    const curve = new Float32Array(257);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i - 128) / 128) * 1.8);
    shaper.curve = curve;
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.9;
    lowpass.frequency.setValueAtTime(900 + color * 900, t);
    lowpass.frequency.exponentialRampToValueAtTime(260 + color * 160, end);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(v * 0.7, t + d * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.02);
    sine.connect(sineGain);
    triangle.connect(triangleGain);
    sineGain.connect(shaper);
    triangleGain.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(audio.graph.song.bass);
    sine.start(t);
    triangle.start(t);
    sine.stop(end + 0.05);
    triangle.stop(end + 0.05);
    audioGraph.releaseVoice(sine, gain, [triangle, sineGain, triangleGain, shaper, lowpass]);
    audio.stemFlash.bass = 0.14;
  }
  return { eRhodes, eWarmBass };
}
