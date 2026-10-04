import { composeGenSession, createTimeline } from './gen/timeline.js';
import { createAudioGen } from './gen/engine.js';
import { PROFILE_IDS } from './gen/profiles.js';

/**
 * One registry connects a style's composition, timeline and arrangement. Every song is generated
 * as it plays: the styles share one engine and differ only by their profile (see gen/profiles.js).
 */
export const SONG_STYLES = Object.freeze(
  Object.fromEntries(
    PROFILE_IDS.map((id) => [
      id,
      {
        compose: (seed, tonal) => composeGenSession(id, seed, tonal),
        createTimeline,
        createArrangement: (deps) => createAudioGen(deps, id).scheduleStep,
      },
    ]),
  ),
);
export function createArrangements(dependencies) {
  return Object.fromEntries(
    Object.entries(SONG_STYLES).map(([style, definition]) => [
      style,
      definition.createArrangement(dependencies),
    ]),
  );
}
