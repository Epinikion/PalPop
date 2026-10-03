import { createSupersaw } from './supersaw.js';

/* [harmonic, weight, ring seconds]: low partials sustain, upper ones are a brief bright strike. */
const PIANO_PARTIALS = [
  [1, 1, 2.6],
  [2, 0.62, 1.7],
  [3, 0.42, 1.1],
  [4, 0.27, 0.7],
  [5, 0.17, 0.45],
  [6, 0.1, 0.3],
  [8, 0.05, 0.18],
];
/** Percussive piano plus broad, sustained saw voices for the festival arrangement. */
export function createFestival({ audio, audioGraph, audioMath }) {
  const { superSaw } = createSupersaw({ audio, audioGraph, audioMath });
  /** Struck piano: inharmonic partials with their own decays, a felt-and-hammer transient. */
  function eFestivalPiano(t, notes, d, v, color = 0.5, partials = notes.length > 1 ? 5 : 7) {
    const sources = [],
      extra = [],
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      position = audio.context.createStereoPanner();
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.value = 6200 + color * 2600;
    position.pan.value = -0.12;
    gain.gain.value = (v * 0.55) / Math.sqrt(notes.length);
    // Each partial stops when its own decay is inaudible; the longest one releases the whole voice.
    const tail = d + 1.1;
    let longest = null,
      longestEnd = 0;
    for (let i = 0; i < notes.length; i++) {
      const at = t + i * 0.006,
        f0 = audioMath.midi(notes[i]),
        // Lower strings are stiffer: their partials stretch a little further from the harmonics.
        stretch = 0.0003 + Math.max(0, 60 - notes[i]) * 0.00002;
      // Chords and accompaniment drop the faintest partials: they are masked, and each is an oscillator.
      for (const [harmonic, weight, ring] of PIANO_PARTIALS.slice(0, partials)) {
        const hz = f0 * harmonic * Math.sqrt(1 + stretch * harmonic * harmonic);
        if (hz > 11000) continue;
        const oscillator = audio.context.createOscillator(),
          partial = audio.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = hz;
        partial.gain.setValueAtTime(0.0001, at);
        partial.gain.exponentialRampToValueAtTime(
          weight * (harmonic === 1 ? 1 : 0.55 + color * 0.7),
          at + 0.003,
        );
        const end = at + Math.min(tail, ring + d * 0.35);
        partial.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(partial);
        partial.connect(filter);
        oscillator.start(at);
        oscillator.stop(end + 0.03);
        if (end > longestEnd) {
          longestEnd = end;
          longest = oscillator;
        }
        sources.push(oscillator);
        extra.push(partial);
      }
      const hammer = audioGraph.nsrc(at, 0.03, 0.4 + i * 0.07),
        hammerFilter = audio.context.createBiquadFilter(),
        hammerGain = audio.context.createGain();
      hammerFilter.type = 'bandpass';
      hammerFilter.frequency.value = 2200 + color * 2600;
      hammerFilter.Q.value = 0.6;
      hammerGain.gain.setValueAtTime(0.05 + color * 0.03, at);
      hammerGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
      hammer.connect(hammerFilter);
      hammerFilter.connect(hammerGain);
      hammerGain.connect(filter);
      extra.push(hammer, hammerFilter, hammerGain);
    }
    filter.connect(gain);
    gain.connect(position);
    position.connect(audio.graph.song.mel);
    audioGraph.feed(position, 0.09, 0.14);
    audioGraph.releaseVoice(
      longest,
      position,
      sources.filter((source) => source !== longest).concat(extra, filter, gain),
    );
    audio.stemFlash.synth = 0.2;
  }
  /** The hook: seven detuned saws, bright at the attack, answered by the dotted-eighth echo. */
  function eFestivalLead(t, note, d, v, color = 0.6) {
    superSaw(t, [note], d, v, {
      voices: 7,
      width: 0.7,
      hp: 190,
      cut: [5200 + color * 4600, 3000 + color * 2200],
      q: 0.9,
      sustain: 0.82,
      release: 0.16,
      pan: 0.04,
      delaySend: 0.17,
      reverbSend: 0.12,
    });
  }
  /** Chord layer under the hook; a long `d` gives the pumping, sidechained pad of the drop. */
  function eFestivalChord(t, notes, d, v, color = 0.6) {
    superSaw(t, notes, d, v, {
      voices: d > 1 ? 3 : 5,
      width: 0.85,
      hp: 210,
      cut: [3600 + color * 3200, 2200 + color * 1400],
      q: 0.7,
      attack: 0.008,
      sustain: 0.78,
      release: 0.2,
      pan: -0.04,
      delaySend: 0.04,
      reverbSend: 0.1,
    });
  }
  return { eFestivalPiano, eFestivalLead, eFestivalChord };
}
