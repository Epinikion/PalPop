import { degreeNote, leadVoices, stack, suspend } from './scales.js';
import { BLOCK, between, pick, unit, weighted } from './random.js';

/** Which scale degrees (0 to 6) a chord of this quality is built from. */
function chordDegrees(root, quality) {
  if (quality === 'sus2' || quality === 'sus4') return suspend(root, quality);
  if (quality === 'seventh') return stack(root, 4);
  if (quality === 'ninth') return [root, root + 2, root + 4, root + 8];
  if (quality === 'power') return [root, root + 4, root + 7];
  return stack(root, 3);
}

/**
 * The harmony of a song as a pure function of the bar. Progressions come in phrases (a few bars
 * long); each phrase either repeats the last one, changes a single chord, or starts a new walk
 * over the profile's chord graph, so a groove stays recognisable for a while and then moves on.
 * A block of sixteen phrases starts from a fresh walk. Voicings glide from each chord to the next, and the colour (triads, suspended chords, sevenths)
 * drifts over a longer span.
 */
export function createHarmony(session, profile) {
  const { seed, pc, scale } = session,
    spec = profile.harmony,
    barsPer = profile.phraseBars,
    memo = new Map();

  function walk(start, count, p) {
    const degrees = [start];
    while (degrees.length < count) {
      const from = degrees.at(-1),
        options = spec.moves[from] || spec.moves[0];
      degrees.push(weighted(options, seed, 'walk', p, degrees.length));
    }
    return degrees;
  }
  function shape(p) {
    return pick(spec.loops, seed, 'loop', p);
  }
  function qualityFor(p) {
    // The colour changes every few phrases: a long, slow drift rather than a new sound each time.
    return weighted(spec.qualities, seed, 'quality', Math.floor(p / 3));
  }
  function build(p) {
    const previous = p % BLOCK ? memo.get(p - 1) : undefined,
      draw = unit(seed, 'harmony', p);
    let slots;
    if (!previous) {
      const lengths = shape(p),
        degrees = walk(weighted(spec.start, seed, 'start'), lengths.length, p);
      slots = lengths.map((bars, i) => ({ deg: degrees[i], bars }));
    } else if (draw < spec.keep) slots = previous.slots.map((slot) => ({ ...slot }));
    else if (draw < spec.keep + spec.tweak) {
      slots = previous.slots.map((slot) => ({ ...slot }));
      const at = between(0, slots.length - 1, seed, 'tweak', p),
        before = slots[(at + slots.length - 1) % slots.length].deg;
      slots[at].deg = weighted(spec.moves[before] || spec.moves[0], seed, 'tweaked', p);
    } else {
      const lengths = shape(p),
        degrees = walk(
          weighted(spec.moves[previous.slots.at(-1).deg] || spec.start, seed, 'again', p),
          lengths.length,
          p,
        );
      slots = lengths.map((bars, i) => ({ deg: degrees[i], bars }));
    }
    const quality = qualityFor(p);
    let last = previous?.slots.at(-1)?.notes;
    slots.forEach((slot) => {
      const degrees = chordDegrees(slot.deg, quality),
        notes = degrees.map((d) => degreeNote(pc, scale, d, 48));
      slot.quality = quality;
      slot.notes = leadVoices(last, notes);
      slot.bass = 28 + ((degreeNote(pc, scale, slot.deg, 0) - 4 + 1200) % 12);
      last = slot.notes;
    });
    return { slots, quality };
  }
  function phrase(p) {
    if (!memo.has(p)) {
      const start = p - (p % BLOCK);
      for (let q = start; q <= p; q++) if (!memo.has(q)) memo.set(q, build(q));
      // Only the neighbouring blocks are kept: a long session never grows this table.
      for (const key of memo.keys())
        if (key < start - BLOCK || key >= start + 2 * BLOCK) memo.delete(key);
    }
    return memo.get(p);
  }
  /** The chord that sounds in this bar: { deg, quality, notes, bass, slot, from, bars }. */
  function chordAt(bar) {
    bar = Math.max(0, Math.floor(bar));
    const p = Math.floor(bar / barsPer),
      local = bar % barsPer;
    let start = 0;
    for (const slot of phrase(p).slots) {
      if (local < start + slot.bars) return { ...slot, from: p * barsPer + start };
      start += slot.bars;
    }
    const slot = phrase(p).slots.at(-1);
    return { ...slot, from: p * barsPer };
  }
  return { chordAt, phrase, barsPer, size: () => memo.size };
}
