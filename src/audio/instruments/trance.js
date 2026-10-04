import { createSupersaw } from './supersaw.js';

/** The wide, bright, sustained supersaw chord that fills the middle of a trance drop. */
export function createTrance({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });
  /**
   * Five detuned saws per note, spread across the stereo field and opened up to the top: a long
   * `d` is the pad that holds a drop together, a short one a bright, gated stab.
   */
  function eTranceChord(t, notes, d, v, color = 0.6) {
    superSaw(t, notes, d, v, {
      voices: d > 1 ? 5 : 3,
      detune: 1.15,
      width: 0.75,
      hp: 190,
      cut: [5200 + color * 3600, 3000 + color * 1800],
      q: 0.6,
      attack: d > 1 ? 0.06 : 0.006,
      sustain: 0.85,
      release: d > 1 ? 0.35 : 0.12,
      pan: 0,
      delaySend: 0.05,
      reverbSend: 0.18,
    });
  }
  /**
   * A sixteenth of the arpeggio: a bright saw that is held past its step so neighbouring notes
   * overlap and the middle of the mix keeps sounding, with a dotted-eighth echo behind it.
   */
  function eTranceArp(t, note, d, v, color = 0.6, pan = 0) {
    superSaw(t, [note], d, v, {
      voices: 3,
      detune: 1.1,
      width: 0.6,
      hp: 240,
      cut: [4600 + color * 3000, 3000 + color * 1300],
      fall: d,
      q: 0.8,
      attack: 0.008,
      sustain: 0.7,
      release: 0.12,
      pan,
      delaySend: 0.3,
      reverbSend: 0.14,
    });
  }
  return { eTranceChord, eTranceArp };
}
