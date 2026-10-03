import { mulberry32 } from '../../core/math.js';

const MODES = {
  MINOR: { n: 'MINOR', s: [0, 2, 3, 5, 7, 8, 10] },
  MAJOR: { n: 'MAJOR', s: [0, 2, 4, 5, 7, 9, 11] },
};
/** Four-chord loops (scale degrees, one chord per bar) for each part of the song, per mode. */
const PROGRESSIONS = {
  MINOR: {
    main: [
      [0, 5, 2, 6],
      [0, 3, 5, 6],
      [0, 6, 5, 4],
    ],
    pre: [
      [3, 5, 6, 6],
      [5, 3, 6, 6],
      [3, 3, 6, 6],
    ],
    lift: [
      [5, 2, 6, 0],
      [5, 6, 0, 3],
      [3, 5, 0, 6],
    ],
    brk: [
      [3, 5, 2, 6],
      [5, 3, 6, 0],
      [0, 5, 3, 6],
    ],
  },
  MAJOR: {
    main: [
      [0, 4, 5, 3],
      [5, 3, 0, 4],
      [0, 5, 3, 4],
    ],
    pre: [
      [5, 3, 1, 4],
      [3, 1, 4, 4],
      [1, 3, 4, 4],
    ],
    lift: [
      [3, 0, 4, 5],
      [0, 4, 3, 4],
      [5, 3, 0, 4],
    ],
    brk: [
      [5, 3, 0, 4],
      [3, 5, 0, 4],
      [1, 5, 3, 4],
    ],
  },
};
const KEYS = [
  ['C', 0],
  ['D', 2],
  ['E', 4],
  ['F', 5],
  ['G', 7],
  ['A', 9],
];
/** 64-bar forms; every section is a multiple of four bars, so each chord loop starts on a section. */
export const VOCAL_FORMS = [
  [
    [4, 'INTRO'],
    [12, 'VERSE'],
    [16, 'PRE'],
    [32, 'CHORUS'],
    [40, 'BREAK'],
    [44, 'PRE'],
    [60, 'CHORUS'],
    [64, 'OUTRO'],
  ],
  [
    [8, 'VERSE'],
    [12, 'PRE'],
    [28, 'CHORUS'],
    [36, 'BREAK'],
    [40, 'PRE'],
    [56, 'CHORUS'],
    [64, 'OUTRO'],
  ],
  [
    [8, 'CHORUS'],
    [16, 'VERSE'],
    [20, 'PRE'],
    [36, 'CHORUS'],
    [44, 'BREAK'],
    [48, 'PRE'],
    [64, 'CHORUS'],
  ],
];

/** A warm, slow-building song: a singer's key and tempo stay for the session, harmony renews. */
export function composeVocalSession(seed, tonal) {
  const random = mulberry32(seed),
    pick = (items) => items[Math.floor(random() * items.length)],
    key = tonal ? [tonal.kname, tonal.pc] : pick(KEYS),
    mode = tonal?.mode || (random() < 0.62 ? MODES.MINOR : MODES.MAJOR),
    bpm = tonal?.bpm || 120 + Math.floor(random() * 5),
    banks = PROGRESSIONS[mode.n],
    pent = mode.n === 'MINOR' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  return {
    seed,
    style: 'vocal',
    mode,
    mname: mode.n,
    kname: key[0],
    pc: key[1],
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: 0.006,
    progs: {
      main: [pick(banks.main)],
      pre: [pick(banks.pre)],
      lift: [pick(banks.lift)],
      brk: [pick(banks.brk)],
    },
    barsPerChord: 1,
    voicing: 'triad',
    // The intro and outro tease the chorus, so they share its chords.
    banks: {
      INTRO: 'lift',
      VERSE: 'main',
      PRE: 'pre',
      CHORUS: 'lift',
      BREAK: 'brk',
      OUTRO: 'lift',
    },
    pent,
    pent5: pent.map((n) => 48 + key[1] + n),
    color: 0.4 + random() * 0.4,
  };
}

export function renewVocalChapter(seed, session, random) {
  const chapter = composeVocalSession(seed, session);
  chapter.form = VOCAL_FORMS[1 + Math.floor(random() * 2)];
  return chapter;
}

/** Which chord loop accompanies each kind of vocal part. */
const BANK_OF = {
  intro: 'lift',
  verse: 'main',
  pre: 'pre',
  chorus: 'lift',
  bridge: 'brk',
  outro: 'lift',
};
/** Comfortable lead range per part, as MIDI notes: an alto stays below E5 so it never gets shrill. */
const RANGE = {
  intro: [57, 69],
  verse: [57, 69],
  pre: [60, 72],
  chorus: [62, 74],
  bridge: [64, 76],
  outro: [57, 69],
};
/** Bar rhythms as [start, length] in sixteenth steps; short notes sit between longer, held ones. */
const TEMPLATES = {
  verse: [
    [
      [0, 6],
      [8, 4],
    ],
    [[2, 6]],
    [[0, 10]],
    [
      [4, 4],
      [10, 6],
    ],
    [
      [0, 4],
      [6, 6],
    ],
  ],
  chorus: [
    [
      [0, 4],
      [4, 4],
      [8, 4],
    ],
    [
      [0, 6],
      [6, 2],
      [8, 4],
    ],
    [
      [2, 2],
      [4, 2],
      [6, 6],
    ],
    [[0, 8]],
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 6],
    ],
    [
      [0, 4],
      [6, 4],
      [10, 6],
    ],
  ],
  pre: [
    [
      [0, 3],
      [4, 3],
      [8, 3],
      [12, 3],
    ],
    [
      [0, 2],
      [2, 2],
      [4, 4],
      [8, 6],
    ],
    [
      [0, 4],
      [4, 4],
      [8, 6],
    ],
  ],
  bridge: [
    [[0, 12]],
    [
      [0, 8],
      [8, 8],
    ],
    [[2, 10]],
    [
      [0, 6],
      [8, 8],
    ],
  ],
  outro: [[[0, 12]]],
};
/** Wordless syllables each part draws from. */
const SYLLABLES = {
  intro: ['mm', 'oo'],
  verse: ['mm', 'oo', 'ah', 'oh'],
  chorus: ['oh', 'oh', 'ah'],
  pre: ['ah'],
  bridge: ['ah', 'oo'],
  outro: ['mm'],
};
/** Nominal length of each part in bars: verses, choruses and bridges run eight, the rest fewer. */
const BARS = { intro: 2, verse: 8, pre: 4, chorus: 8, bridge: 8, outro: 3 };
const SALT = { intro: 11, verse: 23, pre: 37, chorus: 41, bridge: 53, outro: 67 };

export const pitchOf = (session, degree) => {
  const tonic = 48 + session.pc + (session.pc < 4 ? 12 : 0),
    scale = session.mode.s;
  return tonic + scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
};

/**
 * One four-bar vocal line over a chord loop. Held notes start on chord tones, passing notes move
 * by step, leaps are rare and answered by a step back, and every line ends on a long note with
 * room to breathe.
 */
function composeLine(
  random,
  session,
  kind,
  chords,
  { ending, notes: templateBank, contour, rests = [] },
  prefix = [],
  start = null,
) {
  const [low, high] = RANGE[kind],
    candidates = [];
  for (let d = -14; d <= 21; d++) {
    const midi = pitchOf(session, d);
    if (midi >= low && midi <= high) candidates.push(d);
  }
  const chordTone = (degree, chord) =>
      [0, 2, 4].some((third) => (chord + third - degree) % 7 === 0),
    pick = (items) => items[Math.floor(random() * items.length)],
    line = prefix.map((note) => ({ ...note })),
    first = prefix.length ? Math.floor(prefix.at(-1).step / 16) + 1 : 0;
  // A continued line carries its melodic state over: it starts where the previous bars ended.
  let previous = prefix.length
      ? prefix.at(-1).degree
      : (start ?? candidates[Math.floor(candidates.length / 2)]),
    repeats = 0,
    leapped = false,
    lastTemplate = -1,
    previousSum = 0;
  const sung = (template) => template.reduce((total, [, length]) => total + length, 0),
    lastSung = [3, 2, 1, 0].find((bar) => !rests.includes(bar));
  for (let bar = first; bar < 4; bar++) {
    if (rests.includes(bar)) continue;
    const closing = bar === lastSung,
      options = templateBank
        .map((template, index) => ({ template, index }))
        .filter(({ index }) => index !== lastTemplate)
        // Two busy bars in a row would leave the singer no air: keep choruses from running on.
        .filter(({ template }) => kind !== 'chorus' || sung(template) + previousSum <= 24)
        .filter(({ template }) => !closing || template.at(-1)[1] >= 6);
    const { template, index } = pick(
      options.length ? options : [{ template: templateBank[0], index: 0 }],
    );
    lastTemplate = index;
    previousSum = sung(template);
    template.forEach(([start, length], position) => {
      const last = closing && position === template.length - 1,
        strong = start % 8 === 0 || last;
      let best = null;
      for (const degree of candidates) {
        const distance = Math.abs(degree - previous);
        if (distance > (leapped || bar % 2 === 1 ? 3 : 4)) continue;
        if (degree === previous && repeats >= 2) continue;
        let weight =
          distance === 0
            ? 0.8
            : distance === 1
              ? 4
              : distance === 2
                ? 2.5
                : distance === 3
                  ? 1
                  : 0.4;
        const isChordTone = chordTone(degree, chords[bar]);
        if (strong) weight *= isChordTone ? 6 : 0.25;
        else if (isChordTone) weight *= 1.5;
        if (Math.sign(degree - previous) === contour[bar]) weight *= 1.6;
        if (last) {
          // 'open' ends on the chord's third or fifth (a question); otherwise on its root or the tonic.
          const mod = ((degree % 7) + 7) % 7,
            stable =
              ending === 'open'
                ? mod === (chords[bar] + 2) % 7 || mod === (chords[bar] + 4) % 7
                : mod === chords[bar] % 7 || (mod === 0 && chordTone(0, chords[bar]));
          weight *= stable ? 8 : 0.1;
        }
        // A gentle pull toward the middle of the range keeps lines from drifting to the edges.
        weight *= Math.exp(-(((degree - candidates[Math.floor(candidates.length / 2)]) / 6) ** 2));
        const score = weight * (0.6 + random() * 0.8);
        if (!best || score > best.score) best = { degree, score };
      }
      const degree = best ? best.degree : previous;
      if (Math.abs(degree - previous) >= 4) leapped = true;
      else if (Math.abs(degree - previous) > 0) leapped = false;
      repeats = degree === previous ? repeats + 1 : 0;
      previous = degree;
      line.push({
        step: bar * 16 + start,
        // Phrases end with a held note and a rest, never run into the next bar.
        len: last ? Math.min(length, 12) : length,
        degree,
        vel: Math.min(1, 0.78 + (strong ? 0.14 : 0) + (random() - 0.5) * 0.1),
      });
    });
  }
  return line;
}

/**
 * The vocal part for one section: `kind` is intro, verse, pre, chorus, bridge or outro and
 * `occurrence` counts earlier appearances. A chorus keeps its hook across both phrases and across
 * occurrences; only the cadence changes, so the song stays recognisable.
 */
export function composeVocalPhrase(session, kind, occurrence = 0) {
  const chords = session.progs[BANK_OF[kind]][0],
    seed = (session.seed ^ Math.imul(SALT[kind], 0x9e3779b1)) >>> 0,
    bank = TEMPLATES[kind === 'intro' ? 'outro' : kind],
    syllables = SYLLABLES[kind],
    random = mulberry32(seed);
  const plan = (ending, contour) => ({ ending, notes: bank, contour });
  let notes = [];
  if (kind === 'chorus') {
    const hook = composeLine(mulberry32(seed), session, kind, chords, plan('open', [1, 1, -1, -1])),
      answer = composeLine(
        mulberry32(seed ^ 0x5bd1e995),
        session,
        kind,
        chords,
        plan('resolve', [1, 1, -1, -1]),
        hook.filter(({ step }) => step < 48),
      );
    // Both phrases share bars 1-3 (the hook); only the last bar of the second phrase answers it.
    notes = [...hook, ...answer.map((note) => ({ ...note, step: note.step + 64 }))];
    if (occurrence > 0) {
      // The final chorus lifts its closing note one scale step.
      const closing = notes.at(-1);
      closing.degree += pitchOf(session, closing.degree + 1) <= RANGE.chorus[1] + 2 ? 1 : 0;
    }
  } else if (kind === 'pre') {
    notes = composeLine(random, session, kind, chords, plan('open', [1, 1, 1, 1]));
  } else if (kind === 'intro' || kind === 'outro') {
    // Intro and outro hum a fragment of the chorus hook, so the song opens and closes on its theme.
    const hook = composeLine(
      mulberry32((session.seed ^ Math.imul(SALT.chorus, 0x9e3779b1)) >>> 0),
      session,
      'chorus',
      session.progs.lift[0],
      { ending: 'open', notes: TEMPLATES.chorus, contour: [1, 1, -1, -1] },
    );
    notes = hook
      .filter(({ step }) => (kind === 'intro' ? step >= 32 : step < 48))
      .map((note) => ({
        ...note,
        step: note.step - (kind === 'intro' ? 32 : 0),
        vel: note.vel * 0.7,
      }));
  } else {
    // Verses and bridges leave whole bars empty, so the singer breathes and the band is heard.
    const rests = kind === 'verse' ? [[2], [2, 3]] : [[3], [3]],
      first = composeLine(random, session, kind, chords, {
        ...plan('open', [0, 1, -1, 0]),
        rests: rests[0],
      });
    notes = [
      ...first,
      ...composeLine(
        random,
        session,
        kind,
        chords,
        { ...plan('resolve', [1, 0, -1, -1]), rests: rests[1] },
        [],
        first.at(-1).degree,
      ).map((note) => ({ ...note, step: note.step + 64 })),
    ];
  }
  // Syllables are assigned by position inside a four-bar loop, so a repeated hook is sung the same way.
  const sung = new Map();
  return {
    kind,
    occurrence,
    bars: BARS[kind],
    notes: notes.map((note, index) => {
      const slot = note.step % 64;
      if (!sung.has(slot)) sung.set(slot, syllables[sung.size % syllables.length]);
      return {
        ...note,
        midi: pitchOf(session, note.degree),
        syllable: kind === 'verse' && index === 0 ? 'na' : sung.get(slot),
      };
    }),
  };
}
