/** Cent offsets per unison layout; the centre voice is always exactly in tune. */
const LAYOUTS = {
  3: [-13, 0, 13],
  5: [-19, -9, 0, 9, 19],
  7: [-23, -14, -6, 0, 6, 14, 23],
};

/**
 * Detuned-saw stack behind the festival hook, the electro stabs and the plucks. Flat-tuned voices
 * go left, sharp ones right and the centre voice stays put, so the stack is wide but still folds
 * down to a solid mono sum. All oscillators stop together, so one cleanup releases the whole voice.
 */
export function createSupersaw({ audio, audioGraph, audioMath }) {
  /**
   * @param {number[]} notes MIDI notes played together
   * @param {number} d seconds the note is held before its release
   * @param {number} v overall level
   * @param {object} [o] voices (3/5/7), detune scale, width, hp, cut [start, end], fall, q,
   *   attack, sustain, release, delaySend, reverbSend, pan, pulse (square centre voice)
   */
  function superSaw(t, notes, d, v, o = {}) {
    const {
      voices = 7,
      detune = 1,
      width = 0.75,
      hp = 160,
      cut = [6000, 3000],
      fall = d,
      q = 0.8,
      attack = 0.006,
      sustain = 0.8,
      release = 0.14,
      delaySend = 0.05,
      reverbSend = 0.07,
      pan = 0,
      pulse = false,
    } = o;
    const offsets = LAYOUTS[voices] || LAYOUTS[7],
      end = t + d + release + 0.04,
      sources = [],
      extra = [],
      left = audio.context.createGain(),
      centre = audio.context.createGain(),
      right = audio.context.createGain(),
      leftPan = audio.context.createStereoPanner(),
      rightPan = audio.context.createStereoPanner(),
      highpass = audio.context.createBiquadFilter(),
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      position = audio.context.createStereoPanner();
    left.gain.value = right.gain.value = 0.85;
    centre.gain.value = 1;
    leftPan.pan.value = -width;
    rightPan.pan.value = width;
    highpass.type = 'highpass';
    highpass.frequency.value = hp;
    highpass.Q.value = 0.5;
    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(cut[0], t);
    // Keep harmonics through the note body: a fundamental-only tail sounds like a whistle.
    filter.frequency.exponentialRampToValueAtTime(cut[1], t + Math.max(0.05, fall));
    const level = (v * 1.1) / Math.sqrt(notes.length * offsets.length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + attack);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, level * sustain),
      t + Math.max(attack + 0.004, d * 0.65),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + release);
    position.pan.value = pan;
    for (const note of notes)
      for (const cents of offsets) {
        const oscillator = audio.context.createOscillator();
        oscillator.type = pulse && cents === 0 ? 'square' : 'sawtooth';
        oscillator.frequency.value = audioMath.midi(note);
        oscillator.detune.value = cents * detune;
        oscillator.connect(cents < 0 ? left : cents > 0 ? right : centre);
        oscillator.start(t);
        oscillator.stop(end);
        sources.push(oscillator);
      }
    left.connect(leftPan);
    right.connect(rightPan);
    leftPan.connect(highpass);
    rightPan.connect(highpass);
    centre.connect(highpass);
    highpass.connect(filter);
    filter.connect(gain);
    gain.connect(position);
    position.connect(audio.graph.song.mel);
    audioGraph.feed(position, delaySend, reverbSend);
    extra.push(left, centre, right, leftPan, rightPan, highpass, filter, gain);
    audioGraph.releaseVoice(sources[0], position, sources.slice(1).concat(extra));
    audio.stemFlash.synth = 0.2;
  }
  /** Short plucked saw chord or single note: the arpeggio sparkle of breakdowns and builds. */
  function eSawPluck(t, notes, d, v, color = 0.6, pan = 0) {
    superSaw(t, notes, d, v, {
      voices: 3,
      detune: 1.1,
      width: 0.7,
      hp: 260,
      cut: [5000 + color * 3800, 700 + color * 500],
      fall: Math.max(0.08, d * 0.9),
      q: 1.5,
      attack: 0.003,
      sustain: 0.15,
      release: 0.08,
      pan,
      delaySend: 0.42,
      reverbSend: 0.14,
    });
  }
  return { superSaw, eSawPluck };
}
