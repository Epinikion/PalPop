import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createArrangements } from '../src/audio/song-registry.js';
import { createAudioGraph } from '../src/audio/graph.js';
import { createAudioOutput, MASTER_GAIN, SFX_GAIN } from '../src/audio/output.js';
import { createDrums } from '../src/audio/instruments/drums.js';
import { createKit } from '../src/audio/instruments/kit.js';
import { KICK_HZ, kickTuning } from '../src/audio/instruments/kit-dsp.js';
import { createTransitions } from '../src/audio/instruments/transitions.js';
import { createSupersaw } from '../src/audio/instruments/supersaw.js';
import { sweepFor } from '../src/audio/sweep.js';
import { composeFestivalPhrase } from '../src/audio/songs/festival-composition.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';
import { analyzeBars, decodeWav } from '../tools/analyze-wav.mjs';
import { fakeContext, reaches } from './helpers/fake-audio.js';
import { arrangement } from './helpers/arrangement.js';

test('the master chain ends in a soft clipper and limiter that cannot exceed full scale', () => {
  const context = fakeContext(),
    master = createAudioOutput(context);
  assert.equal(master.gain.value, MASTER_GAIN);
  assert(reaches(master, context.destination));
  const clipper = context.nodes.find((node) => node.kind === 'shaper');
  assert(clipper.curve.length >= 1024);
  assert(
    clipper.curve.every((value, i, curve) => Math.abs(value) <= 1 && (!i || value >= curve[i - 1])),
  );
  const [, limiter] = context.nodes.filter((node) => node.kind === 'compressor');
  assert(limiter.ratio.value >= 10 && limiter.threshold.value <= -1);
  // Dry gameplay cues are scaled against the music's makeup gain, never left below it.
  assert(SFX_GAIN > MASTER_GAIN);
});

test('every song bus node reaches the master, and each style gets its loudness trim', () => {
  for (const id of TRACK_IDS) {
    const audio = createAudioState(),
      context = fakeContext();
    audio.trackId = id;
    audio.context = context;
    audio.master = createAudioOutput(context);
    const graph = createAudioGraph({ audio });
    graph.buildMusicGraph();
    graph.newSongBuses();
    const [trim, sweep] = audio.graph.song.extras;
    assert.equal(trim.gain.value, TRACKS[id].trim);
    assert.equal(sweep.type, 'highpass');
    assert(sweep.frequency.value < 20, 'the sweep filter rests below the audible range');
    for (const node of context.nodes)
      if (node.kind !== 'analyser')
        assert(reaches(node, context.destination), `${TRACKS[id].name}: ${node.kind} is dangling`);
    // The synth bus passes the stereo widener, whose side path is high-passed, and its own duck.
    const { mel, bass, duck, melDuck } = audio.graph.song;
    assert(reaches(mel, melDuck) && reaches(bass, duck));
    assert.equal(audio.graph.song.pump, TRACKS[id].pump ?? 1);
    assert(context.nodes.some((node) => node.kind === 'merger'));
  }
});

test('the DJ filter opens through intros, closes through builds and rests out of the way', () => {
  const intro = [0, 0.25, 0.5, 0.75, 1].map((p) => sweepFor('INTRO', p)),
    build = [0, 0.25, 0.5, 0.75, 1].map((p) => sweepFor('BUILD', p));
  assert(intro.every((hz, i) => !i || hz < intro[i - 1]));
  assert(build.every((hz, i) => !i || hz > build[i - 1]));
  assert(build[0] >= 20 && build[4] >= 600 && build[4] <= 1200);
  for (const section of ['GROOVE', 'PEAK', 'FINAL', 'BREAK']) assert(sweepFor(section, 0.5) < 20);
  const context = fakeContext(),
    audio = {
      context,
      graph: {
        song: {
          sweep: {
            frequency: {
              calls: [],
              setTargetAtTime(...a) {
                this.calls.push(a);
              },
            },
          },
        },
      },
    },
    instruments = createTransitions({ audio, audioGraph: {}, audioMath: {} });
  instruments.eSweep(2, 400);
  assert.deepEqual(audio.graph.song.sweep.frequency.calls, [[400, 2, 0.03]]);
});

for (const style of ['festival', 'dance', 'techno'])
  test(`${style}: builds sweep the filter upward and every drop snaps it open`, () => {
    const { comp, bar } = arrangement(style);
    let previous = 0,
      sawBuild = false;
    for (let index = 0; index < 64; index++) {
      const section = comp.sectionAt(index),
        sweeps = bar(index).filter(({ name }) => name === 'eSweep');
      if (section.sec === 'BUILD') {
        sawBuild = true;
        const first = sweeps[0].args[1];
        assert(first > previous || section.bs === 0, `${style} bar ${index} must keep rising`);
        previous = sweeps.at(-1).args[1];
        assert(sweeps.every(({ args }) => args[1] >= 20));
      } else if (['PEAK', 'FINAL'].includes(section.sec)) {
        assert(sweeps.length > 0 && sweeps.every(({ args }) => args[1] < 20));
        if (section.bs === 0)
          assert(previous === 0 || previous >= 300, 'a build preceded the drop');
        previous = 0;
      }
    }
    assert(sawBuild);
  });

for (const style of ['festival', 'dance'])
  test(`${style}: the bar before a drop goes quiet on its last beat and the drop lands with an impact`, () => {
    const { audio, comp, bar } = arrangement(style);
    let drops = 0;
    for (let index = 1; index < 64; index++) {
      const section = comp.sectionAt(index),
        before = comp.sectionAt(index - 1);
      if (!['PEAK', 'FINAL'].includes(section.sec) || section.bs !== 0 || before.sec !== 'BUILD')
        continue;
      drops++;
      const gap = bar(index - 1),
        s16 = audio.session.s16;
      assert(gap.every(({ args }) => args[0] < ((index - 1) * 16 + 12) * s16));
      assert(
        gap.some(({ name }) => name === 'eSwell'),
        'a reverse swell lands in the gap',
      );
      const hit = bar(index)
        .filter(({ args }) => args[0] === index * 16 * s16)
        .map(({ name }) => name);
      for (const voice of ['eKick', 'eCrash', 'eImpact']) assert(hit.includes(voice), voice);
    }
    assert(drops >= 1);
  });

test('festival breakdowns replay the hook on piano and never on the saw lead', () => {
  const { audio, comp, bar } = arrangement('festival');
  const root = 60 + audio.session.pc - (audio.session.pc > 7 ? 12 : 0);
  let melodic = 0;
  for (let index = 0; index < 64; index++) {
    const section = comp.sectionAt(index);
    if (section.sec !== 'BREAK') continue;
    const events = bar(index);
    assert(!events.some(({ name }) => name === 'eFestivalLead'));
    if (section.bs < 2) continue;
    const theme = composeFestivalPhrase(audio.session.seed, Math.floor(index / 8)).melody.filter(
      ([step]) => Math.floor(step / 16) === index % 8,
    );
    const played = events.filter(
      ({ name, args }) => name === 'eFestivalPiano' && args[1].length === 1,
    );
    for (const [step, degree] of theme) {
      const note = root + audio.session.mode.s[degree % 7] + Math.floor(degree / 7) * 12;
      assert(
        played.some(({ args }) => args[1][0] === note),
        `bar ${index} step ${step % 16}`,
      );
      melodic++;
    }
  }
  assert(melodic > 0);
});

test('supersaw voices are wide but symmetric, and one cleanup releases every oscillator', () => {
  const context = fakeContext(),
    cleanups = [],
    audio = { context, graph: { song: { mel: {} } }, stemFlash: {} },
    { superSaw } = createSupersaw({
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
    });
  superSaw(10, [60, 64, 67], 0.4, 0.3, { voices: 7, width: 0.8 });
  const saws = context.nodes.filter((node) => node.kind === 'oscillator');
  assert.equal(saws.length, 21);
  assert(saws.every((node) => node.type === 'sawtooth' && node.endTime === saws[0].endTime));
  const cents = saws.slice(0, 7).map((node) => node.detune.value);
  assert(cents.every((value, i) => value + cents[6 - i] === 0));
  assert(cents.includes(0));
  const [panLeft, panRight] = context.nodes.filter((node) => node.kind === 'panner');
  assert.equal(panLeft.pan.value, -panRight.pan.value);
  assert.equal(cleanups.length, 1);
  const [source, outlet, extra] = cleanups[0];
  assert(saws.slice(1).every((node) => extra.includes(node)) && source === saws[0]);
  assert(outlet.pan.value === 0 && extra.every((node) => node !== outlet));
});

/** The drum voices on a recording rig: every hit's source, outlet and playback rate. */
function drumRig({ rum = false, pump = 1 } = {}) {
  const context = fakeContext(),
    duck = context.createGain(),
    cleanups = [],
    melDuck = context.createGain(),
    song = {
      dry: context.createGain(),
      duck,
      melDuck,
      pump,
      rum: rum ? context.createGain() : null,
    },
    audio = { context, graph: { song }, stemFlash: {} },
    dependencies = {
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
    },
    kit = createKit(dependencies);
  return {
    context,
    duck,
    melDuck,
    cleanups,
    song,
    drums: createDrums({ ...dependencies, kit }),
    kit,
  };
}

test('the kick dips the synth bus instantly and lets it breathe back exponentially', () => {
  const { drums, duck, cleanups } = drumRig();
  drums.eKick(5, 0.5, 0.7, 0, 55, 1);
  const [dip, release] = duck.gain.calls;
  assert.deepEqual(dip.slice(0, 3), ['set', 1 - 0.7, 5]);
  assert.equal(release[0], 'target');
  assert.equal(release[1], 1);
  assert(release[3] > 0.03 && release[3] < 0.15, 'recovers within about a quarter of a beat');
  assert(Math.abs(cleanups[0][0].playbackRate.value - 55 / KICK_HZ) < 1e-9, 'tuned to the key');
});

test('the kick ducks the bass bus fully and the synth bus by the song pump share', () => {
  for (const pump of [1, 0.3, 0]) {
    const { drums, duck, melDuck } = drumRig({ pump });
    drums.eKick(5, 0.5, 0.7, 0, 55, 1);
    assert.deepEqual(duck.gain.calls[0].slice(0, 3), ['set', 1 - 0.7, 5]);
    const [dip, release] = melDuck.gain.calls;
    assert(Math.abs(dip[1] - (1 - 0.7 * pump)) < 1e-12 && dip[2] === 5);
    assert(release[0] === 'target' && release[1] === 1 && release[3] === 0.075);
  }
});

test('kick variants hold their loudness and the rumble feed rides on the kick', () => {
  const levels = [0, 1, 2, 3].map((variant) => {
      const { drums, cleanups } = drumRig();
      drums.eKick(1, 0.5, 0, 0, undefined, variant);
      return cleanups[0][1].gain.value;
    }),
    { drums, cleanups, song } = drumRig({ rum: true });
  assert(
    levels.every((level) => level > 0.4 && level < 0.9),
    levels.join(),
  );
  drums.eKick(1, 0.5, 0, 0.5);
  const [, outlet, extra] = cleanups[0];
  assert(
    extra.some((node) => reaches(node, song.rum)),
    'a send into the rumble bus',
  );
  assert(outlet.gain.value > 0);
  const quiet = drumRig({ rum: true });
  quiet.drums.eKick(1, 0.5, 0, 0);
  assert(!quiet.cleanups[0][2].length, 'no rumble, no send');
});

test('the old drum vocabulary maps onto the kit', () => {
  const { drums, context, cleanups } = drumRig(),
    hit = () => cleanups.at(-1),
    buffers = () => context.nodes.filter((node) => node.kind === 'buffer');
  const before = buffers().length;
  drums.eHat(1, false, 0.05, -0.2, 0.5);
  drums.eHat(1.2, true, 0.075, 0.2, 0.5);
  drums.eShaker(1.4, 0.02, 0.1);
  drums.eRide(1.6, 0.03, 0.1);
  drums.eSnare(1.8, 0.05, 1.2);
  assert.equal(buffers().length - before, 5, 'one buffer voice per drum');
  assert.equal(hit()[0].playbackRate.value, 1.2, 'a snare roll is tuned up by its pitch');
  drums.eClap(2, 0.1);
  assert.equal(buffers().length - before, 7, 'a clap is two takes');
  // Toms: a glide from f0 is heard as its middle, so each f0 lands on the nearest kit tom.
  const rates = [125, 150, 170, 200, 230].map((f0) => {
    drums.eTom(3, f0, 0.3);
    return hit()[0].playbackRate.value;
  });
  assert(
    rates.every((rate) => rate > 0.75 && rate < 1.25),
    rates.join(),
  );
  assert(rates[0] < rates[4], 'higher toms play higher');
  drums.ePerc(4, 'tick', 0.05, 0.2);
  drums.ePerc(4.1, 'conga', 0.05, 0.2);
  drums.ePerc(4.2, 'blip', 0.05, 0.2, 60);
  // The blip is a ping at the note an octave above: C5 is closest to the 640 Hz ping.
  assert(Math.abs(cleanups.at(-1)[0].playbackRate.value * 640 - 440 * 2 ** ((72 - 69) / 12)) < 1);
  assert.equal(cleanups.at(-2)[0].playbackRate.value, 1.5, 'a conga is a high, short tom');
});

test('every crash is a kit crash: the long one rings, the short one is a splash', () => {
  const context = fakeContext(),
    cleanups = [],
    song = { dry: context.createGain() },
    audio = { context, graph: { song }, stemFlash: {} },
    dependencies = {
      audio,
      audioMath: createAudioMath({ seed: 1 }),
      audioGraph: { feed() {}, releaseVoice: (...args) => cleanups.push(args) },
    },
    kit = createKit(dependencies),
    { eCrash } = createTransitions({ ...dependencies, kit });
  eCrash(1, 0.07, true);
  eCrash(3, 0.07, false);
  const [long, short] = cleanups.map(([source]) => source.buffer.length);
  assert(long > short * 1.3, 'the splash is shorter');
  assert(audio.stemFlash.drums > 0.2);
});

test('kicks follow the key: the root where it carries, its fifth or fourth where it would not', () => {
  for (let pc = 0; pc < 12; pc++) {
    const hz = kickTuning(pc),
      semitones = 12 * Math.log2(hz / 440) + 69,
      interval = (((Math.round(semitones) - pc) % 12) + 12) % 12;
    assert(hz >= 46 && hz <= 62, `pitch class ${pc} -> ${hz}`);
    assert([0, 7, 5].includes(interval), `pitch class ${pc} is tuned to a root, fifth or fourth`);
  }
  assert(Math.abs(kickTuning(9) - 55) < 0.1 && Math.abs(kickTuning(7) - 49) < 0.1);
  assert(Math.abs(kickTuning(0) - 49) < 0.1, 'C takes its fifth, G');
});

test('the WAV analyzer reports level, tonal balance and stereo width', () => {
  const sampleRate = 44100,
    seconds = 4.2,
    length = Math.floor(sampleRate * seconds),
    bytes = new Uint8Array(44 + length * 4),
    view = new DataView(bytes.buffer);
  const text = (offset, value) =>
    [...value].forEach((c, i) => (bytes[offset + i] = c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, length * 4, true);
  for (let i = 0; i < length; i++) {
    // 60 Hz at -6 dBFS, 8 kHz twenty decibels lower, identical in both channels.
    const sample =
      0.5 * Math.sin((2 * Math.PI * 60 * i) / sampleRate) +
      0.05 * Math.sin((2 * Math.PI * 8000 * i) / sampleRate);
    view.setInt16(44 + i * 4, sample * 32767, true);
    view.setInt16(46 + i * 4, sample * 32767, true);
  }
  const [row] = analyzeBars(decodeWav(bytes), 120);
  assert(row.peak > -6 && row.peak < -4);
  assert(row.bands[1] < -40 && row.bands[2] < -40, 'nothing between 200 Hz and 3.5 kHz');
  assert(row.bands[3] > -24 && row.bands[3] < -17, 'the 8 kHz partial sits about 20 dB down');
  assert(row.width < -60, 'identical channels carry no side signal');
  assert.throws(() => decodeWav(new Uint8Array(64)), /16-bit stereo/);
});
