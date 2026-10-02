import { createAudioState } from '../src/audio/state.js';
import { createAudioMath } from '../src/audio/math.js';
import { createAudioGraph } from '../src/audio/graph.js';
import { createAudioComposition } from '../src/audio/composition.js';
import { createAudioInstruments } from '../src/audio/instruments.js';
import { createArrangements } from '../src/audio/song-registry.js';
import { createAudioOutput } from '../src/audio/output.js';
import { createGameAudio } from '../src/audio/game-feedback.js';
import { createAudioReactions } from '../src/audio/reactions.js';
import { createAudioScheduler } from '../src/audio/scheduler.js';
import { TRACKS, TRACK_IDS, FESTIVAL } from '../src/audio/catalog.js';
const button = document.querySelector('#run'),
  result = document.querySelector('#result'),
  previewTrack = document.querySelector('#previewTrack');
for (const id of TRACK_IDS) {
  const option = document.createElement('option');
  option.value = TRACKS[id].style;
  option.textContent = TRACKS[id].name;
  previewTrack.append(option);
}
previewTrack.value = TRACKS[FESTIVAL].style;
async function render(style, bar, bars = 4, preview = false, { seed = 42, gameplay = false } = {}) {
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
  const seconds = bars * 16 * audio.session.s16 + 4,
    sampleRate = 24000;
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
  audio.sfxG.gain.value = (audio.effectsVolume / 100) * 0.38;
  const audioInstruments = createAudioInstruments({ audio, audioGraph, audioMath });
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
      end = seconds - 4;
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
  if (nonFinite || peak >= 1 || rms < 0.0001 || audio.liveVoices !== 0)
    throw new Error(
      `${style}, bar ${bar}: invalid signal or unreleased voices (${audio.liveVoices})`,
    );
  if (preview) {
    const bytes = new Uint8Array(44 + buffer.length * 4),
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
    const wave = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(wave),
      player = document.querySelector('#previewAudio'),
      download = document.querySelector('#download');
    if (player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);
    player.src = url;
    player.hidden = false;
    download.href = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(wave);
    });
    download.hidden = false;
    const name = TRACKS[audio.trackId].name.toLowerCase().replaceAll(' ', '-');
    download.download = name + (gameplay ? '-gameplay.wav' : '.wav');
  }
  const stats = gameAudio.getStats();
  return `${style.toUpperCase()} seed ${seed}, bar ${bar}${gameplay ? ' + GAMEPLAY' : ''}: peak ${peak.toFixed(3)}, RMS ${rms.toFixed(4)}, ended voices ${audio.liveVoices}${gameplay ? `, max effects ${stats.maxVoices}, cues ${stats.accepted}` : ''}`;
}
document.querySelector('#preview').addEventListener('click', async (event) => {
  event.target.disabled = true;
  const style = previewTrack.value;
  result.textContent = 'Rendering evolving ' + style + '…';
  try {
    result.textContent =
      (await render(style, 0, style === 'festival' ? 48 : 32, true)) +
      '\nPreview ready: an evolving theme, builds and drops.';
  } catch (error) {
    result.textContent = 'FAIL: ' + error.message;
  } finally {
    event.target.disabled = false;
  }
});
document.querySelector('#gameplay').addEventListener('click', async (event) => {
  event.target.disabled = true;
  result.textContent = 'Rendering music and gameplay feedback…';
  try {
    const style = previewTrack.value;
    result.textContent = await render(style, 0, style === 'festival' ? 48 : 32, true, {
      gameplay: true,
    });
    result.textContent +=
      '\nPreview ready: drops, landings, rapid chains, shake, goals, fever and specials over the live track.';
  } catch (error) {
    result.textContent = 'FAIL: ' + error.message;
  } finally {
    event.target.disabled = false;
  }
});
button.addEventListener('click', async () => {
  button.disabled = true;
  result.textContent = 'Rendering…';
  try {
    const lines = [];
    const styles = [...new Set(TRACK_IDS.map((id) => TRACKS[id].style))];
    for (const style of styles)
      for (const bar of [0, 16, 36, 64, 192]) {
        lines.push(await render(style, bar));
        result.textContent = lines.join('\n');
      }
    for (const style of ['dance', 'festival'])
      for (const seed of [7, 123456789]) lines.push(await render(style, 16, 8, false, { seed }));
    for (const style of styles) lines.push(await render(style, 16, 16, false, { gameplay: true }));
    result.textContent = lines.join('\n');
    result.textContent +=
      '\nPASS: all soundtracks, all rendered sections, finite audio, no clipping, zero remaining voices.';
  } catch (error) {
    result.textContent += '\nFAIL: ' + error.message;
  } finally {
    button.disabled = false;
  }
});
