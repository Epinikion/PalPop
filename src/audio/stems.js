import { bassLine, synthLine } from './instruments/studio.js';

/** Sample rate of the rendered loops: synths need nothing above 16 kHz, and it keeps memory low. */
const RATE = 32000;
/** Seconds rendered past the loop's end, so the last notes can ring out into the next pass. */
const TAIL = 1.6;
/** The order loops are rendered in: what a track needs first comes first. */
const ORDER = ['bass', 'pad', 'arp', 'hookA', 'stab', 'hookB'];
/** Every loop is brought to this RMS level before the style's mix applies, so mixes stay predictable. */
const TARGET_RMS = 0.12;

/**
 * Renders each track's melodic loops (bass, hook, arpeggio, stabs, pads) once, through the studio
 * synths (`instruments/studio.js`), and hands them to the song as audio buffers. Rendering happens
 * in the background, ahead of time - a track opens with drums, so its loops are ready before they
 * are needed. Only a few tracks are held at a time.
 */
export function createStems() {
  const tracks = new Map();
  /** Why the last loop could not be rendered, if one could not (shown in the Sound sheet). */
  let failure = null;
  const keyOf = (session, track) => `${session.style}:${session.seed}:${track.index}`;

  async function render(session, track, stem) {
    const loop = track.loops[stem];
    if (!loop?.length || typeof globalThis.OfflineAudioContext !== 'function') return null;
    const s16 = session.s16,
      seconds = track.cycleBars * 16 * s16 + TAIL,
      mono = stem === 'bass',
      context = new globalThis.OfflineAudioContext(mono ? 1 : 2, Math.ceil(seconds * RATE), RATE),
      out = context.createGain(),
      sound = track.sound,
      notes = loop.map((n) => ({
        time: n.step * s16,
        dur: Math.max(0.03, n.len * s16 * (stem === 'pad' ? 1 : 0.92)),
        note: n.note,
        notes: n.notes,
        vel: n.vel,
      }));
    out.connect(context.destination);
    if (stem === 'bass') bassLine(context, out, notes, sound.bass, sound.bright);
    else {
      const patch = { pad: sound.pad, arp: sound.arp, stab: 'stab' }[stem] || sound.hook;
      synthLine(
        context,
        out,
        notes,
        patch,
        sound.bright,
        sound.detune,
        track.seed + ORDER.indexOf(stem),
      );
    }
    const buffer = await context.startRendering();
    normalise(buffer);
    return buffer;
  }

  /** Starts rendering a track's loops (once); resolves when all of them are ready. */
  function prepare(session, track) {
    const key = keyOf(session, track);
    if (!tracks.has(key)) {
      const entry = { buffers: {}, done: false };
      entry.pending = (async () => {
        for (const stem of ORDER) {
          try {
            entry.buffers[stem] = await render(session, track, stem);
          } catch (error) {
            entry.buffers[stem] = null;
            failure = String(error?.message || error);
          }
        }
        entry.done = true;
      })();
      tracks.set(key, entry);
      while (tracks.size > 3) tracks.delete(tracks.keys().next().value);
    }
    return tracks.get(key).pending;
  }
  /** A rendered loop, or null while it is not ready. */
  const get = (session, track, stem) => tracks.get(keyOf(session, track))?.buffers[stem] || null;
  return { prepare, get, size: () => tracks.size, failure: () => failure };
}

/** Scales a loop to the target RMS (measured where it sounds), never letting it peak above 0.95. */
function normalise(buffer) {
  let sum = 0,
    count = 0,
    peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > 1e-4) {
        sum += v * v;
        count++;
      }
      if (v > peak) peak = v;
    }
  }
  if (!count || !peak) return;
  const rms = Math.sqrt(sum / count),
    gain = Math.min(TARGET_RMS / rms, 0.95 / peak);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

/** One stem manager per audio state: every style's engine shares it. */
const managers = new WeakMap();
export function stemsFor(audio) {
  if (!managers.has(audio)) managers.set(audio, createStems());
  return managers.get(audio);
}
