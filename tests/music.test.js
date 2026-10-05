import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { SONG_STYLES, createArrangements } from '../src/audio/song-registry.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
import { composeGenSession, createTimeline } from '../src/audio/gen/timeline.js';
import { STYLES, STYLE_IDS } from '../src/audio/gen/styles.js';
import { SCALES } from '../src/audio/gen/scales.js';

const SEEDS = [42, 7, 123456789];
const timelineOf = (id, seed) => createTimeline(composeGenSession(id, seed, null));

test('every catalog song is a generated style with a complete registration', () => {
  assert.deepEqual(TRACK_IDS, [1, 2, 3, 4]);
  assert.deepEqual(
    TRACK_IDS.map((id) => TRACKS[id].style),
    ['euphoria', 'rave', 'melodic', 'anthem'],
  );
  const buttons = new Set();
  for (const id of TRACK_IDS) {
    const song = TRACKS[id];
    assert(song.name && song.description && song.label);
    assert(!buttons.has(song.buttonId));
    buttons.add(song.buttonId);
    const style = SONG_STYLES[song.style];
    assert.equal(typeof style.compose, 'function');
    assert.equal(typeof style.createTimeline, 'function');
    assert.equal(typeof style.createArrangement, 'function');
    const [low, high] = STYLES[song.style].bpm;
    assert(song.bpm >= low && song.bpm <= high, `${song.name}: the listed tempo is in range`);
  }
});

for (const id of STYLE_IDS)
  test(`${id}: a set is a pure function of its seed, whatever order it is asked in`, () => {
    for (const seed of SEEDS) {
      const session = composeGenSession(id, seed, null);
      assert.deepEqual(composeGenSession(id, seed, null), session);
      const forward = createTimeline(session),
        backward = createTimeline(session),
        bars = [0, 1, 15, 16, 63, 64, 130, 199, 200, 201, 420, 777];
      const first = bars.map((bar) => JSON.stringify(forward.plan(bar)));
      backward.plan(1500);
      const second = [...bars].reverse().map((bar) => JSON.stringify(backward.plan(bar)));
      assert.deepEqual(first, second.reverse());
      assert.notEqual(
        JSON.stringify(timelineOf(id, seed + 1).track(0).loops),
        JSON.stringify(forward.track(0).loops),
        'another seed is another set',
      );
    }
  });

for (const id of STYLE_IDS)
  test(`${id}: the set never plays the same track twice`, () => {
    for (const seed of SEEDS) {
      const timeline = timelineOf(id, seed),
        prints = new Set();
      let previous = null;
      for (let index = 0; index < 16; index++) {
        const track = timeline.track(index),
          print = JSON.stringify([track.pc, track.loops.hookA, track.loops.bass]);
        assert(!prints.has(print), `${id} track ${index} repeats an earlier one`);
        prints.add(print);
        if (previous) assert.notEqual(track.pc, previous.pc, 'every track moves to a new key');
        previous = track;
      }
      // The tracks follow each other without gaps.
      let bar = 0;
      for (let index = 0; index < 6; index++) {
        const { index: found, local } = timeline.locate(bar);
        assert.equal(found, index);
        assert.equal(local, 0);
        bar += timeline.track(index).length;
      }
    }
  });

for (const id of STYLE_IDS)
  test(`${id}: every track is shaped like a real one`, () => {
    const timeline = timelineOf(id, 42);
    for (let index = 0; index < 10; index++) {
      const track = timeline.track(index),
        types = track.sections.map((section) => section.type);
      assert.equal(types[0], 'INTRO');
      assert.equal(types.at(-1), 'OUTRO');
      assert.equal(types.filter((type) => type === 'DROP').length, 2);
      types.forEach((type, i) => {
        if (type === 'BUILD') assert.equal(types[i + 1], 'DROP', 'every build lands in a drop');
      });
      assert(track.length >= 140 && track.length <= 240, `${track.length} bars`);
      for (const section of track.sections)
        assert.equal(section.len % track.cycleBars, 0, 'sections hold whole loops');
      assert.equal(track.loops.hookB.length > 0, true);
      assert.notDeepEqual(track.loops.hookA, track.loops.hookB, 'the second drop lifts the hook');
    }
  });

for (const id of STYLE_IDS)
  test(`${id}: loops stay in key and in range, and hooks lean on the chords`, () => {
    for (const seed of SEEDS) {
      const timeline = timelineOf(id, seed),
        style = STYLES[id];
      for (let index = 0; index < 6; index++) {
        const track = timeline.track(index),
          key = new Set(SCALES[track.scale].map((step) => (track.pc + step) % 12)),
          steps = track.cycleBars * 16,
          chordAt = (step) => track.chords[Math.floor(step / (track.chordBars * 16))];
        for (const [name, loop] of Object.entries(track.loops))
          for (const note of loop) {
            assert(note.step >= 0 && note.step < steps && note.len > 0, `${name} fits its loop`);
            for (const pitch of note.notes || [note.note])
              assert(key.has(pitch % 12), `${id} ${name}: ${pitch} is in the key`);
          }
        for (const note of track.loops.bass)
          assert(note.note >= style.bassRange[0] && note.note <= style.bassRange[1] + 12);
        let strong = 0,
          fitting = 0;
        for (const note of track.loops.hookA) {
          if (note.step % 4) continue;
          strong++;
          const chord = chordAt(note.step);
          if (chord.notes.some((tone) => tone % 12 === note.note % 12)) fitting++;
        }
        assert(
          fitting >= strong * 0.75,
          `${fitting} of ${strong} strong hook notes are chord tones`,
        );
      }
    }
  });

for (const id of STYLE_IDS)
  test(`${id}: bar plans start each loop where its layer comes in, and builds end in silence`, () => {
    const timeline = timelineOf(id, 42),
      track = timeline.track(0),
      covered = {};
    for (let bar = 0; bar < track.length; bar++) {
      const plan = timeline.plan(bar);
      for (const entry of plan.stems) {
        assert(entry.bars >= 1 && entry.offset >= 0 && entry.offset < track.cycleBars);
        assert(entry.offset + entry.bars <= track.cycleBars, 'a loop never runs past its end');
        covered[entry.layer] = bar + entry.bars;
      }
      for (const name of ['bass', 'hook', 'arp', 'stab', 'pad'])
        if (plan.on[name])
          assert(covered[name] > bar, `${id} bar ${bar}: ${name} has a loop playing`);
      if (plan.dropout) {
        assert.equal(plan.sec, 'BUILD');
        assert.equal(plan.bs, plan.len - 1);
        for (const row of Object.values(plan.drums)) assert(row.slice(12).every((v) => v === 0));
      }
      if (plan.fill !== 'none') assert.equal(plan.bs % 8, 7, 'fills close a phrase');
    }
  });

test('a long session keeps its memory bounded and any bar can be asked for at once', () => {
  for (const id of STYLE_IDS) {
    const timeline = timelineOf(id, 42);
    let biggest = 0;
    for (let bar = 0; bar < 5000; bar++) {
      timeline.plan(bar);
      biggest = Math.max(biggest, timeline.size());
    }
    assert(biggest < 60, `${id}: ${biggest} remembered items`);
    assert.equal(timeline.plan(40000).bar, 40000);
    assert(timeline.size() < 60);
  }
});

test('all arrangements play a long session with finite, in-time musical events', () => {
  for (const id of TRACK_IDS) {
    const style = TRACKS[id].style,
      audio = createAudioState();
    audio.trackId = id;
    audio.seed = 42;
    const audioComposition = createAudioComposition({ audio });
    audio.session = audioComposition.composeSession(audio.seed);
    const events = [],
      param = {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        setTargetAtTime() {},
        cancelScheduledValues() {},
      };
    audio.graph = { song: { duck: { gain: param }, melLP: { frequency: param } } };
    const audioInstruments = new Proxy(
        {},
        {
          get:
            (_, name) =>
            (...args) =>
              events.push({ name, args }),
        },
      ),
      arrangements = createArrangements({
        audio,
        game: { phase: 'play', goldTime: 0, comboCount: 0 },
        audioComposition,
        audioInstruments,
        audioMath: createAudioMath(audio),
      });
    const names = new Set();
    for (let bar = 0; bar < 600; bar++)
      for (let step = 0; step < 16; step++) {
        const time = (bar * 16 + step) * audio.session.s16;
        events.length = 0;
        arrangements[style](bar * 16 + step, time);
        for (const event of events) {
          names.add(event.name);
          for (const argument of event.args)
            if (typeof argument === 'number') assert(Number.isFinite(argument));
          if (event.name === 'kickTuning') continue;
          assert(
            event.args[0] >= time - 0.01 && event.args[0] < time + audio.session.spb * 4,
            `${TRACKS[id].name}: ${event.name} at ${event.args[0]} for the step at ${time}`,
          );
        }
      }
    for (const voice of ['eKick', 'eHat', 'eClap', 'eCrash', 'eRiser', 'eImpact'])
      assert(names.has(voice), `${TRACKS[id].name} plays ${voice}`);
  }
});

test('merge feedback is immediate while musical rewards coalesce and retry preserves the clock', () => {
  const audio = createAudioState();
  audio.session = { style: 'rave', spb: 60 / 145 };
  audio.context = { state: 'running', currentTime: 10 };
  audio.graph = { song: {} };
  audio.playing = { live: true };
  audio.songStart = 7;
  let accents = 0;
  const reactions = createAudioReactions({
    audio,
    game: { phase: 'play' },
    audioComposition: { chordFor: () => ({ notes: [60, 64, 67, 71] }) },
    gameAudio: { play: () => accents++, reset() {} },
  });
  for (let i = 0; i < 30; i++) reactions.reactToMerge(3, i + 1);
  assert.equal(accents, 30);
  assert.equal(audio.pendingHits.length, 1);
  assert.equal(audio.pendingHits[0].combo, 30);
  audio.enabled = false;
  audio.context.currentTime += 2;
  reactions.reactToMerge(4, 2);
  assert.equal(audio.pendingHits.length, 1);
  reactions.resetLiveMusic();
  assert.equal(audio.songStart, 7);
  assert.equal(audio.session.style, 'rave');
  assert(audio.playing);
});
