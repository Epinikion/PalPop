import { createSupersaw } from './supersaw.js';

/**
 * Voice presets of the hard-dance songs: how a stab, an arpeggio note or the lead is voiced for
 * each style. A preset is a bundle of `superSaw` options; the arrangement only picks a name.
 */
const STAB = {
  rave: {
    voices: 5,
    detune: 0.9,
    width: 0.85,
    hp: 220,
    cut: [4200, 700],
    q: 3.2,
    drive: 2.4,
    delaySend: 0.5,
    reverbSend: 0.14,
  },
  euphoric: {
    voices: 7,
    detune: 1.0,
    width: 0.9,
    hp: 320,
    cut: [5200, 1800],
    q: 1.2,
    drive: 1.4,
    delaySend: 0.3,
    reverbSend: 0.2,
  },
  melodic: {
    voices: 5,
    detune: 0.8,
    width: 0.8,
    hp: 240,
    cut: [3600, 900],
    q: 2.2,
    drive: 1.6,
    delaySend: 0.45,
    reverbSend: 0.22,
  },
  anthem: {
    voices: 7,
    detune: 1.1,
    width: 0.8,
    hp: 200,
    cut: [4800, 1500],
    q: 1.8,
    drive: 1.8,
    delaySend: 0.25,
    reverbSend: 0.14,
  },
};
const ARP = {
  rave: {
    voices: 3,
    detune: 0.8,
    width: 0.6,
    hp: 300,
    cut: [3600, 1400],
    q: 3.4,
    drive: 1.8,
    delaySend: 0.4,
    reverbSend: 0.1,
    pulse: true,
  },
  euphoric: {
    voices: 3,
    detune: 0.9,
    width: 0.7,
    hp: 320,
    cut: [4400, 1700],
    q: 2.4,
    drive: 1.5,
    delaySend: 0.38,
    reverbSend: 0.12,
    pulse: true,
  },
  melodic: {
    voices: 3,
    detune: 0.7,
    width: 0.7,
    hp: 300,
    cut: [4800, 1800],
    q: 3,
    drive: 1.4,
    delaySend: 0.42,
    reverbSend: 0.16,
    pulse: true,
  },
  anthem: {
    voices: 3,
    detune: 0.7,
    width: 0.45,
    hp: 280,
    cut: [4200, 1300],
    q: 3.6,
    drive: 2,
    delaySend: 0.3,
    reverbSend: 0.08,
    pulse: true,
  },
};

export function createGenVoices({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });

  /**
   * A short, wide chord hit. `o.filter` (0 to 1, a slow drift in the song) opens or closes the
   * filter, so the same stab breathes from bar to bar.
   */
  function eRave(t, notes, d, v, o = {}) {
    const { style = 'rave', filter = 0.5, pan = 0 } = o,
      preset = STAB[style],
      open = 0.65 + 0.7 * filter;
    superSaw(t, notes, d, v, {
      ...preset,
      cut: [Math.min(6200, preset.cut[0] * open), preset.cut[1] * open],
      fall: Math.max(0.1, d * 0.9),
      attack: 0.004,
      sustain: 0.25,
      release: 0.12,
      pan,
      drift: 3,
    });
  }
  /** One note of a sixteenth-note arpeggio: a bright, plucked saw stack with a quick filter fall. */
  function eArp(t, note, d, v, o = {}) {
    const { style = 'rave', filter = 0.5, pan = 0 } = o,
      preset = ARP[style],
      open = 0.7 + 0.6 * filter;
    superSaw(t, [note], d, v, {
      ...preset,
      cut: [Math.min(6000, preset.cut[0] * open), preset.cut[1] * open],
      fall: Math.max(0.06, d),
      attack: 0.003,
      sustain: 0.18,
      release: 0.06,
      pan,
      drift: 3,
    });
  }
  /** The lead: seven detuned saws that glide in from the previous note, held and then released. */
  function eAnthem(t, note, d, v, o = {}) {
    const { style = 'euphoric', from = 0, filter = 0.5 } = o,
      preset = STAB[style];
    superSaw(t, [note], d, v, {
      ...preset,
      voices: 7,
      cut: [Math.min(6200, preset.cut[0] * (0.7 + 0.6 * filter)), preset.cut[1]],
      fall: d,
      attack: 0.01,
      sustain: 0.85,
      release: 0.18,
      pan: 0.1,
      from,
      glide: 0.07,
      drift: 3,
      delaySend: 0.35,
      reverbSend: 0.25,
    });
  }

  /**
   * The rolling bass: a sine for the weight and a saw for the edge, saturated together and
   * closed by a low-pass, short enough to leave room for the kick that follows. It sits on the
   * bass bus, which every kick ducks completely.
   */
  function eRoll(t, note, d, v, o = {}) {
    const { color = 0.5 } = o,
      ctx = audio.context,
      hz = audioMath.midi(note),
      end = t + d,
      sine = ctx.createOscillator(),
      saw = ctx.createOscillator(),
      sineGain = ctx.createGain(),
      sawGain = ctx.createGain(),
      shaper = ctx.createWaveShaper(),
      lowpass = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    sine.type = 'sine';
    sine.frequency.value = hz;
    saw.type = 'sawtooth';
    saw.frequency.value = hz;
    saw.detune.value = -4;
    sineGain.gain.value = 1;
    sawGain.gain.value = 0.34 + color * 0.4;
    shaper.curve = rollCurve;
    shaper.oversample = '2x';
    lowpass.type = 'lowpass';
    lowpass.Q.value = 1.4;
    lowpass.frequency.setValueAtTime(380 + color * 900, t);
    lowpass.frequency.exponentialRampToValueAtTime(160 + color * 120, end);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.004);
    gain.gain.setValueAtTime(v, t + Math.max(0.006, d * 0.5));
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.015);
    sine.connect(sineGain);
    saw.connect(sawGain);
    sineGain.connect(shaper);
    sawGain.connect(shaper);
    shaper.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(audio.graph.song.bass);
    sine.start(t);
    saw.start(t);
    sine.stop(end + 0.04);
    saw.stop(end + 0.04);
    audioGraph.releaseVoice(sine, gain, [saw, sineGain, sawGain, shaper, lowpass]);
    audio.stemFlash.bass = 0.14;
  }
  return { eRave, eArp, eAnthem, eRoll };
}

const rollCurve = (() => {
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i++)
    curve[i] = Math.tanh(((i * 2) / (curve.length - 1) - 1) * 2.6) / Math.tanh(2.6);
  return curve;
})();
