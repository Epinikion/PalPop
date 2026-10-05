import { STYLES } from './styles.js';
import { SCALES, degreeNote, leadVoices } from './scales.js';
import { between, hash, pick, unit, weighted } from './random.js';

const LEVEL = { X: 1, x: 0.8, o: 0.6, '-': 0.4, ',': 0.25, '.': 0 };
/** A drum row ('X...x...') as levels from 0 to 1. */
export const drumRow = (text) => [...text].map((ch) => LEVEL[ch] ?? 0);

/** The notes of a rhythm ('X--X..X-'): where each starts and how many steps it lasts. */
export function rhythmOf(text) {
  const notes = [];
  [...text].forEach((ch, step) => {
    const last = notes.at(-1);
    if (ch === 'X') notes.push({ step, len: 1 });
    else if (ch === '-' && last && last.step + last.len === step) last.len++;
  });
  return notes;
}

/** Brings a note into [low, high] by octaves. */
function fold(note, low, high) {
  while (note > high) note -= 12;
  while (note < low) note += 12;
  return note;
}

/** How a hook moves from note to note, in scale steps, for each kind of hook. */
const MOVES = {
  riff: [
    [0, 4],
    [1, 2],
    [-1, 2],
    [2, 1],
    [-2, 1],
    [3, 0.5],
  ],
  lead: [
    [1, 3],
    [-1, 3],
    [2, 2],
    [-2, 2],
    [0, 1],
    [3, 1],
    [-3, 1],
    [4, 0.5],
  ],
  pluck: [
    [0, 2],
    [1, 2],
    [-1, 2],
    [2, 2],
    [-2, 1],
    [4, 1],
    [-3, 1],
  ],
};

/** Whether a track of a set is its sung one (styles with vocals alternate sung and instrumental tracks). */
export const isVocal = (session, index) => {
  const vocal = STYLES[session.style].vocal;
  return !!vocal && index % vocal.every === 0;
};

/** The length of every section of a track; cheap, so the set can place tracks without composing them. */
export function formOf(session, index) {
  const style = STYLES[session.style],
    seed = hash(session.seed, session.style, 'track', index),
    sung = isVocal(session, index);
  let start = 0;
  const sections = style.form.map((spec, i) => {
    // The first track of a session opens quickly: a game should not wait half a minute for music.
    // A sung track has a fixed form, because its phrases were sung for it.
    const len =
        index === 0 && spec.type === 'INTRO'
          ? 8
          : sung
            ? style.vocal.lengths[i]
            : pick(spec.len, seed, 'len', i),
      section = { index: i, type: spec.type, start, len, variant: spec.variant || 'A', spec };
    start += len;
    return section;
  });
  return { sections, length: start };
}

/**
 * One track of a set: a key, a chord progression from the style's vocabulary, and the loops that
 * play over it - a bass riff, a hook (a short motif carried over every chord, the way real riffs
 * are written, with a lifted variant for the second drop), an arpeggio, stabs and pads - plus the
 * drum grooves and the arrangement. Everything is drawn from the seed and the track's number.
 */
export function composeTrack(session, index, previousPc) {
  const style = STYLES[session.style],
    seed = hash(session.seed, session.style, 'track', index),
    first = index === 0,
    sung = isVocal(session, index),
    pc = sung
      ? style.vocal.pc
      : first
        ? session.pc
        : pick(
            style.keys.filter((key) => key !== previousPc),
            seed,
            'key',
          ),
    scale = sung
      ? style.vocal.scale
      : first
        ? session.scale
        : weighted(style.scales, seed, 'scale'),
    [degrees, chordBars] = sung
      ? style.vocal.progression
      : pick(style.progressions, seed, 'progression'),
    cycleBars = degrees.length * chordBars,
    steps = cycleBars * 16,
    note = (degree, base) => degreeNote(pc, scale, degree, base);

  // --- chords, voiced so each glides into the next ---
  let previous = null;
  const chords = degrees.map((deg, i) => {
    const notes = leadVoices(
      previous,
      [note(deg, 48), note(deg + 2, 48), note(deg + 4, 48)],
      52,
      72,
    );
    previous = notes;
    return { deg, start: i * chordBars * 16, bars: chordBars, notes, root: note(deg, 0) % 12 };
  });
  const chordAtStep = (step) => chords[Math.floor(step / (chordBars * 16)) % chords.length];
  const isChordTone = (degree, chord) => [0, 2, 4].includes((((degree - chord.deg) % 7) + 7) % 7);

  // --- bass: one riff over every chord ---
  const [bassLow, bassHigh] = style.bassRange,
    bassRow = pick(style.bass, seed, 'bass'),
    bass = [];
  for (let bar = 0; bar < cycleBars; bar++) {
    const chord = chordAtStep(bar * 16),
      root = fold(note(chord.deg, 24), bassLow, bassHigh);
    for (const hit of rhythmOfBass(bassRow)) {
      const offset = {
        R: 0,
        O: 12,
        F: fold(note(chord.deg + 4, 24), root, root + 11) - root,
        S: 2,
      }[hit.symbol];
      bass.push({
        step: bar * 16 + hit.step,
        len: hit.len,
        note: root + offset,
        vel: hit.step % 4 === 1 ? 1 : 0.86,
      });
    }
  }

  // --- the hook: a motif, carried over the chords ---
  const hookText = pick(style.hookRhythms, seed, 'hook'),
    motifSteps = hookText.length,
    rhythm = rhythmOf(hookText),
    moves = MOVES[style.hookMoves],
    [hookLow, hookHigh] = style.hookRange;
  let at = pick([0, 2, 4], seed, 'hookstart');
  const motif = rhythm.map((hit, n) => {
    if (n) at = Math.max(-3, Math.min(9, at + weighted(moves, seed, 'move', n)));
    return { ...hit, rel: at };
  });
  const centre = (hookLow + hookHigh) / 2,
    // A riff either moves with the chords (a sequence) or stays put and bends its strong notes to
    // each chord (an anchored top line); both are how real hooks are written.
    carry = unit(seed, 'carry') < 0.5 ? 'sequence' : 'anchor';
  function hookLine(lift) {
    const line = [];
    for (let start = 0; start < steps; start += motifSteps) {
      const instance = [];
      motif.forEach((hit, n) => {
        const step = start + hit.step;
        if (step >= steps) return;
        const chord = chordAtStep(step),
          late = step >= steps / 2,
          root = carry === 'sequence' ? chord.deg : chords[0].deg;
        let degree = root + hit.rel + (lift && late ? 2 : 0);
        // Strong beats land on a note of the chord; the steps between may pass.
        if (step % 4 === 0 && !isChordTone(degree, chord))
          degree += isChordTone(degree + 1, chord) ? 1 : -1;
        // The last note of the loop resolves onto a note of its chord.
        if (n === motif.length - 1 && start + motifSteps >= steps && !isChordTone(degree, chord))
          degree += isChordTone(degree - 1, chord) ? -1 : 1;
        instance.push({
          step,
          len: hit.len,
          pitch: note(degree, 60),
          vel: hit.step % 4 ? 0.85 : 1,
        });
      });
      // One octave for the whole motif, so its intervals stay as they were written.
      const mean = instance.reduce((sum, hit) => sum + hit.pitch, 0) / (instance.length || 1),
        shift = 12 * Math.round((centre - mean) / 12);
      for (const hit of instance)
        line.push({
          step: hit.step,
          len: hit.len,
          note: fold(hit.pitch + shift, hookLow - 2, hookHigh + 2),
          vel: hit.vel,
        });
    }
    return line;
  }

  // --- arpeggio over the chord tones ---
  const arp = [];
  if (style.arp) {
    const arpRhythm = rhythmOf(pick(style.arp.rhythms, seed, 'arprhythm')),
      order = pick(style.arp.orders, seed, 'arporder'),
      [low] = style.arp.range;
    let k = 0;
    for (let bar = 0; bar < cycleBars; bar++) {
      const chord = chordAtStep(bar * 16),
        base = fold(note(chord.deg, 48), low, low + 11),
        tones = [0, 2, 4, 7].map((d) => fold(note(chord.deg + d, 48), base, base + 23));
      tones.sort((a, b) => a - b);
      for (const hit of arpRhythm)
        arp.push({
          step: bar * 16 + hit.step,
          len: 1,
          note: tones[order[k++ % order.length]],
          vel: hit.step % 4 ? 0.8 : 1,
        });
    }
  }

  // --- chord stabs ---
  const stab = [];
  if (style.stabRhythms) {
    const stabRhythm = rhythmOf(pick(style.stabRhythms, seed, 'stab'));
    for (let bar = 0; bar < cycleBars; bar++) {
      const chord = chordAtStep(bar * 16),
        notes = [chord.notes[0], chord.notes[2], chord.notes[0] + 12].map((n) => fold(n, 55, 76));
      for (const hit of stabRhythm)
        stab.push({ step: bar * 16 + hit.step, len: hit.len, notes, vel: 1 });
    }
  }

  // --- pads: the chords, held ---
  const pad = chords.map((chord) => ({
    step: chord.start,
    len: chord.bars * 16,
    notes: chord.notes,
    vel: 1,
  }));

  // --- drums ---
  const rows = Object.fromEntries(
    Object.entries(style.drums).map(([name, options]) => [
      name,
      { a: pick(options, seed, 'drum', name), b: pick(options, seed, 'drumB', name) },
    ]),
  );

  const { sections, length } = formOf(session, index);
  // The sung phrases of a sung track: where each starts (bar in the track) and how long it lasts.
  const vocals = sung
    ? sections.flatMap((section, i) =>
        style.vocal.cues[i].map(([bar, phrase, harmony]) => ({
          bar: section.start + bar,
          phrase,
          harmony: harmony || null,
          bars: style.vocal.phrases[phrase],
        })),
      )
    : [];
  return {
    index,
    seed,
    style: session.style,
    pc,
    scale,
    cycleBars,
    chordBars,
    chords,
    loops: {
      bass,
      hookA: hookLine(false),
      hookB: hookLine(true),
      arp,
      stab,
      pad,
    },
    rows,
    // How this track's sounds differ from the last one's: detune, brightness, character.
    sound: {
      ...style.sound,
      detune: 0.8 + 0.4 * unit(seed, 'detune'),
      bright: unit(seed, 'bright'),
      character: between(0, 2, seed, 'character'),
    },
    sections,
    length,
    sung,
    vocals,
  };
}

/** A bass row's notes, each with its symbol (R, O, F or S). */
function rhythmOfBass(text) {
  const notes = [];
  [...text].forEach((ch, step) => {
    const last = notes.at(-1);
    if ('ROFS'.includes(ch)) notes.push({ step, len: 1, symbol: ch });
    else if (ch === '-' && last && last.step + last.len === step) last.len++;
  });
  return notes;
}

export { SCALES };
