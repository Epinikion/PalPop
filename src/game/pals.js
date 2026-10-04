import { BOOMER, H, MAXT, PRISM, SPAWN_Y, SPECIALS, TIERS } from '../config.js';
import { store } from '../core/storage.js';
export function createGamePals({ game }) {
  /** @returns {import('./types.js').Pal} */
  function mk(t, x, y) {
    const T = TIERS[t];
    return {
      t,
      x,
      y,
      vx: 0,
      vy: 0,
      r: T.r,
      iw: 1 / (T.r * T.r),
      age: 0,
      s: 1,
      sv: 0,
      q: 0,
      qv: 0,
      flash: 0,
      ot: 0,
      mg: false,
      dead: false,
      id: ++game.nextBodyId,
      bt: 1 + Math.random() * 4,
      bl: 0,
    };
  }
  const mkHeld = (t) => ({
    t,
    x: game.carrierX,
    y: SPAWN_Y,
    s: 0.3,
    sv: 0,
    bt: 2 + Math.random() * 3,
    bl: 0,
  });
  /** Height of the highest pal's top edge: small means a dangerous pile. */
  const pileTop = () => game.bodies.reduce((top, b) => Math.min(top, b.y - b.r), H);
  /**
   * The next pal. Every random choice comes from `game.rand`, so a daily run deals the same pals
   * to everyone; there the specials on offer do not depend on the player's level either.
   * Bigger pals arrive as the run goes on (by drops, not score: tempo must not set difficulty).
   */
  function pick() {
    const rand = game.rand;
    if (game.pickCount++ < 2) return 0;
    const L = game.daily ? Infinity : store.get('lvl', 1),
      av = SPECIALS.filter((x) => x.t === PRISM || L >= x.req),
      open = !(game.held && game.held.t >= PRISM) && game.nextTier < PRISM;
    // Once a Solis stands in the box the Sun is one wildcard away, and the game makes sure it comes.
    if (
      open &&
      game.drops - game.lastSpecialDrop >= 10 &&
      game.bodies.some((b) => b.t === MAXT && !b.dead)
    ) {
      game.lastSpecialDrop = game.drops;
      return PRISM;
    }
    // A pile that has climbed into the top half, with no special for a while, is owed a Boomer.
    if (
      open &&
      game.drops >= 10 &&
      game.drops - game.lastSpecialDrop >= 25 &&
      pileTop() < 100 &&
      av.some((x) => x.t === BOOMER)
    ) {
      game.lastSpecialDrop = game.drops;
      return BOOMER;
    }
    if (open && game.drops >= 10 && rand() < Math.min(0.09, 0.03 + 0.012 * (av.length - 1))) {
      const w = av.map((x) => (x.t === PRISM ? 2 : 1));
      let r = rand() * w.reduce((a, b) => a + b, 0);
      game.lastSpecialDrop = game.drops;
      for (let k = 0; k < av.length; k++) {
        r -= w[k];
        if (r <= 0) return av[k].t;
      }
      return PRISM;
    }
    const w =
      game.drops >= 150
        ? [20, 22, 22, 20, 16]
        : game.drops >= 70
          ? [26, 25, 21, 17, 11]
          : [32, 28, 20, 13, 7];
    let s = rand() * 100;
    for (let i = 0; i < w.length; i++) {
      s -= w[i];
      if (s <= 0) return i;
    }
    return 0;
  }
  return { mk, mkHeld, pick };
}
