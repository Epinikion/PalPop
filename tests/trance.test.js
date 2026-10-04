import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { TRACKS, TRACK_IDS, TRANCE } from '../src/audio/catalog.js';
import {
  composeTranceSession,
  renewTranceChapter,
  TRANCE_FORMS,
} from '../src/audio/songs/trance-composition.js';
import { kickTuning } from '../src/audio/instruments/kit-dsp.js';
import { createTrance } from '../src/audio/instruments/trance.js';
import { fakeContext, reaches } from './helpers/fake-audio.js';
import { arrangement } from './helpers/arrangement.js';

const SEEDS = [1, 7, 42, 99, 2024, 31337, 123456789];
const SECTIONS = ['INTRO', 'GROOVE', 'BUILD', 'PEAK', 'BREAK', 'FINAL'];

test('the trance song is registered with a light synth pump and a stable id', () => {
  assert.equal(TRANCE, 10);
  assert(TRACKS[TRANCE].style === 'trance' && TRACK_IDS.includes(TRANCE));
  assert(TRACKS[TRANCE].pump < 0.5, 'the synths barely duck: the wall stays open');
  assert(TRACKS[TRANCE].bpm >= 138 && TRACKS[TRANCE].bpm <= 144);
});

test('trance sessions are deterministic and valid: key, mode, tempo, loops and patterns', () => {
  let major = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const session = composeTranceSession(seed);
    assert.deepEqual(session, composeTranceSession(seed));
    assert(session.bpm >= 138 && session.bpm <= 144 && Number.isInteger(session.bpm));
    assert(Math.abs(session.s16 * 4 - session.spb) < 1e-12);
    assert(['MAJOR', 'MINOR'].includes(session.mname));
    major += session.mname === 'MAJOR';
    assert.equal(session.mode.s.length, 7);
    for (const bank of Object.values(session.progs))
      for (const loop of bank) {
        assert.equal(loop.length, 4);
        assert(loop.every((degree) => degree >= 0 && degree < 7));
      }
    assert.equal(session.arp.length, 16);
    assert(session.arp.every((index) => Number.isInteger(index) && index >= 0 && index <= 5));
    assert.equal(session.hats.length, 4);
    assert(session.hats.every((velocity) => velocity > 0 && velocity <= 1));
    assert(session.leaps.every((beat) => beat >= 0 && beat < 4));
  }
  // The reference set spent more of its time in major keys than in minor ones.
  assert(major > 300 * 0.45 && major < 300 * 0.75, `${major} major sessions of 300`);
});

test('chapters renew the material but keep the key, mode and tempo, with valid forms', () => {
  for (const seed of SEEDS) {
    const audio = createAudioState();
    audio.trackId = TRANCE;
    audio.seed = seed;
    const composer = createAudioComposition({ audio });
    audio.session = composer.composeSession(seed);
    assert.deepEqual(audio.session, composeTranceSession(seed));
    const arps = new Set();
    for (let chapter = 1; chapter < 400; chapter++) {
      const session = composer.chapterFor(chapter);
      assert.equal(session.bpm, audio.session.bpm);
      assert.equal(session.pc, audio.session.pc);
      assert.equal(session.mname, audio.session.mname);
      assert.equal(session.form.at(-1)[0], 64);
      arps.add(session.arp.join());
    }
    assert(arps.size > 1);
    assert.equal(audio.chapters.size, 3, 'composition memory stays bounded');
  }
  for (const form of TRANCE_FORMS) {
    assert.equal(form.at(-1)[0], 64);
    assert(form.every(([end, name], i) => SECTIONS.includes(name) && (!i || end > form[i - 1][0])));
  }
  const renewed = renewTranceChapter(5, composeTranceSession(5), () => 0.9);
  assert(TRANCE_FORMS.includes(renewed.form));
  assert.notEqual(renewed.form, TRANCE_FORMS[0], 'later chapters begin in a groove, not an intro');
});

test('the floor is a tuned four-on-the-floor kick that stops only in breaks and before drops', () => {
  const { audio, comp, bar } = arrangement('trance'),
    kicks = (events) => events.filter(({ name }) => name === 'eKick');
  for (let index = 0; index < 64; index++) {
    const section = comp.sectionAt(index),
      events = bar(index),
      played = kicks(events);
    if (section.sec === 'BREAK' || (section.sec === 'INTRO' && section.bs < 1))
      assert.equal(played.length, 0, `bar ${index}`);
    else if (section.sec === 'BUILD' && section.bs === section.len - 1) {
      assert.equal(played.length, 3, 'the last beat before the drop is silent');
      assert(events.every(({ args }) => args[0] < (index * 16 + 12) * audio.session.s16));
    } else assert.equal(played.length, 4, `bar ${index}`);
    for (const { args } of played)
      assert.equal(args[5], 3, 'the clean kick leaves the low mids to the bass');
    if (played.length)
      assert(
        events.some(({ name, args }) => name === 'kickTuning' && args[0] === audio.session.pc),
        'tuned to the key',
      );
  }
});

test('the bass rolls through the three sixteenths after each kick and never lands on it', () => {
  const { audio, comp, bar } = arrangement('trance'),
    { s16 } = audio.session;
  let peaks = 0;
  for (let index = 0; index < 64; index++) {
    const section = comp.sectionAt(index),
      notes = bar(index).filter(({ name }) => name === 'eDanceBass');
    for (const { args } of notes) {
      const step = Math.round(args[0] / s16 - index * 16);
      assert(step % 4 !== 0, 'off the kick');
      assert(args[2] > s16, 'notes overlap, so the bass is continuous');
    }
    if (section.sec === 'PEAK' || section.sec === 'FINAL') {
      peaks++;
      assert.equal(notes.length, 12, `bar ${index}`);
      // The sixteenth before the next kick is the strongest.
      const byStep = (n) =>
        notes.filter(({ args }) => Math.round(args[0] / s16 - index * 16) % 4 === n);
      assert(
        byStep(3)[0].args[3] > byStep(2)[0].args[3] && byStep(2)[0].args[3] > byStep(1)[0].args[3],
      );
    }
    if (section.sec === 'BREAK') assert.equal(notes.length, 0);
  }
  assert(peaks >= 16);
});

test('drops have hats on every sixteenth and an arpeggio and chord wall that never leave a gap', () => {
  const { audio, comp, bar } = arrangement('trance'),
    { s16 } = audio.session;
  let walls = 0;
  for (let index = 0; index < 64; index++) {
    const section = comp.sectionAt(index);
    if (section.sec !== 'PEAK' && section.sec !== 'FINAL') continue;
    const events = bar(index),
      hats = events.filter(({ name }) => name === 'eHat'),
      arps = events.filter(({ name }) => name === 'eTranceArp'),
      steps = (list) => list.map(({ args }) => Math.round(args[0] / s16 - index * 16) + 0);
    assert.equal(hats.filter(({ args }) => args[1]).length, 4, 'an open hat on every off-beat');
    assert.deepEqual(
      steps(hats.filter(({ args }) => !args[1])).sort((a, b) => a - b),
      [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15],
      'closed hats on every sixteenth except the off-beat eighths',
    );
    assert.deepEqual(
      steps(arps),
      Array.from({ length: 16 }, (_, i) => i),
      'one arp note per step',
    );
    for (const { args } of arps) assert(args[1] >= 60 && args[1] <= 100 && args[2] > s16);
    walls += events.filter(({ name }) => name === 'eTranceChord').length;
    if (index % 2 === 0) {
      const [wall] = events.filter(({ name }) => name === 'eTranceChord');
      assert(wall && wall.args[2] > s16 * 30, 'a chord that holds for two bars');
    }
  }
  assert(walls >= 8);
});

test('the drop lands with a kick, a crash and an impact, and builds roll a snare into it', () => {
  const { audio, comp, bar } = arrangement('trance');
  let drops = 0;
  for (let index = 1; index < 64; index++) {
    const section = comp.sectionAt(index);
    if (section.sec !== 'PEAK' && section.sec !== 'FINAL') continue;
    if (section.bs !== 0 || comp.sectionAt(index - 1).sec !== 'BUILD') continue;
    drops++;
    const hit = bar(index)
      .filter(({ args }) => args[0] === index * 16 * audio.session.s16)
      .map(({ name }) => name);
    for (const voice of ['eKick', 'eCrash', 'eImpact']) assert(hit.includes(voice), voice);
    assert(bar(index - 1).filter(({ name }) => name === 'eSnare').length >= 6, 'a snare roll');
    assert(bar(index - 1).some(({ name }) => name === 'eSwell'));
  }
  assert(drops >= 2);
});

test('breakdowns keep the wall up: a held chord, piano and the hook, but no kick', () => {
  const { comp, bar } = arrangement('trance');
  let seen = 0;
  for (let index = 0; index < 64; index++) {
    if (comp.sectionAt(index).sec !== 'BREAK') continue;
    seen++;
    const names = new Set(bar(index).map(({ name }) => name));
    assert(names.has('eFestivalPiano'), `bar ${index}`);
    assert(!names.has('eKick') && !names.has('eDanceBass'));
    if (index % 2 === 0) assert(names.has('eTranceChord'));
  }
  assert(seen >= 8);
});

test('the wall voices are one cleaned-up voice each, wide, bright and held past their step', () => {
  const context = fakeContext(),
    cleanups = [],
    song = { mel: context.createGain() },
    audio = { context, graph: { song }, stemFlash: {} },
    { eTranceChord, eTranceArp } = createTrance({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
    }),
    saws = () => context.nodes.filter((node) => node.kind === 'oscillator').length;
  eTranceChord(1, [60, 64, 67], 4, 0.2);
  assert.equal(saws(), 15, 'five saws a note for a held chord');
  eTranceChord(6, [60, 64, 67], 0.2, 0.2);
  assert.equal(saws(), 15 + 9, 'three a note for a short stab');
  const before = saws();
  eTranceArp(8, 72, 0.25, 0.1, 0.6, -0.3);
  assert.equal(saws() - before, 3);
  assert.equal(cleanups.length, 3);
  for (const [source, outlet] of cleanups) assert(reaches(outlet, song.mel) && source.startTime);
  const oscillators = context.nodes.filter((node) => node.kind === 'oscillator').slice(-3);
  assert(
    oscillators.every((node) => node.endTime > 8.25),
    'held longer than the step it sits on',
  );
  assert.deepEqual(
    context.nodes
      .filter((node) => node.kind === 'panner')
      .slice(-3)
      .map((node) => node.pan.value)
      .sort(),
    [-0.3, -0.6, 0.6].sort(),
    'the voices spread either side of the arp position',
  );
  // The chord is bright: its filter opens higher than the festival chord layer's.
  const filters = context.nodes.filter((node) => node.kind === 'biquad' && node.type === 'lowpass');
  assert(filters[0].frequency.calls[0][1] > 5000);
});
