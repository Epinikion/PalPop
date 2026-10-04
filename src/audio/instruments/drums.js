/**
 * The drum voices the arrangements call. Each one plays a rendered hit from the kit (see kit.js)
 * and only translates the arrangement's vocabulary - velocity, pitch, open/closed - into the kit's.
 * The scales below hold every drum at the loudness its oscillator predecessor had in the mix, so
 * the balance the arrangements were tuned with carries over to the sampled sound.
 */
const GAIN = {
  hat: 3.4,
  open: 3.9,
  clap: 1.85,
  snare: 3,
  shaker: 1.4,
  ride: 0.73,
  crash: 2.7,
  tom: 0.57,
  rim: 2.2,
  ping: 1.6,
  conga: 1.3,
};
/** Equal-loudness gain of each kick variant: thud, punch, long, clean, hard, raw. */
const KICK = [1.17, 1.35, 1.0, 1.2, 0.95, 1.15];
/** Where each tom variant settles, and how the old glide (f0 down to 0.55 f0) is heard. */
const TOM_HZ = [96, 132, 176];
const TOM_GLIDE = 0.7;
const log = Math.log;

export function createDrums({ kit }) {
  /**
   * Kick at `hz` (the kit's own tuning when omitted); `variant` is thud 0, punch 1 or long 2, and
   * `rum` the share fed to the rumble bus on songs that have one.
   */
  function eKick(t, v, duck, rum = 0, hz, variant = 0) {
    kit.eKitKick(t, v * KICK[variant], duck, hz, variant, (rum * 0.34) / KICK[variant]);
  }
  function eHat(t, open, v, pan = 0) {
    kit.eKitHat(t, open, v * (open ? GAIN.open : GAIN.hat), pan);
  }
  function eShaker(t, v, pan = 0) {
    kit.eKitShaker(t, v * GAIN.shaker, pan);
  }
  function eClap(t, v) {
    kit.eKitClap(t, v * GAIN.clap);
  }
  /** `pitch` tunes rolls upward. */
  function eSnare(t, v, pitch = 1) {
    kit.eKitSnare(t, v * GAIN.snare, pitch);
  }
  /** A tom glides from `f0` down; the nearest kit tom, re-pitched, stands in for it. */
  function eTom(t, f0, v) {
    const target = f0 * TOM_GLIDE,
      pitch = TOM_HZ.reduce(
        (best, hz, index) =>
          Math.abs(log(target / hz)) < Math.abs(log(target / TOM_HZ[best])) ? index : best,
        0,
      );
    kit.eKitTom(t, v * GAIN.tom, pitch, 0, target / TOM_HZ[pitch]);
  }
  /** Small percussion between the drums: a tick (rim), a tuned blip (ping) or a conga (tom). */
  function ePerc(t, kind, v, pan = 0, n = 60) {
    if (kind === 'tick') kit.eKitRim(t, v * GAIN.rim, pan);
    else if (kind === 'blip') kit.eKitPing(t, n + 12, v * GAIN.ping, pan);
    else kit.eKitTom(t, v * GAIN.conga, 2, pan, 1.5);
  }
  function eRide(t, v, pan = 0) {
    kit.eKitRide(t, v * GAIN.ride, pan);
  }
  return { eKick, eHat, eShaker, eClap, eSnare, eTom, ePerc, eRide };
}
