import { createAudioState } from '../../src/audio/state.js';
import { createAudioMath } from '../../src/audio/math.js';
import { createAudioComposition } from '../../src/audio/composition.js';
import { createArrangements } from '../../src/audio/song-registry.js';
import { TRACKS, TRACK_IDS } from '../../src/audio/catalog.js';

/** Runs one style's real arrangement against recording instruments and returns each bar's events. */
export function arrangement(style, seed = 42) {
  const audio = createAudioState();
  audio.trackId = TRACK_IDS.find((id) => TRACKS[id].style === style);
  audio.seed = seed;
  const comp = createAudioComposition({ audio });
  audio.session = comp.composeSession(seed);
  const events = [];
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} };
  audio.graph = {
    song: { duck: { gain: param }, melLP: { frequency: param }, rum: { gain: param } },
  };
  const instruments = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) =>
          events.push({ name, args }),
    },
  );
  const play = createArrangements({
    audio,
    game: { phase: 'play', goldTime: 0, comboCount: 0 },
    audioComposition: comp,
    audioInstruments: instruments,
    audioMath: createAudioMath(audio),
  })[style];
  return {
    audio,
    comp,
    bar(index) {
      events.length = 0;
      for (let step = 0; step < 16; step++)
        play(index * 16 + step, (index * 16 + step) * audio.session.s16);
      return events.slice();
    },
  };
}
