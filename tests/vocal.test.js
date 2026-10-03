import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioVocal } from '../src/audio/vocal.js';
import { TRACKS, TRACK_IDS, VOCAL } from '../src/audio/catalog.js';
import {
  composeVocalPhrase,
  composeVocalSession,
  VOCAL_FORMS,
} from '../src/audio/songs/vocal-composition.js';
import { createVocal, FORMANTS, SYLLABLES } from '../src/audio/instruments/vocal.js';
import { fakeContext, reaches } from './helpers/fake-audio.js';
import { arrangement } from './helpers/arrangement.js';

const SEEDS = [1, 7, 42, 99, 2024, 31337, 123456789];
const KINDS = ['intro', 'verse', 'pre', 'chorus', 'bridge', 'outro'];

test('the vocal song is registered with its own bus and a stable id', () => {
  assert.equal(VOCAL, 8);
  assert(TRACKS[VOCAL].vocals && TRACKS[VOCAL].style === 'vocal');
  assert(TRACK_IDS.includes(VOCAL));
});

test('vocal sessions are deterministic, hold key and tempo, and renew harmony every chapter', () => {
  for (const seed of SEEDS) {
    const audio = createAudioState();
    audio.trackId = VOCAL;
    audio.seed = seed;
    const composer = createAudioComposition({ audio });
    audio.session = composer.composeSession(seed);
    assert.deepEqual(audio.session, composeVocalSession(seed));
    assert(audio.session.bpm >= 120 && audio.session.bpm <= 124);
    assert.equal(audio.session.voicing, 'triad');
    const loops = new Set();
    for (let chapter = 0; chapter < 2000; chapter++) {
      const session = composer.chapterFor(chapter);
      assert.equal(session.bpm, audio.session.bpm);
      assert.equal(session.pc, audio.session.pc);
      assert.equal(session.mname, audio.session.mname);
      for (const bank of Object.values(session.progs))
        assert(bank[0].length === 4 && bank[0].every((d) => d >= 0 && d < 7));
      loops.add(JSON.stringify(session.progs));
      if (chapter) {
        const { form } = session;
        assert.equal(form.at(-1)[0], 64);
        assert(form.every(([end], i) => end % 4 === 0 && (!i || end > form[i - 1][0])));
      }
    }
    assert(loops.size > 5);
    assert.equal(audio.chapters.size, 3);
  }
  for (const form of VOCAL_FORMS) assert(form.every(([end]) => end % 4 === 0));
});

test('every vocal part is singable: in range, stepwise, breathing, on chord tones', () => {
  for (const seed of SEEDS)
    for (const mode of ['MINOR', 'MAJOR']) {
      let session = composeVocalSession(seed);
      // Find a session of each mode by renewing from this one's key and tempo.
      for (let s = seed; session.mname !== mode; s++)
        session = composeVocalSession(s + 1, { ...session, mode: undefined });
      for (const kind of KINDS)
        for (const occurrence of [0, 1]) {
          const phrase = composeVocalPhrase(session, kind, occurrence),
            sung = phrase.notes.reduce((sum, note) => sum + note.len, 0),
            bank = session.progs[session.banks[kind.toUpperCase().replace('BRIDGE', 'BREAK')]][0];
          assert.deepEqual(phrase, composeVocalPhrase(session, kind, occurrence));
          phrase.notes.forEach((note, index) => {
            const previous = phrase.notes[index - 1];
            assert(note.midi >= 55 && note.midi <= 77, `${kind}: ${note.midi} out of range`);
            assert(note.len >= 2 && note.step >= 0 && note.step + note.len <= phrase.bars * 16 + 1);
            assert(SYLLABLES[note.syllable]);
            if (previous) {
              assert(note.step >= previous.step + previous.len, `${kind}: notes overlap`);
              assert(Math.abs(note.midi - previous.midi) <= 8, `${kind}: leap too wide`);
            }
          });
          // Notes that are held on a strong beat belong to the chord of their bar.
          const lifted = kind === 'chorus' && occurrence > 0;
          phrase.notes.forEach((note, index) => {
            if (note.step % 8 || (lifted && index === phrase.notes.length - 1)) return;
            const chord = bank[Math.floor((note.step % 64) / 16) % 4];
            if (kind === 'intro' || kind === 'outro') return;
            assert(
              [0, 2, 4].some((third) => (chord + third - note.degree) % 7 === 0),
              `${kind} seed ${seed}: degree ${note.degree} clashes with chord ${chord}`,
            );
          });
          const total = { intro: 2, verse: 8, pre: 4, chorus: 8, bridge: 8, outro: 3 }[kind] * 16;
          assert(sung / total <= ({ verse: 0.5, chorus: 0.8, pre: 0.9 }[kind] ?? 0.9));
        }
    }
});

test('the chorus hook returns in both phrases and in every chorus, and is sung the same way', () => {
  for (const seed of SEEDS) {
    const session = composeVocalSession(seed),
      first = composeVocalPhrase(session, 'chorus', 0),
      final = composeVocalPhrase(session, 'chorus', 1),
      pick = (phrase, from, to) =>
        phrase.notes
          .filter(({ step }) => step >= from && step < to)
          .map(({ step, len, midi, syllable }) => [step % 64, len, midi, syllable]);
    assert.deepEqual(pick(first, 0, 48), pick(first, 64, 112));
    assert.notDeepEqual(pick(first, 48, 64), pick(first, 112, 128));
    // The final chorus keeps the hook and only lifts its closing note.
    assert.deepEqual(first.notes.slice(0, -1), final.notes.slice(0, -1));
    assert(final.notes.at(-1).midi >= first.notes.at(-1).midi);
    // The intro teases the same hook it later sings in full.
    const hook = pick(first, 32, 64).map(([step, ...rest]) => [step - 32, ...rest]),
      tease = composeVocalPhrase(session, 'intro').notes.map(({ step, len, midi }) => [
        step,
        len,
        midi,
      ]);
    assert.deepEqual(
      hook.map(([step, len, midi]) => [step, len, midi]),
      tease,
    );
  }
});

test('verses breathe: whole bars stay empty and lines never run on', () => {
  for (const seed of SEEDS) {
    const session = composeVocalSession(seed),
      verse = composeVocalPhrase(session, 'verse'),
      bars = new Set(verse.notes.map(({ step }) => Math.floor(step / 16)));
    assert(bars.size <= 5, 'at most five of eight verse bars are sung');
    const gaps = verse.notes
      .slice(1)
      .map((note, i) => note.step - (verse.notes[i].step + verse.notes[i].len));
    assert(
      gaps.some((gap) => gap >= 16),
      'there is a full bar of rest',
    );
  }
});

function voiceFixture() {
  const context = fakeContext(),
    cleanups = [],
    audio = { context, graph: { song: { vox: context.createGain() } }, stemFlash: {} },
    { eVoice } = createVocal({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: {
        feed() {},
        nsrc: () => context.createBufferSource(),
        releaseVoice: (...args) => cleanups.push(args),
      },
    });
  return { context, cleanups, audio, eVoice };
}
const formantNodes = (context) => context.nodes.filter((node) => node.type === 'bandpass');

test('a sung note puts the vowel formants where the vowel table says', () => {
  for (const [type, vowel, syllable, note] of [
    ['alto', 'a', 'ah', 57],
    ['alto', 'o', 'oh', 60],
    ['tenor', 'a', 'ah', 52],
    ['tenor', 'u', 'oo', 50],
  ]) {
    const { context, eVoice } = voiceFixture();
    eVoice(1, note, 1, 0.5, { syllable, type });
    const filters = formantNodes(context);
    assert.equal(filters.length, 4);
    const expected = FORMANTS[type][vowel];
    filters.forEach((filter, index) => {
      const [hz, , bandwidth] = expected[index],
        set = filter.frequency.calls.find(([kind]) => kind === 'set');
      // Only the first two may move: F1 follows a pitch that has climbed above it.
      if (index > 1 || 440 * 2 ** ((note - 69) / 12) < hz * 0.8) assert.equal(set[1], hz);
      assert(Math.abs(filter.Q.value - hz / bandwidth) < 1e-9 || index < 2);
    });
  }
  // A high note above the first formant drags F1 up with it, as singers open their mouths.
  const { context, eVoice } = voiceFixture();
  eVoice(1, 76, 1, 0.5, { syllable: 'oo', type: 'alto' });
  const [first, second] = formantNodes(context);
  assert(first.frequency.calls[0][1] >= 440 * 2 ** ((76 - 69) / 12));
  assert(second.frequency.calls[0][1] >= first.frequency.calls[0][1] * 1.35);
});

test('vibrato arrives late and gently, the onset is soft, and the pitch can glide and scoop', () => {
  const { context, eVoice } = voiceFixture();
  eVoice(2, 64, 1.6, 0.5, { syllable: 'ah', scoop: 0.6 });
  const oscillators = context.nodes.filter((node) => node.kind === 'oscillator'),
    sources = oscillators.filter((node) => node.wave),
    [wobble] = oscillators.filter((node) => !node.wave);
  assert.equal(sources.length, 2);
  assert(wobble.frequency.value >= 4.8 && wobble.frequency.value <= 6.2);
  const depth = context.nodes.find((node) => node.edges.includes(sources[0].detune) && node.gain);
  const [start, hold, ramp] = depth.gain.calls;
  assert(start[1] === 0 && hold[1] === 0 && hold[2] - 2 >= 0.15, 'no vibrato at the start');
  assert(ramp[1] > 10 && ramp[1] <= 30, 'about 20-30 cents, never a wobble');
  assert(ramp[2] - hold[2] >= 0.3, 'the vibrato fades in');
  assert(sources.every((node) => depth.edges.includes(node.detune)));
  // The scoop starts below the note and arrives at its pitch.
  const [from, to] = sources[0].frequency.calls;
  assert(from[1] < 440 * 2 ** ((64 - 69) / 12) && to[0] === 'exp');
  const amp = context.nodes
    .filter((node) => node.kind === 'gain')
    .find((node) => node.gain.calls[1]?.[0] === 'exp' && node.gain.calls[0][1] < 0.001);
  assert(amp.gain.calls[1][2] - 2 >= 0.04, 'at least a 40 ms attack');
});

test('the level scaling stays in a sane range and follows the requested level', () => {
  const gain = (syllable, type, note, level) => {
    const { context, eVoice } = voiceFixture();
    eVoice(1, note, 1.5, level, { syllable, type });
    return context.nodes
      .filter((node) => node.kind === 'gain')
      .find(
        (node) =>
          node.gain.calls[1]?.[0] === 'exp' &&
          node.gain.calls[0][1] < 0.001 &&
          node.gain.calls.length > 3,
      ).gain.calls[1][1];
  };
  for (const [syllable, type, note] of [
    ['ah', 'alto', 69],
    ['ah', 'alto', 60],
    ['oh', 'alto', 66],
    ['oo', 'alto', 64],
    ['mm', 'alto', 62],
    ['na', 'alto', 67],
    ['la', 'alto', 65],
    ['ah', 'tenor', 55],
  ]) {
    const quiet = gain(syllable, type, note, 0.25),
      loud = gain(syllable, type, note, 0.5);
    assert(quiet > 0.005 && loud < 2, `${syllable} ${note}: ${quiet}, ${loud}`);
    assert(Math.abs(loud / quiet - 2) < 1e-9, 'level is linear');
  }
});

test('a voice is cleaned up as one unit, backing voices are cheaper and feed the vocal bus', () => {
  const { context, cleanups, audio, eVoice } = voiceFixture();
  eVoice(1, 62, 1, 0.5, { syllable: 'ah' });
  const leadNodes = context.nodes.length;
  eVoice(4, 62, 1, 0.5, { syllable: 'ah', backing: true });
  assert(context.nodes.length - leadNodes < leadNodes, 'a backing voice uses fewer nodes');
  assert.equal(cleanups.length, 2);
  for (const [source, outlet, extra] of cleanups) {
    assert(Number.isFinite(source.endTime));
    assert(
      extra.filter((node) => node.endTime).every((node) => node.endTime <= source.endTime + 1e-9),
    );
    assert(reaches(outlet, audio.graph.song.vox));
  }
  assert.equal(formantNodes(context).length, 7, 'four lead formants plus three backing');
});

test('vocals wait for the intro, vanish in danger, and the last beat before a chorus is silent', () => {
  const { audio, comp, bar } = arrangement('vocal');
  const sung = (events) => events.filter(({ name }) => name === 'eVoice');
  assert(!sung(bar(0)).length && !sung(bar(1)).length, 'the first two bars are instrumental');
  assert(sung(bar(2)).length > 0, 'a hum of the hook enters in bar three');
  for (let index = 1; index < 64; index++) {
    const section = comp.sectionAt(index);
    if (section.sec !== 'CHORUS' || section.bs !== 0 || comp.sectionAt(index - 1).sec !== 'PRE')
      continue;
    const gap = bar(index - 1);
    assert(gap.every(({ args }) => args[0] < ((index - 1) * 16 + 12) * audio.session.s16));
    const hit = bar(index).filter(({ args }) => args[0] <= index * 16 * audio.session.s16 + 0.03);
    for (const voice of ['eKick', 'eCrash', 'eImpact'])
      assert(hit.some(({ name }) => name === voice));
  }
  audio.dangerActive = true;
  for (let index = 0; index < 64; index++) assert(!sung(bar(index)).length, `bar ${index}`);
});

test('the lead sings the composed chorus, quietly enough to stay natural', () => {
  const { audio, comp, bar } = arrangement('vocal');
  let chorusBar = 0;
  while (comp.sectionAt(chorusBar).sec !== 'CHORUS') chorusBar++;
  const phrase = composeVocalPhrase(audio.session, 'chorus', 0),
    events = bar(chorusBar).filter(({ name }) => name === 'eVoice'),
    lead = events.filter(({ args }) => !args[4].backing),
    expected = phrase.notes.filter(({ step }) => Math.floor(step / 16) === 0);
  assert.deepEqual(
    lead.map(({ args }) => args[1]),
    expected.map(({ midi }) => midi),
  );
  for (let index = 0; index < 64; index++)
    for (const { args } of bar(index).filter(({ name }) => name === 'eVoice')) {
      assert(args[3] > 0 && args[3] <= 0.6, 'no shouting');
      if (args[4].backing) assert(args[3] <= 0.4, 'backing vocals stay behind the lead');
      assert(Number.isFinite(args[0]) && Number.isFinite(args[1]) && args[2] >= 0.14);
    }
});

test('the vocal arrangement keeps its phrase memory bounded across 24 chapters', () => {
  const audio = createAudioState();
  audio.trackId = VOCAL;
  audio.seed = 42;
  const audioComposition = createAudioComposition({ audio });
  audio.session = audioComposition.composeSession(42);
  const events = [],
    instruments = new Proxy(
      {},
      {
        get:
          () =>
          (...args) =>
            events.push(args),
      },
    ),
    arrangement = createAudioVocal({ audio, audioComposition, audioInstruments: instruments });
  for (let step = 0; step < 1536 * 16; step += 3)
    arrangement.scheduleVocalStep(step, step * audio.session.s16);
  assert(arrangement.getPhraseCacheSize() <= 6);
  assert.equal(audio.chapters.size, 3);
  assert(events.length > 10000);
});
