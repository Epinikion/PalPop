import { createDrums } from './instruments/drums.js';
import { createSynths } from './instruments/synths.js';
import { createDance } from './instruments/dance.js';
import { createFestival } from './instruments/festival.js';
import { createTransitions } from './instruments/transitions.js';
import { createSupersaw } from './instruments/supersaw.js';
/** Shared voice interface used by arrangements and gameplay accents. */
export function createAudioInstruments(dependencies) {
  return {
    ...createDrums(dependencies),
    ...createSynths(dependencies),
    ...createDance(dependencies),
    ...createFestival(dependencies),
    ...createTransitions(dependencies),
    eSawPluck: createSupersaw(dependencies).eSawPluck,
  };
}
