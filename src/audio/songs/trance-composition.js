import { mulberry32 } from '../../core/math.js';

const MODES = {
  MAJOR: { n: 'MAJOR', s: [0, 2, 4, 5, 7, 9, 11], pent: [0, 2, 4, 7, 9] },
  MINOR: { n: 'MINOR', s: [0, 2, 3, 5, 7, 8, 10], pent: [0, 3, 5, 7, 10] },
};
/** Keys in which the reference set kept returning; every one has a deep, clear bass root. */
const KEYS = [
  ['C#', 1],
  ['D#', 3],
  ['E', 4],
  ['F', 5],
  ['G#', 8],
  ['A', 9],
  ['A#', 10],
  ['B', 11],
];
/** Chord loops of four chords, two bars each; each section picks its bank (see composition.js). */
const PROGRESSIONS = {
  MINOR: {
    main: [
      [0, 5, 2, 6],
      [0, 6, 5, 6],
      [0, 2, 5, 6],
    ],
    lift: [
      [0, 5, 2, 6],
      [5, 2, 6, 0],
    ],
    brk: [
      [5, 2, 6, 0],
      [2, 6, 0, 5],
    ],
  },
  MAJOR: {
    main: [
      [0, 4, 5, 3],
      [5, 3, 0, 4],
    ],
    lift: [
      [0, 4, 5, 3],
      [3, 0, 4, 5],
    ],
    brk: [
      [5, 3, 0, 4],
      [3, 4, 5, 0],
    ],
  },
};
/**
 * Sixteen-step arpeggios over a triad: 0-2 are its notes, 3-5 the same notes an octave higher.
 * They run through every step of a drop, which is what keeps the middle of the mix full.
 */
const ARPS = [
  [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 2, 4],
  [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 4, 3, 2, 1],
  [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 3, 4],
  [0, 0, 2, 2, 1, 1, 3, 3, 0, 0, 2, 2, 1, 3, 4, 3],
];
/** Hat velocities per sixteenth of a beat: the closed hat on the "e" and "a" carries the drive. */
const HATS = [
  [0.45, 1, 0.55, 0.85],
  [0.4, 0.9, 0.6, 1],
];
export const TRANCE_FORMS = [
  [
    [4, 'INTRO'],
    [12, 'BUILD'],
    [28, 'PEAK'],
    [36, 'BREAK'],
    [44, 'BUILD'],
    [60, 'FINAL'],
    [64, 'BREAK'],
  ],
  [
    [8, 'GROOVE'],
    [16, 'BUILD'],
    [32, 'PEAK'],
    [40, 'BREAK'],
    [48, 'BUILD'],
    [60, 'FINAL'],
    [64, 'GROOVE'],
  ],
  [
    [8, 'GROOVE'],
    [12, 'BUILD'],
    [28, 'PEAK'],
    [36, 'BREAK'],
    [44, 'BUILD'],
    [60, 'FINAL'],
    [64, 'BREAK'],
  ],
];

/**
 * A trance session: 138-144 BPM in one key and mode, a chord loop for each part of the song, an
 * arpeggio that runs through the drops and a rolling bass that leans into every kick.
 */
export function composeTranceSession(seed, tonal) {
  const random = mulberry32(seed),
    pick = (items) => items[Math.floor(random() * items.length)],
    key = tonal ? [tonal.kname, tonal.pc] : pick(KEYS),
    mode = tonal?.mode || (random() < 0.6 ? MODES.MAJOR : MODES.MINOR),
    bank = PROGRESSIONS[mode.n],
    bpm = tonal?.bpm || 138 + Math.floor(random() * 7);
  return {
    seed,
    style: 'trance',
    mode,
    mname: mode.n,
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: 0,
    progs: { main: [pick(bank.main)], lift: [pick(bank.lift)], brk: [pick(bank.brk)] },
    barsPerChord: 2,
    voicing: 'triad',
    pent: mode.pent,
    pent5: mode.pent.map((n) => 48 + key[1] + n),
    arp: pick(ARPS),
    hats: pick(HATS),
    // The bass plays the three sixteenths after each kick; on these beats it jumps an octave.
    leaps: pick([[], [3], [1, 3], [2]]),
    color: 0.5 + random() * 0.3,
  };
}

export function renewTranceChapter(seed, session, random) {
  const chapter = composeTranceSession(seed, session);
  chapter.form = TRANCE_FORMS[1 + Math.floor(random() * 2)];
  return chapter;
}
