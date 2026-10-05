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
import { createAudioGen } from '../src/audio/gen/engine.js';
import { fakeContext } from './helpers/fake-audio.js';
import { sungGlow } from '../src/render/sung.js';
import fs from 'node:fs';

const SEEDS = [42, 7, 123456789];
const timelineOf = (id, seed) => createTimeline(composeGenSession(id, seed, null));
/** The first generated track of a set (ALL MY PALS opens with its recorded song). */
const firstGenerated = (timeline) => (timeline.track(0).record ? 1 : 0);

test('every catalog song is a generated style with a complete registration', () => {
  assert.deepEqual(TRACK_IDS, [1, 2, 3, 4, 5]);
  assert.deepEqual(
    TRACK_IDS.map((id) => TRACKS[id].style),
    ['euphoria', 'rave', 'melodic', 'anthem', 'pals'],
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
      const generated = firstGenerated(forward);
      assert.notEqual(
        JSON.stringify(timelineOf(id, seed + 1).track(generated).loops),
        JSON.stringify(forward.track(generated).loops),
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
        if (!track.record) {
          assert(!prints.has(print), `${id} track ${index} repeats an earlier one`);
          prints.add(print);
        }
        // A set with a recorded song stays in its key; every other set moves to a new key each track.
        if (previous && !STYLES[id].record)
          assert.notEqual(track.pc, previous.pc, 'every track moves to a new key');
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
      // A recorded song and the short instrumentals between its plays have their own shapes.
      if (STYLES[id].record) continue;
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
      index = firstGenerated(timeline),
      track = timeline.track(index),
      start = timeline.locate(index ? timeline.track(0).length : 0).start,
      covered = {};
    for (let bar = start; bar < start + track.length; bar++) {
      const plan = timeline.plan(bar);
      for (const entry of plan.stems) {
        assert(entry.bars >= 1 && entry.offset >= 0 && entry.offset < track.cycleBars);
        assert(entry.offset + entry.bars <= track.cycleBars, 'a loop never runs past its end');
        covered[entry.layer] = bar + entry.bars;
      }
      for (const name of ['bass', 'hook', 'arp', 'stab', 'pad'])
        if (plan.on[name]) {
          assert(covered[name] > bar, `${id} bar ${bar}: ${name} has a loop playing`);
          // Music that begins in this bar can pick up every loop that is already under way.
          const entry = [...plan.stems, ...plan.joins].find((e) => e.layer === name);
          assert(entry && entry.offset === (bar - start) % track.cycleBars);
        }
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

const RECORD = STYLES.pals.record;
/** The pals the song names: Blipp to Solis, and Goldie, Zappy and Icy. */
const TIERS_OF_SONG = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15];

test('the recorded song plays over and over, half a minute apart, with its measured form', () => {
  for (const seed of SEEDS) {
    const timeline = timelineOf('pals', seed);
    let bar = 0;
    for (let index = 0; index < 8; index++) {
      const track = timeline.track(index);
      assert.equal(!!track.record, index % 2 === 0);
      if (track.record) {
        assert.equal(track.pc, 9);
        assert.equal(track.scale, 'minor');
        assert.equal(track.length, 104);
        assert.deepEqual(
          track.sections.map((section) => [section.start, section.type]),
          RECORD.sections,
        );
        assert.equal(
          track.chords.map((chord) => chord.deg).join(''),
          RECORD.chords,
          'one chord per bar, as measured',
        );
        for (let local = 0; local < track.length; local++) {
          const plan = timeline.plan(bar + local);
          assert.equal(plan.record.file, 'all-my-pals.mp3');
          assert.equal(plan.stems.length, 0);
          assert(Object.values(plan.drums).every((row) => row.every((v) => v === 0)));
          assert(
            Object.values(plan.on).every((on) => !on),
            'nothing generated plays over it',
          );
        }
        assert(timeline.plan(bar + 10).record.sung && timeline.plan(bar + 60).record.sung);
        assert(timeline.plan(bar + 30).record.kick && !timeline.plan(bar + 60).record.kick);
      } else {
        // Between two plays: half a minute in the song's key and chords, a build, a drop, a breakdown.
        assert.equal(track.pc, 9);
        assert.equal(track.scale, 'minor');
        assert.equal(track.chords.map((chord) => chord.deg).join(''), '3052', 'Dm Am F C');
        assert.deepEqual(
          track.sections.map((section) => [section.type, section.len]),
          [
            ['BUILD', 4],
            ['DROP', 8],
            ['BREAK', 4],
          ],
        );
        const seconds = timeline.secondsAt((bar + 16) * 16) - timeline.secondsAt(bar * 16);
        assert(seconds > 27 && seconds < 29, `${seconds.toFixed(1)} s`);
        assert(track.loops.hookA.length && track.loops.bass.length);
        assert(timeline.plan(bar + 3).dropout, 'the build ends in a silent beat before the drop');
        assert(timeline.plan(bar + 4).fx.impact, 'the drop lands with an impact');
      }
      bar += track.length;
    }
  }
});

test('the measured song data is complete and fits inside its file', () => {
  const marks = RECORD.bars;
  assert.equal(marks.length, 105);
  for (let i = 1; i < marks.length; i++) {
    const bpm = 240 / (marks[i] - marks[i - 1]);
    assert(bpm > 135 && bpm < 138.5, `bar ${i - 1}: ${bpm.toFixed(2)} BPM`);
  }
  assert.equal(RECORD.chords.length, 104);
  assert.match(RECORD.chords, /^[0-6]+$/);
  assert.equal(RECORD.sections[0][0], 0);
  RECORD.sections.forEach(([start], i) => i && assert(start > RECORD.sections[i - 1][0]));
  for (const [from, to] of [...RECORD.kick, ...RECORD.sung]) assert(from < to && to <= 104);
  // The file's length, from its MPEG frames: the last bar ends just before the song does.
  const data = fs.readFileSync(new URL('../assets/music/all-my-pals.mp3', import.meta.url));
  let at = data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33 ? 10 : 0;
  if (at)
    at +=
      ((data[6] & 127) << 21) | ((data[7] & 127) << 14) | ((data[8] & 127) << 7) | (data[9] & 127);
  const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    RATES = [44100, 48000, 32000];
  let frames = 0,
    rate = 0;
  while (at + 4 <= data.length && data[at] === 0xff && (data[at + 1] & 0xfe) === 0xfa) {
    const kbps = KBPS[data[at + 2] >> 4];
    rate = RATES[(data[at + 2] >> 2) & 3];
    if (!kbps) break;
    at += Math.floor((144000 * kbps) / rate) + ((data[at + 2] >> 1) & 1);
    frames++;
  }
  // The first frame is the encoder's header, not sound.
  const seconds = ((frames - 1) * 1152) / rate;
  assert(seconds > 180, `${frames} frames`);
  assert(marks.at(-1) < seconds && marks.at(-1) > seconds - 0.5, `${seconds.toFixed(2)} s`);
});

test('every pal is named where the song sings, in order, and the glow follows the words', () => {
  const marks = RECORD.bars,
    barOf = (seconds) => marks.findLastIndex((mark) => mark <= seconds);
  let previous = 0;
  const named = new Set();
  for (const [at, tier, hold] of RECORD.names) {
    assert(at > previous, 'in the order they are sung');
    previous = at;
    const bar = barOf(at);
    assert(
      RECORD.sung.some(([from, to]) => bar >= from - 1 && bar < to),
      `${at} s (bar ${bar}) is in a sung part`,
    );
    assert(tier === -1 || TIERS_OF_SONG.includes(tier));
    assert(hold > 0 && hold <= 1.5);
    named.add(tier);
  }
  for (const tier of TIERS_OF_SONG) assert(named.has(tier), `tier ${tier} is sung`);
  // The glow: full while the name is sung, fading after, a short pop as it starts; -1 lights all.
  const cues = [
    { tier: 3, t: 10, hold: 0.45 },
    { tier: -1, t: 20, hold: 1.2 },
  ];
  const during = sungGlow(cues, 10.1, 16);
  assert.equal(during.glow[3], 1);
  assert(during.pop[3] > 0.5 && during.glow[4] === 0);
  const after = sungGlow(cues, 10.45 + 0.35, 16);
  assert(Math.abs(after.glow[3] - 0.5) < 1e-6 && after.pop[3] === 0);
  assert.equal(sungGlow(cues, 12, 16), null);
  assert(sungGlow(cues, 20.5, 16).glow.every((level) => level === 1));
});

test('the clock follows the recording bar by bar, and generated tracks keep their tempo', () => {
  const session = composeGenSession('pals', 42, null),
    timeline = createTimeline(session),
    marks = RECORD.bars;
  for (let bar = 0; bar <= 104; bar++)
    assert(Math.abs(timeline.secondsAt(bar * 16) - (marks[bar] - marks[0])) < 1e-9);
  const next = timeline.secondsAt(104 * 16);
  for (const steps of [1, 16, 160, 255])
    assert(Math.abs(timeline.secondsAt(104 * 16 + steps) - next - steps * session.s16) < 1e-9);
  let previous = -Infinity;
  for (let step = 0; step < 16 * 600; step += 3.5) {
    const seconds = timeline.secondsAt(step);
    assert(seconds > previous, 'time only moves forward');
    previous = seconds;
    assert(Math.abs(timeline.stepAt(seconds) - step) < 1e-6, `step ${step}`);
  }
  const plain = createTimeline(composeGenSession('rave', 42, null)),
    s16 = composeGenSession('rave', 42, null).s16;
  for (const step of [0, 5, 1000, 54321])
    assert(Math.abs(plain.secondsAt(step) - step * s16) < 1e-9);
});

test('the engine starts the song with its first bar, or joins it on a beat where the music is', async () => {
  const context = fakeContext(),
    starts = [],
    // A decoder that keeps 10 ms more of the encoder's lead-in than the measurements assume.
    lead = 0.01,
    buffer = {
      duration: 182.78,
      sampleRate: 2000,
      length: 365560,
      numberOfChannels: 1,
      getChannelData: () =>
        Float32Array.from({ length: 2000 }, (_, k) =>
          k >= (RECORD.onset + lead) * 2000 ? 0.5 : 0,
        ),
    },
    realFetch = globalThis.fetch;
  context.decodeAudioData = async () => buffer;
  const createBufferSource = context.createBufferSource;
  context.createBufferSource = () => {
    const node = createBufferSource();
    node.start = (when, offset) => starts.push({ node, when, offset });
    return node;
  };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  try {
    for (const late of [false, true]) {
      starts.length = 0;
      const audio = createAudioState();
      audio.trackId = TRACK_IDS.find((id) => TRACKS[id].style === 'pals');
      audio.context = context;
      audio.stemFlash = {};
      const record = context.createGain(),
        audioComposition = createAudioComposition({ audio });
      audio.session = audioComposition.composeSession(42);
      audio.graph = { song: { record, extras: [], layers: null } };
      const play = createAudioGen(
          {
            audio,
            audioComposition,
            audioInstruments: new Proxy({}, { get: () => () => {} }),
          },
          'pals',
        ).scheduleStep,
        time = (step) => 1 + audioComposition.secondsAt(step);
      if (!late) await play.prepare(0, 0);
      play(0, time(0));
      if (late) {
        assert.equal(starts.length, 0, 'not ready yet: nothing starts');
        await new Promise((resolve) => setTimeout(resolve));
        for (let step = 1; step < 8; step++) play(step, time(step));
        assert.equal(starts.length, 1, 'it joins on the next beat');
        const marks = RECORD.bars;
        assert(Math.abs(starts[0].when - time(4)) < 1e-9);
        assert(Math.abs(starts[0].offset - (marks[0] + (marks[1] - marks[0]) / 4 + lead)) < 1e-6);
      } else {
        assert.equal(starts.length, 1);
        // The first downbeat, in this decoder's timing, sounds on the clock's first step.
        const { when, offset } = starts[0];
        assert(Math.abs(when + RECORD.bars[0] + lead - offset - time(0)) < 1e-6);
        assert(when <= time(0) - RECORD.bars[0], 'with its lead-in');
      }
      for (let step = 8; step < 64; step++) play(step, time(step));
      assert.equal(starts.length, 1, 'it is started once');
      // Blipp's name is sung just before bar 8: its cue lands when the word is heard.
      for (let step = 64; step < 9 * 16; step++) play(step, time(step));
      const blipp = audio.palCues.filter((cue) => cue.tier === 0);
      assert.equal(blipp.length, 1);
      assert(Math.abs(blipp[0].t - (1 + 14.24 - RECORD.bars[0])) < 1e-6);
      const source = starts[0].node;
      assert(audio.graph.song.extras.includes(source), 'a new song stops it');
      assert(source.edges[0].edges.includes(record));
      source.onended();
      assert(!audio.graph.song.extras.includes(source));
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});
