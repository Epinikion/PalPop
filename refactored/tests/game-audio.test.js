import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAudio } from '../src/audio/game-feedback.js';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { createAudioScheduler } from '../src/audio/scheduler.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
function fixture() {
  const audio = createAudioState(),
    starts = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({
    frequency: param(),
    gain: param(),
    pan: param(),
    Q: param(),
    connect() {},
    disconnect() {},
    start: (time) => starts.push(time),
    stop() {},
  });
  audio.context = {
    currentTime: 1,
    state: 'running',
    createOscillator: node,
    createGain: node,
    createBiquadFilter: node,
    createStereoPanner: node,
  };
  audio.sfxG = {};
  const audioComposition = createAudioComposition({ audio });
  audio.session = audioComposition.composeSession(42);
  const gameAudio = createGameAudio({
    audio,
    audioComposition,
    audioMath: { midi: (n) => 440 * 2 ** ((n - 69) / 12) },
    audioGraph: { releaseVoice() {} },
  });
  return { audio, gameAudio, audioComposition, starts };
}
test('game effects respond within 5 ms and remain available with music at zero', () => {
  const { audio, gameAudio, starts } = fixture();
  audio.volume = 0;
  assert(gameAudio.play('drop', { tier: 3, x: 30 }));
  assert(starts.every((time) => time === 1.005));
  audio.enabled = false;
  assert.equal(gameAudio.play('merge'), false);
  audio.enabled = true;
  audio.effectsVolume = 0;
  assert.equal(gameAudio.play('merge'), false);
});
test('game effects cap simultaneous voices and keep impact memory bounded', () => {
  const { gameAudio } = fixture();
  for (let i = 0; i < 50; i++) gameAudio.play('merge', { combo: i + 1 }, 1 + i * 0.0001);
  assert.equal(gameAudio.getStats().maxVoices, 7);
  assert(gameAudio.getStats().rejected >= 40);
  assert(gameAudio.play('swap', {}, 1.005));
  assert(gameAudio.play('drop', {}, 1.006));
  assert(gameAudio.play('over', {}, 1.007));
  assert.equal(gameAudio.getStats().maxVoices, 10);
  assert.equal(gameAudio.play('impact', { speed: 40 }, 4), false);
  assert(gameAudio.play('impact', { speed: 200, pair: '1:2' }, 4));
  assert.equal(gameAudio.play('impact', { speed: 200, pair: '1:2' }, 4.11), false);
  for (let i = 0; i < 300; i++)
    gameAudio.play('impact', { speed: 200, pair: `pair:${i}` }, 5 + i * 0.4);
  assert.equal(gameAudio.getStats().pairCacheSize, 24);
});
test('musical cascade rewards take the strongest event, at most one per beat', () => {
  for (const id of TRACK_IDS) {
    const { audio, audioComposition, gameAudio } = fixture(),
      events = [];
    audio.trackId = id;
    audio.session = audioComposition.composeSession(42);
    audio.playing = { live: true };
    audio.graph = { song: {} };
    audio.nextStepTime = 100;
    const game = { phase: 'play' },
      reactions = createAudioReactions({ audio, game, gameAudio }),
      scheduler = createAudioScheduler({
        audio,
        audioComposition,
        audioInstruments: new Proxy(
          {},
          {
            get:
              (_, name) =>
              (...args) =>
                events.push({ name, args }),
          },
        ),
        arrangements: {},
      });
    for (let combo = 1; combo <= 7; combo++) reactions.reactToMerge(2, combo);
    assert.equal(audio.pendingHits.length, 1);
    assert.equal(audio.pendingHits[0].combo, 7);
    scheduler.musicTick();
    assert.equal(events.length, 2);
    if (TRACKS[id].style === 'festival') assert.equal(events[0].name, 'eFestivalPiano');
    const firstReply = events[0].args[0];
    reactions.reactToMerge(8, 4);
    audio.context.currentTime += 0.04;
    scheduler.musicTick();
    assert.equal(events.length, 2);
    audio.context.currentTime = audio.lastRewardTime + 0.01;
    scheduler.musicTick();
    assert.equal(events.length, 4);
    assert(events[2].args[0] - firstReply >= audio.session.spb);
    reactions.reactToMerge(8, 4);
    audio.pendingFx.push(1);
    reactions.reactToEvent('over');
    game.phase = 'dying';
    reactions.reactToMerge(8, 5);
    assert.equal(audio.pendingHits.length, 0);
    assert.equal(audio.pendingFx.length, 0);
  }
});
