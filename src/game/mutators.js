import { dailySeed } from './records.js';

/**
 * Run modifiers. A mutator bends one rule and moves the score to match: the harder it makes the
 * run the more it pays, the easier the less. One unlocks at every other level from level 4, and
 * after a run the panel offers two of the unlocked ones; tapping a card IS the retry. Fields
 * left out keep the normal rules.
 */
export const MUTATORS = [
  {
    id: 'lucky',
    name: 'LUCKY',
    level: 4,
    mult: 0.9,
    desc: 'SPECIAL PALS COME TWO AND A HALF TIMES AS OFTEN. SCORE X0.9',
    luck: 2.5,
  },
  {
    id: 'heavy',
    name: 'HEAVY',
    level: 6,
    mult: 1.5,
    desc: 'EVERYTHING FALLS AND DROPS FASTER. SCORE X1.5',
    pace: 1.2,
  },
  {
    id: 'fizz',
    name: 'FEVER FIZZ',
    level: 8,
    mult: 1,
    desc: 'FEVER CHARGES 60% FASTER BUT LASTS ONLY SIX SECONDS',
    feverGain: 1.6,
    feverTime: 6,
  },
  {
    id: 'fuse',
    name: 'LONG FUSE',
    level: 10,
    mult: 0.8,
    desc: 'THREE SECONDS TO FIX A FULL BOX. SCORE X0.8',
    fuse: 3,
  },
  {
    id: 'noswap',
    name: 'NO SWAP',
    level: 12,
    mult: 1.5,
    desc: 'THE PAL YOU GET IS THE PAL YOU DROP. SCORE X1.5',
    swaps: 0,
  },
  {
    id: 'big',
    name: 'BIG SHOTS',
    level: 14,
    mult: 1.4,
    desc: 'BIGGER PALS ARRIVE FROM THE START. SCORE X1.4',
    weights: [14, 20, 24, 24, 18],
  },
  {
    id: 'small',
    name: 'SMALL FRY',
    level: 16,
    mult: 0.8,
    desc: 'ONLY THE SMALLEST PALS ARRIVE. SCORE X0.8',
    weights: [48, 32, 14, 5, 1],
  },
];

export const mutatorById = (id) => MUTATORS.find((m) => m.id === id) || null;
export const unlockedMutators = (level) => MUTATORS.filter((m) => m.level <= level);
/** Mutators that become available when the level rises from `from` to `to`. */
export const newMutators = (from, to) => MUTATORS.filter((m) => m.level > from && m.level <= to);

/** Up to two unlocked mutators to offer, preferring ones other than the last one played. */
export function offerMutators(level, random, last = null) {
  const pool = unlockedMutators(level),
    fresh = pool.filter((m) => m.id !== last),
    from = (fresh.length >= 2 ? fresh : pool).slice(),
    offer = [];
  while (offer.length < 2 && from.length)
    offer.push(from.splice(Math.floor(random() * from.length), 1)[0]);
  return offer;
}

/** The day's mutator, the same for everyone; one day in three is played as it comes. */
export function dailyMutator(key) {
  const seed = dailySeed(key);
  return seed % 3 === 0 ? null : MUTATORS[(seed >>> 4) % MUTATORS.length];
}
