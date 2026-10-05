import { composeGenSession, createTimeline } from './gen/timeline.js';
import { createAudioGen } from './gen/engine.js';
import { STYLE_IDS } from './gen/styles.js';

/**
 * One registry connects a style's composition, timeline and arrangement. Every song is generated
 * as it plays: the styles share one engine and differ only by their data (see gen/styles.js).
 */
export const SONG_STYLES = Object.freeze(
  Object.fromEntries(
    STYLE_IDS.map((id) => [
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
