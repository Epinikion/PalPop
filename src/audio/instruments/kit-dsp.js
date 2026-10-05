import { mulberry32 } from '../../core/math.js';

/**
 * Drum hits rendered once, sample by sample, instead of being assembled from live oscillators.
 * Pure functions of the sample rate (and fixed seeds), so every run of the kit is identical and
 * Node can measure it. A bank holds a few variants of each drum so repeated hits never sound
 * machined.
 */
const TAU = Math.PI * 2;

/** Second-order filter (RBJ cookbook) applied to a whole buffer; returns a new buffer. */
export function filter(type, hz, q, buffer, sampleRate) {
  const w = (TAU * hz) / sampleRate,
    alpha = Math.sin(w) / (2 * q),
    cos = Math.cos(w);
  let b0, b1, b2;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha,
    a1 = (-2 * cos) / a0,
    a2 = (1 - alpha) / a0,
    out = new Float32Array(buffer.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < buffer.length; i++) {
    const x = buffer[i],
      y = (b0 / a0) * x + (b1 / a0) * x1 + (b2 / a0) * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}
const noise = (random, length) => Float32Array.from({ length }, () => random() * 2 - 1);
const decay = (t, time) => Math.exp(-t / time);
/** Soft saturation: adds odd harmonics, which is what gives a techno kick its bite. */
const saturate = (buffer, drive) => {
  const scale = Math.tanh(drive);
  for (let i = 0; i < buffer.length; i++) buffer[i] = Math.tanh(drive * buffer[i]) / scale;
  return buffer;
};
/** Peak-normalises and fades the last few milliseconds, so no hit ends in a click. */
function finish(buffer, sampleRate, peak = 0.9) {
  let max = 0;
  for (const value of buffer) max = Math.max(max, Math.abs(value));
  const fade = Math.floor(sampleRate * 0.006);
  for (let i = 0; i < buffer.length; i++) {
    const tail = Math.min(1, (buffer.length - i) / fade);
    buffer[i] *= (peak / (max || 1)) * tail;
  }
  return buffer;
}
const add = (target, source, gain = 1, offset = 0) => {
  for (let i = 0; i < source.length && i + offset < target.length; i++)
    target[i + offset] += source[i] * gain;
  return target;
};

/** Kick: a pitch-dropping sine into saturation, a short click and a long, low tail. */
function kick(
  sampleRate,
  { start, end, drop, fast, slow, mixSlow, drive, click, length, knock, tone = 7000 },
  random,
) {
  const out = new Float32Array(Math.floor(sampleRate * length));
  let phase = 0,
    knockPhase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate,
      hz = end + (start - end) * decay(t, drop);
    phase += (TAU * hz) / sampleRate;
    // The knock: a short, higher sine that saturation fuses with the body into one hard thump.
    knockPhase += (TAU * (130 + 330 * decay(t, 0.012))) / sampleRate;
    const attack = 1 - Math.exp(-t / 0.0006),
      envelope = attack * ((1 - mixSlow) * decay(t, fast) + mixSlow * decay(t, slow));
    out[i] = Math.sin(phase) * envelope + knock * Math.sin(knockPhase) * attack * decay(t, 0.028);
  }
  saturate(out, drive);
  const snap = noise(random, Math.floor(sampleRate * 0.012));
  for (let i = 0; i < snap.length; i++) snap[i] *= decay(i / sampleRate, 0.0016);
  add(out, filter('highpass', 2200, 0.7, snap, sampleRate), click);
  // The tone filter decides how much of the distortion is heard: a clean kick keeps only its
  // weight and click, a hard one lets its harmonics sweep down through the mids.
  return finish(
    filter('highpass', 24, 0.7, filter('lowpass', tone, 0.7, out, sampleRate), sampleRate),
    sampleRate,
  );
}
/** Clap: three quick noise bursts and a longer tail through a band, with short early reflections. */
function clap(sampleRate, { tail, centre, reflections }, random) {
  const out = new Float32Array(Math.floor(sampleRate * (0.12 + tail * 4))),
    raw = noise(random, out.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let envelope = 0;
    for (const [at, level] of [
      [0, 0.8],
      [0.0095, 0.7],
      [0.019, 0.85],
    ])
      if (t >= at) envelope += level * decay(t - at, 0.0055);
    if (t >= 0.0285) envelope += decay(t - 0.0285, tail);
    out[i] = raw[i] * envelope;
  }
  let body = filter('bandpass', centre, 1.1, out, sampleRate);
  body = filter('highpass', 380, 0.7, body, sampleRate);
  for (const [at, level] of reflections)
    add(body, body.slice(), level, Math.floor(sampleRate * at));
  return finish(body, sampleRate);
}
/** Rimshot: two short tones and a click. */
function rim(sampleRate, { high, low }, random) {
  const out = new Float32Array(Math.floor(sampleRate * 0.18)),
    snap = noise(random, out.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    out[i] =
      0.7 * Math.sin(TAU * high * t) * decay(t, 0.011) +
      0.55 * Math.sin(TAU * low * t) * decay(t, 0.02) +
      0.35 * snap[i] * decay(t, 0.0025);
  }
  return finish(filter('highpass', 300, 0.7, out, sampleRate), sampleRate);
}
const METALS = [205.3, 304.4, 369.6, 522.7, 540, 800];
/** Metallic cluster (six detuned squares, the classic cymbal recipe) through high bands. */
function metal(sampleRate, { scale, time, quick, length, band, low, grit }, random) {
  const out = new Float32Array(Math.floor(sampleRate * length)),
    dust = noise(random, out.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    let sum = 0;
    for (const hz of METALS) sum += Math.sin(TAU * hz * scale * t) >= 0 ? 1 : -1;
    const envelope = quick ? 0.55 * decay(t, time * 0.25) + 0.45 * decay(t, time) : decay(t, time);
    out[i] = (sum / METALS.length + dust[i] * grit) * envelope;
  }
  return finish(
    filter('highpass', low, 0.7, filter('bandpass', band, 0.8, out, sampleRate), sampleRate),
    sampleRate,
  );
}
/** Tom or conga: a sine that falls quickly into its pitch. */
function tom(sampleRate, { hz, length, time }, random) {
  const out = new Float32Array(Math.floor(sampleRate * length)),
    snap = noise(random, out.length);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    phase += (TAU * hz * (1 + 0.55 * decay(t, 0.028))) / sampleRate;
    out[i] = Math.sin(phase) * decay(t, time) + 0.18 * snap[i] * decay(t, 0.003);
  }
  return finish(saturate(out, 1.4), sampleRate);
}
/** Tuned metal hit: frequency modulation with a quickly fading index, like struck steel. */
function ping(sampleRate, { hz, time }) {
  const out = new Float32Array(Math.floor(sampleRate * 0.5));
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate,
      index = 4.5 * decay(t, 0.045);
    out[i] = Math.sin(TAU * hz * t + index * Math.sin(TAU * hz * 1.4142 * t)) * decay(t, time);
  }
  return finish(out, sampleRate);
}
/** Industrial hit: saturated noise through a band, short and rough. */
function blast(sampleRate, { time, centre }, random) {
  const raw = noise(random, Math.floor(sampleRate * 0.4)),
    out = raw.map((value, i) => value * decay(i / sampleRate, time));
  saturate(out, 4);
  return finish(
    filter('bandpass', centre, 0.6, filter('highpass', 900, 0.7, out, sampleRate), sampleRate),
    sampleRate,
  );
}
/** Snare for fills and rolls: a tuned shell and a snappy noise band. */
function snare(sampleRate, { hz, time }, random) {
  const out = new Float32Array(Math.floor(sampleRate * 0.35)),
    raw = noise(random, out.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    out[i] =
      0.55 * Math.sin(TAU * hz * (1 + 0.3 * decay(t, 0.02)) * t) * decay(t, 0.05) +
      raw[i] * decay(t, time);
  }
  return finish(
    filter('highpass', 180, 0.7, filter('bandpass', 3200, 0.5, out, sampleRate), sampleRate),
    sampleRate,
  );
}
/** Soft, short shaker burst. */
function shaker(sampleRate, { centre }, random) {
  const out = new Float32Array(Math.floor(sampleRate * 0.09)),
    raw = noise(random, out.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    out[i] = raw[i] * (1 - Math.exp(-t / 0.006)) * decay(t, 0.022);
  }
  return finish(filter('bandpass', centre, 0.9, out, sampleRate), sampleRate);
}

/** The frequency every kick variant settles on: the kit retunes it with `playbackRate`. */
export const KICK_HZ = 46;
/** Bass notes (MIDI) a kick is tuned to, per key (pitch class 0-11): F#1 to B1, 46-62 Hz. */
const KICK_NOTES = [31, 32, 33, 34, 35, 34, 30, 31, 32, 33, 34, 35];
/**
 * The kick's fundamental for a key: the root itself where it lies in the range a kick carries and
 * sits well on small speakers, otherwise its fifth (or for F its fourth), all consonant with the bass.
 */
export function kickTuning(pc) {
  return 440 * 2 ** ((KICK_NOTES[pc] - 69) / 12);
}
/** Renders every drum of the kit. Variants are fixed, so the result depends only on the rate. */
const DRUMS = (() => {
  const make = (variants, render) => ({ variants, render });
  return {
    kick: make(
      [
        // Clean: a fast pitch fall, a short click and nothing above the low mids - the trance and
        // Eurodance kick, which leaves the mids to the synths.
        {
          start: 170,
          end: KICK_HZ,
          drop: 0.018,
          fast: 0.12,
          slow: 0.24,
          mixSlow: 0.35,
          drive: 1.8,
          click: 0.14,
          knock: 0.05,
          tone: 1200,
          length: 0.5,
        },
        // Punch: a little more knock and bite, the melodic techno kick.
        {
          start: 210,
          end: KICK_HZ,
          drop: 0.016,
          fast: 0.09,
          slow: 0.2,
          mixSlow: 0.3,
          drive: 2.4,
          click: 0.2,
          knock: 0.35,
          tone: 3000,
          length: 0.5,
        },
        // Hard: a slower sweep into heavy distortion and a long tail, whose harmonics fall through
        // the mids - the hard-techno kick that feeds the rumble.
        {
          start: 320,
          end: KICK_HZ,
          drop: 0.035,
          fast: 0.16,
          slow: 0.4,
          mixSlow: 0.55,
          drive: 5.5,
          click: 0.25,
          knock: 0.4,
          tone: 7000,
          length: 0.75,
        },
        // Round: a long, soft body for quiet passages.
        {
          start: 150,
          end: KICK_HZ - 2,
          drop: 0.028,
          fast: 0.12,
          slow: 0.3,
          mixSlow: 0.45,
          drive: 2,
          click: 0.1,
          knock: 0.2,
          tone: 1400,
          length: 0.7,
        },
      ],
      kick,
    ),
    clap: make(
      [
        {
          tail: 0.07,
          centre: 1150,
          reflections: [
            [0.013, 0.2],
            [0.029, 0.12],
          ],
        },
        {
          tail: 0.1,
          centre: 1050,
          reflections: [
            [0.017, 0.22],
            [0.034, 0.14],
            [0.05, 0.08],
          ],
        },
        {
          tail: 0.13,
          centre: 1250,
          reflections: [
            [0.011, 0.18],
            [0.023, 0.12],
            [0.041, 0.09],
          ],
        },
      ],
      clap,
    ),
    rim: make(
      [
        { high: 1750, low: 520 },
        { high: 1900, low: 610 },
      ],
      rim,
    ),
    hat: make(
      [
        { scale: 0.96, time: 0.014, quick: false, length: 0.14, band: 9500, low: 7000, grit: 0.25 },
        { scale: 1.02, time: 0.019, quick: false, length: 0.16, band: 10500, low: 7500, grit: 0.2 },
        { scale: 1.07, time: 0.011, quick: false, length: 0.12, band: 11000, low: 8000, grit: 0.3 },
        { scale: 0.99, time: 0.024, quick: false, length: 0.18, band: 9000, low: 6500, grit: 0.2 },
      ],
      metal,
    ),
    open: make(
      [
        { scale: 1, time: 0.075, quick: true, length: 0.35, band: 9500, low: 6500, grit: 0.15 },
        { scale: 1.04, time: 0.09, quick: true, length: 0.4, band: 10000, low: 6800, grit: 0.12 },
      ],
      metal,
    ),
    ride: make(
      [{ scale: 1.12, time: 0.38, quick: false, length: 1.2, band: 7500, low: 4200, grit: 0.12 }],
      metal,
    ),
    crash: make(
      [
        { scale: 0.92, time: 0.62, quick: true, length: 2.4, band: 6500, low: 3000, grit: 0.55 },
        { scale: 0.97, time: 0.34, quick: true, length: 1.5, band: 7000, low: 3400, grit: 0.5 },
      ],
      metal,
    ),
    tom: make(
      [
        { hz: 96, length: 0.45, time: 0.15 },
        { hz: 132, length: 0.4, time: 0.13 },
        { hz: 176, length: 0.35, time: 0.11 },
      ],
      tom,
    ),
    ping: make(
      [
        { hz: 640, time: 0.12 },
        { hz: 920, time: 0.1 },
        { hz: 1310, time: 0.09 },
      ],
      ping,
    ),
    blast: make(
      [
        { time: 0.09, centre: 2600 },
        { time: 0.14, centre: 1800 },
      ],
      blast,
    ),
    snare: make(
      [
        { hz: 190, time: 0.07 },
        { hz: 215, time: 0.055 },
      ],
      snare,
    ),
    shaker: make([{ centre: 7200 }, { centre: 8200 }], shaker),
  };
})();
/** The drums the kit holds. */
export const DRUM_NAMES = Object.keys(DRUMS);
/** Renders one drum's variants. Each drum has its own fixed seed, so drums can be built lazily. */
export function renderDrum(name, sampleRate) {
  const { variants, render } = DRUMS[name],
    random = mulberry32(0x7ec4a11 + DRUM_NAMES.indexOf(name) * 7919);
  return variants.map((spec) => render(sampleRate, spec, random));
}
/** Renders every drum of the kit. Variants are fixed, so the result depends only on the rate. */
export function renderKit(sampleRate) {
  return Object.fromEntries(DRUM_NAMES.map((name) => [name, renderDrum(name, sampleRate)]));
}
