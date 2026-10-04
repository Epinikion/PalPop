import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headless-game.js';
import { BOOMER, CH_MAX, FLOOR, LOSE_Y, MAXT, PRISM, SCORE } from '../src/config.js';
import { GAMEPLAY } from '../src/settings.js';
import { mulberry32 } from '../src/core/math.js';
import { dailySeed } from '../src/game/records.js';

const started = (daily = false) => {
  const world = headlessGame();
  world.gameActions.newGame(daily);
  world.game.bodies = [];
  world.game.dropCooldown = 5;
  return world;
};

test('a combo is a chain reaction: only a merge that consumes the last product extends it', () => {
  const { game, gameActions, pal } = started();
  const a = pal(2, 40, 150),
    b = pal(2, 50, 150);
  gameActions.doMerge(a, b, 0, 0);
  assert.equal(game.comboCount, 1);
  const product = game.lastNb,
    third = pal(3, 60, 150);
  gameActions.doMerge(product, third, 0, 0);
  assert.equal(game.comboCount, 2, 'the product merged again within the window');
  // Merges that have nothing to do with the last one never build a combo, however fast they come.
  for (let i = 0; i < 6; i++) gameActions.doMerge(pal(1, 20, 100 - i), pal(1, 30, 100 - i), 0, 0);
  assert.equal(game.comboCount, 1, 'unrelated merges restart the count');
  assert.equal(game.runStats.combo, 2);
});

test('a chain that waits longer than the window is over', () => {
  const { game, gameActions, pal, run } = started();
  gameActions.doMerge(pal(2, 40, 150), pal(2, 50, 150), 0, 0);
  const product = game.lastNb;
  run(GAMEPLAY.chainWindow + 0.2);
  gameActions.doMerge(product, pal(3, 60, 150), 0, 0);
  assert.equal(game.comboCount, 1);
});

test('score grows with the tier you reach, and chains multiply it up to five times', () => {
  assert.deepEqual(SCORE.slice(0, 4), [0, 1, 2, 4]);
  assert(SCORE.every((v, i) => !i || v > SCORE[i - 1]));
  assert(SCORE[10] >= 100 && SCORE[10] / SCORE[5] > 8, 'high tiers are worth far more');
  const { game, gameActions, pal } = started();
  game.score = 0;
  gameActions.doMerge(pal(4, 40, 150), pal(4, 52, 150), 0, 0);
  assert.equal(game.score, SCORE[5], 'a lone merge scores its tier');
  for (let step = 1; step < 6; step++) {
    const before = game.score;
    gameActions.doMerge(game.lastNb, pal(5 + step - 1, 60, 150), 0, 0);
    assert(game.score - before <= SCORE[Math.min(10, 5 + step)] * 5 + 30);
  }
  assert.equal(game.comboCount, 6);
});

test('fever is earned by chains: unrelated merges barely charge it', () => {
  const lone = started(),
    chain = started();
  for (let i = 0; i < 8; i++)
    lone.gameActions.doMerge(lone.pal(3, 20, 100 - i), lone.pal(3, 30, 100 - i), 0, 0);
  chain.gameActions.doMerge(chain.pal(3, 20, 100), chain.pal(3, 30, 100), 0, 0);
  for (let i = 0; i < 7; i++)
    chain.gameActions.doMerge(chain.game.lastNb, chain.pal(4 + Math.min(i, 5), 40, 100), 0, 0);
  assert(lone.game.feverCharge < 0.6, `lone merges: ${lone.game.feverCharge}`);
  assert(chain.game.feverCharge > lone.game.feverCharge * 1.8 || chain.game.feverT > 0);
});

test('swaps are limited, earned by goals and shown on the NEXT button', () => {
  const { game, gameActions, gameProgression } = started();
  assert.equal(game.swaps, GAMEPLAY.swapsAtStart);
  game.held = { t: 1, x: 60, y: 27, s: 1, sv: 0, bt: 1, bl: 0 };
  game.nextTier = 3;
  for (let i = 0; i < GAMEPLAY.swapsAtStart; i++) {
    game.canSwap = true;
    gameActions.swap();
  }
  assert.equal(game.swaps, 0);
  const held = game.held.t;
  game.canSwap = true;
  gameActions.swap();
  assert.equal(game.held.t, held, 'no swaps left, no swap');
  game.mission = { type: 'fever', n: 1, p: 0, k: 9, reward: 25 };
  const score = game.score;
  gameProgression.misEvent('fever', 1);
  assert.equal(game.swaps, 1, 'a goal pays one swap');
  assert.equal(game.score, score, 'and no score');
  game.swaps = GAMEPLAY.swapsMax;
  game.mission = { type: 'fever', n: 1, p: 0, k: 9, reward: 25 };
  gameProgression.misEvent('fever', 1);
  assert.equal(game.swaps, GAMEPLAY.swapsMax, 'never more than the cap');
});

test('the shake needs a full charge and costs the chain and half the fever', () => {
  const { game, gameActions, pal } = started();
  game.bodies = [pal(2, 60, 150)];
  game.charge = CH_MAX - 1;
  gameActions.doShake();
  assert.equal(game.charge, CH_MAX - 1, 'not yet');
  game.charge = CH_MAX;
  game.comboCount = 4;
  game.comboTime = 0.5;
  game.feverCharge = 0.8;
  gameActions.doShake();
  assert.equal(game.charge, 0);
  assert.equal(game.comboCount, 0);
  assert(Math.abs(game.feverCharge - 0.4) < 1e-9);
});

test('the lose line creeps down after a while, by a pixel at a time and never past its limit', () => {
  const { game, run } = started();
  run(GAMEPLAY.squeezeStart - 1);
  assert.equal(game.loseY, LOSE_Y, 'no squeeze before the start');
  run(GAMEPLAY.squeezeEvery * 2 + 1);
  assert(game.loseY > LOSE_Y && game.loseY <= LOSE_Y + 3);
  const seen = [];
  for (let i = 0; i < 80; i++) {
    run(2);
    seen.push(game.loseY);
  }
  assert(seen.every((y, i) => !i || (y >= seen[i - 1] && y - seen[i - 1] <= 1)));
  assert.equal(game.loseY, LOSE_Y + GAMEPLAY.squeezeMax);
});

test('death is fair: the line counts a little inside the pal, and merge-born pals get grace', () => {
  const { game, pal, pin, run } = started();
  const nose = pal(5, 60, 100);
  pin(nose, game.loseY + 0.7 * nose.r + 0.5);
  game.bodies = [nose];
  run(3);
  assert.equal(game.phase, 'play', 'a nose over the line is not a loss');
  assert.equal(game.danger, false);
  const sitting = pal(5, 100, 100);
  pin(sitting, game.loseY - 0.7 * sitting.r - 5);
  game.bodies = [sitting];
  run(1);
  assert(game.danger && sitting.ot > 0.5, 'a pal clearly over the line counts down');
  run(1.5);
  assert.notEqual(game.phase, 'play', 'and ends the run after two seconds');
  const grace = started();
  grace.gameActions.doMerge(grace.pal(2, 40, 20), grace.pal(2, 50, 20), 0, 0);
  assert(grace.game.lastNb.ot < -1, 'a merge-born pal starts with extra time');
  assert(GAMEPLAY.mergeGrace >= 1);
});

test('Icy clears every warning and holds the countdown while it lasts', () => {
  const { game, pal, pin, run } = started();
  const tall = pal(4, 60, 100);
  pin(tall, game.loseY - 20);
  game.bodies = [tall];
  run(1.4);
  assert(tall.ot > 1, 'the countdown runs');
  game.iceTime = 7;
  run(1.5);
  assert.equal(game.phase, 'play');
  assert(tall.ot < 0.5, 'the countdown drains while time is frozen');
  assert.equal(game.danger, false);
});

test('the Sun is a victory: it sweeps the small pals, starts a fever and is counted', () => {
  const { game, gameActions, pal } = started();
  const small = [pal(1, 30, 180), pal(3, 50, 180), pal(5, 70, 180)],
    big = pal(8, 90, 170);
  gameActions.doMerge(pal(MAXT, 40, 100), pal(MAXT, 52, 100), 0, 0);
  assert(
    small.every((p) => p.dead),
    'tiers up to five are cleared',
  );
  assert(!big.dead, 'larger pals stay');
  assert.equal(game.runStats.suns, 1);
  assert(game.feverT > 0);
  assert(game.score >= 600);
});

test('pals come from the run, not the clock: bigger pieces arrive as drops pile up', () => {
  const mean = (drops) => {
    const { game, gamePals } = started();
    game.rand = mulberry32(5);
    game.drops = drops;
    game.pickCount = 10;
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const t = gamePals.pick();
      sum += t < PRISM ? t : 0;
    }
    return sum / 2000;
  };
  const early = mean(0),
    mid = mean(100),
    late = mean(200);
  assert(early < mid && mid < late, `${early} ${mid} ${late}`);
});

test('a daily run deals every player the same pals and goals, whatever their level', () => {
  const sequence = (level) => {
    const { game, gamePals, gameProgression, store } = started(true);
    store.set('lvl', level);
    game.rand = mulberry32(dailySeed(20261004));
    game.drops = 12;
    game.pickCount = 5;
    const picks = [],
      goals = [];
    for (let i = 0; i < 80; i++) {
      picks.push(gamePals.pick());
      game.drops++;
    }
    for (let k = 0; k < 12; k++) goals.push(JSON.stringify(gameProgression.genMission(k)));
    return JSON.stringify([picks, goals]);
  };
  assert.equal(sequence(1), sequence(9));
  assert(
    JSON.parse(sequence(1))[0].some((t) => t >= PRISM),
    'specials are dealt to everyone',
  );
  assert.notEqual(
    sequence(1),
    (() => {
      const { game, gamePals } = started(true);
      game.rand = mulberry32(dailySeed(20261005));
      game.drops = 12;
      game.pickCount = 5;
      return JSON.stringify([
        Array.from({ length: 80 }, () => (game.drops++, gamePals.pick())),
        [],
      ]);
    })(),
    'another day, other pals',
  );
});

test('a pile in trouble is owed a Boomer, and a standing Solis a wildcard', () => {
  const { game, gamePals, pal } = started(true);
  game.rand = () => 0.99;
  game.pickCount = 5;
  game.drops = 40;
  game.lastSpecialDrop = 0;
  pal(6, 60, 70);
  assert.equal(
    gamePals.pick(),
    BOOMER,
    'the pile reaches the top half, with no special for 25 drops',
  );
  assert.equal(game.lastSpecialDrop, 40);
  const calm = started(true);
  calm.game.rand = () => 0.99;
  calm.game.pickCount = 5;
  calm.game.drops = 40;
  calm.pal(6, 60, 170);
  assert.notEqual(calm.gamePals.pick(), BOOMER, 'a low pile is left alone');
  const solis = started(true);
  solis.game.rand = () => 0.99;
  solis.game.pickCount = 5;
  solis.game.drops = 30;
  solis.game.lastSpecialDrop = 15;
  solis.pal(MAXT, 60, FLOOR - 28);
  assert.equal(
    solis.gamePals.pick(),
    PRISM,
    'with a Solis in the box the Sun is one wildcard away',
  );
});

test('best score, records and quests are booked when the run ends', () => {
  const { game, gameActions, store, pal } = started();
  game.score = 1234;
  game.merges = 30;
  game.highestTier = 6;
  game.runStats = { fevers: 1, specials: 2, suns: 0, combo: 3 };
  game.runTime = 95;
  pal(1, 60, 100);
  gameActions.gameOver();
  game.dying.i = game.dying.list.length;
  gameActions.finishOver();
  assert.equal(game.phase, 'over');
  assert.equal(store.get('best', 0), 1234);
  assert.equal(game.newBest, true);
  assert.equal(store.get('stats', {}).runs, 1);
  assert.equal(store.get('hist', []).length, 1);
  assert.equal(store.get('quests', []).length, 3);
  assert(store.get('xp', 0) + (store.get('lvl', 1) - 1) * 200 > 0, 'XP is paid');
  // A second, weaker run keeps the best.
  gameActions.newGame();
  game.score = 500;
  gameActions.gameOver();
  gameActions.finishOver();
  assert.equal(store.get('best', 0), 1234);
  assert.equal(game.newBest, false);
  assert.equal(store.get('stats', {}).runs, 2);
});

test("a daily run is booked as the day's best and survives a tab closing mid-run", () => {
  const { game, gameActions, store } = started(true);
  assert(game.daily > 20260000);
  game.score = 900;
  gameActions.checkpoint();
  assert.equal(store.get('best', 0), 900, 'a closed tab keeps the best of the run');
  gameActions.gameOver();
  gameActions.finishOver();
  assert.equal(game.newBest, true, 'the best before the run decides, not the checkpoint');
  const day = store.get('daily', {});
  assert.equal(day.best, 900);
  assert.equal(day.tries, 1);
});
