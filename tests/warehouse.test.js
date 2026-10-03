import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioWarehouse } from '../src/audio/warehouse.js';
import { TRACKS, TRACK_IDS, WAREHOUSE } from '../src/audio/catalog.js';
import {
  composeWarehouseSession,
  WAREHOUSE_FORMS,
} from '../src/audio/songs/warehouse-composition.js';
import { KICK_HZ, renderKit } from '../src/audio/instruments/kit-dsp.js';
import { createKit } from '../src/audio/instruments/kit.js';
import { createWarehouse } from '../src/audio/instruments/warehouse.js';
import { fft } from '../tools/analyze-wav.mjs';
import { fakeContext, reaches } from './helpers/fake-audio.js';
import { arrangement } from './helpers/arrangement.js';

const SAMPLE_RATE = 44100;
const kit = renderKit(SAMPLE_RATE);

/** Magnitude spectrum of the first `size` samples of a drum hit. */
function spectrum(samples, size = 8192) {
  const re = new Float64Array(size),
    im = new Float64Array(size);
  for (let i = 0; i < size; i++)
    re[i] = (samples[i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
  fft(re, im);
  return Float64Array.from({ length: size / 2 }, (_, k) => Math.hypot(re[k], im[k]));
}
const hzOf = (bin, size = 8192) => (bin * SAMPLE_RATE) / size;
const centroid = (samples) => {
  const bins = spectrum(samples);
  let total = 0,
    weighted = 0;
  bins.forEach((magnitude, k) => {
    total += magnitude ** 2;
    weighted += magnitude ** 2 * hzOf(k);
  });
  return weighted / total;
};
/** Seconds until the 5 ms RMS envelope last exceeds `db` below its peak. */
function fadeTime(samples, db) {
  const window = Math.floor(SAMPLE_RATE * 0.005),
    envelope = [];
  for (let i = 0; i + window < samples.length; i += window) {
    let sum = 0;
    for (let k = 0; k < window; k++) sum += samples[i + k] ** 2;
    envelope.push(Math.sqrt(sum / window));
  }
  const peak = Math.max(...envelope);
  let last = 0;
  envelope.forEach((value, i) => {
    if (value > peak * 10 ** (-db / 20)) last = (i + 1) * 0.005;
  });
  return last;
}

test('the drum kit renders deterministically, cleanly and quickly', () => {
  const started = performance.now(),
    again = renderKit(SAMPLE_RATE);
  assert(performance.now() - started < 2000, 'the whole kit renders in well under two seconds');
  for (const [name, variants] of Object.entries(kit)) {
    assert(variants.length >= 1, name);
    variants.forEach((samples, index) => {
      assert.deepEqual(samples, again[name][index], `${name}${index} is deterministic`);
      let peak = 0,
        sum = 0;
      for (const value of samples) {
        assert(Number.isFinite(value));
        peak = Math.max(peak, Math.abs(value));
        sum += value;
      }
      assert(peak > 0.85 && peak <= 0.9001, `${name}${index} is normalised`);
      assert(Math.abs(sum / samples.length) < 0.02, `${name}${index} has no DC offset`);
      assert(Math.abs(samples.at(-1)) < 1e-3, `${name}${index} ends silently`);
    });
  }
});

test('every kick is a deep, hard thump: low fundamental, punch above it, finite tail', () => {
  for (const samples of kit.kick) {
    const bins = spectrum(samples),
      low = bins.slice(
        Math.floor((30 * 8192) / SAMPLE_RATE),
        Math.floor((70 * 8192) / SAMPLE_RATE),
      ),
      peakBin = low.indexOf(Math.max(...low)) + Math.floor((30 * 8192) / SAMPLE_RATE);
    assert(Math.abs(hzOf(peakBin) - KICK_HZ) < 8, `fundamental near ${KICK_HZ} Hz`);
    // The first 100 ms carry real energy above the fundamental: that is what makes it hit.
    const head = spectrum(samples.subarray(0, Math.floor(SAMPLE_RATE * 0.1)), 4096),
      band = (from, to) =>
        head
          .slice(Math.floor((from * 4096) / SAMPLE_RATE), Math.floor((to * 4096) / SAMPLE_RATE))
          .reduce((sum, value) => sum + value ** 2, 0);
    assert(
      band(100, 800) > band(20, 100) * 10 ** -3.5,
      'punch: mids within 35 dB of the fundamental',
    );
    assert(fadeTime(samples, 30) >= 0.3 && fadeTime(samples, 30) <= 0.95, 'tail of a techno kick');
  }
  // Punchy variants are shorter than the long one.
  assert(fadeTime(kit.kick[1], 30) < fadeTime(kit.kick[2], 30));
});

test('hats are bright and short, open hats ring, claps sit in the mids', () => {
  for (const hat of kit.hat) {
    assert(centroid(hat) > 7000, 'closed hats live above 7 kHz');
    assert(fadeTime(hat, 30) < 0.12, 'closed hats are short');
  }
  for (const open of kit.open) assert(fadeTime(open, 30) > 0.25, 'open hats ring on');
  for (const clap of kit.clap) {
    const middle = centroid(clap);
    assert(middle > 800 && middle < 3500, `claps centre in the mids: ${middle}`);
  }
  assert(centroid(kit.ride[0]) > 5000 && centroid(kit.crash[0]) > 4000);
});

function kitFixture() {
  const context = fakeContext(),
    cleanups = [],
    song = { dry: context.createGain(), duck: context.createGain(), voxDuck: context.createGain() },
    audio = { context, graph: { song }, stemFlash: {} },
    sends = [],
    voices = createKit({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: {
        feed: (...args) => sends.push(args),
        releaseVoice: (...args) => cleanups.push(args),
      },
    });
  return { context, cleanups, song, sends, voices };
}

test('the kit is built once per context and each hit is a single, cleaned-up buffer voice', () => {
  const { context, cleanups, song, voices } = kitFixture(),
    buffers = () => context.nodes.filter((node) => node.kind === 'buffer');
  voices.eKitClap(1, 0.4);
  assert.equal(buffers().length, 2, 'a clap is two takes, panned apart');
  const [left, right] = context.nodes.filter((node) => node.kind === 'panner');
  assert(left.pan.value < 0 && right.pan.value > 0);
  assert(buffers()[1].startTime > buffers()[0].startTime, 'the second take is a hair late');
  const total = Object.values(kit).reduce((sum, variants) => sum + variants.length, 0);
  voices.eKitHat(2, false, 0.2);
  voices.eKitHat(2.1, true, 0.2);
  assert.equal(buffers().length, 4);
  assert.equal(cleanups.length, 4);
  for (const [source, outlet] of cleanups) {
    assert(source.buffer && source.startTime >= 1);
    assert(reaches(outlet, song.dry));
  }
  assert(total > 20);
});

test('the kick retunes to the key, dips the sidechain and eases back exponentially', () => {
  const { context, cleanups, song, voices } = kitFixture();
  voices.eKitKick(3, 0.6, 0.7, 55, 1);
  const [source] = cleanups[0];
  assert(Math.abs(source.playbackRate.value - 55 / KICK_HZ) < 1e-9);
  const [dip, release] = song.duck.gain.calls;
  assert.deepEqual(dip.slice(0, 3), ['set', 1 - 0.7, 3]);
  assert(release[0] === 'target' && release[1] === 1 && release[3] > 0.03 && release[3] < 0.15);
  // Vocals duck only a third as deeply.
  assert.deepEqual(song.voxDuck.gain.calls[0].slice(0, 3), ['set', 1 - 0.7 * 0.3, 3]);
  assert(context.nodes.some((node) => node.kind === 'buffer'));
});

test('tuned metal hits follow the requested note', () => {
  const { cleanups, voices } = kitFixture();
  voices.eKitPing(1, 84, 0.1);
  const [source] = cleanups[0];
  // C6 is 1046 Hz, closest to the 920 Hz variant, which is shifted up to it.
  assert(Math.abs(source.playbackRate.value * 920 - 440 * 2 ** ((84 - 69) / 12)) < 1);
});

test('rumble swells between kicks on the bass bus; the reese is a saturated detuned pair', () => {
  const context = fakeContext(),
    cleanups = [],
    song = { bass: context.createGain() },
    audio = { context, graph: { song }, stemFlash: {} },
    { eRumble, eReese } = createWarehouse({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: {
        feed() {},
        nsrc: () => context.createBufferSource(),
        releaseVoice: (...a) => cleanups.push(a),
      },
    });
  eRumble(2, 29, 0.5, 0.3);
  const [, rumbleOut, rumbleExtra] = cleanups[0];
  assert(reaches(rumbleOut, song.bass));
  const swell = rumbleOut.gain.calls;
  assert(
    swell[0][1] < 0.001 && swell[1][1] === 0.3 && swell[1][2] > 2.1 && swell.at(-1)[1] < 0.001,
  );
  assert(rumbleExtra.length >= 3);
  eReese(4, 29, 0.2, 0.2, 800);
  const saws = context.nodes.filter((node) => node.type === 'sawtooth');
  assert.equal(saws.length, 2);
  assert.deepEqual(
    saws.map((node) => node.detune.value),
    [-9, 9],
  );
  assert(context.nodes.some((node) => node.kind === 'shaper' && node.curve.length > 100));
  assert(cleanups.length === 2 && reaches(cleanups[1][1], song.bass));
});

test('warehouse sessions are deterministic, fixed in key and tempo, with sound rhythm material', () => {
  assert.equal(TRACKS[WAREHOUSE].style, 'warehouse');
  assert(TRACK_IDS.includes(WAREHOUSE));
  for (const seed of [1, 7, 42, 99, 2024, 31337]) {
    const audio = createAudioState();
    audio.trackId = WAREHOUSE;
    audio.seed = seed;
    const composer = createAudioComposition({ audio });
    audio.session = composer.composeSession(seed);
    assert.deepEqual(audio.session, composeWarehouseSession(seed));
    assert(audio.session.bpm >= 132 && audio.session.bpm <= 138);
    const patterns = new Set();
    for (let chapter = 0; chapter < 2000; chapter++) {
      const session = composer.chapterFor(chapter),
        { hats, rim, percCycle, percSteps, metal, bass, stab, ping } = session.patterns;
      assert.equal(session.bpm, audio.session.bpm);
      assert.equal(session.pc, audio.session.pc);
      assert(session.swing > 0.03 && session.swing < 0.08);
      assert(hats.length === 16 && hats.every((v) => v >= 0 && v <= 0.7));
      assert([10, 12, 14].includes(percCycle));
      for (const steps of [rim, percSteps, metal, bass, stab])
        assert(steps.every((s) => Number.isInteger(s) && s >= 0 && s < 16));
      assert(
        bass.every((s) => s % 4 !== 0),
        'the bass never lands on the kick',
      );
      assert(ping.length === 8);
      patterns.add(JSON.stringify(session.patterns));
      if (chapter) {
        assert.equal(session.form.at(-1)[0], 64);
        assert(
          session.form.every(([end], i) => end % 4 === 0 && (!i || end > session.form[i - 1][0])),
        );
      }
    }
    assert(patterns.size > 20);
    assert.equal(audio.chapters.size, 3);
  }
  for (const form of WAREHOUSE_FORMS) assert.equal(form.at(-1)[0], 64);
});

test('the floor never stops except in breaks and the last beat before a drop', () => {
  const { audio, comp, bar } = arrangement('warehouse'),
    kicks = (events) => events.filter(({ name }) => name === 'eKitKick').length;
  for (let index = 0; index < 64; index++) {
    const section = comp.sectionAt(index),
      events = bar(index);
    if (section.sec === 'BREAK') assert.equal(kicks(events), 0, `bar ${index}`);
    else if (section.sec === 'BUILD' && section.bs === section.len - 1) {
      assert.equal(kicks(events), 3, 'the last beat before the drop is silent');
      assert(events.every(({ args }) => args[0] < (index * 16 + 12) * audio.session.s16));
    } else if (section.sec === 'OUTRO' && section.bs >= 3) assert.equal(kicks(events), 0);
    else if (!(section.sec === 'INTRO') || section.bs >= 0)
      assert.equal(kicks(events), 4, `bar ${index}`);
  }
});

test('the drop lands with a kick, a crash and an impact, and builds roll a snare into it', () => {
  const { audio, comp, bar } = arrangement('warehouse');
  let drops = 0;
  for (let index = 1; index < 64; index++) {
    const section = comp.sectionAt(index);
    if (section.sec !== 'FINAL' || section.bs !== 0 || comp.sectionAt(index - 1).sec !== 'BUILD')
      continue;
    drops++;
    const hit = bar(index)
      .filter(({ args }) => args[0] === index * 16 * audio.session.s16)
      .map(({ name }) => name);
    for (const voice of ['eKitKick', 'eKitCrash', 'eImpact']) assert(hit.includes(voice), voice);
    const roll = bar(index - 1).filter(({ name }) => name === 'eKitSnare');
    assert(roll.length >= 6, 'a quickening snare roll');
    assert(bar(index - 1).some(({ name }) => name === 'eSwell'));
  }
  assert(drops >= 1);
});

test('percussion drifts against the bar: no two consecutive peak bars repeat it', () => {
  const { comp, bar } = arrangement('warehouse');
  const toms = [];
  for (let index = 0; index < 64; index++)
    if (comp.sectionAt(index).sec === 'PEAK')
      toms.push(
        bar(index)
          .filter(({ name }) => name === 'eKitTom')
          .map(({ args }) => Math.round(args[0] * 1000)),
      );
  assert(toms.length >= 8);
  const shapes = toms.map((times) => times.map((time) => time - times[0]).join());
  assert(new Set(shapes).size >= 3, 'the tom pattern changes shape from bar to bar');
});

test('the warehouse arrangement keeps its memory bounded across 24 chapters', () => {
  const audio = createAudioState();
  audio.trackId = WAREHOUSE;
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
    { scheduleWarehouseStep } = createAudioWarehouse({
      audio,
      audioComposition,
      audioInstruments: instruments,
    });
  for (let step = 0; step < 1536 * 16; step += 2)
    scheduleWarehouseStep(step, step * audio.session.s16);
  assert.equal(audio.chapters.size, 3);
  assert(events.length > 20000);
  for (const args of events)
    for (const argument of args)
      if (typeof argument === 'number') assert(Number.isFinite(argument));
});
