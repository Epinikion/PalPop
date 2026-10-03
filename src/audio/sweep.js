/** Cutoff of the DJ-style high-pass at rest: far below the audible range. */
const OPEN = 10;

/**
 * High-pass cutoff for the whole mix: it opens through an intro and closes up through a build,
 * reaching about 900 Hz at the drop, where it snaps back open.
 */
export function sweepFor(section, progress) {
  // The intro stays well below the kick's body (~55 Hz) so it still sounds like a kick.
  if (section === 'INTRO') return OPEN + 80 * (1 - progress) ** 2;
  if (section === 'BUILD' || section === 'PRE') return 30 * 30 ** (progress ** 2);
  return OPEN;
}
