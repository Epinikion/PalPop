/** A dry electronic sound language for physical actions and earned rewards. */
export function createGameAudio({ audio, audioComposition, audioGraph, audioMath }) {
  const last = new Map(),
    pairs = new Map(),
    voices = [],
    counts = {};
  const cooldown = {
    drop: 0.08,
    swap: 0.08,
    impact: 0.1,
    shake: 0.5,
    goal: 0.7,
    discover: 0.7,
    fever: 1,
    danger: 0.68,
    over: 1,
    zap: 0.15,
    gold: 0.5,
    freeze: 0.5,
    start: 0.3,
  };
  let accepted = 0,
    rejected = 0,
    maxVoices = 0;
  function currentChord(t) {
    if (!audio.session) return { notes: [48, 51, 55], bass: 36 };
    return audioComposition.chordFor(audioComposition.barAt(t - audio.songStart));
  }
  function voice(t, n, end, duration, level, texture, pan) {
    const oscillator = audio.context.createOscillator(),
      overtone = audio.context.createOscillator(),
      harmonics = audio.context.createGain(),
      filter = audio.context.createBiquadFilter(),
      gain = audio.context.createGain(),
      position = audio.context.createStereoPanner();
    const f = audioMath.midi(n),
      target = audioMath.midi(end);
    oscillator.type = texture === 'reward' ? 'sawtooth' : 'sine';
    overtone.type = 'square';
    oscillator.frequency.setValueAtTime(f, t);
    oscillator.frequency.exponentialRampToValueAtTime(target, t + duration);
    overtone.frequency.setValueAtTime(f * 2, t);
    overtone.frequency.exponentialRampToValueAtTime(target * 2, t + duration);
    harmonics.gain.value = texture === 'reward' ? 0.08 : 0.22;
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(texture === 'reward' ? 2600 : 1800, t);
    filter.frequency.exponentialRampToValueAtTime(550, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(level * 0.3, t + duration * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    position.pan.value = pan;
    oscillator.connect(filter);
    overtone.connect(harmonics);
    harmonics.connect(filter);
    filter.connect(gain);
    gain.connect(position);
    position.connect(audio.sfxG);
    oscillator.start(t);
    overtone.start(t);
    oscillator.stop(t + duration + 0.025);
    overtone.stop(t + duration + 0.025);
    audioGraph.releaseVoice(oscillator, position, [overtone, harmonics, filter, gain]);
    voices.push(t + duration + 0.025);
    maxVoices = Math.max(maxVoices, voices.length);
  }
  function play(kind, detail = {}, at = audio.context?.currentTime) {
    if (kind !== 'merge' && !Object.hasOwn(cooldown, kind)) return false;
    if (
      !audio.context ||
      !audio.sfxG ||
      !audio.enabled ||
      audio.effectsVolume <= 0 ||
      !['running', 'suspended'].includes(audio.context.state) ||
      !Number.isFinite(at)
    )
      return false;
    // Offline renderers schedule an ordered timeline; live calls use currentTime.
    const now = at;
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i] <= now) voices.splice(i, 1);
    const tier = Math.min(10, Math.max(0, detail.tier || 0)),
      combo = Math.min(5, Math.max(1, detail.combo || 1)),
      pan = Math.max(-0.55, Math.min(0.55, ((detail.x ?? 60) - 60) / 100));
    if (kind === 'impact') {
      if (
        (detail.speed || 0) < 170 ||
        voices.length >= 5 ||
        now - (last.get('merge') ?? -Infinity) < 0.08
      )
        return false;
      if (detail.pair !== undefined) {
        if (now - (pairs.get(detail.pair) ?? -Infinity) < 0.3) return false;
        pairs.set(detail.pair, now);
        if (pairs.size > 24) pairs.delete(pairs.keys().next().value);
      }
    }
    const rewards = {
      start: { notes: [0, 2], times: [0, 0.07], duration: 0.1, level: 0.13 },
      goal: { notes: [0, 1, 2], times: [0, 0.065, 0.13], duration: 0.13, level: 0.16 },
      discover: { notes: [0, 2, 1], times: [0, 0.075, 0.15], duration: 0.14, level: 0.15 },
      fever: { notes: [0, 2], times: [0, 0.14], duration: 0.18, level: 0.18 },
      gold: { notes: [2, 1, 2], times: [0, 0.04, 0.12], duration: 0.09, level: 0.14 },
    };
    const reward = rewards[kind],
      required = reward ? reward.notes.length : 1,
      essential = ['drop', 'swap', 'over', 'start'].includes(kind),
      limit = kind === 'over' ? 10 : essential ? 9 : 7;
    if (
      now - (last.get(kind) ?? -Infinity) < (cooldown[kind] || 0) ||
      voices.length + required > limit ||
      (reward && kind !== 'start' && now - (last.get('reward') ?? -Infinity) < 0.25)
    ) {
      rejected++;
      return false;
    }
    last.set(kind, now);
    if (reward) last.set('reward', now);
    accepted++;
    counts[kind] = (counts[kind] || 0) + 1;
    const t = now + 0.005,
      chord = currentChord(t);
    if (kind === 'drop') voice(t, 59 - tier * 0.5, 42, 0.065, 0.19, 'pop', pan);
    else if (kind === 'swap') voice(t, 56, 63, 0.07, 0.13, 'pop', pan);
    else if (kind === 'impact')
      voice(t, 43 - tier * 0.4, 33, 0.085, Math.min(0.2, (detail.speed || 170) / 1800), 'pop', pan);
    else if (kind === 'merge') {
      // Bounded chord tones distinguish chains without climbing into a shrill register.
      const n = chord.notes[(combo - 1) % 3] + (tier >= 6 ? 0 : -12);
      voice(t, n + 7, n, 0.11 + tier * 0.005, 0.29 + combo * 0.018, 'pop', pan);
    } else if (reward) {
      for (let i = 0; i < required; i++) {
        const n = chord.notes[reward.notes[i]];
        voice(t + reward.times[i], n, n, reward.duration, reward.level, 'reward', (i - 1) * 0.22);
      }
    } else if (kind === 'danger') voice(t, 39, 36, 0.11, 0.13, 'pop', 0);
    else if (kind === 'over') voice(t, chord.notes[0], chord.notes[0] - 12, 0.32, 0.2, 'pop', 0);
    else if (kind === 'shake') voice(t, 52, 28, 0.23, 0.3, 'pop', pan);
    else if (kind === 'zap')
      voice(t, chord.notes[1] + 12, chord.notes[0], 0.14, 0.24, 'reward', pan);
    else if (kind === 'freeze')
      voice(t, chord.notes[2], chord.notes[2] - 7, 0.24, 0.16, 'reward', pan);
    return true;
  }
  function reset() {
    last.clear();
    pairs.clear();
  }
  return {
    play,
    reset,
    getStats: () => ({
      accepted,
      rejected,
      maxVoices,
      counts: { ...counts },
      pairCacheSize: pairs.size,
    }),
  };
}
