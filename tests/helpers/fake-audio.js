/** A recording stand-in for the Web Audio nodes the graph and voices use. */
export function fakeContext() {
  const nodes = [];
  const param = () => ({
    value: 0,
    calls: [],
    setValueAtTime(value, time) {
      this.calls.push(['set', value, time]);
    },
    linearRampToValueAtTime(value, time) {
      this.calls.push(['linear', value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      this.calls.push(['exp', value, time]);
    },
    setTargetAtTime(value, time, constant) {
      this.calls.push(['target', value, time, constant]);
    },
    cancelScheduledValues() {},
  });
  const make = (kind, params = []) => {
    const node = {
      kind,
      edges: [],
      connect(target) {
        this.edges.push(target);
        return target;
      },
      disconnect() {
        this.edges.length = 0;
      },
      start(time) {
        this.startTime = time;
      },
      stop(time) {
        this.endTime = time;
      },
    };
    for (const name of params) node[name] = param();
    nodes.push(node);
    return node;
  };
  const destination = { kind: 'destination', edges: [] };
  return {
    nodes,
    destination,
    sampleRate: 48000,
    currentTime: 0,
    createGain: () => make('gain', ['gain']),
    createBiquadFilter: () => make('biquad', ['frequency', 'Q', 'gain', 'detune']),
    createDynamicsCompressor: () =>
      make('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']),
    createWaveShaper: () => make('shaper'),
    createStereoPanner: () => make('panner', ['pan']),
    createDelay: () => make('delay', ['delayTime']),
    createConvolver: () => make('convolver'),
    createChannelSplitter: () => make('splitter'),
    createChannelMerger: () => make('merger'),
    createAnalyser: () => make('analyser'),
    createOscillator: () => {
      const node = make('oscillator', ['frequency', 'detune']);
      node.setPeriodicWave = (wave) => (node.wave = wave);
      return node;
    },
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBufferSource: () => make('buffer', ['playbackRate']),
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }),
  };
}
export function reaches(from, target, seen = new Set()) {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return from.edges.some((next) => reaches(next, target, seen));
}
