import { TRACKS } from './catalog.js';
import { SONG_STYLES } from './song-registry.js';

/**
 * What the rest of the audio code asks of the running song. Every song is a timeline (see
 * gen/timeline.js): the section, chord and layer plan of any bar are pure functions of the seed,
 * so nothing here has to remember the past.
 */
export function createAudioComposition({ audio }) {
  /** The timeline of the current session, built once per session. */
  const timelines = new WeakMap();
  function timelineOf() {
    const session = audio.session;
    if (!session) throw new Error('No song is playing');
    if (!timelines.has(session))
      timelines.set(session, SONG_STYLES[session.style].createTimeline(session));
    return timelines.get(session);
  }
  const planAt = (bar) => timelineOf().plan(Math.max(0, Math.floor(bar)));
  const sectionAt = (bar) => timelineOf().sectionAt(Math.max(0, Math.floor(bar)));
  const chordFor = (bar) => timelineOf().chordAt(Math.max(0, Math.floor(bar)));
  const LOOK = 0.24;
  function composeSession(seed, tonal) {
    return SONG_STYLES[tonal?.style || TRACKS[audio.trackId].style].compose(seed, tonal);
  }
  return { sectionAt, planAt, chordFor, LOOK, composeSession, timeline: timelineOf };
}
