import { createSet } from './set.js';
import { STYLES } from './styles.js';
import { between, pick, weighted } from './random.js';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * A session of one style: its tempo is fixed for the whole set, its first track's key and scale too.
 * A style with a recorded song opens with it, so the session starts in the song's key.
 */
export function composeGenSession(id, seed, tonal) {
  const style = STYLES[id],
    bpm = tonal?.bpm ?? between(style.bpm[0], style.bpm[1], seed, 'bpm'),
    pc = tonal?.pc ?? style.record?.pc ?? pick(style.keys, seed, 'key'),
    scale = tonal?.scale ?? style.record?.scale ?? weighted(style.scales, seed, 'scale');
  return {
    seed,
    style: id,
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: style.swing,
    voices:
      style.sound.hook === 'supersaw'
        ? 'euphoric'
        : style.sound.hook === 'pluck'
          ? 'melodic'
          : id === 'anthem'
            ? 'anthem'
            : 'rave',
    pc,
    scale,
    kname: NAMES[pc],
    mname: scale.toUpperCase(),
  };
}

/** Everything the arrangement and the rest of the audio code ask of the song, as pure functions of the bar. */
export function createTimeline(session) {
  const set = createSet(session);
  return {
    style: STYLES[session.style],
    sectionAt: set.sectionAt,
    chordAt: set.chordAt,
    plan: set.plan,
    layersAt: set.layersAt,
    track: set.track,
    locate: set.locate,
    secondsAt: set.secondsAt,
    stepAt: set.stepAt,
    size: set.size,
  };
}
