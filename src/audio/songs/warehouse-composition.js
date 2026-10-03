import { mulberry32 } from '../../core/math.js';

const MODES = [
  { n: 'MINOR', s: [0, 2, 3, 5, 7, 8, 10] },
  { n: 'PHRYGIAN', s: [0, 1, 3, 5, 7, 8, 10] },
  { n: 'DORIAN', s: [0, 2, 3, 5, 7, 9, 10] },
];
/** Keys whose root falls on a deep, well-defined bass note. */
const KEYS = [
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
];
/** Techno barely moves harmonically: a pedal root, a rare visit to a second chord. */
const PROGRESSIONS = {
  main: [
    [0, 0, 0, 0],
    [0, 0, 0, 6],
    [0, 0, 6, 0],
  ],
  lift: [
    [0, 0, 5, 6],
    [0, 6, 0, 5],
    [0, 0, 6, 5],
  ],
  brk: [
    [5, 5, 6, 6],
    [3, 3, 6, 6],
    [0, 5, 3, 6],
  ],
};
export const WAREHOUSE_FORMS = [
  [
    [8, 'INTRO'],
    [16, 'GROOVE'],
    [32, 'PEAK'],
    [40, 'BREAK'],
    [44, 'BUILD'],
    [60, 'FINAL'],
    [64, 'OUTRO'],
  ],
  [
    [8, 'GROOVE'],
    [24, 'PEAK'],
    [32, 'BREAK'],
    [36, 'BUILD'],
    [56, 'FINAL'],
    [64, 'GROOVE'],
  ],
  [
    [16, 'PEAK'],
    [24, 'BREAK'],
    [28, 'BUILD'],
    [48, 'FINAL'],
    [56, 'BREAK'],
    [60, 'BUILD'],
    [64, 'PEAK'],
  ],
];

/**
 * Chapter-long rhythm material. Every pattern is drawn once per chapter and then repeated, which
 * is what makes techno hypnotic; the arrangement adds, removes and filters layers around it.
 */
function composePatterns(random) {
  const pick = (items) => items[Math.floor(random() * items.length)],
    // 16-step velocity maps for the closed hats: the accented "and" of each beat, ghosts between.
    hats = pick([
      [0.3, 0.15, 0.55, 0.2, 0.3, 0.15, 0.55, 0.25, 0.3, 0.15, 0.55, 0.2, 0.3, 0.2, 0.6, 0.3],
      [0.25, 0.4, 0.6, 0.15, 0.25, 0.35, 0.6, 0.2, 0.25, 0.4, 0.6, 0.15, 0.25, 0.35, 0.6, 0.4],
      [0.35, 0, 0.55, 0.25, 0.3, 0, 0.55, 0.25, 0.35, 0, 0.55, 0.25, 0.3, 0.2, 0.55, 0.3],
    ]);
  return {
    hats,
    rim: pick([
      [3, 11],
      [6, 14],
      [7, 15],
      [2, 10, 14],
    ]),
    // Percussion on a cycle that is not a bar long: it drifts against the kick and never repeats
    // the same way twice within a phrase.
    percCycle: pick([10, 12, 14]),
    percSteps: pick([
      [0, 3, 6, 9],
      [1, 4, 7, 9],
      [0, 3, 7, 10],
      [2, 5, 8, 11],
    ]),
    metal: pick([
      [2, 5, 11],
      [3, 7, 10, 14],
      [1, 6, 13],
    ]),
    // Rolling bass: sixteenths between the kicks, with a rest or two and an occasional leap.
    bass: pick([
      [2, 3, 6, 7, 10, 11, 14, 15],
      [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15],
      [2, 3, 5, 6, 7, 10, 11, 13, 14, 15],
    ]),
    stab: pick([[6], [6, 14], [3, 10]]),
    ping: Array.from({ length: 8 }, () => pick([0, 0, 2, 3, 4, 4, 5])),
  };
}

/** A dark, hypnotic session: a deep root, a fixed tempo and a chapter of fixed rhythms. */
export function composeWarehouseSession(seed, tonal) {
  const random = mulberry32(seed),
    pick = (items) => items[Math.floor(random() * items.length)],
    key = tonal ? [tonal.kname, tonal.pc] : pick(KEYS),
    mode = tonal?.mode || pick(MODES),
    bpm = tonal?.bpm || 132 + Math.floor(random() * 7),
    pent = [0, 3, 5, 7, 10];
  return {
    seed,
    style: 'warehouse',
    mode,
    mname: mode.n,
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    // The offbeat sixteenths arrive a little late: the shuffle that makes hats groove.
    swing: 0.035 + random() * 0.04,
    progs: {
      main: [pick(PROGRESSIONS.main)],
      lift: [pick(PROGRESSIONS.lift)],
      brk: [pick(PROGRESSIONS.brk)],
    },
    barsPerChord: 2,
    voicing: 'triad',
    pent,
    pent5: pent.map((n) => 48 + key[1] + n),
    color: random(),
    patterns: composePatterns(random),
  };
}

export function renewWarehouseChapter(seed, session, random) {
  const chapter = composeWarehouseSession(seed, session);
  chapter.form = WAREHOUSE_FORMS[1 + Math.floor(random() * 2)];
  return chapter;
}
