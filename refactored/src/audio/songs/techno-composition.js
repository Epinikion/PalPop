import { clamp, mulberry32 } from '../../core/math.js';
/* ==== procedural techno engine v4 ==== */
/* A session holds its key and tempo while seeded chapters renew the musical material and form.
   Arrangement choices depend on (seed, step); gameplay adds temporary accents and energy. */
const MODES = [
  {
    n: 'MINOR',
    s: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    n: 'DORIAN',
    s: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    n: 'PHRYGIAN',
    s: [0, 1, 3, 5, 7, 8, 10],
  },
];
const KEYS = [
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
  ['A#', 10],
];
const PROGS = {
  MINOR: {
    main: [
      [0, 0, 5, 6],
      [0, 6, 5, 6],
      [0, 0, 3, 6],
      [0, 3, 0, 6],
      [0, 5, 0, 6],
      [0, 0, 6, 5],
    ],
    lift: [
      [5, 6, 0, 0],
      [3, 5, 6, 0],
      [2, 6, 5, 6],
      [5, 6, 4, 0],
      [5, 3, 6, 6],
    ],
    brk: [
      [5, 2, 6, 0],
      [0, 5, 2, 6],
      [3, 6, 2, 5],
      [5, 6, 2, 0],
    ],
  },
  DORIAN: {
    main: [
      [0, 0, 3, 6],
      [0, 6, 3, 6],
      [0, 3, 0, 6],
      [0, 0, 6, 3],
      [0, 3, 6, 0],
    ],
    lift: [
      [3, 6, 0, 0],
      [6, 3, 0, 0],
      [2, 6, 3, 6],
      [3, 2, 6, 0],
    ],
    brk: [
      [3, 2, 6, 0],
      [0, 3, 2, 6],
      [2, 6, 3, 0],
      [6, 3, 2, 0],
    ],
  },
  PHRYGIAN: {
    main: [
      [0, 0, 1, 0],
      [0, 1, 0, 6],
      [0, 0, 5, 6],
      [0, 1, 1, 0],
      [0, 5, 1, 0],
    ],
    lift: [
      [1, 0, 6, 0],
      [5, 1, 0, 0],
      [1, 6, 5, 0],
      [1, 5, 0, 6],
    ],
    brk: [
      [5, 1, 0, 6],
      [0, 1, 5, 6],
      [1, 5, 6, 0],
      [5, 0, 1, 6],
    ],
  },
};
const STABS = [
  '..x...x...x...x.',
  'x..x..x...x..x..',
  '..x...x.x.....x.',
  '.x..x..x..x..x..',
  '..x..x....x..x.x',
  'x...x...x...x..x',
  '..x...x...xx..x.',
];
const ARPS = [
  [0, 1, 2, 3, 4, 3, 2, 1],
  [0, 2, 1, 3, 2, 4, 3, 5],
  [0, 4, 2, 5, 1, 4, 3, 6],
  [0, 1, 3, 5, 6, 5, 3, 1],
  [0, 2, 4, 6, 5, 3, 1, 2],
];
/* merge melody contour in pentatonic steps */
/* arrangement forms: cyc 0 introduces the track, later cycles rotate through three different forms */
const FORMS = [
  [
    [8, 'INTRO'],
    [24, 'GROOVE'],
    [32, 'BUILD'],
    [48, 'PEAK'],
    [56, 'BREAK'],
    [64, 'FINAL'],
  ],
  [
    [16, 'GROOVE'],
    [24, 'BUILD'],
    [40, 'PEAK'],
    [48, 'BREAK'],
    [64, 'FINAL'],
  ],
  [
    [8, 'GROOVE'],
    [16, 'PEAK'],
    [24, 'BREAK'],
    [32, 'BUILD'],
    [56, 'PEAK'],
    [64, 'FINAL'],
  ],
  [
    [12, 'GROOVE'],
    [20, 'BUILD'],
    [44, 'PEAK'],
    [52, 'BREAK'],
    [60, 'BUILD'],
    [64, 'FINAL'],
  ],
];
export function composeTechnoSession(seed, tonal) {
  const R = mulberry32(seed),
    pick = (a) => a[Math.floor(R() * a.length)];
  const mode = tonal ? tonal.mode : pick(MODES),
    key = tonal ? [tonal.kname, tonal.pc] : pick(KEYS),
    bpm = tonal ? tonal.bpm : 133 + Math.floor(R() * 13),
    P = PROGS[mode.n];
  const mkAcid = (dense) => {
    const a = [];
    for (let i = 0; i < 16; i++)
      a.push(
        dense
          ? {
              on: R() < 0.86,
              idx: pick([0, 0, 1, 2, 2, 3, 4, 5]),
              acc: i % 4 === 2 || R() < 0.2,
              sl: R() < 0.34,
            }
          : {
              on: R() < (i % 4 === 0 ? 0.5 : 0.72),
              idx: pick([0, 0, 0, 1, 2, 2, 3, 5, 4]),
              acc: R() < 0.28,
              sl: R() < 0.24,
            },
      );
    a[2].on = a[6].on = a[10].on = true;
    return a;
  };
  const acidBank = [mkAcid(false), mkAcid(false), mkAcid(false), mkAcid(true)];
  const mkMotif = () => {
    const motif = [];
    let idx = pick([2, 3, 4]);
    for (const st of [0, 3, 6, 8, 10, 12, 14, 16, 19, 22, 24, 26, 28, 30]) {
      if (R() < 0.64) {
        idx = clamp(idx + pick([-2, -1, -1, 0, 1, 1, 2]), 0, 9);
        motif.push({
          st,
          idx,
          len: pick([1, 2, 2, 3]),
        });
      }
    }
    if (motif.length < 5)
      for (const st of [0, 8, 16, 24])
        if (!motif.some((m) => m.st === st))
          motif.push({
            st,
            idx: pick([2, 4, 5]),
            len: 2,
          });
    return motif.sort((a, b) => a.st - b.st);
  };
  const motifs = [mkMotif(), mkMotif(), mkMotif()];
  const percBank = [];
  for (let k = 0; k < 3; k++) {
    const p = [];
    for (let i = 0; i < 16; i++)
      p.push(i % 4 === 0 ? 0 : R() < 0.4 ? pick(['tick', 'conga', 'blip', 'tick']) : 0);
    percBank.push(p);
  }
  const bassBank = [];
  for (let k = 0; k < 3; k++) {
    const o = [];
    for (let i = 0; i < 16; i++)
      o.push((i % 4 === 3 && R() < 0.45) || (i % 4 === 1 && R() < 0.22) ? 12 : 0);
    bassBank.push(o);
  }
  const pent = [0, 2, 3, 4, 6].map((d) => mode.s[d]),
    pb = 53 + ((key[1] - 5 + 12) % 12);
  return {
    seed,
    style: 'techno',
    mode,
    mname: mode.n,
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: 0.01 + R() * 0.05,
    progs: {
      main: [pick(P.main), pick(P.main)],
      lift: [pick(P.lift), pick(P.lift)],
      brk: [pick(P.brk), pick(P.brk)],
    },
    acidBank,
    motifs,
    percBank,
    bassBank,
    pent,
    bassGate: Array.from(
      {
        length: 3,
      },
      () =>
        Array.from(
          {
            length: 16,
          },
          (_, i) => i % 4 === 2 || R() < (i % 4 === 3 ? 0.82 : 0.58),
        ),
    ),
    pent5: pent.map((i) => pb + i),
    stabs: [pick(STABS), pick(STABS)],
    arps: [pick(ARPS), pick(ARPS)],
  };
}
export { FORMS };
export function renewTechnoChapter(seed, session, random) {
  const chapter = composeTechnoSession(seed, session);
  const groove = 8 + 4 * Math.floor(random() * 3),
    build = random() < 0.5 ? 4 : 8,
    peak = 12 + 4 * Math.floor(random() * 3),
    brk = random() < 0.5 ? 4 : 8;
  let end = 0;
  chapter.form = [
    [groove, 'GROOVE'],
    [build, 'BUILD'],
    [peak, 'PEAK'],
    [brk, 'BREAK'],
    [4, 'BUILD'],
  ].map(([length, section]) => [(end += length), section]);
  chapter.form.push([64, 'FINAL']);
  chapter.acidBank[0] = session.acidBank[0];
  return chapter;
}
