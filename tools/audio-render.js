import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioGraph } from '../src/audio/graph.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioInstruments } from '../src/audio/instruments.js';
import { createArrangements } from '../src/audio/song-registry.js';
import { createAudioOutput, SFX_GAIN } from '../src/audio/output.js';
import { createGameAudio } from '../src/audio/game-feedback.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { createAudioScheduler } from '../src/audio/scheduler.js';
import { TRACKS, TRACK_IDS } from '../src/audio/catalog.js';

/** Silence rendered after the last scheduled step so long pads and reverb tails can end. */
const TAIL = 6;

/** Builds the real graph, voices and output chain on an OfflineAudioContext. */
export function createRig(style, { seed = 42, sampleRate = 24000, bars = 0, seconds = 10 } = {}) {
  const audio = createAudioState();
  audio.trackId = TRACK_IDS.find((id) => TRACKS[id].style === style);
  if (!audio.trackId) throw new Error(`Unknown preview style ${style}`);
  audio.seed = seed;
  audio.volume = 78;
  audio.bassAmount = 68;
  audio.enabled = true;
  audio.effectsVolume = 55;
  const audioComposition = createAudioComposition({ audio });
  audio.session = audioComposition.composeSession(audio.seed);
  if (bars) seconds = bars * 16 * audio.session.s16 + TAIL;
  audio.context = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const context = audio.context;
  audio.master = createAudioOutput(context);
  audio.noiseBuf = audio.context.createBuffer(1, sampleRate, sampleRate);
  const noise = audio.noiseBuf.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  const audioMath = createAudioMath(audio),
    audioGraph = createAudioGraph({ audio });
  audioGraph.buildMusicGraph();
  audioGraph.newSongBuses();
  audio.graph.dA.delayTime.value = audio.graph.dB.delayTime.value = audio.session.spb * 0.75;
  audio.musG.gain.value = (audio.volume / 100) * 0.72;
  audio.bassShelf.gain.value = (audio.bassAmount / 100) * 3;
  audio.sfxG.gain.value = (audio.effectsVolume / 100) * SFX_GAIN;
  const audioInstruments = createAudioInstruments({ audio, audioGraph, audioMath });
  return { audio, context, audioComposition, audioMath, audioGraph, audioInstruments };
}

/**
 * Renders the real graph, voices, arrangement and (optionally) a gameplay timeline into an
 * OfflineAudioContext. Shared by the browser audio check page and by scripted analysis.
 */
export async function renderOffline(
  style,
  bar,
  bars = 4,
  { seed = 42, gameplay = false, sampleRate = 24000, masterGain, solo } = {},
) {
  const rig = createRig(style, { seed, sampleRate, bars });
  const { audio, context, audioComposition, audioMath, audioGraph } = rig;
  let { audioInstruments } = rig;
  // Calibration hooks for scripted analysis: override the makeup gain, or mute all but some voices.
  if (masterGain !== undefined) audio.master.gain.value = masterGain;
  if (solo)
    audioInstruments = Object.fromEntries(
      Object.entries(audioInstruments).map(([name, voice]) => [
        name,
        solo.includes(name) ? voice : () => {},
      ]),
    );
  const seconds = bars * 16 * audio.session.s16 + TAIL;
  const game = { phase: 'play', goldTime: 0, comboCount: 0, iceTime: 0, danger: false },
    arrangements = createArrangements({
      audio,
      game,
      audioComposition,
      audioMath,
      audioInstruments,
    });
  audio.songStart = 0.1 - bar * 16 * audio.session.s16;
  const gameAudio = createGameAudio({ audio, audioComposition, audioGraph, audioMath });
  const reactions = createAudioReactions({
    audio,
    game,
    gameAudio,
    audioComposition,
    audioInstruments,
  });
  // Apply the live track's neutral filter too, so a music-only audition matches gameplay.
  reactions.musicReact(0);
  if (gameplay) {
    // Replay an ordered gameplay timeline against the actual voices, output chain and scheduler.
    // OfflineAudioContext has no advancing wall clock until rendering, so expose the replay clock.
    let replayTime = 0;
    audio.context = new Proxy(context, {
      get(target, key) {
        if (key === 'currentTime') return replayTime;
        if (key === 'state') return 'running';
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    audio.playing = { live: true };
    audio.step = bar * 16;
    audio.nextStepTime = 0.1;
    const audioScheduler = createAudioScheduler({
      audio,
      audioComposition,
      audioGraph,
      audioInstruments,
      arrangements,
    });
    const events = [{ time: 0.12, kind: 'start' }],
      end = seconds - TAIL;
    for (let i = 0; i * 1.15 + 1 < end; i++) {
      const time = i * 1.15 + 1,
        x = 20 + ((i * 31) % 80);
      events.push(
        { time, kind: 'drop', x },
        { time: time + 0.33, kind: 'impact', x, speed: 240, pair: i },
      );
      if (i % 2 === 0)
        events.push({ time: time + 0.6, kind: 'merge', tier: 1 + (i % 7), combo: 1 + (i % 4), x });
    }
    for (const time of [12, 24, 42])
      if (time < end) {
        events.push({ time, kind: 'shake' });
        for (let i = 0; i < 7; i++)
          events.push({
            time: time + 0.13 + i * 0.08,
            kind: 'merge',
            tier: (i % 6) + 1,
            combo: i + 1,
            x: 20 + i * 12,
          });
      }
    for (const [time, kind] of [
      [end * 0.15, 'swap'],
      [end * 0.3, 'goal'],
      [end * 0.36, 'discover'],
      [end * 0.45, 'fever'],
      [end * 0.6, 'boom'],
      [end * 0.66, 'zap'],
      [end - 12, 'freeze'],
      [end - 9, 'gold'],
      [end - 0.35, 'over'],
    ])
      if (time < end) events.push({ time, kind });
    events.sort((a, b) => a.time - b.time);
    let event = 0,
      nextDanger = 0;
    const environments = new Set();
    for (replayTime = 0; replayTime < end; replayTime += 0.025) {
      while (events[event]?.time <= replayTime) {
        const e = events[event++];
        if (e.kind === 'merge') reactions.reactToMerge(e.tier, e.combo, e.x);
        else reactions.reactToEvent(e.kind, e);
        if (e.kind === 'over') game.phase = 'dying';
      }
      audio.hype = Math.max(0, audio.hype - 0.025 * 0.2);
      audio.feverOn =
        game.phase === 'play' && replayTime >= end * 0.45 && replayTime < end * 0.45 + 7;
      game.iceTime = replayTime >= end - 12 && replayTime < end - 5 ? 1 : 0;
      game.goldTime = replayTime >= end - 9 && replayTime < end - 2 ? 1 : 0;
      game.danger = replayTime > end - 3 && replayTime < end - 1;
      if (game.danger && replayTime >= nextDanger) {
        reactions.reactToEvent('danger');
        nextDanger = replayTime + 0.72;
      }
      reactions.musicReact(0.025);
      environments.add(audio.environmentKey);
      audioScheduler.musicTick();
    }
    const counts = gameAudio.getStats().counts;
    for (const kind of ['drop', 'impact', 'merge', 'shake', 'fever', 'freeze', 'gold', 'over'])
      if (!counts[kind]) throw new Error(`Replay did not sound ${kind}`);
    for (const state of ['n', 'f', 'e'])
      if (!environments.has(state)) throw new Error(`Missing environment ${state}`);
    audio.context = context;
  } else {
    for (let step = 0; step < bars * 16; step++)
      arrangements[style](bar * 16 + step, 0.1 + step * audio.session.s16);
  }
  const buffer = await context.startRendering();
  let peak = 0,
    squares = 0,
    nonFinite = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++)
    for (const value of buffer.getChannelData(channel)) {
      if (!Number.isFinite(value)) nonFinite++;
      peak = Math.max(peak, Math.abs(value));
      squares += value * value;
    }
  const rms = Math.sqrt(squares / (buffer.length * buffer.numberOfChannels));
  if (nonFinite || peak >= 1 || (!solo && rms < 0.0001) || audio.liveVoices !== 0)
    throw new Error(
      `${style}, bar ${bar}: invalid signal or unreleased voices (${audio.liveVoices})`,
    );
  const stats = gameAudio.getStats();
  return {
    buffer,
    audio,
    peak,
    rms,
    stats,
    summary: `${style.toUpperCase()} seed ${seed}, bar ${bar}${gameplay ? ' + GAMEPLAY' : ''}: peak ${peak.toFixed(3)}, RMS ${rms.toFixed(4)}, ended voices ${audio.liveVoices}${gameplay ? `, max effects ${stats.maxVoices}, cues ${stats.accepted}` : ''}`,
  };
}

/** 16-bit stereo PCM WAV bytes for an AudioBuffer. */
export function encodeWav(buffer) {
  const sampleRate = buffer.sampleRate,
    bytes = new Uint8Array(44 + buffer.length * 4),
    view = new DataView(bytes.buffer);
  const word = (offset, text) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  word(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  word(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  word(36, 'data');
  view.setUint32(40, bytes.length - 44, true);
  for (let i = 0; i < buffer.length; i++)
    for (let channel = 0; channel < 2; channel++)
      view.setInt16(
        44 + i * 4 + channel * 2,
        Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i])) * 32767,
        true,
      );
  return bytes;
}
