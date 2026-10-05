import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioGraph } from '../src/audio/graph.js';
import { createAudioOutput } from '../src/audio/output.js';
import { createSupersaw } from '../src/audio/instruments/supersaw.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
import { fakeContext, reaches } from './helpers/fake-audio.js';

test('the last stage of the master rounds peaks off below full scale instead of clipping', () => {
  const context = fakeContext();
  createAudioOutput(context);
  const last = context.nodes.filter((node) => node.kind === 'shaper').at(-1);
  assert(last.edges.includes(context.destination), 'it sits right before the output');
  const { curve } = last,
    middle = (curve.length - 1) / 2;
  assert(
    curve.every((value) => Math.abs(value) < 0.99),
    'nothing reaches 0.99',
  );
  assert(Math.abs(curve[0]) > 0.96 && Math.abs(curve.at(-1)) > 0.96, 'but loud peaks are not lost');
  // Below 0.9 the signal passes untouched, and the curve is odd and never falls.
  for (let i = 0; i < curve.length; i++) {
    const x = (i - middle) / middle;
    if (Math.abs(x) <= 0.9) assert(Math.abs(curve[i] - x) < 1e-6);
    assert(i === 0 || curve[i] >= curve[i - 1]);
    assert(Math.abs(curve[i] + curve[curve.length - 1 - i]) < 1e-6);
  }
});

test('the music bus is clean: no exciter, only a gentle presence and air lift, and a path to the output', () => {
  for (const id of TRACK_IDS) {
    const audio = createAudioState(),
      context = fakeContext();
    audio.trackId = id;
    audio.context = context;
    audio.master = createAudioOutput(context);
    createAudioGraph({ audio }).buildMusicGraph();
    // The saturation that once added dense highs also added a glassy hiss: only the soft master
    // saturator and the voices' own drive are left.
    const highpasses = context.nodes.filter(
      (node) => node.kind === 'biquad' && node.type === 'highpass' && node.frequency.value >= 1000,
    );
    assert.equal(highpasses.length, 0, `${TRACKS[id].name}: no exciter high-pass`);
    const lifts = context.nodes.filter(
      (node) =>
        node.kind === 'biquad' &&
        (node.type === 'peaking' || node.type === 'highshelf') &&
        node.frequency.value >= 3000,
    );
    for (const lift of lifts)
      assert(Math.abs(lift.gain.value) <= 3, `${TRACKS[id].name}: top-end EQ stays gentle`);
    assert(reaches(audio.musIn, context.destination));
  }
});

test('a driven, drifting saw stack is saturated after its filter and never the same twice', () => {
  const build = (options) => {
    const context = fakeContext(),
      song = { mel: context.createGain() },
      audio = { context, graph: { song }, stemFlash: {} },
      cleanups = [],
      { superSaw } = createSupersaw({
        audio,
        audioMath: createAudioMath({ seed: 1 }),
        audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
      });
    superSaw(1, [60, 64], 0.3, 0.1, { voices: 5, ...options });
    return { context, song, cleanups };
  };
  const plain = build({}),
    driven = build({ drive: 2.4, drift: 3 });
  assert.equal(plain.context.nodes.filter((node) => node.kind === 'shaper').length, 0);
  const [shaper, ...more] = driven.context.nodes.filter((node) => node.kind === 'shaper');
  assert(shaper && !more.length);
  assert(reaches(shaper, driven.song.mel), 'the saturated signal is the one that is heard');
  assert.equal(driven.cleanups.length, 1, 'still one voice to clean up');
  assert(driven.cleanups[0][2].includes(shaper), 'and the shaper goes with it');
  const detunes = (run) =>
    run.context.nodes.filter((node) => node.kind === 'oscillator').map((node) => node.detune.value);
  assert.equal(new Set(detunes(plain)).size, 5, 'five layouts offsets, the same for both notes');
  assert(new Set(detunes(driven)).size > 5, 'drift makes every oscillator its own');
  for (const cents of detunes(driven)) assert(Math.abs(cents) < 23 * 1 + 3 + 1e-9);
});
