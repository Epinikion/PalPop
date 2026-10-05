import { GOLDIE, ICY, PRISM, TIERS, ZAPPY } from '../config.js';
export function createGameAnimation({ game, gameEffects, gamePhysics, gameSpecials }) {
  function tickPal(p, dt) {
    p.bt -= dt;
    if (p.bt <= 0) {
      p.bl = 0.13;
      p.bt = 1.2 + Math.random() * 3.4;
    }
    if (p.bl > 0) p.bl -= dt;
  }
  function stepBodies(dt) {
    gamePhysics.advance(dt);
    if (game.goos.length) {
      for (const goo of game.goos) goo.age += dt;
      game.goos = game.goos.filter((goo) => goo.age < goo.life);
    }
    for (const b of game.bodies) {
      b.sv += (1 - b.s) * 340 * dt;
      b.sv *= Math.exp(-7 * dt);
      b.s += b.sv * dt;
      if (Math.abs(1 - b.s) < 0.004 && Math.abs(b.sv) < 0.05) {
        b.s = 1;
        b.sv = 0;
      }
      b.qv += -b.q * 420 * dt;
      b.qv *= Math.exp(-9 * dt);
      b.q += b.qv * dt;
      if (Math.abs(b.q) < 0.003 && Math.abs(b.qv) < 0.05) {
        b.q = 0;
        b.qv = 0;
      }
      if (!b.mg && b.age > 0.5 && Math.abs(b.vy) < 14)
        b.q += Math.sin(game.elapsed * 2.6 + b.id * 1.9) * 0.013; /* idle breathing */
      b.flash = Math.max(0, b.flash - dt * 4);
      tickPal(b, dt);
      if (dt > 0 && game.phase === 'play') {
        if (b.age > 1 && !b.mg && Math.abs(b.vy) < 10 && Math.random() < dt * 0.05) b.qv += 0.7;
        if (b.vy > 230 && game.parts.length < 500 && Math.random() < 0.6)
          game.parts.push({
            x: b.x + (Math.random() - 0.5) * b.r,
            y: b.y - b.r * 0.5,
            vx: 0,
            vy: 0,
            l: 0.16,
            c: TIERS[b.t].ramp[3],
            sz: 1,
            g: 0,
          });
        if (b.t === PRISM && Math.random() < dt * 6)
          gameEffects.sparkles(
            b.x + (Math.random() - 0.5) * b.r * 2,
            b.y + (Math.random() - 0.5) * b.r * 2,
            1,
            20,
          );
        else if (b.t === GOLDIE && Math.random() < dt * 3.4)
          gameEffects.sparkles(
            b.x + (Math.random() - 0.5) * b.r * 1.8,
            b.y + (Math.random() - 0.5) * b.r * 1.8,
            1,
            14,
          );
        else if (b.t === ZAPPY && Math.random() < dt * 3)
          game.parts.push({
            x: b.x + (Math.random() - 0.5) * b.r * 2.2,
            y: b.y + (Math.random() - 0.5) * b.r * 2.2,
            vx: 0,
            vy: -6,
            l: 0.13,
            c: Math.random() < 0.5 ? '#fff36a' : '#d2ff2a',
            sz: 1,
            g: 0,
          });
        else if (b.t === ICY && Math.random() < dt * 3)
          game.parts.push({
            x: b.x + (Math.random() - 0.5) * b.r * 1.8,
            y: b.y + b.r * 0.5,
            vx: (Math.random() - 0.5) * 5,
            vy: -9 - Math.random() * 5,
            l: 0.55,
            c: '#eaffff',
            sz: 1,
            g: -4,
          });
      }
    }
    if (dt > 0 && game.phase === 'play') gameSpecials.actSpecials();
  }

  /* ================= update ================= */
  return { stepBodies, tickPal };
}
