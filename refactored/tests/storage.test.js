import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage.js';
import { createGameState } from '../src/game/state.js';
import { createAudioState } from '../src/audio/state.js';
test('saved values remain compatible with the original game', () => {
  const data = new Map();
  const storage = createStorage(() => ({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }));
  storage.set('best', 420);
  storage.set('musicTrack', 6);
  storage.set('dex', [0, 2, 10]);
  assert.equal(data.get('palpop:best'), '420');
  const game = createGameState(storage),
    audio = createAudioState(storage);
  assert.equal(game.best, 420);
  assert.equal(audio.trackId, 6);
  assert.equal(game.dex[10], true);
  const second = createGameState(storage);
  game.bodies.push({});
  assert.equal(second.bodies.length, 0);
});
test('invalid JSON and blocked storage use defaults without stopping play', () => {
  const malformed = createStorage(() => ({ getItem: () => '{bad json' }));
  assert.equal(malformed.get('best', 0), 0);
  const blocked = createStorage(() => {
    throw new Error('blocked');
  });
  assert.equal(blocked.get('best', 12), 12);
  assert.doesNotThrow(() => blocked.set('best', 12));
  assert.equal(createAudioState(blocked).trackId, 5);
});
test('malformed collection and unknown song IDs are rejected', () => {
  const storage = {
    get: (key, fallback) =>
      ({ dex: { bad: true }, musicTrack: 99, musicVol: 999, bassAmt: -10 })[key] ?? fallback,
  };
  assert.deepEqual(createGameState(storage).dex, [true]);
  const audio = createAudioState(storage);
  assert.equal(audio.trackId, 5);
  assert.equal(audio.volume, 100);
  assert.equal(audio.bassAmount, 0);
});
