/**
 * The synths behind the melodic loops. They are not played live: `stems.js` renders a whole loop
 * through them once per track, into an OfflineAudioContext, and the song plays the result like a
 * sample. That frees them to be as heavy as a studio synth - free-running unison oscillators,
 * 24 dB filters with their own envelopes, oversampled saturation - at no cost while the game runs.
 *
 * Every function schedules its notes into `context` and connects to `out`; notes are
 * `{ time, dur, note | notes, vel }` in seconds and MIDI numbers.
 */

const hz = (note) => 440 * 2 ** ((note - 69) / 12);

/** Sawtooth waves with their phase shifted: unison voices that do not all start together. */
const waveBanks = new WeakMap();
function sawWave(context, index) {
  if (!waveBanks.has(context)) {
    const waves = [];
    for (let v = 0; v < 12; v++) {
      const size = 256,
        real = new Float32Array(size),
        imag = new Float32Array(size),
        phase = (v * 0.618034) % 1;
      for (let k = 1; k < size; k++) {
        const amp = 2 / (Math.PI * k),
          angle = 2 * Math.PI * k * phase;
        real[k] = amp * Math.sin(angle);
        imag[k] = amp * Math.cos(angle);
      }
      waves.push(context.createPeriodicWave(real, imag));
    }
    waveBanks.set(context, waves);
  }
  const waves = waveBanks.get(context);
  return waves[index % waves.length];
}

const curves = new Map();
/** A gentle tanh curve: warmth and density without audible distortion. */
function warmth(context, drive) {
  if (!curves.has(drive)) {
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++)
      curve[i] = Math.tanh(((i * 2) / (curve.length - 1) - 1) * drive) / Math.tanh(drive);
    curves.set(drive, curve);
  }
  const shaper = context.createWaveShaper();
  shaper.curve = curves.get(drive);
  shaper.oversample = '2x';
  return shaper;
}

/** Two lowpass filters in series: the steep, smooth 24 dB slope of an analogue synth's filter. */
function lowpass24(context, q = 0.6) {
  const a = context.createBiquadFilter(),
    b = context.createBiquadFilter();
  a.type = b.type = 'lowpass';
  a.Q.value = q;
  b.Q.value = 0.5;
  a.connect(b);
  return { input: a, output: b, params: [a.frequency, b.frequency] };
}

/** Cutoff envelope: from `peak` to `rest` over `fall` seconds, on both filters of a 24 dB pair. */
function sweep(filter, t, peak, rest, fall, attack = 0.002) {
  for (const param of filter.params) {
    param.setValueAtTime(rest, Math.max(0, t - 0.001));
    param.linearRampToValueAtTime(peak, t + attack);
    param.setTargetAtTime(rest, t + attack, fall / 3);
  }
}

/** Amplitude envelope with a click-free attack and release. */
function envelope(
  gain,
  t,
  dur,
  level,
  { attack = 0.004, decay = 0.2, sustain = 0.8, release = 0.15 },
) {
  const g = gain.gain;
  g.setTargetAtTime(0, Math.max(0, t - 0.004), 0.001);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(level, t + attack);
  g.setTargetAtTime(level * sustain, t + attack, decay / 3);
  const end = t + Math.max(dur, attack + 0.01);
  g.setTargetAtTime(0, end, release / 4);
  return end + release * 1.6;
}

/** Detune (cents) of each unison voice, spread wider at the edges like the classic supersaw. */
const SPREAD = {
  1: [0],
  2: [-8, 8],
  3: [-12, 0, 12],
  5: [-22, -10, 0, 10, 22],
  7: [-27, -16, -6, 0, 6, 16, 27],
};

/**
 * A stack of free-running saws per note, spread across the stereo field, into a 24 dB filter with
 * an envelope, a little warmth, and an amplitude envelope.
 */
/**
 * A fixed set of voices, like a polyphonic synth: each note takes the voice that has been free the
 * longest. The filter and amplifier of a voice are shared by all the notes it plays, so a loop of a
 * hundred notes costs a handful of filter chains instead of a hundred.
 */
function voicePool(count, build) {
  const voices = Array.from({ length: count }, () => ({ ...build(), free: 0 }));
  return (start, end) => {
    const voice =
      voices.find((v) => v.free <= start) || voices.reduce((a, b) => (a.free < b.free ? a : b));
    voice.free = end;
    return voice;
  };
}

function stack(context, out, notes, o) {
  const {
    voices = 7,
    detune = 1,
    width = 0.8,
    square = 0,
    sub = 0,
    q = 0.6,
    peak = 6000,
    rest = 2500,
    fall = 0.3,
    drive = 1.3,
    highpass = 150,
    amp = {},
    seed = 0,
    polyphony = 6,
  } = o;
  // One warmth stage and one low cut for the whole loop: the notes are summed first, as on a
  // synth's output.
  const shaper = warmth(context, drive),
    hp = context.createBiquadFilter(),
    chordSize = Math.max(1, ...notes.map((n) => n.notes?.length || 1)),
    level = 1 / Math.sqrt(voices * chordSize);
  hp.type = 'highpass';
  hp.frequency.value = highpass;
  shaper.connect(hp);
  hp.connect(out);
  const take = voicePool(polyphony, () => {
    const filter = lowpass24(context, q),
      gain = context.createGain(),
      left = context.createGain(),
      right = context.createGain(),
      centre = context.createGain(),
      leftPan = context.createStereoPanner(),
      rightPan = context.createStereoPanner();
    leftPan.pan.value = -width;
    rightPan.pan.value = width;
    left.gain.value = right.gain.value = centre.gain.value = level;
    gain.gain.value = 0;
    left.connect(leftPan);
    right.connect(rightPan);
    leftPan.connect(filter.input);
    rightPan.connect(filter.input);
    centre.connect(filter.input);
    filter.output.connect(gain);
    gain.connect(shaper);
    return { filter, gain, left, right, centre };
  });
  let index = seed % 997;
  for (const n of notes) {
    const release = amp.release ?? 0.15,
      voice = take(n.time, n.time + n.dur + release * 1.8);
    sweep(voice.filter, n.time, peak, rest, fall);
    const end = envelope(voice.gain, n.time, n.dur, n.vel ?? 1, amp);
    for (const pitch of n.notes || [n.note]) {
      for (const cents of SPREAD[voices]) {
        const osc = context.createOscillator();
        osc.setPeriodicWave(sawWave(context, index++));
        osc.frequency.value = hz(pitch);
        osc.detune.value = cents * detune + ((index * 7) % 5) - 2;
        osc.connect(cents < 0 ? voice.left : cents > 0 ? voice.right : voice.centre);
        osc.start(Math.max(0, n.time - 0.002));
        osc.stop(end);
      }
      for (const [type, amount, ratio] of [
        ['square', square, square < 0 ? 0.5 : 1],
        ['sine', sub, 0.5],
      ]) {
        if (!amount) continue;
        const osc = context.createOscillator(),
          g = context.createGain();
        osc.type = type;
        osc.frequency.value = hz(pitch) * ratio;
        g.gain.value = Math.abs(amount) * 2;
        osc.connect(g);
        g.connect(voice.centre);
        osc.start(n.time);
        osc.stop(end);
      }
    }
  }
}

/** The patches: how each kind of loop is voiced. `bright` (0-1) and `detune` vary per track. */
export const PATCHES = {
  // Leads and hooks.
  supersaw: (b, d) => ({
    voices: 7,
    detune: d,
    width: 0.85,
    peak: 10000 + 4000 * b,
    rest: 6000 + 3000 * b,
    fall: 0.25,
    drive: 1.4,
    highpass: 180,
    amp: { attack: 0.006, decay: 0.3, sustain: 0.85, release: 0.22 },
  }),
  rave: (b, d) => ({
    voices: 5,
    detune: 0.8 * d,
    width: 0.6,
    square: 0.35,
    q: 1.8,
    peak: 9000 + 3000 * b,
    rest: 3800 + 1600 * b,
    fall: 0.18,
    drive: 2.8,
    highpass: 160,
    amp: { attack: 0.003, decay: 0.18, sustain: 0.55, release: 0.1 },
  }),
  bright: (b, d) => ({
    voices: 3,
    detune: 0.7 * d,
    width: 0.5,
    square: 0.4,
    q: 1.4,
    peak: 6500 + 2500 * b,
    rest: 800 + 400 * b,
    fall: 0.16,
    drive: 1.4,
    highpass: 200,
    amp: { attack: 0.002, decay: 0.22, sustain: 0.25, release: 0.12 },
  }),
  pluck: (b, d) => ({
    voices: 3,
    detune: 0.6 * d,
    width: 0.55,
    q: 1.6,
    peak: 7000 + 3000 * b,
    rest: 900 + 500 * b,
    fall: 0.2,
    drive: 1.3,
    highpass: 180,
    amp: { attack: 0.002, decay: 0.3, sustain: 0.2, release: 0.15 },
  }),
  soft: (b, d) => ({
    voices: 3,
    detune: 0.5 * d,
    width: 0.6,
    q: 1.1,
    peak: 3000 + 1500 * b,
    rest: 600 + 300 * b,
    fall: 0.25,
    drive: 1.2,
    highpass: 220,
    amp: { attack: 0.003, decay: 0.35, sustain: 0.15, release: 0.2 },
  }),
  // Pads.
  wall: (b, d) => ({
    voices: 5,
    detune: d,
    width: 0.9,
    peak: 8000 + 3000 * b,
    rest: 6000 + 3000 * b,
    fall: 0.6,
    drive: 1.3,
    highpass: 200,
    amp: { attack: 0.08, decay: 0.6, sustain: 0.9, release: 0.6 },
  }),
  warm: (b, d) => ({
    voices: 5,
    detune: 0.8 * d,
    width: 0.9,
    peak: 2200 + 1200 * b,
    rest: 1600 + 900 * b,
    fall: 1.2,
    drive: 1.1,
    highpass: 180,
    amp: { attack: 0.7, decay: 1, sustain: 0.9, release: 1.2 },
  }),
  dark: (b, d) => ({
    voices: 5,
    detune: 1.1 * d,
    width: 0.9,
    peak: 4200 + 1800 * b,
    rest: 3200 + 1400 * b,
    fall: 1.5,
    drive: 1.8,
    highpass: 150,
    amp: { attack: 1.1, decay: 1, sustain: 0.9, release: 1.4 },
  }),
  airy: (b, d) => ({
    voices: 5,
    detune: 0.7 * d,
    width: 0.85,
    peak: 2600 + 1200 * b,
    rest: 1900 + 900 * b,
    fall: 0.8,
    drive: 1.1,
    highpass: 200,
    amp: { attack: 0.3, decay: 0.8, sustain: 0.9, release: 0.9 },
  }),
  // Stabs.
  stab: (b, d) => ({
    voices: 5,
    detune: 0.9 * d,
    width: 0.8,
    q: 1.2,
    peak: 6500 + 2500 * b,
    rest: 1800 + 800 * b,
    fall: 0.16,
    drive: 1.6,
    highpass: 260,
    amp: { attack: 0.003, decay: 0.2, sustain: 0.3, release: 0.15 },
  }),
};

/**
 * The bass: one saw and a sine an octave below it for the weight, warmed before a 24 dB filter
 * whose envelope gives every note its pluck. Mono, and centred.
 */
export function bassLine(context, out, notes, kind = 'roll', bright = 0.5) {
  const shape = {
    roll: { peak: 900 + 600 * bright, rest: 240, fall: 0.07, release: 0.03, sub: 0.9, square: 0 },
    deep: { peak: 650 + 400 * bright, rest: 200, fall: 0.1, release: 0.05, sub: 1, square: 0.3 },
    offbeat: {
      peak: 1300 + 700 * bright,
      rest: 320,
      fall: 0.11,
      release: 0.06,
      sub: 0.8,
      square: 0.5,
    },
  }[kind];
  const take = voicePool(3, () => {
    const sawGain = context.createGain(),
      sqGain = context.createGain(),
      sineGain = context.createGain(),
      shaper = warmth(context, 1.6),
      filter = lowpass24(context, 1),
      gain = context.createGain();
    sawGain.gain.value = 0.5;
    sqGain.gain.value = 0.35 * shape.square;
    sineGain.gain.value = 0.6 * shape.sub;
    gain.gain.value = 0;
    sawGain.connect(shaper);
    sqGain.connect(shaper);
    shaper.connect(filter.input);
    filter.output.connect(gain);
    sineGain.connect(gain);
    gain.connect(out);
    return { sawGain, sqGain, sineGain, filter, gain };
  });
  for (const n of notes) {
    const f = hz(n.note),
      voice = take(n.time, n.time + n.dur + shape.release * 1.8);
    sweep(voice.filter, n.time, shape.peak, shape.rest, shape.fall);
    const end = envelope(voice.gain, n.time, n.dur, (n.vel ?? 1) * 0.8, {
      attack: 0.003,
      decay: 0.12,
      sustain: 0.85,
      release: shape.release,
    });
    for (const [type, target] of [
      ['sawtooth', voice.sawGain],
      ['square', shape.square ? voice.sqGain : null],
      ['sine', voice.sineGain],
    ]) {
      if (!target) continue;
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.connect(target);
      osc.start(n.time);
      osc.stop(end);
    }
  }
}

/** Plays a loop's notes through a patch (see PATCHES). */
export function synthLine(context, out, notes, patch, bright = 0.5, detune = 1, seed = 0) {
  const make = PATCHES[patch] || PATCHES.pluck;
  stack(context, out, notes, { ...make(bright, detune), seed });
}
