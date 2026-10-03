// Mix report for 16-bit stereo PCM WAV files, such as the previews exported by tools/audio-check.html.
// Usage: node tools/analyze-wav.mjs preview.wav --bpm 127 [--start-bar 0]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const WINDOW = 4096;
/** Four broad bands used for tonal balance: kick+bass, low mids, upper mids, and the top end. */
export const BANDS = [
  ['LOW', 20, 200],
  ['LM', 200, 800],
  ['HM', 800, 3500],
  ['HI', 3500, 20000],
];
const db = (power) => (power > 1e-14 ? 10 * Math.log10(power) : -140);

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size,
      stepRe = Math.cos(angle),
      stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wRe = 1,
        wIm = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k,
          b = a + size / 2,
          tRe = re[b] * wRe - im[b] * wIm,
          tIm = re[b] * wIm + im[b] * wRe;
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        [wRe, wIm] = [wRe * stepRe - wIm * stepIm, wRe * stepIm + wIm * stepRe];
      }
    }
  }
}

/** Decodes 16-bit stereo PCM WAV bytes into float channels. */
export function decodeWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0) !== 0x52494646 ||
    view.getUint16(22, true) !== 2 ||
    view.getUint16(34, true) !== 16
  )
    throw new Error('Expected a 16-bit stereo PCM WAV file');
  const length = (bytes.byteLength - 44) / 4,
    left = new Float32Array(length),
    right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    left[i] = view.getInt16(44 + i * 4, true) / 32768;
    right[i] = view.getInt16(46 + i * 4, true) / 32768;
  }
  return { sampleRate: view.getUint32(24, true), left, right };
}

/** Per-bar level, band balance (dB relative to LOW) and stereo width (side/mid, dB). */
export function analyzeBars({ sampleRate, left, right }, bpm, offsetSeconds = 0.1) {
  const barLength = (60 / bpm) * 4 * sampleRate,
    offset = offsetSeconds * sampleRate,
    window = Float32Array.from(
      { length: WINDOW },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW),
    ),
    rows = [];
  for (let bar = 0; (bar + 1) * barLength + offset <= left.length; bar++) {
    const from = Math.floor(offset + bar * barLength),
      to = Math.floor(offset + (bar + 1) * barLength),
      energy = new Float64Array(BANDS.length);
    let squares = 0,
      peak = 0,
      mid = 0,
      side = 0,
      frames = 0;
    for (let i = from; i < to; i++) {
      squares += (left[i] ** 2 + right[i] ** 2) / 2;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      mid += ((left[i] + right[i]) / 2) ** 2;
      side += ((left[i] - right[i]) / 2) ** 2;
    }
    for (let at = from; at + WINDOW <= to; at += WINDOW / 2) {
      const re = new Float64Array(WINDOW),
        im = new Float64Array(WINDOW);
      for (let i = 0; i < WINDOW; i++) re[i] = ((left[at + i] + right[at + i]) / 2) * window[i];
      fft(re, im);
      for (let k = 1; k < WINDOW / 2; k++) {
        const hz = (k * sampleRate) / WINDOW;
        BANDS.forEach(([, low, high], band) => {
          if (hz >= low && hz < high) energy[band] += (re[k] ** 2 + im[k] ** 2) / WINDOW ** 2;
        });
      }
      frames++;
    }
    const levels = Array.from(energy, (value) => db(value / Math.max(1, frames)));
    rows.push({
      bar,
      rms: db(squares / (to - from)),
      peak: db(peak * peak),
      bands: levels.map((level) => level - levels[0]),
      width: db(side / (mid + 1e-12)),
    });
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    option = (name, fallback) =>
      args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback,
    file = args.find((arg) => arg.endsWith('.wav'));
  if (!file || !option('--bpm', 0)) {
    console.error('Usage: node tools/analyze-wav.mjs preview.wav --bpm 127 [--start-bar 0]');
    process.exit(1);
  }
  const rows = analyzeBars(decodeWav(fs.readFileSync(file)), option('--bpm'));
  const cell = (value) => value.toFixed(1).padStart(7);
  console.log('   bar    rms   peak |    LM    HM    HI  (dB re LOW) |  side/mid');
  for (const row of rows)
    console.log(
      String(row.bar + option('--start-bar', 0)).padStart(6) +
        cell(row.rms) +
        cell(row.peak) +
        ' |' +
        row.bands.slice(1).map(cell).join('') +
        '  |' +
        cell(row.width),
    );
}
