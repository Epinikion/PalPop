import { DRUM_NAMES, renderDrum, KICK_HZ, kickTuning } from './kit-dsp.js';

/**
 * Plays the rendered drum kit. Each hit is one buffer source and one gain, which is far cheaper
 * than assembling a drum from oscillators and filters, and every hit picks one of several
 * variants (by a deterministic hash of its time), so repeats keep their natural variation.
 */
export function createKit({ audio, audioGraph, audioMath }) {
  const banks = new WeakMap();
  /** Turns rendered samples into audio buffers for this context. */
  function store(context, name, variants) {
    if (!banks.has(context)) banks.set(context, {});
    const buffers = banks.get(context);
    buffers[name] ??= variants.map((data) => {
      const buffer = context.createBuffer(1, data.length, context.sampleRate);
      buffer.getChannelData(0).set(data);
      return buffer;
    });
    return buffers[name];
  }
  /** A drum's buffers: ready from the worker, or rendered on the spot if a hit cannot wait. */
  function drum(name) {
    const context = audio.context;
    return banks.get(context)?.[name] || store(context, name, renderDrum(name, context.sampleRate));
  }
  /**
   * After the first hit the rest of the kit is built in the background: by a worker where there
   * is one, otherwise one drum per timer tick so no single beat has to wait for the whole kit.
   * Hits that arrive earlier render their drum on the spot.
   */
  const warming = new WeakSet();
  /** Starts a worker that renders the whole kit; false where workers are unavailable. */
  function render(context) {
    if (typeof Worker !== 'function') return false;
    try {
      const worker = new Worker(new URL('./kit-worker.js', import.meta.url), { type: 'module' });
      let left = DRUM_NAMES.length;
      worker.onmessage = ({ data: { name, variants } }) => {
        store(context, name, variants);
        if (--left === 0) worker.terminate();
      };
      worker.onerror = () => {
        worker.terminate();
        if (audio.context === context) warmOnTimers(context);
      };
      worker.postMessage({ sampleRate: context.sampleRate });
      return true;
    } catch {
      return false;
    }
  }
  function warm() {
    const context = audio.context;
    if (warming.has(context)) return;
    warming.add(context);
    if (!render(context)) warmOnTimers(context);
  }
  function warmOnTimers(context) {
    if (typeof setTimeout !== 'function') return;
    const pending = DRUM_NAMES.slice();
    const next = () => {
      const name = pending.shift();
      if (name === undefined || audio.context !== context) return;
      drum(name);
      setTimeout(next, 30);
    };
    setTimeout(next, 120);
  }
  /** One hit: a buffer through a gain (and a panner), with optional echo and reverb sends. */
  function hit(
    name,
    t,
    v,
    { pan = 0, rate = 1, variant, delaySend = 0, reverbSend = 0, rumble = 0, to = 'dry' } = {},
  ) {
    warm();
    const buffers = drum(name),
      index =
        variant ??
        Math.floor(audioMath.hashRand(Math.round(t * 1000), name.length) * buffers.length) %
          buffers.length,
      source = audio.context.createBufferSource(),
      gain = audio.context.createGain(),
      position = pan ? audio.context.createStereoPanner() : null,
      outlet = position || gain;
    source.buffer = buffers[index % buffers.length];
    source.playbackRate.value = rate;
    gain.gain.value = v;
    source.connect(gain);
    if (position) {
      position.pan.value = pan;
      gain.connect(position);
    }
    outlet.connect(audio.graph.song[to] || audio.graph.song.dry);
    const extras = position ? [gain] : [];
    if (rumble > 0 && audio.graph.song.rum) {
      // Techno's rumble bus is fed from the kick: a lowpassed, feeding-back echo of its body.
      const send = audio.context.createGain();
      send.gain.value = rumble;
      gain.connect(send);
      send.connect(audio.graph.song.rum);
      extras.push(send);
    }
    source.start(t);
    audioGraph.feed(outlet, delaySend, reverbSend);
    audioGraph.releaseVoice(source, outlet, extras);
  }
  /**
   * Kick, retuned to `hz` (the kit's kicks settle on 46 Hz) and ducking the bass bus fully and the synth
   * bus by the song's `pump` share.
   * `duck` is how deep the sidechain dips; `variant` picks thud (0), punch (1), long (2) or clean (3);
   * `rumble` feeds the kick into the rumble bus where the song has one.
   */
  function eKitKick(t, v, duck, hz = KICK_HZ, variant, rumble = 0) {
    hit('kick', t, v, { rate: hz / KICK_HZ, variant, rumble });
    if (duck > 0) {
      const song = audio.graph.song,
        d = song.duck.gain;
      // A 3 ms glide down instead of a jump: a step in the level of a held sound is heard as a click.
      d.setTargetAtTime(1 - duck, t, 0.0012);
      d.setTargetAtTime(1, t + 0.02, 0.075);
      if (song.melDuck) {
        const share = duck * (song.pump ?? 1);
        song.melDuck.gain.setTargetAtTime(1 - share, t, 0.0012);
        song.melDuck.gain.setTargetAtTime(1, t + 0.02, 0.075);
      }
      if (song.vocalDuck) {
        song.vocalDuck.gain.setTargetAtTime(1 - duck * 0.18, t, 0.0015);
        song.vocalDuck.gain.setTargetAtTime(1, t + 0.02, 0.09);
      }
    }
    audio.stemFlash.kick = 0.16;
  }
  const flash = () => (audio.stemFlash.drums = 0.14);
  return {
    kickTuning,
    eKitKick,
    /** Two takes a few milliseconds apart, panned either side of `pan`: a clap that fills the room. */
    eKitClap(t, v, pan = 0) {
      const take = Math.floor(audioMath.hashRand(Math.round(t * 1000), 4) * 3);
      hit('clap', t, v * 0.62, { pan: pan - 0.4, variant: take, reverbSend: 0.2, delaySend: 0.04 });
      hit('clap', t + 0.011, v * 0.55, { pan: pan + 0.4, variant: take + 1, reverbSend: 0.1 });
      flash();
    },
    eKitRim(t, v, pan = 0) {
      hit('rim', t, v, { pan, reverbSend: 0.1, delaySend: 0.06 });
      flash();
    },
    eKitHat(t, open, v, pan = 0, variant) {
      hit(open ? 'open' : 'hat', t, v, {
        pan,
        variant,
        reverbSend: open ? 0.06 : 0.015,
        delaySend: open ? 0.05 : 0,
      });
      flash();
    },
    eKitRide(t, v, pan = 0) {
      hit('ride', t, v, { pan, reverbSend: 0.08 });
      flash();
    },
    /** The long crash rings for over two seconds; the short one is a splash that is gone in one. */
    eKitCrash(t, v, long = true) {
      hit('crash', t, v, { variant: long ? 0 : 1, reverbSend: 0.2 });
      audio.stemFlash.drums = 0.3;
    },
    eKitTom(t, v, pitch = 1, pan = 0, rate = 1) {
      hit('tom', t, v, { variant: pitch, rate, pan, reverbSend: 0.14, delaySend: 0.1 });
      flash();
    },
    /** A tuned metallic hit at a MIDI note: the percussive melody of techno. */
    eKitPing(t, note, v, pan = 0) {
      const hz = audioMath.midi(note),
        variant = hz < 780 ? 0 : hz < 1100 ? 1 : 2;
      hit('ping', t, v, {
        variant,
        rate: hz / [640, 920, 1310][variant],
        pan,
        delaySend: 0.45,
        reverbSend: 0.18,
      });
    },
    eKitBlast(t, v, pan = 0) {
      hit('blast', t, v, { pan, reverbSend: 0.15, delaySend: 0.12 });
      flash();
    },
    eKitSnare(t, v, rate = 1) {
      hit('snare', t, v, { rate, reverbSend: 0.12 });
      flash();
    },
    eKitShaker(t, v, pan = 0) {
      hit('shaker', t, v, { pan });
    },
  };
}
