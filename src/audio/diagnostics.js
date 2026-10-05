import { stemsFor } from './stems.js';

/** The analyser hung on each node that is measured, made the first time it is asked for. */
const probes = new WeakMap();

/** The level of a node's signal right now, as text: dB of its RMS, SILENT, or NAN if it broke. */
export function levelOf(context, node) {
  if (!context || !node) return '-';
  if (!probes.has(node)) {
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    node.connect(analyser);
    probes.set(node, { analyser, data: new Float32Array(analyser.fftSize) });
  }
  const { analyser, data } = probes.get(node);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const x of data) {
    if (!Number.isFinite(x)) return 'NAN';
    sum += x * x;
  }
  const rms = Math.sqrt(sum / data.length);
  return rms > 1e-5 ? `${Math.round(20 * Math.log10(rms))} DB` : 'SILENT';
}

/**
 * One line about the music, for the Sound sheet: what a phone's audio is doing can only be seen
 * there. The context's rate and state; scheduler ticks per second since the last report; the
 * melodic loops started and missing; the level of the generated music (GEN, the music bus before
 * the game's filter), of the recorded song (SONG) and of all the music (OUT); and the last error.
 * `last` is the previous report's `{ ticks, at }`.
 */
export function audioReport(audio, last) {
  const context = audio.context;
  if (!context) return { text: 'AUDIO NOT STARTED', ticks: 0, at: 0 };
  const at = performance.now(),
    rate = last?.at ? Math.round(((audio.ticks - last.ticks) * 1000) / (at - last.at)) : '-',
    loops = audio.loops || { started: 0, missing: 0 },
    stemError = stemsFor(audio).failure(),
    parts = [
      `AUDIO ${context.sampleRate} HZ ${String(context.state).toUpperCase()}`,
      `TICKS ${rate}/S`,
      `STEP ${audio.step}`,
      `LOOPS ${loops.started} OK ${loops.missing} MISSING`,
      `GEN ${levelOf(context, audio.graph?.bus)}`,
      `SONG ${levelOf(context, audio.recordShelf)}`,
      `OUT ${levelOf(context, audio.musG)}`,
      audio.fault
        ? `ERROR AT STEP ${audio.fault.step}: ${audio.fault.message}`.toUpperCase()
        : 'NO ERRORS',
    ];
  if (stemError) parts.push(`LOOP ERROR: ${stemError}`.toUpperCase());
  return { text: parts.join(' / '), ticks: audio.ticks, at };
}
