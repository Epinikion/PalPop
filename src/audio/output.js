/** Makeup gain that brings the music bus into the range where the dynamics stages do useful work. */
export const MASTER_GAIN = 0.72;

/** Dry gameplay feedback bypasses the music bus; this scales it against the music's makeup gain. */
export const SFX_GAIN = 1.7;

/** Shared by live playback and offline audition: music and effects use the same master chain. */
export function createAudioOutput(context) {
  const master = context.createGain(),
    compressor = context.createDynamicsCompressor(),
    clipper = context.createWaveShaper(),
    output = context.createGain(),
    limiter = context.createDynamicsCompressor();
  master.gain.value = MASTER_GAIN;
  // Gentle glue: a slow attack leaves kick and clap transients intact.
  compressor.threshold.value = -14;
  compressor.knee.value = 10;
  compressor.ratio.value = 2.4;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.16;
  // A soft clipper shaves the loudest transients before the limiter instead of letting it pump.
  const curve = new Float32Array(4096);
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = Math.tanh(x * 1.35) / Math.tanh(1.35);
  }
  clipper.curve = curve;
  clipper.oversample = '2x';
  output.gain.value = 0.82;
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.09;
  master.connect(compressor);
  compressor.connect(clipper);
  clipper.connect(output);
  output.connect(limiter);
  limiter.connect(context.destination);
  return master;
}
