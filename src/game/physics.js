import { FL, FLOOR, FR, GOLDIE, PRISM } from '../config.js';
import { PHYSICS } from '../settings.js';
import { clamp } from '../core/math.js';
/** Pure fixed-step solver. Callbacks connect collisions to scoring and cosmetic effects. */
export function createGamePhysics({
  game,
  onMerge,
  onLanding = () => {},
  onCollision = () => {},
  settings = PHYSICS,
}) {
  /* ================= physics ================= */
  function physics(h) {
    const n = game.bodies.length,
      gz = settings.gravity * game.pace;
    for (let i = 0; i < n; i++) {
      const b = game.bodies[i];
      b.age += h;
      if (b.mg) continue;
      b.vy = Math.min(settings.maxFallSpeed, b.vy + gz * h);
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.vx *= Math.exp(-settings.airDrag * h);
    }
    for (let it = 0; it < settings.solverIterations; it++) {
      for (let i = 0; i < n; i++) {
        const b = game.bodies[i];
        if (b.mg) continue;
        if (b.x - b.r < FL) {
          b.x = FL + b.r;
          if (b.vx < 0) b.vx *= -settings.wallRestitution;
        }
        if (b.x + b.r > FR) {
          b.x = FR - b.r;
          if (b.vx > 0) b.vx *= -settings.wallRestitution;
        }
        if (b.y + b.r > FLOOR) {
          b.y = FLOOR - b.r;
          if (b.vy > 0) {
            const iv = b.vy;
            if (iv > 90) {
              b.qv += Math.min(0.6, iv / 700);
              if (iv > 170) {
                onLanding(b, iv);
              }
            }
            b.vy = iv > settings.floorBounceThreshold ? -iv * settings.floorRestitution : 0;
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const a = game.bodies[i];
        if (a.mg) continue;
        for (let j = i + 1; j < n; j++) {
          if (a.mg) break;
          const b = game.bodies[j];
          if (b.mg) continue;
          const dx = b.x - a.x,
            dy = b.y - a.y,
            rs = a.r + b.r;
          const range = rs + Math.max(settings.attractionDistance, settings.mergeDistance);
          if (dx > range || dx < -range || dy > range || dy < -range) continue;
          const d2 = dx * dx + dy * dy;
          const match =
            a.t < GOLDIE &&
            b.t < GOLDIE &&
            (a.t === b.t || ((a.t === PRISM || b.t === PRISM) && game.phase !== 'title'));
          if (it === 0 && match && d2 < (rs + settings.mergeDistance) ** 2) {
            a.mg = b.mg = true;
            a.flash = b.flash = 0.8;
            const massA = 1 / a.iw,
              massB = 1 / b.iw,
              total = massA + massB;
            game.merging.push({
              a,
              b,
              // where the two touched, for the liquid drawn as they run together
              from: [
                { x: a.x, y: a.y, t: a.t },
                { x: b.x, y: b.y, t: b.t },
              ],
              t: settings.mergeDelay,
              vx: ((a.vx * massA + b.vx * massB) / total) * 0.65,
              vy: ((a.vy * massA + b.vy * massB) / total) * 0.45,
            });
            continue;
          }
          /* Only close, slow matches attract; distant pals still need a well-aimed drop. */
          if (
            it === 0 &&
            match &&
            d2 > rs * rs &&
            d2 < (rs + settings.attractionDistance) ** 2 &&
            a.age > 0.2 &&
            b.age > 0.2 &&
            Math.hypot(b.vx - a.vx, b.vy - a.vy) < settings.attractionMaxSpeed
          ) {
            const d = Math.sqrt(d2),
              pull = settings.attractionForce * h,
              ws = a.iw + b.iw;
            a.vx += ((dx / d) * pull * a.iw) / ws;
            a.vy += ((dy / d) * pull * a.iw) / ws;
            b.vx -= ((dx / d) * pull * b.iw) / ws;
            b.vy -= ((dy / d) * pull * b.iw) / ws;
          }
          if (d2 >= rs * rs) continue;
          const d = Math.sqrt(d2),
            nx = d > 1e-6 ? dx / d : a.id < b.id ? 1 : -1,
            ny = d > 1e-6 ? dy / d : 0,
            pen = rs - d,
            wa = a.iw,
            wb = b.iw,
            ws = wa + wb,
            k = (0.85 * Math.min(Math.max(0, pen - 0.015), 4)) / ws;
          a.x -= nx * k * wa;
          a.y -= ny * k * wa;
          b.x += nx * k * wb;
          b.y += ny * k * wb;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) {
            if (vn < -70) {
              const kk = Math.min(0.5, -vn / 800);
              a.qv += kk;
              b.qv += kk;
              if (vn < -170) onCollision(a.x + nx * a.r, a.y + ny * a.r, -vn, a, b);
            }
            const e = vn < -110 ? 0.24 : 0,
              j2 = (-(1 + e) * vn) / ws;
            a.vx -= j2 * wa * nx;
            a.vy -= j2 * wa * ny;
            b.vx += j2 * wb * nx;
            b.vy += j2 * wb * ny;
            const tx2 = -ny,
              ty2 = nx,
              vt = (b.vx - a.vx) * tx2 + (b.vy - a.vy) * ty2,
              lim = j2 * settings.contactFriction,
              jt = clamp((-vt / ws) * 0.2, -lim, lim);
            a.vx -= jt * wa * tx2;
            a.vy -= jt * wa * ty2;
            b.vx += jt * wb * tx2;
            b.vy += jt * wb * ty2;
          }
        }
      }
    }
    for (const b of game.bodies) {
      if (!b.mg) {
        b.x = clamp(b.x, FL + b.r, FR - b.r);
        b.y = Math.min(b.y, FLOOR - b.r);
        /* Ground drag runs once per step, regardless of the number of solver contacts. */
        if (b.y + b.r >= FLOOR - 0.05 && b.vy >= -8) {
          b.vx *= Math.exp(-settings.floorDrag * h);
          if (Math.abs(b.vx) < 0.15) b.vx = 0;
        }
      }
    }
    if (game.merging.length) {
      const k = Math.min(1, h * 45);
      for (const m of game.merging) {
        const a = m.a,
          b = m.b,
          mx = (a.x + b.x) / 2,
          my = (a.y + b.y) / 2;
        a.x += (mx - a.x) * k;
        a.y += (my - a.y) * k;
        b.x += (mx - b.x) * k;
        b.y += (my - b.y) * k;
        m.t -= h;
        if (m.t <= 0) {
          m.done = true;
          onMerge(a, b, m.vx, m.vy, m.from);
        }
      }
      game.merging = game.merging.filter((m) => !m.done);
      game.bodies = game.bodies.filter((b) => !b.dead);
    }
  }
  function advance(dt) {
    game.physicsAccumulator += Math.min(dt, 0.05);
    while (game.physicsAccumulator + 1e-9 >= settings.timestep) {
      physics(settings.timestep);
      game.physicsAccumulator = Math.max(0, game.physicsAccumulator - settings.timestep);
    }
  }
  return { physics, advance };
}
