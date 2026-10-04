import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage.js';
import { mulberry32 } from '../src/core/math.js';
import { MAXT } from '../src/config.js';
import {
  QUEST_SLOTS,
  QUEST_TYPES,
  advanceQuests,
  dailyNumber,
  dailySeed,
  dailyState,
  dayKey,
  ensureQuests,
  loadStats,
  makeQuest,
  recordDaily,
  recordRun,
  shiftDay,
  streak,
} from '../src/game/records.js';

const memory = () => {
  const map = new Map();
  return createStorage(() => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  }));
};
const run = (extra = {}) => ({
  score: 1000,
  tier: 4,
  secs: 90,
  merges: 40,
  combo: 2,
  suns: 0,
  fevers: 0,
  specials: 0,
  ...extra,
});

test('a run is booked into lifetime stats and a history of the last ten', () => {
  const store = memory();
  for (let i = 0; i < 12; i++) recordRun(store, run({ score: 100 * (i + 1) }));
  const stats = loadStats(store);
  assert.equal(stats.runs, 12);
  assert.equal(stats.bestScore, 1200);
  assert.equal(stats.merges, 480);
  assert.equal(stats.secs, 1080);
  const history = store.get('hist', []);
  assert.equal(history.length, 10);
  assert.deepEqual(
    history.map((r) => r.s),
    [300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
  );
});

test('records describe the run: new best, near miss, average and category records', () => {
  const store = memory();
  const first = recordRun(store, run({ score: 2000, tier: 5, combo: 4, secs: 100 }));
  assert.equal(first.newBest, true);
  assert.deepEqual(first.records, [], 'the first run sets every record and so celebrates none');
  store.set('best', 2000);
  const close = recordRun(store, run({ score: 1800, tier: 5, combo: 2, secs: 60 }));
  assert.equal(close.newBest, false);
  assert.equal(close.gap, 200);
  assert.equal(close.nearMiss, true, 'within 15 % of the best');
  assert.equal(close.average, 1900);
  const far = recordRun(store, run({ score: 500 }));
  assert.equal(far.nearMiss, false);
  const better = recordRun(store, run({ score: 900, tier: 7, combo: 6, secs: 200 }));
  assert.deepEqual(better.records, ['BEST PAL', 'BEST CHAIN', 'LONGEST RUN']);
  const weak = recordRun(store, run({ score: 900, tier: 7, combo: 6, secs: 200 }));
  assert.deepEqual(weak.records, [], 'equalling a record is not beating it');
});

test('damaged saved data never stops a run from being recorded', () => {
  const store = memory();
  store.set('stats', 'garbage');
  store.set('hist', { not: 'a list' });
  store.set('quests', [null, { type: 'nonsense' }, { type: 'merges', target: 'x' }]);
  assert.equal(recordRun(store, run()).runs, 1);
  assert.equal(ensureQuests(store, mulberry32(1), 1).length, QUEST_SLOTS);
});

test('quests: three distinct slots whose targets grow with level and stay in range', () => {
  for (let level = 1; level <= 30; level++) {
    const store = memory(),
      quests = ensureQuests(store, mulberry32(level), level);
    assert.equal(quests.length, QUEST_SLOTS);
    assert.equal(new Set(quests.map((q) => q.type)).size, QUEST_SLOTS);
    for (const q of quests) {
      assert(QUEST_TYPES.includes(q.type) && q.target > 0 && q.prog === 0);
      assert(q.xp >= 100 && q.xp <= 400);
      if (q.type === 'reach') assert(q.target >= 4 && q.target <= MAXT);
      if (q.type === 'chain') assert(q.target >= 3 && q.target <= 6);
    }
  }
  const low = makeQuest(() => 0.99, 1, {}, ['reach', 'chain', 'score', 'merges', 'fevers']),
    high = makeQuest(() => 0.99, 24, {}, ['reach', 'chain', 'score', 'merges', 'fevers']);
  assert.equal(low.type, 'specials');
  assert(high.target > low.target);
  assert(
    makeQuest(() => 0, 1, {}, QUEST_TYPES),
    'with every kind taken a quest is still made',
  );
});

test('quest progress survives death, completes, pays XP and is replaced by another kind', () => {
  const store = memory();
  store.set('quests', [
    { type: 'merges', target: 100, prog: 40, xp: 150 },
    { type: 'reach', target: 6, prog: 4, xp: 200 },
    { type: 'chain', target: 4, prog: 2, xp: 120 },
  ]);
  const first = advanceQuests(store, mulberry32(3), run({ merges: 30, tier: 5, combo: 3 }), 3);
  assert.equal(first.xp, 0);
  assert.deepEqual(
    store.get('quests', []).map((q) => [q.type, q.prog]),
    [
      ['merges', 70],
      ['reach', 5],
      ['chain', 3],
    ],
    'sums add up, bests keep their high-water mark',
  );
  assert(first.rows.every((row) => !row.done));
  const second = advanceQuests(store, mulberry32(4), run({ merges: 40, tier: 6, combo: 4 }), 3);
  assert.equal(second.xp, 150 + 200 + 120);
  assert(second.rows.every((row) => row.done && row.after === row.target));
  const fresh = store.get('quests', []);
  assert.equal(fresh.length, QUEST_SLOTS);
  assert(fresh.every((q) => q.prog === 0));
  assert.equal(new Set(fresh.map((q) => q.type)).size, QUEST_SLOTS);
  // A weaker run never moves a high-water mark backwards.
  store.set('quests', [{ type: 'score', target: 5000, prog: 3000, xp: 100 }]);
  advanceQuests(store, mulberry32(5), run({ score: 500 }), 1);
  assert.equal(store.get('quests', []).find((q) => q.type === 'score').prog, 3000);
});

test('daily numbers count from 1 January 2026 and every day shares one seed', () => {
  assert.equal(dailyNumber(20260101), 1);
  assert.equal(dailyNumber(20260102), 2);
  assert.equal(dailyNumber(20261004), 277);
  assert.equal(dailyNumber(20270101), 366);
  assert.equal(dayKey(new Date(2026, 9, 4, 23, 59)), 20261004);
  assert.equal(shiftDay(20260301, -1), 20260228);
  assert.equal(shiftDay(20261231, 1), 20270101);
  const seeds = new Set();
  for (let day = 0; day < 400; day++) seeds.add(dailySeed(shiftDay(20260101, day)));
  assert.equal(seeds.size, 400, 'no two days share a seed');
  assert.equal(dailySeed(20261004), dailySeed(20261004));
  const a = mulberry32(dailySeed(20261004)),
    b = mulberry32(dailySeed(20261004));
  assert.deepEqual([a(), a(), a()], [b(), b(), b()], 'everyone gets the same pals that day');
});

test('the daily keeps the best of the day and a streak that only ever counts up', () => {
  const store = memory(),
    today = 20261004;
  assert.deepEqual(dailyState(store, today), { best: 0, tier: 0, tries: 0 });
  assert.equal(recordDaily(store, today, run({ score: 800, tier: 3 })).newBest, true);
  const second = recordDaily(store, today, run({ score: 600, tier: 5 }));
  assert.equal(second.newBest, false);
  assert.deepEqual(dailyState(store, today), { best: 800, tier: 5, tries: 2 });
  assert.deepEqual(dailyState(store, shiftDay(today, 1)), { best: 0, tier: 0, tries: 0 });
  assert.equal(streak(store, today), 1);
  recordDaily(store, shiftDay(today, -1), run());
  recordDaily(store, shiftDay(today, -2), run());
  assert.equal(streak(store, today), 3);
  assert.equal(streak(store, shiftDay(today, 1)), 3, 'an unplayed today does not break the streak');
  assert.equal(streak(store, shiftDay(today, 2)), 0, 'a gap resets the count, silently');
  assert(store.get('days', []).length === 3);
});
