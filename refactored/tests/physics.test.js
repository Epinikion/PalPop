import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGameState } from '../src/game/state.js';
import { createGamePals } from '../src/game/pals.js';
import { createGamePhysics } from '../src/game/physics.js';
import { MAXT, TIERS } from '../src/config.js';
import { PHYSICS } from '../src/settings.js';
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/physics.json', import.meta.url)));
function simulate(kind, fps, settings = PHYSICS) {
  const game = createGameState(),
    pals = createGamePals({ game });
  const physics = createGamePhysics({
    game,
    settings,
    onMerge: (a, b, vx, vy) => {
      a.dead = b.dead = true;
      const tier = Math.min(MAXT, Math.max(a.t, b.t) + 1);
      if (a.t < MAXT) {
        const pal = pals.mk(tier, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pal.s = 0.3;
        pal.vx = vx || 0;
        pal.vy = vy || 0;
        game.bodies.push(pal);
      }
    },
  });
  const add = (tier, x, y, vx = 0, vy = 0) => {
    const pal = pals.mk(tier, x, y);
    Object.assign(pal, { vx, vy, age: 0.3 });
    game.bodies.push(pal);
  };
  if (kind === 'slide') add(2, 30, 181, 60);
  if (kind === 'contact') {
    add(4, 60, 177);
    add(2, 60, 155, 60, 50);
  }
  if (kind === 'match') {
    add(0, 45, 170);
    add(0, 58.4, 170);
  }
  if (kind === 'chain') {
    add(0, 48, 184);
    add(0, 60, 184);
    add(1, 69, 182.5);
  }
  if (kind === 'overlap') {
    add(2, 60, 160);
    add(3, 60, 160);
  }
  if (kind === 'stack')
    for (let i = 0; i < 32; i++)
      add(i % 7, 20 + (i % 4) * 26, 65 + Math.floor(i / 4) * 14, ((i % 3) - 1) * 50);
  if (kind === 'shake')
    for (let i = 0; i < 16; i++)
      add(i % 5, 20 + (i % 4) * 26, 90 + Math.floor(i / 4) * 20, ((i % 3) - 1) * 150, -260);
  for (let i = 0; i < fps * 6; i++) physics.advance(1 / fps);
  let maxOverlap = 0;
  for (let i = 0; i < game.bodies.length; i++)
    for (let j = i + 1; j < game.bodies.length; j++) {
      const a = game.bodies[i],
        b = game.bodies[j];
      maxOverlap = Math.max(maxOverlap, a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y));
    }
  return {
    bodies: game.bodies.map(({ t, x, y, vx, vy, r }) => ({ t, x, y, vx, vy, r })),
    maxOverlap,
  };
}
for (const kind of Object.keys(baseline))
  test(`${kind}: original trajectory at 30, 60, and 120 FPS`, () => {
    for (const fps of [30, 60, 120]) {
      const actual = simulate(kind, fps);
      assert.deepEqual(actual, baseline[kind]);
      assert(actual.maxOverlap < 1.5);
      for (const body of actual.bodies) {
        assert(Object.values(body).every(Number.isFinite));
        assert(body.x - body.r >= 5.99 && body.x + body.r <= 114.01 && body.y + body.r <= 190.01);
      }
    }
  });
test('physics tuning can be overridden per instance', () => {
  const regular = simulate('slide', 60),
    slippery = simulate('slide', 60, { ...PHYSICS, floorDrag: 0.5 });
  assert(slippery.bodies[0].x > regular.bodies[0].x);
  assert.equal(TIERS[2].r, 9);
});
