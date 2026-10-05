import { createSupersaw } from './supersaw.js';

/** How a reply stab is voiced in each style: a bundle of `superSaw` options. */
const STAB = {
  rave: { voices: 5, detune: 0.9, width: 0.8, hp: 240, cut: [3800, 900], q: 1.4, drive: 1.6 },
  euphoric: { voices: 7, detune: 1, width: 0.9, hp: 220, cut: [5200, 1800], q: 0.9, drive: 1.3 },
  melodic: { voices: 5, detune: 0.8, width: 0.8, hp: 240, cut: [3600, 1100], q: 1.2, drive: 1.3 },
  anthem: { voices: 5, detune: 0.9, width: 0.8, hp: 220, cut: [4800, 1400], q: 1.2, drive: 1.4 },
};

/** The live voice gameplay replies use: a short chord stab in the sound of the running song. */
export function createGenVoices({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });
  /** A short, wide chord hit; `o.filter` (0 to 1) opens or closes it. */
  function eRave(t, notes, d, v, o = {}) {
    const { style = 'rave', filter = 0.5, pan = 0 } = o,
      preset = STAB[style] || STAB.rave,
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
      delaySend: 0.3,
      reverbSend: 0.18,
    });
  }
  return { eRave };
}
