import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStorage } from '../src/core/storage.js';
import { CH_MAX, W } from '../src/config.js';
import { createRenderText } from '../src/render/text.js';
import { HINTS, learnHint, loadHints, pickHint } from '../src/game/hints.js';
import { adaptLook, createAudioScheduler } from '../src/audio/scheduler.js';
import { hasHomeBar } from '../src/ui/viewport.js';

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

test('a step that throws loses its notes, not the clock', () => {
  const played = [],
    audio = {
      context: { state: 'running', currentTime: 0.9 },
      graph: {},
      session: { style: 'x', spb: 0.4, s16: 0.1 },
      playing: { live: true },
      enabled: true,
      volume: 80,
      songStart: 0,
      nextStepTime: 0,
      step: 0,
      lastTick: -1,
      pendingFx: [],
      pendingHits: [],
    },
    audioComposition = { LOOK: 0.24, stepAt: (s) => s / 0.1, secondsAt: (k) => k * 0.1 },
    arrangements = {
      x: (step) => {
        if (step === 11) throw new Error('broken voice');
        played.push(step);
      },
    },
    { musicTick } = createAudioScheduler({ audio, audioComposition, arrangements });
  musicTick();
  audio.context.currentTime = 1.2;
  musicTick();
  assert.deepEqual(audio.fault, { message: 'broken voice', step: 11 });
  assert.ok(played.includes(10) && played.includes(12), 'the steps around it still play');
  assert.ok(audio.step > 14, 'and the clock keeps going');
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

test('tall phone screens have a home indicator, phones with a home button do not', () => {
  assert(hasHomeBar(402, 874), 'iPhone 16 Pro');
  assert(hasHomeBar(874, 402), 'the same turned sideways');
  assert(hasHomeBar(375, 812), 'iPhone X');
  assert(!hasHomeBar(375, 667), 'iPhone SE');
  assert(!hasHomeBar(414, 736), 'iPhone 8 Plus');
  assert(!hasHomeBar(820, 1180), 'an iPad');
});

test('every icon file is a PNG of the size its name and the manifest promise', () => {
  const size = (name) => {
    const bytes = fs.readFileSync(new URL('../' + name, import.meta.url));
    assert.equal(bytes.toString('latin1', 1, 4), 'PNG', name);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  };
  assert.deepEqual(size('icon-192.png'), [192, 192]);
  assert.deepEqual(size('icon-512.png'), [512, 512]);
  assert.deepEqual(size('icon-maskable-192.png'), [192, 192]);
  assert.deepEqual(size('icon-maskable-512.png'), [512, 512]);
  assert.deepEqual(size('apple-touch-icon.png'), [180, 180]);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert(html.includes('apple-touch-icon.png'));
});
