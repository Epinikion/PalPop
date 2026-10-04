// Compares a track with the reference live set the soundtracks were voiced against.
// Usage: node tools/reference-report.mjs track.(wav|mp3|flac) [--start 30] [--seconds 90]
// Needs ffmpeg on the PATH to decode. Measurements use the same frames for every file, so ours
// and a recording are directly comparable: loudness-matched files should land near the reference.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fft } from './analyze-wav.mjs';

const SR = 32000,
  N = 2048,
  HOP = 512,
  FPS = SR / HOP;
/** Bands in Hz: sub, kick, bass, low mids, mids, high mids, highs. */
const EDGES = [30, 60, 120, 250, 500, 2000, 5000, 10000];
const NAMES = ['sub', 'kick', 'bass', 'lmid', 'mid', 'himid', 'high'];
/** Measured on a 62-minute Armin van Buuren set (Tomorrowland 2026) in its kick-driven passages. */
export const REFERENCE = {
  level: [-28.2, -26.2, -32.9, -34.0, -31.2, -35.8, -40.0],
  side: [-19, -15, -8, -3, -2, -2, -5],
  swing: { bass: 7.0, lmid: 2.5, mid: 1.6, himid: 1.4, high: 3.6 },
  dropOverBreakdown: 3.1,
  bpm: [137, 145],
};
const db = (power) => 10 * Math.log10(power + 1e-20);
const quantile = (values, q) =>
  [...values].sort((a, b) => a - b)[Math.floor(q * (values.length - 1))];

/** Per-frame mid and side energy in every band, plus the frame's total power. */
export function extractFeatures(pcm) {
  const frames = Math.max(0, Math.floor((pcm.length / 2 - N) / HOP)),
    bin = (hz) => Math.round((hz * N) / SR),
    window = Float64Array.from(
      { length: N },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N),
    ),
    mid = new Float32Array(frames * NAMES.length),
    side = new Float32Array(frames * NAMES.length),
    total = new Float32Array(frames),
    [re, im, reSide, imSide] = [0, 1, 2, 3].map(() => new Float64Array(N));
  for (let frame = 0; frame < frames; frame++) {
    let power = 0;
    for (let i = 0; i < N; i++) {
      const left = pcm[(frame * HOP + i) * 2] / 32768,
        right = pcm[(frame * HOP + i) * 2 + 1] / 32768;
      re[i] = ((left + right) / 2) * window[i];
      reSide[i] = ((left - right) / 2) * window[i];
      im[i] = imSide[i] = 0;
      power += (left * left + right * right) / 2;
    }
    fft(re, im);
    fft(reSide, imSide);
    for (let band = 0; band < NAMES.length; band++) {
      let m = 0,
        s = 0;
      for (let k = bin(EDGES[band]); k < bin(EDGES[band + 1]); k++) {
        m += re[k] ** 2 + im[k] ** 2;
        s += reSide[k] ** 2 + imSide[k] ** 2;
      }
      mid[frame * NAMES.length + band] = m / N ** 2;
      side[frame * NAMES.length + band] = s / N ** 2;
    }
    total[frame] = power / N;
  }
  return { frames, mid, side, total };
}

/** Seconds in which the kick is playing: the 30-120 Hz energy is within 9 dB of the loudest tenth. */
function kickSeconds({ frames, mid }) {
  const seconds = Math.floor(frames / FPS),
    level = Float64Array.from({ length: seconds }, (_, s) => {
      let power = 0;
      for (let f = Math.floor(s * FPS); f < Math.floor((s + 1) * FPS); f++)
        power += mid[f * NAMES.length] + mid[f * NAMES.length + 1];
      return db(power / FPS);
    }),
    threshold = quantile(level, 0.9) - 9;
  return Array.from(level, (value) => value > threshold);
}

/** Tempo from the gaps between kick onsets, and each band's swing across one beat. */
function beatFold({ frames, mid }, on) {
  const onset = new Float32Array(frames),
    kick = (f) => Math.sqrt(mid[f * NAMES.length] + mid[f * NAMES.length + 1]);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, kick(f) - kick(f - 1));
  const peaks = [];
  let last = -1e9;
  for (let f = 2; f < frames - 2; f++) {
    if (!on[Math.floor(f / FPS)] || !(onset[f] >= onset[f - 1] && onset[f] > onset[f + 1]))
      continue;
    const near = onset.subarray(Math.max(0, f - 200), f + 200);
    if (onset[f] > 0.5 * quantile(near, 0.97) && f - last >= Math.round(0.3 * FPS)) {
      peaks.push(f);
      last = f;
    }
  }
  const gaps = [];
  for (let i = 1; i < peaks.length; i++) {
    const gap = (peaks[i] - peaks[i - 1]) / FPS;
    if (gap > 0.3 && gap < 0.75) gaps.push(gap);
  }
  const length = Math.round(0.5 * FPS),
    swing = {};
  for (const [name, band] of [
    ['bass', 2],
    ['lmid', 3],
    ['mid', 4],
    ['himid', 5],
    ['high', 6],
  ]) {
    const curve = new Float64Array(length);
    let count = 0;
    for (const p of peaks) {
      if (p + length >= frames) continue;
      for (let j = 0; j < length; j++) curve[j] += mid[(p + j) * NAMES.length + band];
      count++;
    }
    const levels = Array.from(curve, (value) => db(value / Math.max(1, count)));
    swing[name] = count ? Math.max(...levels) - Math.min(...levels) : NaN;
  }
  // Onsets sit on 16 ms frames, so one gap is coarse; the mean of the gaps near the median is not.
  const typical = gaps.length ? quantile(gaps, 0.5) : NaN,
    steady = gaps.filter((gap) => Math.abs(gap - typical) < typical * 0.06);
  return {
    bpm: steady.length ? 60 / (steady.reduce((sum, gap) => sum + gap, 0) / steady.length) : NaN,
    onsets: peaks.length,
    swing,
  };
}

export function report(pcm) {
  const features = extractFeatures(pcm),
    on = kickSeconds(features),
    { frames, mid, side, total } = features,
    sum = new Float64Array(NAMES.length),
    sumSide = new Float64Array(NAMES.length),
    levels = { on: 0, off: 0 },
    counts = { on: 0, off: 0 };
  for (let f = 0; f < frames; f++) {
    const key = on[Math.floor(f / FPS)] ? 'on' : 'off';
    levels[key] += total[f];
    counts[key]++;
    if (key === 'off') continue;
    for (let band = 0; band < NAMES.length; band++) {
      sum[band] += mid[f * NAMES.length + band];
      sumSide[band] += side[f * NAMES.length + band];
    }
  }
  const bands = Array.from(sum, (value) => db(value / Math.max(1, counts.on))),
    widths = Array.from(sumSide, (value, band) => db(value) - db(sum[band]));
  return {
    seconds: frames / FPS,
    kickShare: on.filter(Boolean).length / Math.max(1, on.length),
    level: db(levels.on / Math.max(1, counts.on)),
    // A breakdown needs a few seconds of kick-less music to be worth comparing.
    dropOverBreakdown:
      counts.off > 4 * FPS ? db(levels.on / counts.on) - db(levels.off / counts.off) : NaN,
    bands,
    widths,
    ...beatFold(features, on),
  };
}

function decode(file, start, seconds) {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (start) args.push('-ss', String(start));
  if (seconds) args.push('-t', String(seconds));
  args.push('-i', file, '-f', 's16le', '-ar', String(SR), '-ac', '2', 'pipe:1');
  const bytes = execFileSync('ffmpeg', args, { maxBuffer: 2 ** 31 - 1 });
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

function print(result) {
  const f = (value, width = 7) =>
    (Number.isFinite(value) ? value.toFixed(1) : 'n/a').padStart(width);
  console.log(
    `${result.seconds.toFixed(0)} s, kick playing ${(result.kickShare * 100).toFixed(0)} % of the time, ` +
      `tempo ${f(result.bpm, 0)} BPM (reference ${REFERENCE.bpm.join('-')}), ${result.onsets} kicks`,
  );
  console.log(
    `level while the kick plays ${f(result.level)} dB; drops over breakdowns ${f(result.dropOverBreakdown)} dB ` +
      `(reference ${REFERENCE.dropOverBreakdown})`,
  );
  console.log('\nband        :' + NAMES.map((name) => name.padStart(7)).join(''));
  console.log('level (dB)  :' + result.bands.map((v) => f(v)).join(''));
  console.log('reference   :' + REFERENCE.level.map((v) => f(v)).join(''));
  console.log('difference  :' + result.bands.map((v, i) => f(v - REFERENCE.level[i])).join(''));
  console.log('side/mid dB :' + result.widths.map((v) => f(v)).join(''));
  console.log('reference   :' + REFERENCE.side.map((v) => f(v)).join(''));
  console.log('\nswing across one beat (dB; flat middles mean a continuous wall of sound):');
  for (const [name, value] of Object.entries(result.swing))
    console.log(`  ${name.padEnd(6)}${f(value)}   reference ${f(REFERENCE.swing[name])}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    option = (name) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : 0),
    file = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!file) {
    console.error('Usage: node tools/reference-report.mjs track.wav [--start 30] [--seconds 90]');
    process.exit(1);
  }
  print(report(decode(file, option('--start'), option('--seconds'))));
}
