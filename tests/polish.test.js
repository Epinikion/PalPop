import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStorage } from '../src/core/storage.js';
import { CH_MAX, W } from '../src/config.js';
import { createRenderText } from '../src/render/text.js';
import { HINTS, learnHint, loadHints, pickHint } from '../src/game/hints.js';
import { adaptLook } from '../src/audio/scheduler.js';

const memory = () => {
  const map = new Map();
  return createStorage(() => ({
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  }));
};
const fresh = (extra = {}) => ({
  phase: 'play',
  didDrop: false,
  didMerge: false,
  didSwap: false,
  swaps: 3,
  merges: 0,
  score: 0,
  danger: false,
  charge: 0,
  ...extra,
});

test('a new player is coached through drop, merge and swap in order', () => {
  const seen = loadHints(memory()),
    game = fresh();
  assert.equal(pickHint(game, seen), 'drop');
  game.didDrop = true;
  assert.equal(pickHint(game, seen), 'merge');
  game.didMerge = true;
  assert.equal(pickHint(game, seen), 'swap');
  game.didSwap = true;
  assert.equal(pickHint(game, seen), null);
  assert.equal(pickHint({ ...game, phase: 'title' }, seen), null);
});

test('a learned hint never returns, in this run or the next', () => {
  const store = memory(),
    seen = loadHints(store);
  assert.equal(learnHint(store, seen, 'drop'), true);
  assert.equal(learnHint(store, seen, 'drop'), false);
  assert.equal(learnHint(store, seen, 'nonsense'), false);
  assert.notEqual(pickHint(fresh(), seen), 'drop');
  const later = loadHints(store);
  assert(later.has('drop'));
  assert.notEqual(pickHint(fresh(), later), 'drop');
});

test('the line and shake hints wait for their moment', () => {
  const seen = new Set(['drop', 'merge', 'swap']);
  assert.equal(pickHint(fresh({ didDrop: true, didMerge: true }), seen), null);
  assert.equal(pickHint(fresh({ danger: true }), seen), 'line');
  assert.equal(pickHint(fresh({ charge: CH_MAX }), seen), 'shake');
  seen.add('line');
  seen.add('shake');
  assert.equal(pickHint(fresh({ danger: true, charge: CH_MAX }), seen), null);
});

test('anyone who has finished a run already knows the basics', () => {
  const store = memory();
  store.set('stats', { runs: 3 });
  const seen = loadHints(store);
  for (const id of ['drop', 'merge', 'swap']) assert(seen.has(id), id);
  assert(!seen.has('line'));
  store.set('hints', 'garbage');
  assert.equal(loadHints(store).size, 3);
});

test('hint texts fit the board in the bitmap font', () => {
  const { textW } = createRenderText({ game: {} });
  for (const [id, text] of Object.entries(HINTS)) assert(textW(text, 1) <= W - 2 * 8, id);
});

test('the look-ahead widens after a late tick and relaxes while ticks are on time', () => {
  const base = 0.24;
  assert.equal(adaptLook(base, 0.035, base), base);
  assert.equal(adaptLook(base, 0, base), base, 'the first tick has no gap');
  const widened = adaptLook(base, 0.2, base);
  assert(widened > base && widened <= 0.6);
  assert(widened >= 0.2 + 0.1, 'it covers the gap that just happened');
  assert.equal(adaptLook(base, 0.9, base), 0.6, 'but never beyond the cap');
  assert.equal(adaptLook(widened, 5, base), widened, 'a suspended page is no evidence');
  let look = 0.6;
  for (let i = 0; i < 2000; i++) look = adaptLook(look, 0.035, base);
  assert.equal(look, base, 'back to normal after a stretch of steady ticks');
});

test('the manifest ships padded maskable icons that the offline cache carries', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url))),
    precache = fs.readFileSync(new URL('../precache.js', import.meta.url), 'utf8');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(
      (i) => i.purpose === 'maskable' && i.sizes === `${size}x${size}`,
    );
    assert(icon, `maskable ${size}`);
    assert(fs.existsSync(new URL('../' + icon.src, import.meta.url)), icon.src);
    assert(precache.includes(icon.src), icon.src + ' is cached offline');
  }
  assert(manifest.icons.some((i) => i.purpose === 'any'));
});
