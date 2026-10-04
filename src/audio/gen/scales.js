/** Scale tables, in semitones above the key's root. */
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/** MIDI note of a scale degree (negative and above seven wrap into other octaves). */
export function degreeNote(pc, scale, degree, base = 48) {
  const steps = SCALES[scale],
    octave = Math.floor(degree / 7),
    index = ((degree % 7) + 7) % 7;
  return base + pc + steps[index] + 12 * octave;
}

/** The scale degrees stacked in thirds on a root: a triad, or with more notes a seventh or ninth. */
export function stack(root, size = 3) {
  return Array.from({ length: size }, (_, k) => root + 2 * k);
}

/** Suspended variants replace the third with the second or fourth: the open sound of rave stabs. */
export function suspend(root, kind) {
  return kind === 'sus2' ? [root, root + 1, root + 4] : [root, root + 3, root + 4];
}

/**
 * Voices a chord (a list of MIDI notes) close to the previous one: every note moves to the octave
 * that is nearest its partner, so a progression glides instead of jumping.
 */
export function leadVoices(previous, notes, low = 50, high = 74) {
  const fit = (note, target) => {
    let best = note;
    for (let shifted = note - 48; shifted <= note + 48; shifted += 12)
      if (
        shifted >= low &&
        shifted <= high &&
        (best < low || best > high || Math.abs(shifted - target) < Math.abs(best - target))
      )
        best = shifted;
    return best;
  };
  const centre = previous ? previous.reduce((a, b) => a + b, 0) / previous.length : 60,
    result = notes.map((note, i) => fit(note, previous ? (previous[i] ?? centre) : centre));
  return result.sort((a, b) => a - b);
}
