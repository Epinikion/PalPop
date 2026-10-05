/** How quickly a pal settles back after a kick (s), and how much bigger it looks on the beat. */
const DECAY = 0.13;
export const BEAT_GROW = 0.06;

/**
 * How strongly the board pulses at `now` (0-1): the most recent kick that has sounded, by its
 * strength, falling away quickly after it.
 */
export function beatPulse(beats, now) {
  let pulse = 0;
  for (let i = beats.length - 1; i >= 0; i--) {
    const k = now - beats[i].t;
    if (k < 0) continue;
    if (k > DECAY * 6) break;
    pulse = Math.max(pulse, beats[i].v * Math.exp(-k / DECAY));
  }
  return pulse;
}
