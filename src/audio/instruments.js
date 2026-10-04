import { createDrums } from './instruments/drums.js';
import { createSynths } from './instruments/synths.js';
import { createTransitions } from './instruments/transitions.js';
import { createSupersaw } from './instruments/supersaw.js';
import { createKit } from './instruments/kit.js';
import { createGenVoices } from './instruments/gen.js';
/** Shared voice interface used by arrangements and gameplay accents. */
export function createAudioInstruments(dependencies) {
  // One kit serves every drum voice, so its buffers are rendered once per context.
  const kit = createKit(dependencies),
    shared = { ...dependencies, kit };
  return {
    ...createDrums(shared),
    ...createSynths(dependencies),
    ...createTransitions(shared),
    eSawPluck: createSupersaw(dependencies).eSawPluck,
    ...kit,
    ...createGenVoices(dependencies),
  };
}
