/** How long a sung pal keeps glowing after its name (s), and how long the pop at its start lasts. */
const FADE = 0.7;
const POP = 0.3;

/**
 * How brightly each kind of pal glows while the song sings its name: `glow` (0-1) holds while the
 * name is sung and fades after it; `pop` (0-1) is a short burst as the name starts. A cue for tier
 * -1 ("all my pals") lights every pal. `now` is the time being heard, in the audio clock.
 */
export function sungGlow(cues, now, tiers) {
  const glow = new Float32Array(tiers),
    pop = new Float32Array(tiers);
  let any = false;
  for (const cue of cues) {
    const k = now - cue.t;
    if (k < 0 || k > cue.hold + FADE) continue;
    const level = k < cue.hold ? 1 : 1 - (k - cue.hold) / FADE,
      burst = k < POP ? 1 - k / POP : 0,
      from = cue.tier < 0 ? 0 : cue.tier,
      to = cue.tier < 0 ? tiers : cue.tier + 1;
    for (let i = from; i < to; i++) {
      glow[i] = Math.max(glow[i], level);
      pop[i] = Math.max(pop[i], burst);
    }
    any = true;
  }
  return any ? { glow, pop } : null;
}
