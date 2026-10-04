import { DRUM_NAMES, renderDrum } from './kit-dsp.js';

/**
 * Renders the drum kit off the main thread. Building the samples costs a second or more of CPU on
 * a weak phone, which would otherwise stall touches and the music's scheduler while the song starts.
 */
self.onmessage = ({ data: { sampleRate } }) => {
  for (const name of DRUM_NAMES) {
    const variants = renderDrum(name, sampleRate);
    self.postMessage(
      { name, variants },
      variants.map((samples) => samples.buffer),
    );
  }
};
