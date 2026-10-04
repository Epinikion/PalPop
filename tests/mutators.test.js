import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage.js';
import { mulberry32 } from '../src/core/math.js';
import { shiftDay } from '../src/game/records.js';
import {
  MUTATORS,
  dailyMutator,
  mutatorById,
  newMutators,
  offerMutators,
  unlockedMutators,
} from '../src/game/mutators.js';
import { BADGES, BADGE_XP, badgeRows, checkBadges } from '../src/game/badges.js';

const memory = () => {
  const map = new Map();
  return createStorage(() => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  }));
};

test('mutators have unique ids, climb every other level from four, and pay what they cost', () => {
  assert.equal(new Set(MUTATORS.map((m) => m.id)).size, MUTATORS.length);
  assert.deepEqual(
    MUTATORS.map((m) => m.level),
    [4, 6, 8, 10, 12, 14, 16],
  );
  for (const m of MUTATORS) {
    assert(m.name && m.desc && m.mult > 0);
    assert.equal(mutatorById(m.id), m);
  }
  assert.equal(mutatorById('nonsense'), null);
  // The harder ones pay more than a plain run, the easier ones less.
  for (const id of ['heavy', 'noswap', 'big']) assert(mutatorById(id).mult > 1, id);
  for (const id of ['lucky', 'fuse', 'small']) assert(mutatorById(id).mult < 1, id);
});

test('levels unlock mutators in order and say which ones are new', () => {
  assert.equal(unlockedMutators(3).length, 0);
  assert.equal(unlockedMutators(4).length, 1);
  assert.equal(unlockedMutators(99).length, MUTATORS.length);
  assert.deepEqual(
    newMutators(3, 4).map((m) => m.id),
    ['lucky'],
  );
  assert.deepEqual(
    newMutators(3, 9).map((m) => m.id),
    ['lucky', 'heavy', 'fizz'],
  );
  assert.equal(newMutators(9, 9).length, 0);
});

test('two different cards are offered, avoiding the last one played where possible', () => {
  assert.equal(offerMutators(3, mulberry32(1)).length, 0, 'nothing before level four');
  assert.equal(offerMutators(4, mulberry32(1)).length, 1, 'one unlocked, one card');
  for (let seed = 1; seed <= 200; seed++) {
    const offer = offerMutators(16, mulberry32(seed), 'lucky');
    assert.equal(offer.length, 2);
    assert.notEqual(offer[0].id, offer[1].id);
    assert(offer.every((m) => m.id !== 'lucky'));
  }
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++)
    for (const m of offerMutators(16, mulberry32(seed))) seen.add(m.id);
  assert.equal(seen.size, MUTATORS.length, 'every unlocked mutator gets offered');
  assert.equal(
    offerMutators(6, mulberry32(3), 'heavy').length,
    2,
    'with two unlocked both come back',
  );
});

test('the daily mutator is the same all day for everyone and plain on about one day in three', () => {
  const days = Array.from({ length: 300 }, (_, i) => shiftDay(20260101, i));
  const mutators = days.map(dailyMutator);
  assert.deepEqual(mutators, days.map(dailyMutator));
  const plain = mutators.filter((m) => m === null).length;
  assert(plain > 70 && plain < 130, `${plain} plain days of 300`);
  assert(new Set(mutators.filter(Boolean).map((m) => m.id)).size >= 5);
});

test('badges are earned from lifetime stats, once, and every one has a goal and a hint', () => {
  assert.equal(BADGES.length, 21);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  assert(BADGES.every((b) => b.name && b.hint && b.goal > 0 && typeof b.value === 'function'));
  const store = memory();
  assert.deepEqual(checkBadges(store), []);
  store.set('stats', { runs: 1, bestTier: 5, bestCombo: 3, merges: 600, suns: 0 });
  const first = checkBadges(store).map((b) => b.id);
  for (const id of ['first', 'tabby', 'panda', 'chain3', 'machine']) assert(first.includes(id), id);
  assert(!first.includes('owl') && !first.includes('legend'));
  assert.deepEqual(checkBadges(store), [], 'nothing new, nothing awarded again');
  store.set('stats', { runs: 9, bestTier: 10, bestCombo: 7, merges: 3000, suns: 5, longest: 400 });
  const more = checkBadges(store).map((b) => b.id);
  for (const id of [
    'owl',
    'dragon',
    'solis',
    'burst',
    'king',
    'chain5',
    'chain7',
    'legend',
    'marathon',
  ])
    assert(more.includes(id), id);
  assert.equal(new Set([...first, ...more]).size, first.length + more.length);
});

test('badges that need more than the stats take their figures from outside', () => {
  const store = memory();
  store.set('stats', { runs: 1 });
  assert(
    !checkBadges(store, { dailyDays: 6, worlds: 6 }).some((b) =>
      ['daily', 'tourist'].includes(b.id),
    ),
  );
  const earned = checkBadges(store, { dailyDays: 7, worlds: 7 }).map((b) => b.id);
  assert(earned.includes('daily') && earned.includes('tourist'));
});

test('the Palbook rows show progress, capped at the goal, and which badges are earned', () => {
  const store = memory();
  store.set('stats', { runs: 1, merges: 120, bestTier: 4 });
  checkBadges(store);
  const rows = badgeRows(store, {});
  assert.equal(rows.length, BADGES.length);
  const machine = rows.find((r) => r.badge.id === 'machine');
  assert.deepEqual([machine.value, machine.got], [120, false]);
  assert.equal(rows.find((r) => r.badge.id === 'tabby').got, true);
  store.set('stats', { merges: 99999 });
  assert.equal(badgeRows(store, {}).find((r) => r.badge.id === 'legend').value, 3000);
  assert.equal(BADGE_XP, 100);
});
