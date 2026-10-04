/**
 * Deterministic randomness for a generator that must give the same answer for the same place no
 * matter when it is asked: everything is a pure function of a seed and some coordinates (bar,
 * step, layer name), so any bar can be recomputed, and a test can replay a whole song.
 */
const text = (value) => {
  if (typeof value === 'number') return value | 0;
  let h = 0x811c9dc5;
  for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h | 0;
};

/** A 32-bit hash of any mix of numbers and words. */
export function hash(...parts) {
  let h = 0x9e3779b9;
  for (const part of parts) {
    h = Math.imul(h ^ text(part), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** A number in [0, 1) that belongs to these coordinates. */
export const unit = (...parts) => hash(...parts) / 4294967296;

/** One of the items, chosen by the coordinates. */
export const pick = (items, ...parts) => items[Math.floor(unit(...parts) * items.length)];

/** One of `[value, weight]` entries, chosen by the coordinates. */
export function weighted(entries, ...parts) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = unit(...parts) * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries.at(-1)[0];
}

/** An integer in [low, high] that belongs to these coordinates. */
export const between = (low, high, ...parts) => low + Math.floor(unit(...parts) * (high - low + 1));

/** Smooth noise in [0, 1] along a continuous position: a slow drift that never repeats. */
export function drift(seed, name, position) {
  const i = Math.floor(position),
    f = position - i,
    s = f * f * (3 - 2 * f);
  return unit(seed, name, i) * (1 - s) + unit(seed, name, i + 1) * s;
}

/**
 * Phrases evolve from one to the next, but only inside a block of this many phrases: at a block's
 * start everything is drawn fresh. After that many small changes a groove has drifted into
 * something new anyway, so the seam is not heard, and memory and recomputation stay bounded in a
 * session of any length.
 */
export const BLOCK = 16;
