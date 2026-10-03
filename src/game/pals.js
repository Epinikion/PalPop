import { PRISM, SPAWN_Y, SPECIALS, TIERS } from '../config.js';
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
  function pick() {
    if (game.pickCount++ < 2) return 0;
    const L = store.get('lvl', 1),
      av = SPECIALS.filter((x) => x.t === PRISM || L >= x.req);
    if (
      game.drops >= 10 &&
      !(game.held && game.held.t >= PRISM) &&
      game.nextTier < PRISM &&
      Math.random() < Math.min(0.09, 0.03 + 0.012 * (av.length - 1))
    ) {
      const w = av.map((x) => (x.t === PRISM ? 2 : 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < av.length; k++) {
        r -= w[k];
        if (r <= 0) return av[k].t;
      }
      return PRISM;
    }
    const w =
      game.score > 3000
        ? [22, 24, 22, 19, 13]
        : game.score > 1200
          ? [28, 27, 21, 15, 9]
          : [32, 28, 20, 13, 7];
    let s = Math.random() * 100;
    for (let i = 0; i < w.length; i++) {
      s -= w[i];
      if (s <= 0) return i;
    }
    return 0;
  }
  return { mk, mkHeld, pick };
}
