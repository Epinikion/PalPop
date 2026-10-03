import { mulberry32 } from '../../core/math.js';
const DANCE_FORMS = [
  [
    [4, 'INTRO'],
    [12, 'GROOVE'],
    [16, 'BUILD'],
    [32, 'PEAK'],
    [40, 'BREAK'],
    [44, 'BUILD'],
    [64, 'FINAL'],
  ],
];
const DANCE_MODES = [
  { n: 'MINOR', s: [0, 2, 3, 5, 7, 8, 10] },
  { n: 'DORIAN', s: [0, 2, 3, 5, 7, 9, 10] },
];
const DANCE_PROGS = [
  [0, 0, 5, 6],
  [0, 3, 6, 5],
  [0, 5, 3, 6],
  [0, 6, 5, 3],
  [0, 3, 0, 4],
  [0, 5, 6, 0],
];

/** Chapters share the musical clock/key, but renew harmony and the sound palette. */
export function composeDanceSession(seed, tonal) {
  const random = mulberry32(seed),
    pick = (items) => items[Math.floor(random() * items.length)];
  const key = tonal
    ? [tonal.kname, tonal.pc]
    : pick([
        ['C', 0],
        ['D', 2],
        ['E', 4],
        ['F', 5],
        ['G', 7],
        ['A', 9],
      ]);
  const mode = tonal?.mode || pick(DANCE_MODES),
    bpm = tonal?.bpm || 128 + Math.floor(random() * 5),
    pent = [0, 2, 3, 7, 10];
  return {
    seed,
    style: 'dance',
    mode,
    mname: mode.n,
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: 0.015 + random() * 0.035,
    progs: {
      main: [pick(DANCE_PROGS), pick(DANCE_PROGS)],
      lift: [pick(DANCE_PROGS), pick(DANCE_PROGS)],
      brk: [pick(DANCE_PROGS), pick(DANCE_PROGS)],
    },
    barsPerChord: pick([1, 2, 2, 4]),
    pent,
    pent5: pent.map((n) => 48 + key[1] + n),
    color: 0.35 + random() * 0.65,
  };
}

/** A / A variation / B / A reply across 32 bars; each chapter grows a new theme. */
export function composeDancePhrase(seed, phraseIndex) {
  const random = mulberry32((seed ^ Math.imul(phraseIndex + 1, 0x85ebca6b)) >>> 0),
    pick = (items) => items[Math.floor(random() * items.length)];
  const themeRandom = mulberry32(
    (seed ^ Math.imul(Math.floor(phraseIndex / 4) + 1, 0xc2b2ae35)) >>> 0,
  );
  const themePick = (items) => items[Math.floor(themeRandom() * items.length)],
    development = phraseIndex % 4;
  const rhythms = [
    [0, 3, 6, 10],
    [2, 6, 9, 14],
    [0, 6, 11],
    [3, 8, 14],
    [0, 2, 7, 14],
  ];
  const motif = Array.from({ length: 4 }, () => themePick([0, 0, 2, 3, 4])),
    callRhythm = themePick(rhythms),
    replyRhythm = themePick(rhythms),
    melody = [];
  for (let bar = 0; bar < 8; bar++) {
    // Space between phrases is part of the groove; the synth never runs continuously.
    const reprise = development === 3 && bar === 0;
    if (bar === 3 || bar === 7 || (!reprise && random() < 0.12)) continue;
    const rhythm = bar % 2 ? replyRhythm : callRhythm;
    for (let i = 0; i < rhythm.length; i++) {
      if (!reprise && random() < 0.2) continue;
      const ending = i === rhythm.length - 1 && (bar >= 4 || development === 1),
        degree =
          (motif[(i + (development === 2 ? 2 : 0)) % 4] + (ending ? development + 1 : 0)) % 7;
      melody.push([bar * 16 + rhythm[i], degree, pick([1, 1, 2, 2, 3]), 0.65 + random() * 0.35]);
    }
  }
  const bassRhythm = themePick([
    [2, 6, 10, 14],
    [0, 3, 6, 8, 10, 14],
    [0, 2, 5, 7, 10, 12, 14],
    [0, 3, 7, 10, 14],
  ]);
  return {
    melody,
    motif,
    development,
    bass: Array.from({ length: 16 }, (_, step) =>
      bassRhythm.includes(step)
        ? { interval: pick([0, 0, 0, 7, 12]), gate: 0.65 + random() * 0.85 }
        : null,
    ),
    chords: pick([
      [0, 6, 10],
      [2, 7, 14],
      [0, 3, 10, 14],
      [2, 6, 11],
    ]),
    hatMask: Array.from(
      { length: 16 },
      (_, step) => step % 4 === 2 || (step % 2 === 1 && random() < 0.5),
    ),
    percussion: pick([3, 7, 11, 15]),
    fill: pick(['snare', 'clap', 'perc']),
    drumAccent: 0.85 + random() * 0.2,
    leadColor: themeRandom(),
    bassColor: random(),
    pan: (themeRandom() - 0.5) * 0.55,
    leadActive: development === 3 || random() > 0.2,
    chordActive: true,
  };
}
export function renewDanceChapter(seed, session, random) {
  const chapter = composeDanceSession(seed, session),
    groove = 8 + 4 * Math.floor(random() * 3),
    build = random() < 0.5 ? 4 : 8,
    peak = 12 + 4 * Math.floor(random() * 3),
    rest = random() < 0.5 ? 4 : 8;
  let end = 0;
  chapter.form = [
    [groove, 'GROOVE'],
    [build, 'BUILD'],
    [peak, 'PEAK'],
    [rest, 'BREAK'],
    [4, 'BUILD'],
  ].map(([length, section]) => [(end += length), section]);
  chapter.form.push([64, 'FINAL']);
  return chapter;
}
export { DANCE_FORMS };
