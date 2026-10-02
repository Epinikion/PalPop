import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioFestival } from '../src/audio/festival.js';
import { composeFestivalPhrase } from '../src/audio/songs/festival-composition.js';
import { createFestival } from '../src/audio/instruments/festival.js';

function fixture(seed = 42) {
  const audio = createAudioState({ get: (key, fallback) => (key === 'musicTrack' ? 7 : fallback) });
  audio.seed = seed;
  const audioComposition = createAudioComposition({ audio });
  audio.session = audioComposition.composeSession(seed);
  return { audio, audioComposition };
}
test('festival song loads saved ID 7, renews deterministically and keeps a bounded musical clock', () => {
  for (const seed of [7, 42, 123456789]) {
    const { audio, audioComposition } = fixture(seed);
    assert.equal(audio.trackId, 7);
    assert.equal(audio.session.style, 'festival');
    assert(audio.session.bpm >= 126 && audio.session.bpm <= 128);
    assert.deepEqual(audio.session, audioComposition.composeSession(seed));
    const themes = new Set();
    for (let chapter = 0; chapter < 2000; chapter++) {
      const session = audioComposition.chapterFor(chapter);
      assert.equal(session.bpm, audio.session.bpm);
      assert.equal(session.pc, audio.session.pc);
      if (chapter) {
        assert.equal(session.form.at(-1)[0], 64);
        assert(session.form.every(([end], index, form) => !index || end > form[index - 1][0]));
      }
      themes.add(JSON.stringify(composeFestivalPhrase(session.seed, chapter * 8).motif));
    }
    assert(themes.size > 10);
    assert.equal(audio.chapters.size, 3);
  }
});
test('festival harmony holds two bars per chord and reaches the first drop within 16 seconds', () => {
  const { audio, audioComposition } = fixture();
  assert.equal(audioComposition.sectionAt(8).sec, 'PEAK');
  assert(audio.session.spb * 32 <= 16);
  for (let bar = 0; bar < 64; bar += 2) {
    const first = audioComposition.sectionAt(bar),
      second = audioComposition.sectionAt(bar + 1);
    assert.deepEqual(
      audioComposition.chordFor(bar, first.sec, 0),
      audioComposition.chordFor(bar + 1, second.sec, 0),
    );
  }
  assert(
    new Set(Array.from({ length: 4 }, (_, i) => audioComposition.chordFor(i * 2, 'PEAK', 0).deg))
      .size >= 3,
  );
});
test('festival hook develops A, variation, B, exact A reprise, with an empty eighth bar', () => {
  const phrases = Array.from({ length: 4 }, (_, index) => composeFestivalPhrase(42, index));
  assert.deepEqual(phrases[0].melody, phrases[3].melody);
  assert.notDeepEqual(phrases[0].melody, phrases[1].melody);
  assert.notDeepEqual(phrases[0].melody, phrases[2].melody);
  for (const phrase of phrases) {
    assert(phrase.melody.length <= 18);
    assert(
      phrase.melody.every(
        ([step, degree, gate]) => step < 112 && degree >= 0 && degree <= 7 && gate >= 2,
      ),
    );
    assert.deepEqual(phrase.motif, phrases[0].motif);
  }
});
test('festival chapter themes have distinct contours and rhythms while each drop retains its motif', () => {
  const themes = Array.from({ length: 1000 }, (_, seed) => composeFestivalPhrase(seed, 0));
  assert(new Set(themes.map((theme) => JSON.stringify(theme.motif))).size > 100);
  assert.equal(new Set(themes.map((theme) => JSON.stringify(theme.rhythm))).size, 4);
  const { audio, audioComposition } = fixture(),
    events = [];
  const arrangement = createAudioFestival({
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
  });
  const root = 60 + audio.session.pc - (audio.session.pc > 7 ? 12 : 0);
  for (const [bar, phraseIndex] of [
    [8, 0],
    [16, 1],
    [44, 2],
    [52, 3],
  ]) {
    events.length = 0;
    for (let step = 0; step < 128; step++)
      arrangement.scheduleFestivalStep(bar * 16 + step, (bar * 16 + step) * audio.session.s16);
    const actual = events.filter(({ name }) => name === 'eFestivalLead').map(({ args }) => args[1]);
    const expected = composeFestivalPhrase(42, phraseIndex).melody.map(
      ([, degree]) => root + audio.session.mode.s[degree % 7] + 12 * Math.floor(degree / 7),
    );
    assert.deepEqual(actual, expected);
  }
});
test('festival keeps its hook out of breaks and builds, leaves a beat before drops, and bounds phrase memory', () => {
  const { audio, audioComposition } = fixture(),
    events = [];
  const arrangement = createAudioFestival({
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
  });
  for (let bar = 0; bar < 64; bar++) {
    events.length = 0;
    for (let step = 0; step < 16; step++)
      arrangement.scheduleFestivalStep(bar * 16 + step, (bar * 16 + step) * audio.session.s16);
    const section = audioComposition.sectionAt(bar);
    if (!['PEAK', 'FINAL'].includes(section.sec))
      assert(!events.some(({ name }) => name === 'eFestivalLead'));
    if (section.sec === 'BUILD' && section.bs === section.len - 1)
      assert(events.every(({ args }) => args[0] < (bar * 16 + 12) * audio.session.s16));
    for (const event of events.filter(({ name }) => name === 'eFestivalLead'))
      assert(event.args[1] >= 57 && event.args[1] <= 79);
  }
  for (let phrase = 0; phrase < 10000; phrase++)
    arrangement.scheduleFestivalStep(phrase * 128, phrase * 128 * audio.session.s16);
  assert.equal(arrangement.getPhraseCacheSize(), 4);
  assert.equal(audio.chapters.size, 3);
});
test('festival piano and saw voices clean all sources after the longest strummed note', () => {
  const oscillators = [],
    cleanups = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({
    frequency: param(),
    gain: param(),
    pan: param(),
    Q: param(),
    detune: param(),
    connect() {},
    start(t) {
      this.startTime = t;
    },
    stop(t) {
      this.end = t;
    },
  });
  const audio = {
    context: {
      createOscillator() {
        const oscillator = node();
        oscillators.push(oscillator);
        return oscillator;
      },
      createGain: node,
      createBiquadFilter: node,
      createStereoPanner: node,
    },
    graph: { song: { mel: {} } },
    stemFlash: {},
  };
  const instruments = createFestival({
    audio,
    audioMath: { midi: (n) => 440 * 2 ** ((n - 69) / 12) },
    audioGraph: { feed() {}, nsrc: node, releaseVoice: (...nodes) => cleanups.push(nodes) },
  });
  instruments.eFestivalPiano(10, [55, 60, 64], 0.4, 0.3);
  instruments.eFestivalLead(12, 72, 0.3, 0.2);
  assert.equal(cleanups.length, 2);
  for (const [source, , extra] of cleanups) {
    assert(Number.isFinite(source.end));
    assert(extra.filter((node) => node.end).every((node) => node.end <= source.end));
  }
  assert(oscillators.slice(0, 12).every((node) => node.type === 'sine'));
  assert(oscillators.slice(12).every((node) => node.type === 'sawtooth'));
});
