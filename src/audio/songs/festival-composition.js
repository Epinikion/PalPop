import { mulberry32 } from '../../core/math.js';

const FESTIVAL_FORMS = [
  [
    [4, 'INTRO'],
    [8, 'BUILD'],
    [24, 'PEAK'],
    [32, 'GROOVE'],
    [40, 'BREAK'],
    [44, 'BUILD'],
    [60, 'FINAL'],
    [64, 'BREAK'],
  ],
  [
    [8, 'GROOVE'],
    [12, 'BUILD'],
    [28, 'PEAK'],
    [36, 'BREAK'],
    [40, 'BUILD'],
    [56, 'FINAL'],
    [64, 'GROOVE'],
  ],
  [
    [8, 'GROOVE'],
    [12, 'BUILD'],
    [24, 'PEAK'],
    [32, 'BREAK'],
    [40, 'BUILD'],
    [56, 'FINAL'],
    [64, 'BREAK'],
  ],
];
const FESTIVAL_PROGS = [
  [5, 3, 0, 4],
  [0, 4, 5, 3],
  [5, 0, 4, 3],
  [0, 3, 5, 4],
];
const FESTIVAL_MODE = { n: 'MAJOR', s: [0, 2, 4, 5, 7, 9, 11] };

/** A bright major-key song with relative-minor harmony and an early, recognisable drop. */
export function composeFestivalSession(seed, tonal) {
  const random = mulberry32(seed),
    pick = (items) => items[Math.floor(random() * items.length)],
    key = tonal
      ? [tonal.kname, tonal.pc]
      : pick([
          ['C', 0],
          ['D', 2],
          ['F', 5],
          ['G', 7],
          ['A', 9],
        ]),
    bpm = tonal?.bpm || 126 + Math.floor(random() * 3),
    progression = pick(FESTIVAL_PROGS),
    pent = [0, 2, 4, 7, 9];
  return {
    seed,
    style: 'festival',
    mode: tonal?.mode || FESTIVAL_MODE,
    mname: 'MAJOR',
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: 0.012,
    // A progression stays for a whole chapter; arrangement and endings create the contrast.
    progs: { main: [progression], lift: [progression], brk: [progression] },
    barsPerChord: 2,
    pent,
    pent5: pent.map((n) => 48 + key[1] + n),
    color: 0.45 + random() * 0.3,
  };
}

/** A / varied A / B / exact A reprise, using one original theme across the chapter. */
export function composeFestivalPhrase(seed, index) {
  const themeRandom = mulberry32((seed ^ 0x51f15e5d) >>> 0),
    pick = (items) => items[Math.floor(themeRandom() * items.length)],
    anchor = pick([2, 4, 5]),
    ending = pick([
      [0, 2, 0],
      [4, 2, 0],
      [5, 4, 2],
      [2, 1, 0],
    ]),
    motif = [
      anchor,
      anchor,
      anchor + pick([-1, 1]),
      Math.max(0, anchor + pick([-2, -1, 1])),
      pick([2, 4, 5, 6]),
      pick([1, 2, 4]),
      ...ending,
    ],
    development = index % 4,
    random = mulberry32((seed ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0),
    rhythm = pick([
      [0, 6, 10, 16, 22, 26, 32, 42, 54],
      [0, 3, 10, 16, 20, 26, 34, 42, 54],
      [2, 6, 12, 16, 22, 28, 32, 40, 54],
      [0, 6, 12, 18, 22, 28, 34, 44, 54],
    ]),
    gates = rhythm.map((step, i) =>
      Math.min(i < 6 ? pick([2, 3, 4]) : pick([4, 5, 6]), (rhythm[i + 1] || 64) - step),
    ),
    line = motif.slice();
  if (development === 1) line.splice(6, 3, line[6] === 4 ? 5 : 4, 2, 0);
  if (development === 2) {
    for (let i = 0; i < 6; i++) line[i] = Math.min(7, motif[i] + (i < 3 ? 2 : 1));
    line.splice(6, 3, 5, 4, 2);
  }
  const melody = [];
  for (let half = 0; half < 2; half++)
    for (let i = 0; i < rhythm.length; i++) {
      const step = half * 64 + rhythm[i];
      // Every eighth bar is a piano reply, with room for the game's physical cues.
      if (step >= 112) continue;
      melody.push([step, line[i], gates[i], i === 0 ? 1 : 0.82]);
    }
  return {
    motif,
    rhythm,
    melody,
    development,
    piano: development === 2 ? [0, 6, 14] : [0, 6, 10],
    bass: random() < 0.5 ? [2, 6, 10, 14] : [2, 6, 9, 14],
    hatMask: Array.from(
      { length: 16 },
      (_, step) => step % 4 === 2 || (step % 2 === 1 && random() < 0.35),
    ),
    color: 0.45 + themeRandom() * 0.25,
    accent: 0.9 + random() * 0.15,
  };
}

export function renewFestivalChapter(seed, session, random) {
  const chapter = composeFestivalSession(seed, session);
  chapter.form = FESTIVAL_FORMS[1 + Math.floor(random() * 2)];
  return chapter;
}
export { FESTIVAL_FORMS };
