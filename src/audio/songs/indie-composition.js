import { mulberry32 } from '../../core/math.js';
import { composeVocalSession } from './vocal-composition.js';

const MAJOR = { n: 'MAJOR', s: [0, 2, 4, 5, 7, 9, 11] };
/**
 * Four-chord loops in E major, one chord per bar, as degrees of the scale: 5 is C# minor, 3 is A,
 * 0 is E, 4 is B, 1 is F# minor. The song this style is voiced after turns on C#m, A, E, E.
 */
const PROGRESSIONS = {
  main: [
    [5, 3, 0, 0],
    [5, 3, 0, 4],
  ],
  pre: [
    [3, 3, 4, 4],
    [1, 3, 4, 4],
  ],
  lift: [
    [5, 3, 0, 4],
    [5, 3, 0, 0],
  ],
  brk: [
    [5, 1, 0, 0],
    [1, 3, 0, 4],
  ],
};
/**
 * 64-bar forms. Long grooves, one real breakdown without the kick, and a short outro. Every
 * section is a multiple of four bars, so each chord loop starts on a section.
 */
export const INDIE_FORMS = [
  [
    [4, 'INTRO'],
    [16, 'VERSE'],
    [20, 'PRE'],
    [36, 'CHORUS'],
    [48, 'BREAK'],
    [52, 'PRE'],
    [60, 'CHORUS'],
    [64, 'OUTRO'],
  ],
  [
    [8, 'VERSE'],
    [12, 'PRE'],
    [28, 'CHORUS'],
    [40, 'BREAK'],
    [44, 'PRE'],
    [60, 'CHORUS'],
    [64, 'OUTRO'],
  ],
  [
    [8, 'CHORUS'],
    [20, 'VERSE'],
    [24, 'PRE'],
    [40, 'CHORUS'],
    [52, 'BREAK'],
    [56, 'PRE'],
    [64, 'CHORUS'],
  ],
];

/**
 * An indie-dance song: bright and warm at about 123 BPM, always in E major, a sung hook over a
 * four-on-the-floor kick with an off-beat bass. Tempo and key stay for the session; the chord
 * loops, melodies and forms renew every 64 bars.
 */
export function composeIndieSession(seed, tonal) {
  const random = mulberry32(seed ^ 0x1ed1e),
    pick = (items) => items[Math.floor(random() * items.length)],
    base = composeVocalSession(seed, {
      kname: 'E',
      pc: 4,
      mode: MAJOR,
      bpm: tonal?.bpm || 122 + Math.floor(random() * 3),
    });
  return {
    ...base,
    style: 'indie',
    swing: 0.004,
    progs: {
      main: [pick(PROGRESSIONS.main)],
      pre: [pick(PROGRESSIONS.pre)],
      lift: [pick(PROGRESSIONS.lift)],
      brk: [pick(PROGRESSIONS.brk)],
    },
    color: 0.45 + random() * 0.35,
  };
}

export function renewIndieChapter(seed, session, random) {
  const chapter = composeIndieSession(seed, session);
  chapter.form = INDIE_FORMS[1 + Math.floor(random() * 2)];
  return chapter;
}
