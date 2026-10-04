import { CH_MAX } from '../config.js';
import { loadStats } from './records.js';

/**
 * First-run coaching. Each hint is shown until the player has done the thing once, then it is
 * saved as learned and never comes back, so only a new player ever sees them.
 */
export const HINTS = {
  drop: 'DRAG & RELEASE',
  merge: 'SAME PALS MERGE!',
  swap: 'TAP NEXT TO SWAP',
  line: 'STAY UNDER THE LINE!',
  shake: 'FULL BOX? SHAKE IT!',
};
const BASICS = ['drop', 'merge', 'swap'];

/** The hints this player has already learned. Anyone with a finished run knows the basics. */
export function loadHints(store) {
  const saved = store.get('hints', null);
  if (Array.isArray(saved)) return new Set(saved.filter((id) => id in HINTS));
  return new Set(loadStats(store).runs > 0 ? BASICS : []);
}

/** Marks a hint as learned for good; returns true the first time. */
export function learnHint(store, seen, id) {
  if (!(id in HINTS) || seen.has(id)) return false;
  seen.add(id);
  store.set('hints', [...seen]);
  return true;
}

/** The hint to show right now, or null. Order is the order a new player meets the rules. */
export function pickHint(game, seen) {
  if (game.phase !== 'play') return null;
  if (!seen.has('drop') && !game.didDrop) return 'drop';
  if (!seen.has('merge') && !game.didMerge) return 'merge';
  if (!seen.has('swap') && !game.didSwap && game.swaps > 0 && game.merges < 4 && game.score < 12)
    return 'swap';
  if (!seen.has('line') && game.danger) return 'line';
  if (!seen.has('shake') && game.charge >= CH_MAX) return 'shake';
  return null;
}
