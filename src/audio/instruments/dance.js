import { createSupersaw } from './supersaw.js';
export function createDance({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });
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
  /** Stereo supersaw stab; short `d` is a plucked hit, long `d` a sustained, ducked chord. */
  function eDanceChord(t, notes, d, v, color = 0.5, pan = -0.15) {
    superSaw(t, notes, d, v * 1.3, {
      voices: 5,
      detune: 0.9,
      width: 0.8,
      hp: 150,
      cut: [3200 + color * 4200, 700 + color * 600],
      fall: d + 0.1,
      q: 0.9,
      attack: 0.004,
      sustain: 0.3,
      release: 0.18,
      pan,
      delaySend: 0.07,
      reverbSend: 0.08,
    });
  }
  /** Short, detuned saw/pulse lead for the electro call and reply. */
  function eDanceLead(t, n, d, v, color = 0.5, pan = 0.1) {
    superSaw(t, [n], d, v, {
      voices: 3,
      detune: 0.85,
      width: 0.45,
      pulse: color < 0.35,
      hp: 140,
      cut: [3000 + color * 4000, 600 + color * 700],
      fall: d + 0.07,
      q: 1.1,
      attack: 0.003,
      sustain: 0.25,
      release: 0.1,
      pan,
      delaySend: 0.1,
      reverbSend: 0.06,
    });
  }
  return { eDanceBass, eDanceChord, eDanceLead };
}
