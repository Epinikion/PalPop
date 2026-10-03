import { TRACKS } from './catalog.js';
import { mulberry32 } from '../core/math.js';
import { SONG_STYLES } from './song-registry.js';
export function createAudioComposition({ audio }) {
  const MCONTOUR = [0, 1, 2, 3, 4, 5, 7, 9]; /* merge melody contour in pentatonic steps */
  /* arrangement forms: cyc 0 introduces the track, later cycles rotate through three different forms */

  function sectionAt(bar) {
    bar = Math.max(0, Math.floor(bar));
    const cyc = Math.floor(bar / 64),
      b = bar % 64,
      f =
        cyc === 0
          ? SONG_STYLES[audio.session?.style || TRACKS[audio.trackId].style].introForm
          : chapterFor(cyc).form;
    let s = 0;
    for (let k = 0; k < f.length; k++) {
      if (b < f[k][0])
        return {
          sec: f[k][1],
          bs: b - s,
          len: f[k][0] - s,
          cyc,
        };
      s = f[k][0];
    }
    return {
      sec: 'FINAL',
      bs: b - s,
      len: 64 - s,
      cyc,
    };
  }
  const LOOK = 0.24;
  /* New musical material every 64 bars, with one familiar acid phrase as an anchor.
     Keep only three chapters: a long session has constant composition memory. */

  function chapterFor(cyc) {
    if (cyc === 0) return audio.session;
    if (audio.chapters.has(cyc)) return audio.chapters.get(cyc);
    const seed = (audio.seed ^ Math.imul(cyc, 0x9e3779b9)) >>> 0,
      R = mulberry32(seed);
    const style = SONG_STYLES[audio.session.style];
    const chapter = style.renewChapter(seed, audio.session, R);
    audio.chapters.set(cyc, chapter);
    if (audio.chapters.size > 3) audio.chapters.delete(audio.chapters.keys().next().value);
    return chapter;
  }
  /* chord for a bar: bass note (E1..D#2 range), four stacked thirds in the scale (mid register).
     progression bank rotates with the cycle, voicing flips every 8 bars - chords never loop the same way. */
  function chordFor(bar, sec, cyc) {
    const S = chapterFor(cyc || 0);
    const bank =
      sec === 'BREAK'
        ? S.progs.brk
        : sec === 'PEAK' || sec === 'FINAL'
          ? S.progs.lift
          : S.progs.main;
    const prog = bank[(S.style === 'dance' ? Math.floor(bar / 8) : cyc || 0) % bank.length],
      deg = prog[(S.barsPerChord ? Math.floor(bar / S.barsPerChord) : bar) % 4],
      sc = S.mode.s,
      notes = [];
    const inv = (Math.floor(bar / 8) + (cyc || 0)) % 2;
    for (let k = 0; k < (S.style === 'festival' ? 3 : 4); k++) {
      const i = deg + 2 * k;
      let n = 48 + S.pc + sc[i % 7] + 12 * Math.floor(i / 7);
      if (inv && k === 3) n -= 12;
      notes.push(n);
    }
    if (S.style === 'festival') {
      // Compact, stable piano inversions keep large root jumps out of the hook's register.
      for (let i = 0; i < notes.length; i++) {
        while (notes[i] > 71) notes[i] -= 12;
        while (notes[i] < 52) notes[i] += 12;
      }
      notes.sort((a, b) => a - b);
    }
    return {
      deg,
      bass: 28 + ((((S.pc + sc[deg]) % 12) - 4 + 12) % 12),
      notes,
    };
  }
  const pentNote = (idx) =>
    audio.session.pc + 60 + audio.session.pent[idx % 5] + 12 * Math.floor(idx / 5);
  function composeSession(seed, tonal) {
    return SONG_STYLES[tonal?.style || TRACKS[audio.trackId].style].compose(seed, tonal);
  }

  /* ---------- graph ---------- */
  return {
    sectionAt,
    chapterFor,
    chordFor,
    pentNote,
    LOOK,
    MCONTOUR,
    composeSession,
  };
}
