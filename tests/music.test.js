import test from 'node:test';
import { createAudioMath } from '../src/audio/math.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAudioState } from '../src/audio/state.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { SONG_STYLES, createArrangements } from '../src/audio/song-registry.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
import { composeDancePhrase } from '../src/audio/songs/dance-composition.js';
import { createAudioDance } from '../src/audio/dance.js';
import { createDance } from '../src/audio/instruments/dance.js';
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/music.json', import.meta.url)));
for (const [style, id] of [
  ['dance', 5],
  ['techno', 6],
])
  for (const seed of [42, 123456789])
    test(`${style}, seed ${seed}: deterministic composition and continuing chapter renewal`, () => {
      const audio = createAudioState();
      audio.trackId = id;
      audio.seed = seed;
      const composer = createAudioComposition({ audio });
      audio.session = composer.composeSession(seed);
      const result = {
        session: audio.session,
        chapters: Array.from({ length: 24 }, (_, i) => composer.chapterFor(i)),
        sections: Array.from({ length: 64 }, (_, i) => composer.sectionAt(i)),
        chords: Array.from({ length: 64 }, (_, i) => {
          const section = composer.sectionAt(i);
          return composer.chordFor(i, section.sec, section.cyc);
        }),
      };
      if (style === 'techno') assert.deepEqual(result, baseline[style + '-' + seed]);
      else {
        assert.deepEqual(composer.composeSession(seed), audio.session);
        assert(['MINOR', 'DORIAN'].includes(audio.session.mname));
        assert(!('hook' in audio.session));
        assert(audio.session.bpm >= 128 && audio.session.bpm <= 132);
        assert(new Set(result.chapters.map((chapter) => JSON.stringify(chapter.progs))).size > 20);
      }
      assert.equal(audio.chapters.size, 3);
      for (let chapter = 24; chapter < 2000; chapter++) {
        const generated = composer.chapterFor(chapter);
        assert.equal(generated.bpm, audio.session.bpm);
        assert.equal(generated.pc, audio.session.pc);
        if (style === 'dance') assert(!('hook' in generated));
      }
      assert.equal(audio.chapters.size, 3);
    });
test('every catalog song has a complete registered style', () => {
  assert.deepEqual(TRACK_IDS, [5, 6, 7, 8]);
  const ids = new Set();
  for (const id of TRACK_IDS) {
    const song = TRACKS[id];
    assert(song.name && song.description && song.label);
    assert(!ids.has(song.buttonId));
    ids.add(song.buttonId);
    const style = SONG_STYLES[song.style];
    assert.equal(typeof style.compose, 'function');
    assert.equal(typeof style.renewChapter, 'function');
    assert.equal(typeof style.createArrangement, 'function');
  }
});
test('all arrangements schedule 24 chapters with finite musical events', () => {
  for (const id of TRACK_IDS) {
    const style = TRACKS[id].style;
    const audio = createAudioState();
    audio.trackId = id;
    audio.seed = 42;
    const audioComposition = createAudioComposition({ audio });
    audio.session = audioComposition.composeSession(audio.seed);
    const events = [];
    const param = {
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      setTargetAtTime() {},
      cancelScheduledValues() {},
    };
    audio.graph = {
      song: {
        duck: { gain: param },
        melLP: { frequency: param },
        acidSh: { gain: param },
        rum: { gain: param },
      },
    };
    const audioInstruments = new Proxy(
      {},
      {
        get:
          (_, name) =>
          (...args) =>
            events.push({ name, args }),
      },
    );
    const arrangements = createArrangements({
      audio,
      game: { phase: 'play', goldTime: 0, comboCount: 0 },
      audioComposition,
      audioInstruments,
      audioMath: createAudioMath(audio),
    });
    for (let bar = 0; bar < 1536; bar++)
      for (let step = 0; step < 16; step++)
        arrangements[style](bar * 16 + step, (bar * 16 + step) * audio.session.s16);
    assert(events.length > 10000);
    assert.equal(audio.chapters.size, 3);
    if (style === 'dance')
      assert(!events.some((event) => ['eAcid', 'eZap', 'eRide', 'eTom'].includes(event.name)));
    for (const event of events)
      for (const argument of event.args)
        if (typeof argument === 'number') assert(Number.isFinite(argument));
  }
});
test('merge feedback is immediate while musical rewards coalesce and retry preserves the clock', () => {
  const audio = createAudioState();
  audio.session = { style: 'dance', spb: 60 / 124 };
  audio.context = { state: 'running', currentTime: 10 };
  audio.graph = { song: {} };
  audio.playing = { live: true };
  audio.songStart = 7;
  let accents = 0;
  const reactions = createAudioReactions({
    audio,
    game: { phase: 'play' },
    audioComposition: {
      sectionAt: () => ({ sec: 'GROOVE', cyc: 0 }),
      chordFor: () => ({ notes: [60, 64, 67, 71] }),
    },
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
  assert.equal(audio.session.style, 'dance');
  assert(audio.playing);
});

test('electro phrases change melody, bass, rhythms and timbre every eight bars', () => {
  const phrases = Array.from({ length: 256 }, (_, index) => composeDancePhrase(42, index));
  assert.deepEqual(composeDancePhrase(42, 0), phrases[0]);
  for (const property of ['melody', 'bass', 'hatMask', 'chords']) {
    const distinct = new Set(phrases.map((phrase) => JSON.stringify(phrase[property])));
    assert(distinct.size > (property === 'chords' ? 2 : 30), property + ' repeats too much');
  }
  assert(new Set(phrases.map((phrase) => phrase.leadColor)).size === 64);
  for (const phrase of phrases) {
    assert(phrase.melody.length < 30);
    assert(
      phrase.melody.every(([step]) => Math.floor(step / 16) !== 3 && Math.floor(step / 16) !== 7),
    );
  }
});

test('electro arrangement bounds phrase memory during long sessions', () => {
  const audio = createAudioState();
  audio.seed = 42;
  audio.trackId = 5;
  const audioComposition = createAudioComposition({ audio });
  audio.session = audioComposition.composeSession(42);
  const instruments = new Proxy({}, { get: () => () => {} });
  const arrangement = createAudioDance({ audio, audioComposition, audioInstruments: instruments });
  for (let phrase = 0; phrase < 10000; phrase++)
    arrangement.scheduleDanceStep(phrase * 128, phrase * 128 * audio.session.s16);
  assert.equal(arrangement.getPhraseCacheSize(), 4);
  assert.equal(audio.chapters.size, 3);
});

test('electro lead uses short detuned saw/pulse voices instead of a flute-like triangle', () => {
  const oscillators = [],
    cleanup = [];
  const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const node = () => ({
    gain: { ...param },
    frequency: { ...param },
    Q: { ...param },
    pan: { ...param },
    detune: { ...param },
    connect() {},
    start() {},
    stop(time) {
      this.end = time;
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
  const instrument = createDance({
    audio,
    audioMath: { midi: (n) => 440 * 2 ** ((n - 69) / 12) },
    audioGraph: { feed() {}, releaseVoice: (...nodes) => cleanup.push(nodes) },
  });
  instrument.eDanceLead(10, 60, 0.15, 0.16, 0.2, 0);
  assert.deepEqual(
    oscillators.map((oscillator) => oscillator.type),
    ['sawtooth', 'square', 'sawtooth'],
  );
  assert(oscillators.every((oscillator) => oscillator.end < 10.4));
  assert.equal(cleanup.length, 1);
  assert(oscillators.slice(1).every((oscillator) => cleanup[0][2].includes(oscillator)));
});

test('electro develops a theme over four phrases and renews the next theme', () => {
  const phrases = Array.from({ length: 12 }, (_, index) => composeDancePhrase(42, index));
  for (let theme = 0; theme < 3; theme++) {
    const block = phrases.slice(theme * 4, theme * 4 + 4);
    assert(
      block.every((phrase) => JSON.stringify(phrase.motif) === JSON.stringify(block[0].motif)),
    );
    assert(block.every((phrase) => phrase.leadActive || phrase.chordActive));
    assert.equal(new Set(block.map((phrase) => JSON.stringify(phrase.melody))).size, 4);
  }
  assert.notDeepEqual(phrases[0].motif, phrases[4].motif);
});
