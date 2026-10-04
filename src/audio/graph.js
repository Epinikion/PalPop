import { TRACKS } from './catalog.js';

/** Level at which voices enter the music bus; the master stage supplies the remaining makeup. */
const MUSIC_INPUT_GAIN = 0.55;
/** Side-channel boost for the synth bus. Only content above ~220 Hz widens; bass stays centred. */
const SYNTH_WIDTH = 1.2;

/**
 * Mid/side stereo widener. The side signal is high-passed first, so low-mid content and bass stay
 * centred and the result still folds down to the original mono sum.
 */
function createWidener(context, width) {
  const input = context.createGain(),
    split = context.createChannelSplitter(2),
    merge = context.createChannelMerger(2),
    mid = context.createGain(),
    sideLeft = context.createGain(),
    sideRight = context.createGain(),
    sideFilter = context.createBiquadFilter(),
    side = context.createGain(),
    sideInverse = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';
  mid.gain.value = 0.5;
  sideLeft.gain.value = 0.5;
  sideRight.gain.value = -0.5;
  sideFilter.type = 'highpass';
  sideFilter.frequency.value = 220;
  sideFilter.Q.value = 0.6;
  side.gain.value = width;
  sideInverse.gain.value = -1;
  input.connect(split);
  split.connect(mid, 0);
  split.connect(mid, 1);
  split.connect(sideLeft, 0);
  split.connect(sideRight, 1);
  sideLeft.connect(sideFilter);
  sideRight.connect(sideFilter);
  sideFilter.connect(side);
  mid.connect(merge, 0, 0);
  mid.connect(merge, 0, 1);
  side.connect(merge, 0, 0);
  side.connect(sideInverse);
  sideInverse.connect(merge, 0, 1);
  return {
    input,
    output: merge,
    nodes: [input, split, merge, mid, sideLeft, sideRight, sideFilter, side, sideInverse],
  };
}

export function createAudioGraph({ audio }) {
  /* ---------- graph ---------- */
  function buildMusicGraph() {
    // Dry tactile feedback bypasses the song's kick ducking and effect tails.
    audio.sfxG = audio.context.createGain();
    audio.sfxG.gain.value = 0;
    audio.sfxG.connect(audio.master);
    audio.musG = audio.context.createGain();
    audio.musG.gain.value = 0;
    audio.musG.connect(audio.master);
    audio.analyser = audio.context.createAnalyser();
    audio.analyser.fftSize = 256;
    audio.analyser.smoothingTimeConstant = 0.72;
    audio.musG.connect(audio.analyser);
    audio.frequencyData = new Uint8Array(audio.analyser.frequencyBinCount);
    audio.musIn = audio.context.createGain();
    audio.musIn.gain.value =
      MUSIC_INPUT_GAIN; /* one trim for dry + delay + reverb, keeps wet/dry ratios intact */
    const hp = audio.context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 28;
    hp.Q.value = 0.7;
    audio.bassShelf = audio.context.createBiquadFilter();
    audio.bassShelf.type = 'lowshelf';
    audio.bassShelf.frequency.value = 105;
    /* a touch of presence and air; the top octaves come from the voices themselves, not from EQ */
    const presence = audio.context.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3400;
    presence.Q.value = 0.6;
    presence.gain.value = 2;
    const air = audio.context.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 8500;
    air.gain.value = 1.5;
    const sat = audio.context.createWaveShaper(),
      curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25);
    }
    sat.curve = curve;
    sat.oversample = '2x';
    /* bus glue: slow attack keeps the kick's punch while the sustained layers sit together */
    const glue = audio.context.createDynamicsCompressor();
    glue.threshold.value = -17;
    glue.knee.value = 12;
    glue.ratio.value = 2.2;
    glue.attack.value = 0.02;
    glue.release.value = 0.16;
    const gLP = audio.context.createBiquadFilter();
    gLP.type = 'lowpass';
    gLP.frequency.value = 20000;
    gLP.Q.value = 0.5;
    const gG = audio.context.createGain();
    gG.gain.value = 1;
    audio.musIn.connect(hp);
    hp.connect(audio.bassShelf);
    audio.bassShelf.connect(presence);
    presence.connect(air);
    air.connect(sat);
    sat.connect(glue);
    glue.connect(gLP);
    gLP.connect(gG);
    gG.connect(audio.musG);
    /* ping-pong delay (dotted eighth), darker with every repeat */
    const dlIn = audio.context.createGain(),
      dA = audio.context.createDelay(2),
      dB = audio.context.createDelay(2),
      fA = audio.context.createGain(),
      fB = audio.context.createGain(),
      lpF = audio.context.createBiquadFilter();
    const pA = audio.context.createStereoPanner(),
      pB = audio.context.createStereoPanner(),
      dOut = audio.context.createGain();
    lpF.type = 'lowpass';
    lpF.frequency.value = 2800;
    fA.gain.value = 0.5;
    fB.gain.value = 0.5;
    pA.pan.value = -0.6;
    pB.pan.value = 0.6;
    dOut.gain.value = 0.7;
    dlIn.connect(dA);
    dA.connect(pA);
    pA.connect(dOut);
    dA.connect(fA);
    fA.connect(dB);
    dB.connect(pB);
    pB.connect(dOut);
    dB.connect(lpF);
    lpF.connect(fB);
    fB.connect(dA);
    dOut.connect(audio.musIn);
    /* plate reverb with a little pre-delay: bright early reflections that darken as the tail fades */
    const rvIn = audio.context.createGain(),
      pre = audio.context.createDelay(0.2),
      conv = audio.context.createConvolver(),
      rvOut = audio.context.createGain();
    const sr = audio.context.sampleRate,
      len = Math.floor(sr * 2.1),
      ir = audio.context.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        y += (Math.random() * 2 - 1 - y) * (0.8 - 0.68 * Math.sqrt(k));
        d[i] = y * Math.pow(1 - k, 2.6) * 2.2;
      }
    }
    pre.delayTime.value = 0.018;
    conv.buffer = ir;
    rvOut.gain.value = 0.5;
    rvIn.connect(pre);
    pre.connect(conv);
    conv.connect(rvOut);
    rvOut.connect(audio.musIn);
    audio.graph = {
      gLP,
      gG,
      dlIn,
      dA,
      dB,
      rvIn,
      song: null,
    };
  }
  /* every song gets fresh buses, so a restart never leaves the previous song's long pads / risers behind */
  function newSongBuses() {
    const now = audio.context.currentTime,
      old = audio.graph.song;
    if (old) {
      for (const g of [old.out, old.dl, old.rv]) {
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, 0.05);
      }
      setTimeout(() => {
        for (const node of [old.out, old.dl, old.rv, old.rumFB, old.rumD, ...old.extras]) {
          try {
            node.disconnect();
          } catch (e) {}
        }
      }, 1500);
    }
    const out = audio.context.createGain(),
      trim = audio.context.createGain(),
      sweep = audio.context.createBiquadFilter(),
      dry = audio.context.createGain(),
      drive = audio.context.createWaveShaper(),
      duck = audio.context.createGain(),
      melDuck = audio.context.createGain(),
      bass = audio.context.createGain(),
      mel = audio.context.createGain(),
      melLP = audio.context.createBiquadFilter(),
      acidSh = audio.context.createWaveShaper();
    const cv = new Float32Array(1024);
    for (let i = 0; i < cv.length; i++) {
      const x = (i * 2) / (cv.length - 1) - 1;
      cv[i] = Math.tanh(x * 3.2) * 0.8;
    }
    acidSh.curve = cv;
    /* kick bodies pass one shared soft clipper: harmonics keep the kick audible on small speakers */
    const kickCurve = new Float32Array(1024);
    for (let i = 0; i < kickCurve.length; i++) {
      const x = (i * 2) / (kickCurve.length - 1) - 1;
      kickCurve[i] = Math.tanh(x * 2.8) / Math.tanh(2.8);
    }
    drive.curve = kickCurve;
    drive.connect(dry);
    melLP.type = 'lowpass';
    melLP.frequency.value = 9500;
    melLP.Q.value = 0.4;
    /* per-song loudness trim keeps the soundtracks at a similar level */
    trim.gain.value = TRACKS[audio.trackId]?.trim ?? 1;
    /* DJ-style high-pass sweep for builds; parked far below the audible range otherwise */
    sweep.type = 'highpass';
    sweep.frequency.value = 10;
    sweep.Q.value = 0.8;
    const widener = createWidener(audio.context, SYNTH_WIDTH);
    /* rumble bus: kick feed into a lowpassed feedback delay - the classic rolling techno floor */
    const rum = audio.context.createGain(),
      rumLP = audio.context.createBiquadFilter(),
      rumD = audio.context.createDelay(1),
      rumFB = audio.context.createGain(),
      rumOut = audio.context.createGain();
    rumLP.type = 'lowpass';
    rumLP.frequency.value = 115;
    rumLP.Q.value = 1.2;
    rumFB.gain.value = 0.55;
    rumOut.gain.value = 0.5;
    rumD.delayTime.value = 0.11;
    rum.connect(rumLP);
    rumLP.connect(rumD);
    rumD.connect(rumFB);
    rumFB.connect(rum);
    rumLP.connect(rumOut);
    rumOut.connect(out);
    dry.connect(out);
    bass.connect(duck);
    mel.connect(melLP);
    acidSh.connect(mel);
    melLP.connect(widener.input);
    /* the bass bus takes the kick's full dip; the synths take the track's `pump` share of it */
    widener.output.connect(melDuck);
    melDuck.connect(out);
    duck.connect(out);
    out.connect(trim);
    trim.connect(sweep);
    sweep.connect(audio.musIn);
    const dl = audio.context.createGain(),
      rv = audio.context.createGain();
    dl.connect(audio.graph.dlIn);
    rv.connect(audio.graph.rvIn);
    audio.graph.song = {
      out,
      dry,
      drive,
      duck,
      melDuck,
      pump: TRACKS[audio.trackId]?.pump ?? 1,
      bass,
      mel,
      melLP,
      acidSh,
      rum,
      rumD,
      rumFB,
      dl,
      rv,
      sweep,
      extras: [trim, sweep, drive, melDuck, ...widener.nodes],
    };
  }
  function feed(node, dl, rv) {
    const sends = [];
    if (dl) {
      const g = audio.context.createGain();
      g.gain.value = dl;
      node.connect(g);
      g.connect(audio.graph.song.dl);
      sends.push(g);
    }
    if (rv) {
      const g = audio.context.createGain();
      g.gain.value = rv;
      node.connect(g);
      g.connect(audio.graph.song.rv);
      sends.push(g);
    }
    node._sends = (node._sends || []).concat(sends);
  }
  /* Disconnect the voice and its sends when its longest source ends. */

  function releaseVoice(source, outlet, extra = []) {
    audio.liveVoices++;
    source.onended = () => {
      audio.liveVoices--;
      source.disconnect();
      outlet.disconnect();
      for (const node of extra) {
        node.disconnect();
        for (const g of node._sends || []) g.disconnect();
      }
      for (const g of outlet._sends || []) g.disconnect();
    };
  }
  const nsrc = (t, dur, off) => {
    const s = audio.context.createBufferSource();
    s.buffer = audio.noiseBuf;
    s.loop = true;
    s.start(t, off || 0);
    s.stop(t + dur);
    return s;
  };

  /* ---------- voices ---------- */
  return { buildMusicGraph, nsrc, releaseVoice, feed, newSongBuses };
}
