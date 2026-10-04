import { createHarmony } from './harmony.js';
import { createForm } from './form.js';
import { createLayers } from './layers.js';
import { PROFILES } from './profiles.js';
import { between, pick, weighted } from './random.js';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** The data of a song: tempo, key and scale are drawn once; everything else unfolds from them. */
export function composeGenSession(id, seed, tonal) {
  const profile = PROFILES[id],
    bpm = tonal?.bpm ?? between(profile.bpm[0], profile.bpm[1], seed, 'bpm'),
    pc = tonal?.pc ?? pick(profile.keys, seed, 'key'),
    scale = tonal?.scale ?? weighted(profile.scales, seed, 'scale');
  return {
    seed,
    style: id,
    bpm,
    spb: 60 / bpm,
    s16: 60 / bpm / 4,
    swing: profile.swing,
    voices: profile.sound.voices,
    pc,
    scale,
    kname: NAMES[pc],
    mname: scale.toUpperCase(),
  };
}

/** Everything the arrangement and the rest of the audio code ask of the song, as pure functions of the bar. */
export function createTimeline(session) {
  const profile = PROFILES[session.style],
    harmony = createHarmony(session, profile),
    form = createForm(session, profile),
    layers = createLayers(session, profile, harmony, form);
  return {
    profile,
    sectionAt: form.sectionAt,
    chordAt: harmony.chordAt,
    plan: layers.plan,
    layersAt: form.layersAt,
    size: () => harmony.size() + layers.size(),
  };
}
