import { degreeNote, SCALES } from './scales.js';
import { BLOCK, between, drift, unit, weighted } from './random.js';

const STEPS = 16;
const empty = () => new Array(STEPS).fill(0);

/** A sixteen-character row such as 'X...x...o...,...' becomes probabilities (X always, . never). */
export const row = (text) =>
  [...text.replace(/ /g, '')].map(
    (ch) => ({ X: 1, x: 0.85, o: 0.55, c: 0.35, ',': 0.18, '.': 0 })[ch],
  );

/**
 * The layers of one bar, drawn from the profile's templates. Every layer owns a pattern that
 * evolves from phrase to phrase: a few steps are drawn again from the template, the rest stay as
 * they were, so a groove keeps its character yet is never the same two phrases running. Each
 * answer depends only on the seed and the place, so any bar can be computed at any time.
 */
export function createLayers(session, profile, harmony, form) {
  const { seed, pc, scale } = session,
    spec = profile.layers,
    barsPer = profile.phraseBars,
    states = new Map();

  /**
   * An array of sixteen values that is redrawn a little each phrase; `sample(step, phrase)` draws
   * one. A block of phrases starts from a fresh draw and evolves from there.
   */
  function evolve(key, phrase, mutate, sample) {
    const block = Math.floor(phrase / BLOCK);
    if (!states.has(key)) states.set(key, new Map());
    const blocks = states.get(key);
    if (!blocks.has(block)) {
      blocks.set(block, []);
      for (const old of blocks.keys()) if (old < block - 1 || old > block + 1) blocks.delete(old);
    }
    const list = blocks.get(block),
      at = phrase - block * BLOCK;
    while (list.length <= at) {
      const j = list.length,
        k = block * BLOCK + j,
        before = list[j - 1];
      list.push(
        Array.from({ length: STEPS }, (_, i) =>
          !before || unit(seed, 'mut', key, k, i) < mutate ? sample(i, k) : before[i],
        ),
      );
    }
    return list[at];
  }
  const maskOf = (name, phrase) => {
    const { tpl, mutate = 0.2 } = spec[name];
    return evolve(`${name}:mask`, phrase, mutate, (i, k) =>
      unit(seed, name, 'on', i, k) < tpl[i] ? 1 : 0,
    );
  };
  const velocity = (name, bar, i, low = 0.78, high = 1) =>
    low + (high - low) * unit(seed, 'vel', name, bar, i);

  /** The pitches a layer may play in a range, from a chord's notes or from the scale around its root. */
  function tones(chord, range, mode) {
    const [low, high] = range,
      found = [];
    if (mode === 'scale') {
      for (let degree = chord.deg - 14; degree <= chord.deg + 21; degree++) {
        const note = degreeNote(pc, scale, degree, 48);
        if (note >= low && note <= high) found.push(note);
      }
    } else
      for (const base of chord.notes)
        for (let note = base - 48; note <= base + 48; note += 12)
          if (note >= low && note <= high) found.push(note);
    return [...new Set(found)].sort((a, b) => a - b);
  }
  /** The index of the chord's lowest note inside the list, so patterns can be written from the root up. */
  const rootIndex = (list, chord, mode) => {
    const target = mode === 'scale' ? degreeNote(pc, scale, chord.deg, 48) : chord.notes[0];
    let best = 0;
    list.forEach((note, i) => {
      if (Math.abs(note - target) < Math.abs(list[best] - target)) best = i;
    });
    return best;
  };

  /** Everything that plays in `bar`, as plain data. */
  function plan(bar) {
    const segment = form.segmentAt(bar),
      section = form.sectionAt(bar),
      on = form.layersAt(bar),
      chord = harmony.chordAt(bar),
      p = Math.floor(bar / barsPer),
      lastOfPhrase = bar % barsPer === barsPer - 1,
      { sec, bs, len, progress, energy } = section,
      build = sec === 'BUILD',
      lastBar = bs === len - 1,
      dropout =
        build &&
        lastBar &&
        spec.kick.dropout &&
        unit(seed, 'dropout', segment.index) < spec.kick.dropout,
      out = {
        bar,
        phrase: p,
        sec,
        bs,
        len,
        energy,
        level: 0.78 + 0.22 * energy,
        progress,
        segment: segment.index,
        chord,
        on,
        dropout,
        kick: empty(),
        hat: empty(),
        open: empty(),
        clap: empty(),
        snare: empty(),
        perc: [],
        bass: [],
        stab: [],
        arp: [],
        lead: [],
        acid: [],
        pad: null,
        fx: {},
        filter: drift(seed, 'filter', bar / 6),
        width: drift(seed, 'width', bar / 10),
      };

    // --- kick: straight, rolling through the end of a build, silent on the last beat before a drop ---
    if (on.kick) {
      spec.kick.tpl.forEach((chance, i) => {
        if (chance > 0) out.kick[i] = (i % 4 === 0 ? 1 : 0.85) * velocity('kick', bar, i, 0.94, 1);
      });
      const roll = spec.kick.roll;
      if (build && roll && len - bs <= roll) {
        const t = (bs - (len - roll)) / roll,
          interval = t < 0.4 ? 4 : t < 0.75 ? 2 : 1;
        for (let i = 0; i < STEPS; i += interval)
          out.kick[i] = Math.max(out.kick[i], 0.7 + 0.3 * t) * velocity('kick', bar, i, 0.9, 1);
      }
      // A short kick roll into the next phrase now and then, so the floor does not stay flat forever.
      if (spec.kick.fill && lastOfPhrase && !build && unit(seed, 'kickfill', bar) < spec.kick.fill)
        for (const i of [11, 13, 14, 15]) out.kick[i] = 0.7 * velocity('kick', bar, i, 0.9, 1);
      if (dropout) for (let i = 12; i < STEPS; i++) out.kick[i] = 0;
    }

    // --- bass: a pattern that drifts, over notes drawn from the chord ---
    if (on.bass) {
      const { notes, lens, range = [28, 47], mutate = 0.18 } = spec.bass,
        mask = maskOf('bass', p),
        pool = evolve('bass:note', p, mutate, (i, k) => weighted(notes, seed, 'bassnote', i, k)),
        long = evolve('bass:len', p, mutate, (i, k) => weighted(lens, seed, 'basslen', i, k));
      for (let i = 0; i < STEPS; i++) {
        if (!mask[i] || (dropout && i >= 12)) continue;
        const [offset, octave] = pool[i];
        let note = degreeNote(pc, scale, chord.deg + offset, 24) + 12 * octave;
        while (note > range[1]) note -= 12;
        while (note < range[0]) note += 12;
        out.bass.push({
          si: i,
          note,
          len: long[i],
          vel: (i % 4 === 3 ? 1 : 0.85) * velocity('bass', bar, i, 0.85, 1),
        });
      }
    }

    // --- drums above the kick ---
    const accent = (i) => (i % 4 === 2 ? 1 : i % 2 ? 0.55 : 0.75);
    if (on.hat) {
      const mask = maskOf('hat', p);
      mask.forEach((hit, i) => {
        if (hit) out.hat[i] = accent(i) * velocity('hat', bar, i, 0.7, 1);
      });
    }
    if (on.open) {
      const mask = maskOf('open', p);
      mask.forEach((hit, i) => {
        if (hit) out.open[i] = velocity('open', bar, i, 0.75, 1);
      });
    }
    if (on.clap) {
      const mask = maskOf('clap', p);
      mask.forEach((hit, i) => {
        if (hit) out.clap[i] = (i === 4 || i === 12 ? 1 : 0.5) * velocity('clap', bar, i, 0.85, 1);
      });
    }
    if (on.perc) {
      const { kinds, mutate = 0.25 } = spec.perc,
        mask = maskOf('perc', p),
        kind = evolve('perc:kind', p, mutate, (i, k) => weighted(kinds, seed, 'perckind', i, k));
      mask.forEach((hit, i) => {
        if (hit) out.perc.push({ si: i, kind: kind[i], vel: velocity('perc', bar, i, 0.65, 1) });
      });
    }
    // Snare: a roll that quickens through the end of a build, and a fill at the end of some phrases.
    const roll = spec.snare?.roll;
    if (build && roll && len - bs <= roll) {
      const t = (bs - (len - roll)) / roll,
        interval = t < 0.3 ? 4 : t < 0.6 ? 2 : 1;
      for (let i = 0; i < STEPS; i += interval)
        out.snare[i] = (0.35 + 0.65 * t) * velocity('snare', bar, i, 0.9, 1);
      if (dropout) for (let i = 12; i < STEPS; i++) out.snare[i] = 0;
    } else if (
      spec.snare?.fill &&
      lastOfPhrase &&
      (sec === 'DROP' || sec === 'GROOVE') &&
      unit(seed, 'snarefill', bar) < spec.snare.fill
    )
      for (const i of [10, 12, 13, 14, 15]) out.snare[i] = 0.55 + 0.05 * (i - 10);

    // --- harmony and melody ---
    if (on.stab) {
      const { len: lens, mutate = 0.25 } = spec.stab,
        mask = maskOf('stab', p),
        hold = evolve('stab:len', p, mutate, (i, k) => weighted(lens, seed, 'stablen', i, k));
      mask.forEach((hit, i) => {
        if (hit && !(dropout && i >= 12))
          out.stab.push({
            si: i,
            notes: chord.notes,
            len: hold[i],
            vel: velocity('stab', bar, i, 0.8, 1),
          });
      });
    }
    for (const name of ['arp', 'acid']) {
      if (!on[name]) continue;
      const { tpl, range, mode = 'chord', pool, mutate = 0.22, accent: accents } = spec[name],
        list = tones(chord, range, mode),
        base = rootIndex(list, chord, mode),
        pattern = evolve(`${name}:idx`, p, mutate, (i, k) =>
          unit(seed, name, 'has', i, k) < tpl[i] ? weighted(pool, seed, name, 'pick', i, k) : null,
        ),
        flags = evolve(
          `${name}:flag`,
          p,
          mutate,
          (i, k) => unit(seed, name, 'flag', i, k) < (accents ?? 0.25),
        );
      pattern.forEach((offset, i) => {
        if (offset === null || !list.length || (dropout && i >= 12)) return;
        const note = list[Math.min(list.length - 1, Math.max(0, base + offset))];
        const event = {
          si: i,
          note,
          len: spec[name].len,
          vel: velocity(name, bar, i, 0.7, 1) * (flags[i] ? 1 : 0.8),
        };
        if (name === 'acid') {
          event.accent = flags[i];
          event.slide = pattern[(i + 15) % STEPS] !== null && unit(seed, 'slide', bar, i) < 0.25;
          event.from = event.slide
            ? list[Math.min(list.length - 1, Math.max(0, base + pattern[(i + 15) % STEPS]))]
            : 0;
        }
        out[name].push(event);
      });
    }
    if (on.lead && leadBars(segment.index, Math.floor(bs / barsPer))[bar % 4]) {
      const { range, ideaPhrases = 4 } = spec.lead,
        local = Math.floor(bs / barsPer),
        idea = Math.floor(local / ideaPhrases),
        motif = leadMotif(segment.index, idea, chord.deg, range),
        half = bar % 2;
      motif.forEach((note, n) => {
        if (note.step >= half * STEPS && note.step < (half + 1) * STEPS)
          out.lead.push({
            si: note.step - half * STEPS,
            note: note.note,
            len: note.len,
            vel: note.vel,
            from: n && motif[n - 1].step + motif[n - 1].len >= note.step ? motif[n - 1].note : 0,
          });
      });
    }
    if (on.pad && bar === chord.from)
      out.pad = { notes: chord.notes, bars: Math.max(1, chord.bars) };

    // --- transitions ---
    const fx = out.fx;
    if (build && bs === Math.max(0, len - 3)) fx.riser = (len - bs) * STEPS;
    if (build && lastBar) fx.swell = true;
    if (sec === 'DROP' && bs === 0) {
      fx.impact = true;
      fx.crash = 'long';
    } else if (
      bs > 0 &&
      bs % barsPer === 0 &&
      (sec === 'DROP' || sec === 'GROOVE') &&
      unit(seed, 'crash', bar) < 0.6
    )
      fx.crash = 'short';
    if (sec === 'BREAK' && bs === 0) {
      fx.downlifter = true;
      fx.impact = 'soft';
    }
    if (sec === 'BREAK' && lastBar) fx.swell = true;
    return out;
  }

  /** Which bars of a phrase the lead sings in: it answers and rests instead of droning on. */
  const LEAD_BARS = [
    [1, 1, 0, 0],
    [1, 1, 1, 0],
    [1, 0, 1, 0],
    [1, 1, 1, 1],
    [0, 1, 1, 0],
  ];
  const leadBars = (segmentIndex, local) =>
    LEAD_BARS[between(0, LEAD_BARS.length - 1, seed, 'leadbars', segmentIndex, local)];

  /** A short melodic idea over two bars: stepwise mostly, ending on a note of the chord. */
  const motifs = new Map();
  function leadMotif(segmentIndex, idea, degree, range) {
    const key = `${segmentIndex}:${idea}`;
    if (!motifs.has(key)) {
      const { rhythms } = spec.lead,
        rhythm = rhythms[between(0, rhythms.length - 1, seed, 'rhythm', key)],
        notes = [];
      let at = between(0, 4, seed, 'start', key);
      rhythm.forEach(([step, length], n) => {
        const move = weighted(
          [
            [0, 2],
            [1, 3],
            [-1, 3],
            [2, 1],
            [-2, 1],
            [4, 0.5],
            [-3, 0.5],
          ],
          seed,
          'move',
          key,
          n,
        );
        at = Math.max(-3, Math.min(8, at + move));
        notes.push({ step, len: length, rel: at, vel: 0.8 + 0.2 * unit(seed, 'lv', key, n) });
      });
      motifs.set(key, notes);
      if (motifs.size > 24) motifs.delete(motifs.keys().next().value);
    }
    return motifs.get(key).map((note) => {
      let pitch = degreeNote(pc, scale, degree + note.rel, 48);
      while (pitch < range[0]) pitch += 12;
      while (pitch > range[1]) pitch -= 12;
      return { step: note.step, len: note.len, vel: note.vel, note: pitch };
    });
  }

  const cache = new Map();
  return {
    plan(bar) {
      bar = Math.max(0, Math.floor(bar));
      if (!cache.has(bar)) {
        cache.set(bar, plan(bar));
        if (cache.size > 24) cache.delete(cache.keys().next().value);
      }
      return cache.get(bar);
    },
    scale: SCALES[scale],
    /** How many remembered items there are (bars, motifs, evolving patterns): a bound, for tests. */
    size: () =>
      cache.size + motifs.size + [...states.values()].reduce((sum, blocks) => sum + blocks.size, 0),
  };
}
