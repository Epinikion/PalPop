import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { SONG_STYLES, createArrangements } from '../src/audio/song-registry.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
import { composeGenSession, createTimeline } from '../src/audio/gen/timeline.js';
import { PROFILES, PROFILE_IDS } from '../src/audio/gen/profiles.js';
import { SCALES } from '../src/audio/gen/scales.js';

const SEEDS = [42, 7, 123456789];
const timelineOf = (id, seed) => createTimeline(composeGenSession(id, seed, null));
const plans = (timeline, from, to) =>
  Array.from({ length: to - from }, (_, i) => timeline.plan(from + i));

test('every catalog song is a generated style with a complete registration', () => {
  assert.deepEqual(TRACK_IDS, [1, 2, 3, 4]);
  assert.deepEqual(
    TRACK_IDS.map((id) => TRACKS[id].style),
    PROFILE_IDS.length === 4 ? ['euphoria', 'rave', 'melodic', 'anthem'] : [],
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
    const [low, high] = PROFILES[song.style].bpm;
    assert(song.bpm >= low && song.bpm <= high, `${song.name}: the listed tempo is in range`);
  }
});

for (const id of PROFILE_IDS)
  for (const seed of SEEDS)
    test(`${id}, seed ${seed}: the song is a pure function of its seed, whatever order it is asked in`, () => {
      const session = composeGenSession(id, seed, null),
        profile = PROFILES[id];
      assert.deepEqual(composeGenSession(id, seed, null), session);
      assert(session.bpm >= profile.bpm[0] && session.bpm <= profile.bpm[1]);
      assert(profile.keys.includes(session.pc));
      assert(profile.scales.some(([name]) => name === session.scale));
      const forward = createTimeline(session),
        backward = createTimeline(session),
        bars = [0, 1, 2, 3, 15, 16, 47, 63, 64, 65, 130, 255, 300];
      const first = bars.map((bar) => JSON.stringify(forward.plan(bar)));
      // Asking far ahead first, and then in reverse, must change nothing.
      backward.plan(900);
      const second = [...bars].reverse().map((bar) => JSON.stringify(backward.plan(bar)));
      assert.deepEqual(first, second.reverse());
      const other = timelineOf(id, seed + 1);
      assert.notEqual(
        JSON.stringify(plans(other, 0, 200)),
        JSON.stringify(plans(forward, 0, 200)),
        'another seed is another song',
      );
    });

for (const id of PROFILE_IDS)
  for (const seed of SEEDS)
    test(`${id}, seed ${seed}: sixteen-bar stretches never come back, over 512 bars`, () => {
      const timeline = timelineOf(id, seed),
        all = plans(timeline, 0, 512),
        content = (list) =>
          JSON.stringify(
            list.map((p) => [p.kick, p.bass, p.arp, p.stab, p.lead, p.chord.notes, p.hat, p.perc]),
          ),
        seen = new Set();
      for (let bar = 0; bar + 16 <= 512; bar += 4) {
        const stretch = content(all.slice(bar, bar + 16));
        assert(!seen.has(stretch), `${id}: bar ${bar} repeats an earlier stretch`);
        seen.add(stretch);
      }
      // The harmony keeps moving too: many different chords and several progressions.
      const chords = new Set(all.map((p) => p.chord.notes.join()));
      assert(chords.size >= 20, `${chords.size} distinct chords`);
      const loops = new Set();
      for (let p = 0; p < 512 / PROFILES[id].phraseBars; p++)
        loops.add(
          all
            .slice(p * PROFILES[id].phraseBars, (p + 1) * PROFILES[id].phraseBars)
            .map((plan) => plan.chord.deg)
            .join(),
        );
      assert(loops.size >= 5, `${loops.size} distinct progressions`);
    });

for (const id of PROFILE_IDS)
  test(`${id}: layers evolve, so a groove is never quite the same two phrases running`, () => {
    const timeline = timelineOf(id, 42),
      barsPer = PROFILES[id].phraseBars;
    let changed = 0,
      compared = 0;
    for (let phrase = 8; phrase < 120; phrase++) {
      const a = timeline.plan(phrase * barsPer),
        b = timeline.plan((phrase + 1) * barsPer);
      if (a.sec !== b.sec || !a.bass.length) continue;
      compared++;
      const cell = (p) => JSON.stringify([p.bass.map((n) => [n.si, n.note]), p.hat, p.perc]);
      if (cell(a) !== cell(b)) changed++;
    }
    assert(compared > 20);
    assert(changed / compared > 0.8, `${changed} of ${compared} phrases changed`);
  });

for (const id of PROFILE_IDS)
  test(`${id}: the form is a valid, endless chain of sections`, () => {
    const profile = PROFILES[id],
      timeline = timelineOf(id, 42),
      segments = [];
    for (let bar = 0; bar < 1500; bar++) {
      const section = timeline.sectionAt(bar);
      if (!segments.length || segments.at(-1).cyc !== section.cyc) {
        if (segments.length) assert.equal(segments.at(-1).seen, segments.at(-1).len);
        segments.push({ ...section, seen: 0 });
      }
      const current = segments.at(-1);
      assert.equal(section.bs, current.seen, 'bars count up through a section');
      current.seen++;
      assert(Object.hasOwn(profile.form, section.sec));
    }
    assert.equal(segments[0].sec, 'INTRO');
    assert(segments.length > 30);
    for (let i = 0; i < segments.length - 1; i++) {
      const { sec, len } = segments[i];
      assert(profile.form[sec].len.includes(len), `${sec} of ${len} bars`);
      assert(i === 0 || profile.form[segments[i - 1].sec].next.some(([next]) => next === sec));
      if (sec === 'BUILD') assert.equal(segments[i + 1].sec, 'DROP', 'every build lands in a drop');
      if (i >= 2)
        assert(
          !(segments[i - 2].sec === sec && segments[i - 1].sec === sec),
          'no section three times running',
        );
    }
    const kinds = new Set(segments.map((s) => s.sec));
    assert(['GROOVE', 'BUILD', 'DROP', 'BREAK'].every((kind) => kinds.has(kind)));
  });

for (const id of PROFILE_IDS)
  for (const seed of SEEDS)
    test(`${id}, seed ${seed}: every note is in the key, in range and finite`, () => {
      const session = composeGenSession(id, seed, null),
        timeline = createTimeline(session),
        spec = PROFILES[id].layers,
        inKey = new Set(SCALES[session.scale].map((step) => (session.pc + step) % 12)),
        lowest = (list) => Math.min(...list);
      for (const plan of plans(timeline, 0, 400)) {
        for (const note of plan.chord.notes)
          assert(
            inKey.has(note % 12),
            `chord note ${note} is in ${session.kname} ${session.scale}`,
          );
        for (const hit of plan.bass) {
          assert(hit.note >= spec.bass.range[0] && hit.note <= spec.bass.range[1]);
          assert(hit.si >= 0 && hit.si < 16 && hit.vel > 0 && hit.vel <= 1);
        }
        for (const name of ['arp', 'lead'])
          for (const hit of plan[name]) {
            assert(inKey.has(hit.note % 12), `${name} note ${hit.note} is in the key`);
            assert(hit.note >= spec[name].range[0] && hit.note <= spec[name].range[1]);
            assert(hit.si >= 0 && hit.si < 16 && Number.isFinite(hit.len) && hit.len > 0);
          }
        for (const hit of plan.stab) assert(lowest(hit.notes) >= 40 && hit.si < 16);
        for (const row of [plan.kick, plan.hat, plan.open, plan.clap, plan.snare]) {
          assert.equal(row.length, 16);
          assert(row.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
        }
      }
    });

test('a long session keeps its memory bounded and any bar can be asked for at once', () => {
  for (const id of PROFILE_IDS) {
    const timeline = timelineOf(id, 42);
    let biggest = 0;
    for (let bar = 0; bar < 6000; bar++) {
      timeline.plan(bar);
      biggest = Math.max(biggest, timeline.size());
    }
    assert(biggest < 200, `${id}: ${biggest} remembered items`);
    const jumped = timeline.plan(40000);
    assert.equal(jumped.bar, 40000);
    assert(timeline.size() < 200);
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
    for (let bar = 0; bar < 1024; bar++)
      for (let step = 0; step < 16; step++) {
        const time = (bar * 16 + step) * audio.session.s16;
        events.length = 0;
        arrangements[style](bar * 16 + step, time);
        for (const event of events) {
          names.add(event.name);
          for (const argument of event.args)
            if (typeof argument === 'number') assert(Number.isFinite(argument));
          if (event.name === 'kickTuning') continue;
          // Nothing is scheduled before its step (bar a few milliseconds of humanising) or a bar after it.
          assert(
            event.args[0] >= time - 0.01 && event.args[0] < time + audio.session.spb * 4,
            `${TRACKS[id].name}: ${event.name} at ${event.args[0]} for the step at ${time}`,
          );
        }
      }
    for (const voice of ['eKick', 'eRoll', 'eHat', 'eClap', 'eRave', 'ePad'])
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
