/** Singing-voice formants as [centre Hz, level dB, bandwidth Hz], after the classic vowel tables. */
export const FORMANTS = {
  alto: {
    a: [
      [800, 0, 80],
      [1150, -4, 90],
      [2800, -15, 120],
      [3500, -28, 130],
    ],
    e: [
      [400, 0, 60],
      [1600, -22, 80],
      [2700, -24, 120],
      [3300, -28, 150],
    ],
    i: [
      [350, 0, 50],
      [1700, -18, 100],
      [2700, -24, 120],
      [3700, -28, 150],
    ],
    o: [
      [450, 0, 70],
      [800, -9, 80],
      [2830, -13, 100],
      [3500, -22, 130],
    ],
    u: [
      [325, 0, 50],
      [700, -12, 60],
      [2530, -25, 170],
      [3500, -32, 180],
    ],
  },
  tenor: {
    a: [
      [650, 0, 80],
      [1080, -6, 90],
      [2650, -7, 120],
      [2900, -8, 130],
    ],
    e: [
      [400, 0, 70],
      [1700, -14, 80],
      [2600, -12, 100],
      [3200, -14, 120],
    ],
    i: [
      [290, 0, 40],
      [1870, -15, 90],
      [2800, -18, 100],
      [3250, -20, 120],
    ],
    o: [
      [400, 0, 40],
      [800, -10, 80],
      [2600, -12, 100],
      [2800, -12, 120],
    ],
    u: [
      [350, 0, 40],
      [600, -20, 60],
      [2700, -17, 100],
      [2900, -14, 120],
    ],
  },
};
/** Consonant and hum states: a strong low formant and little else, as when the lips or tongue close. */
export const CLOSURES = {
  m: [
    [250, 0, 60],
    [1000, -26, 120],
    [2200, -34, 150],
    [3300, -40, 200],
  ],
  n: [
    [260, 0, 60],
    [1500, -24, 150],
    [2500, -30, 150],
    [3300, -38, 200],
  ],
  l: [
    [360, 0, 70],
    [1050, -10, 120],
    [2800, -22, 120],
    [3500, -30, 150],
  ],
};
/**
 * Wordless syllables. `vowels` lists [vowel, position in the note] pairs, so a diphthong glides to
 * its second vowel late in the note; `onset` is a closure the note opens from.
 */
export const SYLLABLES = {
  ah: { vowels: [['a', 0]] },
  oh: {
    vowels: [
      ['o', 0],
      ['u', 0.72],
    ],
  },
  ay: {
    vowels: [
      ['e', 0],
      ['i', 0.7],
    ],
  },
  oo: { vowels: [['u', 0]], soft: true },
  mm: { vowels: [['u', 0]], closure: 'm', hum: true, soft: true },
  na: { vowels: [['a', 0]], onset: 'n' },
  la: { vowels: [['a', 0]], onset: 'l' },
};
const level = (db) => 10 ** (db / 20);
/** Maps the arrangement's level scale onto the voice's output; set by measuring against the piano. */
const LEVEL_SCALE = 0.24;

const HARMONICS = 96;
const TILT = { modal: 1.05, soft: 1.7 };
/** Peak of the harmonic series' waveform, which the oscillator normalises away. */
const peaks = {};
function peakOf(kind) {
  if (!peaks[kind]) {
    let peak = 0;
    for (let i = 0; i < 1024; i++) {
      let sum = 0;
      for (let k = 1; k < HARMONICS; k++)
        sum += Math.sin((2 * Math.PI * k * i) / 1024) / k ** TILT[kind];
      peak = Math.max(peak, Math.abs(sum));
    }
    peaks[kind] = peak;
  }
  return peaks[kind];
}
/**
 * Output power of the voice for one note: the source's harmonics through the parallel formants.
 * Dividing by its square root keeps every vowel and pitch about equally loud at the same level.
 */
function voicePower(pitch, bank, kind, voices) {
  let power = 0;
  for (let k = 1; k < HARMONICS && k * pitch < 12000; k++) {
    const amplitude = 1 / k ** TILT[kind] / peakOf(kind),
      hz = k * pitch;
    let response = 0;
    for (const [centre, db, bandwidth] of bank) {
      const q = centre / bandwidth,
        x = q * (hz / centre - centre / hz);
      response += level(db) ** 2 / (1 + x * x);
    }
    power += (amplitude * amplitude * response) / 2;
  }
  return power * voices;
}

/**
 * A sung voice made of a glottal-like source, a bank of vowel formants, vibrato, breath and a soft
 * onset. It is a synthetic voice, closest to a warm "ooh/ah" singer, not a recording.
 */
export function createVocal({ audio, audioGraph, audioMath }) {
  const waves = new WeakMap();
  /** Harmonic series that falls away smoothly: no buzz, unlike a plain sawtooth. */
  function wave(kind) {
    let set = waves.get(audio.context);
    if (!set) waves.set(audio.context, (set = {}));
    if (!set[kind]) {
      const size = HARMONICS,
        tilt = TILT[kind],
        imag = new Float32Array(size);
      for (let k = 1; k < size; k++) imag[k] = 1 / k ** tilt;
      set[kind] = audio.context.createPeriodicWave(new Float32Array(size), imag);
    }
    return set[kind];
  }
  /** Above the first formant, singers open their mouths so F1 follows the pitch. */
  function tuned(bank, pitch) {
    const tuned = bank.map((formant) => formant.slice());
    if (pitch > tuned[0][0] * 0.85) tuned[0][0] = pitch * 1.04;
    if (tuned[1][0] < tuned[0][0] * 1.4) tuned[1][0] = tuned[0][0] * 1.4;
    return tuned;
  }
  /**
   * @param {number} t start time in seconds
   * @param {number} note MIDI note
   * @param {number} d how long the note is held
   * @param {number} v level
   * @param {object} [o] syllable, type ('alto'/'tenor'), pan, vibrato, breath, from (previous MIDI
   *   note for a legato glide), scoop (semitones to rise from), fall (semitones to fall away),
   *   backing (a cheaper voice for harmonies), cents (intonation), delaySend, reverbSend
   */
  function eVoice(t, note, d, v, o = {}) {
    const {
      syllable = 'ah',
      type = 'alto',
      pan = 0,
      vibrato = 1,
      breath = 1,
      from = null,
      scoop = 0,
      fall = 0,
      backing = false,
      cents = 0,
      delaySend = 0.1,
      reverbSend = 0.22,
    } = o;
    const context = audio.context,
      syl = SYLLABLES[syllable] || SYLLABLES.ah,
      rand = (salt) => audioMath.hashRand(Math.round(t * 1000), salt),
      f0 = audioMath.midi(note),
      attack = syl.hum ? 0.075 : syl.soft ? 0.085 : syl.onset ? 0.065 : 0.05,
      release = Math.min(0.3, 0.12 + d * 0.12),
      end = t + d + release,
      stop = end + 0.05,
      sources = [],
      extra = [],
      excitation = context.createGain(),
      mix = context.createGain(),
      amp = context.createGain(),
      position = context.createStereoPanner();
    // Source: a harmonic series, two voices a few cents apart for a lead, one for backing.
    const offsets = backing ? [0] : [-3.5, 3.5],
      startHz = from !== null ? audioMath.midi(from) : scoop ? f0 * 2 ** (-scoop / 12) : f0;
    for (const offset of offsets) {
      const oscillator = context.createOscillator();
      oscillator.setPeriodicWave(wave(syl.soft ? 'soft' : 'modal'));
      oscillator.detune.value = offset + cents + (rand(2) - 0.5) * 6;
      oscillator.frequency.setValueAtTime(startHz, t);
      if (startHz !== f0)
        oscillator.frequency.exponentialRampToValueAtTime(f0, t + (from !== null ? 0.065 : 0.09));
      if (fall) {
        oscillator.frequency.setValueAtTime(f0, Math.max(t + 0.1, t + d - 0.04));
        oscillator.frequency.exponentialRampToValueAtTime(f0 * 2 ** (-fall / 12), end);
      }
      oscillator.connect(excitation);
      oscillator.start(t);
      oscillator.stop(stop);
      sources.push(oscillator);
    }
    // Vibrato arrives after the note settles, like a singer's, plus a slow, tiny pitch drift.
    const vibratoDepth = (backing ? 14 : 24) * vibrato * (syl.hum ? 0.5 : 1) * (d > 0.45 ? 1 : 0.3),
      wobble = context.createOscillator(),
      wobbleDepth = context.createGain(),
      drift = backing ? null : context.createOscillator(),
      driftDepth = backing ? null : context.createGain(),
      delay = 0.16 + rand(3) * 0.14;
    wobble.frequency.value = 5.1 + rand(4) * 0.7;
    wobbleDepth.gain.setValueAtTime(0, t);
    wobbleDepth.gain.setValueAtTime(0, t + delay);
    wobbleDepth.gain.linearRampToValueAtTime(vibratoDepth, t + delay + 0.32);
    if (drift) {
      drift.frequency.value = 0.8 + rand(5) * 0.7;
      driftDepth.gain.value = 4;
      drift.connect(driftDepth);
    }
    wobble.connect(wobbleDepth);
    for (const oscillator of sources.slice()) {
      wobbleDepth.connect(oscillator.detune);
      if (driftDepth) driftDepth.connect(oscillator.detune);
    }
    for (const lfo of drift ? [wobble, drift] : [wobble]) {
      lfo.start(t);
      lfo.stop(stop);
      sources.push(lfo);
    }
    extra.push(wobbleDepth);
    if (driftDepth) extra.push(driftDepth);
    // Breath: noise shaped by the same vocal tract, strongest at the start of the note.
    const noise = audioGraph.nsrc(t, stop - t, rand(6) * 0.8),
      noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.16 * breath, t);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.04 * breath), t + 0.1);
    noiseGain.gain.setValueAtTime(Math.max(0.0002, 0.04 * breath), end - 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, end);
    noise.connect(noiseGain);
    noiseGain.connect(excitation);
    // Air: breath above the formants, a little sibilance-free brightness that follows the note.
    const air = context.createBiquadFilter(),
      airGain = context.createGain();
    air.type = 'highpass';
    air.frequency.value = 3800;
    airGain.gain.setValueAtTime(0.03 * breath, t);
    airGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.005 * breath), t + 0.12);
    noise.connect(air);
    air.connect(airGain);
    airGain.connect(amp);
    extra.push(noise, noiseGain, air, airGain);
    // Formants: the vowel's resonances, entered from a closure and moved for diphthongs.
    const vowels = syl.vowels.map(([vowel, at]) => ({
        bank: tuned((FORMANTS[type] || FORMANTS.alto)[vowel], f0).slice(0, backing ? 3 : 4),
        at,
      })),
      closure = syl.closure ? CLOSURES[syl.closure] : syl.onset ? CLOSURES[syl.onset] : null;
    vowels[0].bank.forEach((vowelFormant, index) => {
      // A hum keeps its closure's resonances, so its filters take their width from the closure.
      const [hz, db, bandwidth] = closure && syl.hum ? closure[index] : vowelFormant,
        filter = context.createBiquadFilter(),
        weight = context.createGain();
      filter.type = 'bandpass';
      filter.Q.value = hz / bandwidth;
      if (closure && !syl.hum) {
        filter.frequency.setValueAtTime(closure[index][0], t);
        filter.frequency.exponentialRampToValueAtTime(hz, t + 0.075);
        weight.gain.setValueAtTime(level(closure[index][1]), t);
        weight.gain.linearRampToValueAtTime(level(db), t + 0.075);
      } else if (closure) {
        // A hum stays closed, but opens a little at the end so the note does not stop dead.
        filter.frequency.setValueAtTime(closure[index][0], t);
        weight.gain.setValueAtTime(level(closure[index][1]), t);
      } else {
        filter.frequency.setValueAtTime(hz, t);
        weight.gain.setValueAtTime(level(db), t);
      }
      vowels.slice(1).forEach(({ bank, at }, step) => {
        const moveAt = t + at * d,
          [nextHz, nextDb] = bank[index],
          [lastHz, lastDb] = vowels[step].bank[index];
        filter.frequency.setValueAtTime(lastHz, moveAt);
        filter.frequency.exponentialRampToValueAtTime(nextHz, moveAt + 0.16);
        weight.gain.setValueAtTime(level(lastDb), moveAt);
        weight.gain.linearRampToValueAtTime(level(nextDb), moveAt + 0.16);
      });
      excitation.connect(filter);
      filter.connect(weight);
      weight.connect(mix);
      extra.push(filter, weight);
    });
    // Level: a soft onset and a gentle swell, then a release that follows the note's length.
    const reference = closure && syl.hum ? closure : vowels[0].bank,
      peak =
        (v * LEVEL_SCALE) /
        Math.sqrt(voicePower(f0, reference, syl.soft ? 'soft' : 'modal', offsets.length));
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + attack);
    if (d > 0.6) {
      amp.gain.exponentialRampToValueAtTime(peak * 1.08, t + d * 0.45);
      amp.gain.exponentialRampToValueAtTime(peak * 0.94, t + d);
    } else amp.gain.exponentialRampToValueAtTime(peak * 0.92, t + d);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    position.pan.value = pan;
    excitation.gain.value = 1;
    mix.gain.value = 1;
    mix.connect(amp);
    amp.connect(position);
    position.connect(audio.graph.song.vox || audio.graph.song.mel);
    audioGraph.feed(position, delaySend, reverbSend);
    extra.push(excitation, mix, amp);
    audio.stemFlash.synth = 0.15;
    const [first, ...rest] = sources;
    audioGraph.releaseVoice(first, position, rest.concat(extra));
  }
  return { eVoice };
}
