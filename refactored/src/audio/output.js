/** Shared by live playback and offline audition: music and effects use the same headroom. */
export function createAudioOutput(context) {
  const compressor = context.createDynamicsCompressor(),
    output = context.createGain(),
    limiter = context.createDynamicsCompressor(),
    master = context.createGain();
  compressor.threshold.value = -10;
  compressor.knee.value = 8;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.14;
  output.gain.value = 0.8;
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.09;
  master.gain.value = 0.84;
  master.connect(compressor);
  compressor.connect(output);
  output.connect(limiter);
  limiter.connect(context.destination);
  return master;
}
