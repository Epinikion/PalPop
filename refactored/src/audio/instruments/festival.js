/** Percussive piano and broad, sustained saw voices for the festival arrangement. */
export function createFestival({ audio, audioGraph, audioMath }) {
  function eFestivalPiano(t, notes, d, v, color = 0.5) {
    const sources = [],
      extra = [],
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      position = audio.context.createStereoPanner();
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.value = 3800 + color * 1400;
    position.pan.value = -0.18;
    gain.gain.value = v / Math.sqrt(notes.length);
    const tail = d + 0.22;
    for (let i = 0; i < notes.length; i++) {
      const at = t + i * 0.005;
      for (const [ratio, weight, decay] of [
        [1, 0.6, 0.45],
        [2.003, 0.28, 0.16],
        [3.01, 0.14, 0.075],
        [4.02, 0.07, 0.045],
      ]) {
        const oscillator = audio.context.createOscillator(),
          partial = audio.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = audioMath.midi(notes[i]) * ratio;
        partial.gain.setValueAtTime(0.0001, at);
        partial.gain.exponentialRampToValueAtTime(
          weight * (ratio === 1 ? 1 : 0.5 + color),
          at + 0.003,
        );
        partial.gain.exponentialRampToValueAtTime(0.0001, at + Math.min(tail, decay + d * 0.4));
        oscillator.connect(partial);
        partial.connect(filter);
        oscillator.start(at);
        // All sources end together; cleanup cannot cut off the last strummed note.
        oscillator.stop(t + tail + 0.04);
        sources.push(oscillator);
        extra.push(partial);
      }
      const hammer = audioGraph.nsrc(at, 0.024, 0.4 + i * 0.07),
        hammerFilter = audio.context.createBiquadFilter(),
        hammerGain = audio.context.createGain();
      hammerFilter.type = 'bandpass';
      hammerFilter.frequency.value = 1800 + color * 2400;
      hammerFilter.Q.value = 0.6;
      hammerGain.gain.setValueAtTime(0.025 + color * 0.018, at);
      hammerGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.018);
      hammer.connect(hammerFilter);
      hammerFilter.connect(hammerGain);
      hammerGain.connect(filter);
      extra.push(hammer, hammerFilter, hammerGain);
    }
    filter.connect(gain);
    gain.connect(position);
    position.connect(audio.graph.song.mel);
    audioGraph.feed(position, 0.055, 0.09);
    audioGraph.releaseVoice(sources[0], position, sources.slice(1).concat(extra, filter, gain));
    audio.stemFlash.synth = 0.2;
  }
  function festivalStack(t, notes, d, v, color, lead) {
    const sources = [],
      extra = [],
      highpass = audio.context.createBiquadFilter(),
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      position = audio.context.createStereoPanner(),
      detunes = lead ? [-16, -7, 0, 7, 16] : [-9, 9];
    highpass.type = 'highpass';
    highpass.frequency.value = lead ? 180 : 140;
    highpass.Q.value = 0.5;
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(2800 + color * 2800, t);
    // Keep harmonics through the note body; avoid a whistle-like, fundamental-only tail.
    filter.frequency.exponentialRampToValueAtTime(2300 + color * 1800, t + d);
    position.pan.value = lead ? 0.08 : -0.08;
    const level = v / (Math.sqrt(notes.length * detunes.length) * 1.2);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.008);
    gain.gain.setValueAtTime(level * 0.75, t + Math.max(0.012, d * 0.65));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.14);
    for (const note of notes)
      for (const detune of detunes) {
        const oscillator = audio.context.createOscillator(),
          spread = audio.context.createStereoPanner(),
          weight = audio.context.createGain();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = audioMath.midi(note);
        oscillator.detune.value = detune;
        spread.pan.value = (detune / (lead ? 16 : 9)) * 0.65;
        weight.gain.value = detune === 0 ? 1 : 0.8;
        oscillator.connect(weight);
        weight.connect(spread);
        spread.connect(highpass);
        oscillator.start(t);
        oscillator.stop(t + d + 0.18);
        sources.push(oscillator);
        extra.push(spread, weight);
      }
    highpass.connect(filter);
    filter.connect(gain);
    gain.connect(position);
    position.connect(audio.graph.song.mel);
    audioGraph.feed(position, 0.05, 0.065);
    audioGraph.releaseVoice(
      sources[0],
      position,
      sources.slice(1).concat(extra, highpass, filter, gain),
    );
    audio.stemFlash.synth = 0.22;
  }
  function eFestivalLead(t, note, d, v, color = 0.6) {
    festivalStack(t, [note], d, v, color, true);
  }
  function eFestivalChord(t, notes, d, v, color = 0.6) {
    festivalStack(t, notes, d, v, color, false);
  }
  return { eFestivalPiano, eFestivalLead, eFestivalChord };
}
