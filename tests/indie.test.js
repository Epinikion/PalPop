import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { TRACKS, TRACK_IDS, INDIE } from '../src/audio/catalog.js';
import {
  composeIndieSession,
  renewIndieChapter,
  INDIE_FORMS,
} from '../src/audio/songs/indie-composition.js';
import { createIndie } from '../src/audio/instruments/indie.js';
import { fakeContext, reaches } from './helpers/fake-audio.js';
import { arrangement } from './helpers/arrangement.js';

const SEEDS = [1, 7, 42, 99, 2024, 31337, 123456789];
const SECTIONS = ['INTRO', 'VERSE', 'PRE', 'CHORUS', 'BREAK', 'OUTRO'];

test('the indie song is registered as a sung track with a deep pump and a stable id', () => {
  assert.equal(INDIE, 11);
  assert(TRACKS[INDIE].style === 'indie' && TRACK_IDS.includes(INDIE));
  assert(TRACKS[INDIE].vocals, 'it has a vocal bus');
  assert(TRACKS[INDIE].pump >= 0.6, 'the whole mix breathes with the kick');
  assert(TRACKS[INDIE].bpm >= 122 && TRACKS[INDIE].bpm <= 124);
});

test('indie sessions are deterministic, always E major at 122 to 124 BPM, with valid loops', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const session = composeIndieSession(seed);
    assert.deepEqual(session, composeIndieSession(seed));
    assert.equal(session.style, 'indie');
    assert(session.bpm >= 122 && session.bpm <= 124 && Number.isInteger(session.bpm));
    assert.equal(session.kname, 'E');
    assert.equal(session.pc, 4);
    assert.equal(session.mname, 'MAJOR');
    assert(Math.abs(session.s16 * 4 - session.spb) < 1e-12);
    for (const name of ['main', 'pre', 'lift', 'brk']) {
      const [loop] = session.progs[name];
      assert.equal(loop.length, 4);
      assert(loop.every((degree) => Number.isInteger(degree) && degree >= 0 && degree < 7));
    }
    for (const section of SECTIONS) assert(session.progs[session.banks[section]], section);
    // The chorus loop turns on C# minor and A, the heart of the song this style is voiced after.
    assert.deepEqual(session.progs.lift[0].slice(0, 2), [5, 3]);
  }
});

test('chapters renew the material but keep the key and tempo, with valid long-groove forms', () => {
  for (const seed of SEEDS) {
    const audio = createAudioState();
    audio.trackId = INDIE;
    audio.seed = seed;
    const composer = createAudioComposition({ audio });
    audio.session = composer.composeSession(seed);
    assert.deepEqual(audio.session, composeIndieSession(seed));
    const loops = new Set();
    for (let chapter = 1; chapter < 400; chapter++) {
      const session = composer.chapterFor(chapter);
      assert.equal(session.bpm, audio.session.bpm);
      assert.equal(session.pc, audio.session.pc);
      assert.equal(session.form.at(-1)[0], 64);
      loops.add(session.progs.lift[0].join() + session.progs.brk[0].join());
    }
    assert(loops.size > 1);
    assert.equal(audio.chapters.size, 3, 'composition memory stays bounded');
  }
  for (const form of INDIE_FORMS) {
    assert.equal(form.at(-1)[0], 64);
    let start = 0;
    for (const [end, name] of form) {
      assert(SECTIONS.includes(name) && end > start && (end - start) % 4 === 0, name);
      start = end;
    }
    // One real breakdown, long enough to hear the kick leave and come back.
    const lengths = form.map(([end], i) => end - (i ? form[i - 1][0] : 0));
    const names = form.map(([, name]) => name);
    assert(lengths[names.indexOf('BREAK')] >= 8);
  }
  const renewed = renewIndieChapter(5, composeIndieSession(5), () => 0.9);
  assert(INDIE_FORMS.includes(renewed.form));
  assert.notEqual(renewed.form, INDIE_FORMS[0], 'later chapters begin in a groove, not an intro');
});

/** Sixteenth step of an event inside its bar, from the time the arrangement scheduled it. */
const stepOf = (audio, event) => Math.round(event.args[0] / audio.session.s16) % 16;

test('the kick is straight on every beat until the breakdown takes it away', () => {
  for (const seed of SEEDS) {
    const play = arrangement('indie', seed);
    for (let bar = 0; bar < 64; bar++) {
      const { sec, bs, len } = play.comp.sectionAt(bar),
        kicks = play
          .bar(bar)
          .filter((event) => event.name === 'eKick')
          .map((event) => stepOf(play.audio, event));
      if (sec === 'BREAK') assert.deepEqual(kicks, [], `bar ${bar}`);
      else if (sec === 'OUTRO' && bs >= 2) assert.deepEqual(kicks, [], `bar ${bar}`);
      else if (sec === 'PRE' && bs === len - 1) assert.deepEqual(kicks, [0, 4, 8], `bar ${bar}`);
      else assert.deepEqual(kicks, [0, 4, 8, 12], `${sec} bar ${bar}`);
    }
  }
});

test('the bass plays only between the kicks, root then fifth, and the breakdown holds one note', () => {
  const play = arrangement('indie', 42);
  let bassBars = 0;
  for (let bar = 0; bar < 64; bar++) {
    const { sec, bs } = play.comp.sectionAt(bar),
      bass = play.bar(bar).filter((event) => event.name === 'eWarmBass'),
      steps = bass.map((event) => stepOf(play.audio, event));
    if (sec === 'BREAK') {
      assert.deepEqual(steps, [0], 'one long note under the pads');
      continue;
    }
    if (steps.length) {
      bassBars++;
      assert(
        steps.every((step) => step % 4 === 2),
        `${sec} bar ${bar}: ${steps}`,
      );
    }
    if (sec === 'CHORUS') {
      assert.deepEqual(steps, [2, 6, 10, 14]);
      // Root twice, then the fifth: the pattern of the bass line.
      assert.equal(bass[0].args[1], bass[1].args[1]);
      if (bs % 4 !== 3) assert.equal(bass[2].args[1] - bass[0].args[1], 7);
    }
  }
  assert(bassBars >= 40, `${bassBars} bars with a bass line`);
});

test('claps land on two and four, chord stabs are dotted, and the chorus is sung', () => {
  const play = arrangement('indie', 42);
  let choruses = 0;
  for (let bar = 0; bar < 64; bar++) {
    const { sec, bs } = play.comp.sectionAt(bar),
      events = play.bar(bar),
      at = (name) =>
        events.filter((event) => event.name === name).map((e) => stepOf(play.audio, e));
    if (sec === 'CHORUS') {
      choruses++;
      assert.deepEqual(at('eClap'), [4, 12]);
      // Two takes a few cents apart, one in each ear, on every stab step.
      assert.deepEqual([...new Set(at('eRhodes'))], [0, 3, 6, 8, 11, 14]);
      assert.equal(at('eRhodes').length, 12);
      if (bs === 0) assert(events.some((event) => event.name === 'eImpact'));
    }
    if (sec === 'BREAK') {
      assert.deepEqual(at('eClap'), []);
      assert(!events.some((event) => event.name === 'eRhodes'));
    }
  }
  assert(choruses >= 16);
  // The chorus carries a sung hook: a lead with doubles on most bars.
  let sung = 0;
  for (let bar = 20; bar < 36; bar++)
    sung += play.bar(bar).some((event) => event.name === 'eVoice') ? 1 : 0;
  assert(sung >= 6, `${sung} sung bars of 16`);
});

test('the sung parts are shared with the house song and bounded in memory', () => {
  const play = arrangement('indie', 42);
  for (let bar = 0; bar < 128; bar++) play.bar(bar);
  assert(play.audio.chapters.size <= 3);
});

test('the electric piano and the bass are one cleaned-up voice each and reach their buses', () => {
  const context = fakeContext(),
    cleanups = [],
    song = { mel: context.createGain(), bass: context.createGain() },
    audio = { context, graph: { song }, stemFlash: {} },
    { eRhodes, eWarmBass } = createIndie({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
    }),
    oscillators = () => context.nodes.filter((node) => node.kind === 'oscillator').length;
  eRhodes(1, [64, 68, 71], 0.2, 0.2, 0.5, -0.4, -5);
  assert.equal(oscillators(), 9, 'carrier, body and tine for each of three notes');
  assert.equal(cleanups.length, 1);
  assert(reaches(cleanups[0][1], song.mel) && cleanups[0][0].startTime >= 1);
  assert(
    context.nodes.filter((node) => node.kind === 'oscillator').every((node) => node.endTime > 1.2),
    'the keys ring past their step',
  );
  assert.equal(context.nodes.find((node) => node.kind === 'panner').pan.value, -0.4);
  eWarmBass(2, 40, 0.3, 0.2);
  assert.equal(oscillators(), 11, 'a sine and its second harmonic');
  assert.equal(cleanups.length, 2);
  assert(reaches(cleanups[1][1], song.bass));
});
