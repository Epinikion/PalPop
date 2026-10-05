import test from 'node:test';
import assert from 'node:assert/strict';
import { headlessGame } from './helpers/headless-game.js';
import { CH_MAX, FLOOR, GOLDIE, ICY, LOSE_Y, MAXT, PRISM, SCORE, SPECIALS } from '../src/config.js';
import { GAMEPLAY } from '../src/settings.js';
import { mulberry32 } from '../src/core/math.js';
import { dailySeed } from '../src/game/records.js';
import { dailyMutator } from '../src/game/mutators.js';
import { BADGE_XP } from '../src/game/badges.js';

const started = (daily = false, mutator = null) => {
  const world = headlessGame();
  world.gameActions.newGame(daily, mutator);
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

test('Icy shatters the small pals around it into points before time slows down', () => {
  const { game, pal, run } = started();
  const icy = pal(ICY, 60, 150),
    small = [pal(0, 42, 152), pal(1, 78, 150), pal(2, 60, 172)],
    far = pal(0, 15, 120),
    big = pal(3, 60, 126);
  icy.age = 0.89;
  const before = game.score;
  run(1 / 60);
  assert(
    small.every((p) => p.dead),
    'Blipp, Chirpy and Bunbun next to it shatter',
  );
  assert(!far.dead && !big.dead, 'pals out of reach or bigger stay');
  assert(game.score - before >= SCORE[1] + SCORE[2] + SCORE[3], 'and they pay points');
  assert(game.iceTime > 0, 'then time slows down');
});

test('a merge runs together like drops of water for a moment, from where the two touched', () => {
  const { game, pal, run } = started();
  const a = pal(2, 50, FLOOR - 9),
    b = pal(2, 68.5, FLOOR - 9);
  run(0.1);
  assert(a.dead && b.dead, 'the two touching Bunbuns merged');
  assert.equal(game.goos.length, 1);
  const [goo] = game.goos;
  assert.equal(goo.pal, game.lastNb, 'into the new pal');
  assert.deepEqual(
    goo.from.map((f) => f.t),
    [2, 2],
  );
  assert(goo.from[0].x < goo.from[1].x - 15, 'from where each of them was');
  run(0.3);
  assert.equal(game.goos.length, 0, 'and is gone a moment later');
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

test('a pile in trouble is owed a wildcard, and a standing Solis one too', () => {
  const { game, gamePals, pal } = started(true);
  game.rand = () => 0.99;
  game.pickCount = 5;
  game.drops = 40;
  game.lastSpecialDrop = 0;
  pal(6, 60, 70);
  assert.equal(
    gamePals.pick(),
    PRISM,
    'the pile reaches the top half, with no special for 25 drops',
  );
  assert.equal(game.lastSpecialDrop, 40);
  const calm = started(true);
  calm.game.rand = () => 0.99;
  calm.game.pickCount = 5;
  calm.game.drops = 40;
  calm.pal(6, 60, 170);
  assert.notEqual(calm.gamePals.pick(), PRISM, 'a low pile is left alone');
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

test('mutators bend the rules they name and move the score to match', () => {
  const plain = started(),
    heavy = started(false, 'heavy');
  assert.equal(plain.game.mut, null);
  assert.equal(heavy.game.pace, 1.2);
  assert(1 / 1.2 < 1 && plain.game.pace === 1);
  const merged = (world) => {
    world.game.score = 0;
    world.gameActions.doMerge(world.pal(4, 40, 150), world.pal(4, 52, 150), 0, 0);
    return world.game.score;
  };
  assert.equal(merged(started(false, 'heavy')), Math.round(SCORE[5] * 1.5));
  assert.equal(merged(started(false, 'lucky')), Math.max(1, Math.round(SCORE[5] * 0.9)));
  assert.equal(merged(started()), SCORE[5]);

  const fuse = started(false, 'fuse');
  assert.equal(fuse.game.fuse, 3);
  const tall = fuse.pal(4, 60, 100);
  fuse.pin(tall, fuse.game.loseY - 20);
  fuse.game.bodies = [tall];
  fuse.run(2.6);
  assert.equal(fuse.game.phase, 'play', 'two and a half seconds is survivable with a long fuse');
  fuse.run(1);
  assert.notEqual(fuse.game.phase, 'play');

  const noswap = started(false, 'noswap');
  assert.equal(noswap.game.swaps, 0);
  noswap.game.mission = { type: 'fever', n: 1, p: 0, k: 9, reward: 25 };
  noswap.gameProgression.misEvent('fever', 1);
  assert.equal(noswap.game.swaps, 0, 'a goal cannot pay a swap that does not exist');

  const fizz = started(false, 'fizz'),
    normal = started();
  for (const world of [fizz, normal])
    world.gameActions.doMerge(world.pal(3, 20, 100), world.pal(3, 30, 100), 0, 0);
  assert(Math.abs(fizz.game.feverCharge / normal.game.feverCharge - 1.6) < 1e-6);
  fizz.game.feverCharge = 0.99;
  fizz.gameActions.doMerge(fizz.pal(3, 20, 80), fizz.pal(3, 30, 80), 0, 0);
  assert(fizz.game.feverT > 5.9 && fizz.game.feverT <= 6, 'the fever lasts six seconds');
});

test('lucky brings specials more often, big shots and small fry change the pals dealt', () => {
  const dealt = (mutator) => {
    const { game, gamePals, store } = started(false, mutator);
    store.set('lvl', 20);
    game.rand = mulberry32(11);
    game.drops = 20;
    game.pickCount = 5;
    const picks = [];
    for (let i = 0; i < 4000; i++) {
      game.lastSpecialDrop = game.drops; // switch the pity timer off: only the roll is measured
      picks.push(gamePals.pick());
    }
    return {
      specials: picks.filter((t) => t >= PRISM).length,
      mean: picks.filter((t) => t < PRISM).reduce((a, b) => a + b, 0) / picks.length,
    };
  };
  const normal = dealt(null),
    lucky = dealt('lucky'),
    big = dealt('big'),
    small = dealt('small');
  assert(lucky.specials > normal.specials * 2, `${lucky.specials} vs ${normal.specials}`);
  assert(small.mean < normal.mean && normal.mean < big.mean);
});

test('the daily has its own mutator whatever card was tapped, the same for everyone', () => {
  const { game } = started(true, 'heavy');
  assert.equal(game.mut, dailyMutator(game.daily));
  assert.equal(started(true).game.mut, dailyMutator(game.daily));
});

test('finishing a run awards badges once and pays their XP', () => {
  const { game, gameActions, store } = started();
  game.score = 3000;
  game.highestTier = 5;
  game.runStats = { fevers: 0, specials: 0, suns: 0, combo: 3 };
  game.runTime = 120;
  game.merges = 40;
  gameActions.gameOver();
  gameActions.finishOver();
  const earned = store.get('badges', []);
  for (const id of ['first', 'tabby', 'panda', 'chain3']) assert(earned.includes(id), id);
  assert(!earned.includes('owl'));
  const xp = store.get('xp', 0) + (store.get('lvl', 1) - 1) * 200;
  assert(xp >= earned.length * BADGE_XP, `XP ${xp} covers ${earned.length} badges`);
  gameActions.newGame();
  game.score = 100;
  game.highestTier = 5;
  gameActions.gameOver();
  gameActions.finishOver();
  assert.deepEqual(
    store.get('badges', []).slice(0, earned.length),
    earned,
    'a badge is never earned twice',
  );
});

test('the bomb is gone: nothing deals it, nothing explodes, and the specials start at Goldie', () => {
  assert(!SPECIALS.some(({ n, hint, desc }) => /boom/i.test(`${n} ${hint} ${desc}`)));
  assert.equal(Math.min(...SPECIALS.filter(({ t }) => t !== PRISM).map(({ t }) => t)), GOLDIE);
  // Whatever the level, the specials on offer never include tier 12, even after a long run.
  const { game, gamePals } = started(true);
  game.pickCount = 5;
  const seen = new Set();
  let seed = 1;
  game.rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let drop = 10; drop < 3000; drop++) {
    game.drops = drop;
    seen.add(gamePals.pick());
  }
  assert(!seen.has(12), 'no bomb is ever dealt');
  assert(seen.has(PRISM) && seen.has(GOLDIE));
});
