import { clamp } from '../core/math.js';
import { sweepFor } from './sweep.js';
/** Dub-chord stabs sit behind the kick and bass; this lifts them to a record-like level. */
const STAB = 2.2;
/** Hats and shakers carry the top end of techno; keep them present against the kick. */
const HAT = 1.8;
const SHAKER = 1.6;
export function createAudioTechno({ audio, audioComposition, audioInstruments, audioMath, game }) {
  /* musical merge sound: a bass stab in the current key, snapped to the 32nd-note grid (see musicTick) */

  /* ---------- arrangement ---------- */
  function planFor(sec, bs, len = 8) {
    const L = {
      kick: 0,
      hat: 0,
      open: 0,
      clap: 0,
      bass: 0,
      acid: 0,
      arp: 0,
      stab: 0,
      lead: 0,
      perc: 0,
      shaker: 0,
      pad: 0.4,
      duck: 0,
      fill: 0,
      roll: 0,
      stop: 0,
    };
    switch (sec) {
      case 'INTRO':
        L.kick = 1;
        L.hat = 1;
        L.open = bs >= 2 ? 1 : 0;
        L.bass = bs >= 2 ? 'roll' : 'sub';
        L.perc = bs >= 4 ? 1 : 0;
        L.pad = 0.25;
        L.duck = 0.5;
        L.arp = bs >= 6 ? 0.3 : 0;
        break;
      case 'GROOVE':
        Object.assign(L, {
          kick: 1,
          hat: 2,
          open: 1,
          clap: bs >= 1 ? 1 : 0,
          bass: 'roll',
          perc: bs >= 2 ? 1 : 0,
          shaker: bs >= 4 ? 1 : 0,
          acid: bs >= 12 ? 0.6 : bs >= 8 ? 0.3 : 0,
          stab: bs % 4 === 3 ? 1 : 0,
          pad: 0.24,
          duck: 0.55,
          fill: bs % 8 === 7 ? 1 : 0,
        });
        break;
      case 'BUILD':
        Object.assign(L, {
          kick: 1,
          hat: 2,
          open: 1,
          clap: bs < len - 3 ? 1 : 0,
          bass: 'roll',
          perc: 1,
          shaker: 1,
          acid: 0.75,
          arp: bs >= 2 ? 0.55 : 0,
          pad: 0.3,
          duck: 0.6,
          roll: bs >= len - 4 ? bs - (len - 4) + 1 : 0,
          stop: bs === len - 1 ? 1 : 0,
        });
        break;
      case 'PEAK':
        Object.assign(L, {
          kick: 1,
          hat: 2,
          open: 1,
          clap: 1,
          bass: 'roll',
          perc: 1,
          shaker: 1,
          acid: 0.9,
          arp: 0.4,
          stab: 1,
          lead: bs >= 2 && bs % 4 < 3 ? 1 : 0,
          pad: 0.2,
          duck: 0.78,
          fill: bs % 8 === 7 ? 1 : 0,
        });
        break;
      case 'BREAK':
        Object.assign(L, {
          hat: bs >= len - 4 ? 1 : 0,
          bass: 'sub',
          arp: 0.7,
          lead: bs >= 2 ? 1 : 0,
          pad: 0.65,
          roll: bs === len - 1 ? 5 : 0,
        });
        break;
      default:
        Object.assign(L, {
          kick: 1,
          hat: 2,
          open: 1,
          clap: 1,
          bass: 'roll',
          perc: 1,
          shaker: 1,
          acid: 0.95,
          arp: 0.5,
          stab: 1,
          lead: bs % 4 < 3 ? 1 : 0,
          pad: 0.24,
          duck: 0.82,
          fill: bs % 2 === 1 ? 1 : 0,
        });
    }
    if (audio.feverOn || game.goldTime > 0) {
      L.kick = 1;
      L.hat = Math.max(L.hat, 2);
      L.open = 1;
      L.clap = 1;
      L.bass = L.bass || 'roll';
      L.acid = Math.max(L.acid, 0.8);
      L.stab = 1;
      L.perc = 1;
      L.shaker = 1;
      L.duck = Math.max(L.duck, 0.7);
    }
    /* merge hype: the track lifts for a few seconds after every merge */
    if (audio.hype > 0) {
      L.acid = Math.max(L.acid, 0.4 + 0.6 * audio.hype);
      L.stab = 1;
      L.shaker = 1;
      L.perc = 1;
      L.open = 1;
      L.duck = Math.max(L.duck, 0.45 + 0.35 * audio.hype);
      if (audio.hype > 0.45) L.hat = Math.max(L.hat, 2);
      if (audio.hype > 0.7) L.kick = 1;
    }
    if (audio.dangerActive) {
      L.acid = 0;
      L.arp = 0;
      L.lead = 0;
      L.stab = 0;
      L.perc = 0;
      L.shaker = 0;
    }
    return L;
  }
  const hat = (t, open, v, pan, off) => audioInstruments.eHat(t, open, v * HAT, pan, off);
  const shaker = (t, v, pan, off) => audioInstruments.eShaker(t, v * SHAKER, pan, off);
  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16),
      si = step % 16;
    const SA = audioComposition.sectionAt(bar),
      sec = SA.sec,
      bs = SA.bs,
      cyc = SA.cyc;
    const S = audioComposition.chapterFor(cyc);
    const ph = Math.floor(bar / 8); /* 8-bar phrase index */
    const vr = (salt) =>
      audioMath.hashRand(
        ph * 131 + cyc * 91171 + salt * 7717,
      ); /* phrase-level variation, pure per (seed,step) */
    const ch = audioComposition.chordFor(bar, sec, cyc),
      r = audioMath.hashRand(step, cyc * 13 + 7);
    const L = planFor(sec, bs, SA.len),
      s16 = S.s16,
      ts = t + (si & 1 ? s16 * S.swing : 0),
      pan = (si % 4 < 2 ? -1 : 1) * 0.22;
    /* Let a phrase feature acid, dub chords or melody, with space between voices. */
    const focus = Math.floor(audioMath.hashRand(cyc, 81) * 3);
    if (sec === 'GROOVE' || sec === 'PEAK' || sec === 'FINAL') {
      if (focus === 0) {
        L.lead = 0;
        L.arp *= 0.35;
        L.stab = bs % 4 === 3 ? L.stab : 0;
      } else if (focus === 1) {
        L.acid *= 0.35;
        L.lead = 0;
        L.arp *= 0.5;
        L.stab = 1;
      } else {
        L.acid *= 0.4;
        L.stab = bs % 4 === 3 ? L.stab : 0;
      }
      if (bs % 8 === 6) {
        L.shaker = 0;
        L.perc = 0;
      } /* breath before the fill */
    }
    audio.bar = bar;
    audio.section = sec;
    // DJ-style filter move on the whole mix: opens through the intro, closes up through builds.
    if (si % 4 === 0 && !(L.stop && si >= 8))
      audioInstruments.eSweep(t, sweepFor(sec, Math.min(1, (bs + si / 16) / Math.max(1, SA.len))));
    if (L.stop && si >= 8) {
      L.kick = L.bass = L.acid = L.hat = L.open = L.perc = L.shaker = L.clap = L.stab = 0;
    }
    /* structure: risers, impacts, crashes, phrase sweeps */
    if (si === 0) {
      if (sec === 'BUILD' && bs === 0) audioInstruments.eRiser(t, SA.len * 16 * s16 - 0.05, 0.13);
      if (sec === 'BREAK' && bs === SA.len - 2)
        audioInstruments.eRiser(t, 2 * 16 * s16 - 0.05, 0.1);
      if (sec === 'GROOVE' && bs === 0) audioInstruments.eCrash(t, 0.09, false);
      if ((sec === 'PEAK' || sec === 'FINAL') && bs === 0) {
        audioInstruments.eImpact(t, 0.7);
        audioInstruments.eCrash(t, 0.13, true);
      }
      if (sec === 'BREAK' && bs === 0) audioInstruments.eCrash(t, 0.07, true);
      if (bs === 4 && (sec === 'PEAK' || sec === 'FINAL') && vr(14) < 0.5)
        audioInstruments.eRiser(t, 4 * 16 * s16 - 0.05, 0.055);
    }
    /* drums */
    const rumble = sec === 'PEAK' || sec === 'FINAL' ? 0.5 : sec === 'GROOVE' && bs >= 8 ? 0.28 : 0;
    const kickNow = L.kick && si % 4 === 0;
    const kickHz = audioInstruments.kickTuning(S.pc);
    if (kickNow) audioInstruments.eKick(t, 0.68, L.duck, rumble, kickHz, 2);
    else if (
      L.kick &&
      (sec === 'PEAK' || sec === 'FINAL') &&
      bs % 4 === 3 &&
      si === 14 &&
      vr(1) < 0.55
    )
      audioInstruments.eKick(t, 0.55, L.duck, rumble * 0.6, kickHz, 1);
    if (sec === 'BREAK' && bs === SA.len - 1 && si >= 8 && si % 2 === 0)
      audioInstruments.eKick(t, 0.8, 0, 0, kickHz, 1);
    if (L.hat === 1 && si % 4 === 2) hat(ts, false, 0.05 * (0.85 + 0.3 * r), pan, r * 0.6);
    if (L.hat === 2 && si % 2 === 1 && (sec !== 'GROOVE' || r > 0.1))
      hat(ts, false, (si % 4 === 3 ? 0.06 : 0.045) * (0.85 + 0.3 * r), pan, r * 0.6);
    if (L.hat === 2 && bs % 8 === 7 && si >= 12 && vr(2) < 0.55)
      hat(ts, false, 0.03 + (si - 12) * 0.009, pan, r);
    if (audio.hype > 0.55 && L.hat === 2 && si % 4 === 0 && si > 0)
      hat(ts + s16 / 2, false, 0.028, pan, r);
    if (audio.hype > 0.5 && sec === 'GROOVE' && si % 4 === 2) audioInstruments.eRide(ts, 0.03, pan);
    if (L.open && si % 4 === 2) hat(ts, true, 0.075, -pan, (1 - r) * 0.5);
    if (L.open && si === 14 && bs % 8 === 3 && vr(3) < 0.35) hat(ts, true, 0.05, -pan, r * 0.5);
    if ((sec === 'FINAL' || (sec === 'PEAK' && vr(4) < 0.4)) && L.hat && si % 4 === 2)
      audioInstruments.eRide(ts, 0.045, pan);
    if (L.clap && (si === 4 || si === 12)) audioInstruments.eClap(t, 0.13);
    else if (L.clap && (sec === 'PEAK' || sec === 'FINAL') && si === 15 && vr(5) < 0.35)
      audioInstruments.eSnare(ts, 0.05, 1.25);
    if (L.shaker && si % 2 === 0) shaker(t, si % 4 === 0 ? 0.02 : 0.032, -pan, r * 0.7);
    if (L.perc) {
      const pp = S.percBank[(ph + cyc) % S.percBank.length];
      if (pp[si] && audioMath.hashRand(bar * 16 + si + 999, cyc * 5) < 0.85)
        audioInstruments.ePerc(ts, pp[si], 0.07, pan, ch.notes[0]);
    }
    /* snare roll / fills - fill bars vary per phrase instead of every 8th bar */
    if (L.roll) {
      const lv = L.roll,
        div = lv === 1 ? 4 : lv === 2 ? 2 : lv <= 4 ? 1 : si < 8 ? 2 : 1,
        v = 0.05 + (0.04 * Math.min(lv, 4)) / 4 + (si / 16) * 0.03;
      if (si % div === 0) audioInstruments.eSnare(t, v, 1 + (Math.min(lv, 4) + si / 16) * 0.07);
      if (lv === 4 && si >= 8) audioInstruments.eSnare(t + s16 / 2, v * 0.8, 1.35);
    }
    if (
      (L.fill || ((sec === 'PEAK' || sec === 'GROOVE') && bs % 4 === 3 && vr(6) < 0.3)) &&
      si >= 12
    ) {
      if (si === 12) audioInstruments.eTom(t, 230, 0.32);
      if (si === 13) audioInstruments.eSnare(t, 0.06, 1);
      if (si === 14) audioInstruments.eTom(t, 170, 0.32);
      if (si === 15) audioInstruments.eTom(t, 125, 0.36);
    }
    if (sec === 'FINAL' && bs === SA.len - 1 && si >= 8) {
      if (si % 2 === 0) audioInstruments.eSnare(t, 0.05 + si * 0.003, 1 + si * 0.02);
      if (si === 12) audioInstruments.eTom(t, 200, 0.34);
      if (si === 14) audioInstruments.eTom(t, 150, 0.34);
      if (si === 15) {
        audioInstruments.eCrash(t, 0.08, true);
      }
    }
    if ((sec === 'PEAK' || sec === 'FINAL') && si === 6 && vr(15) < 0.22)
      audioInstruments.eZap(t + s16 * 2, 0.04);
    /* bass */
    if (L.bass === 'sub') {
      if (si === 0)
        audioInstruments.eBass(
          t,
          ch.bass,
          16 * s16 * 0.96,
          false,
          sec === 'BREAK' ? 0.11 : 0.15,
          true,
        );
    } else if (
      L.bass === 'roll' &&
      !((sec === 'PEAK' || sec === 'FINAL') && bs % 8 === 7 && si >= 12)
    ) {
      const bo = S.bassBank[(ph + cyc * 2) % S.bassBank.length];
      const grooveSkip = sec === 'GROOVE' && si % 4 === 1 && vr(8) < 0.6;
      if (si % 4 !== 0 && !grooveSkip && S.bassGate[(ph + cyc) % 3][si]) {
        const n =
          ch.bass +
          bo[si] +
          (si === 15 && bs % 4 === 3 ? 7 : 0) +
          (audio.hype > 0.6 && si % 8 === 6 ? 12 : 0);
        audioInstruments.eBass(
          ts,
          n,
          s16 * (si % 4 === 2 ? 0.95 : 0.72),
          si % 4 === 2,
          0.24,
          false,
        );
      }
    }
    /* acid line: pattern bank rotates per phrase, dense variant in peaks, steps mutate as cycles pass */
    if (L.acid > 0) {
      let ap = S.acidBank[(ph + cyc) % 3];
      if (sec === 'PEAK' || sec === 'FINAL') ap = bs % 8 >= 4 || vr(9) < 0.45 ? S.acidBank[3] : ap;
      else if (sec === 'BREAK') ap = S.acidBank[(cyc + 1) % 3];
      const a = ap[si],
        mut = audioMath.hashRand(si * 131 + ph * 17, cyc * 977 + 5);
      const mrate = Math.min(0.2, 0.05 + 0.03 * cyc);
      const on = mut < mrate ? !a.on : a.on;
      const pool = [
        ch.notes[0] - 12,
        ch.notes[0] - 12,
        ch.notes[1] - 12,
        ch.notes[2] - 12,
        ch.notes[3] - 12,
        ch.notes[0],
        ch.notes[2],
      ];
      let ix = a.idx;
      if (mut > 0.94) ix = (ix + 1 + (Math.floor(mut * 100) % 6)) % pool.length;
      if (on && audioMath.hashRand(step * 7 + 3, cyc * 31) < 0.25 + L.acid * 0.75) {
        const prev = ap[(si + 15) % 16];
        const sweep = 0.5 + 0.5 * Math.sin((step / (16 * 12)) * Math.PI * 2 + cyc * 1.7);
        const cut =
          (300 + 2100 * (0.25 + 0.75 * sweep)) * (0.6 + 0.4 * L.acid) * (1 + audio.hype * 0.7);
        audioInstruments.eAcid(
          ts,
          pool[ix],
          s16 * (a.sl ? 1.25 : 0.8),
          a.acc || mut < 0.02,
          a.sl && prev.on ? pool[prev.idx] : 0,
          cut,
          0.075,
        );
      }
    }
    /* pad */
    if (si === 0 && L.pad > 0)
      audioInstruments.ePad(
        t,
        ch.notes,
        16 * s16,
        L.pad * 0.075,
        sec === 'BREAK' || sec === 'PEAK' || sec === 'BUILD',
      );
    /* arp */
    if (L.arp && (si % 2 === 0 || sec === 'BREAK' || (sec === 'BUILD' && bs >= 5))) {
      const arp = S.arps[(ph + cyc) % S.arps.length];
      const pool = [
        ch.notes[0],
        ch.notes[1],
        ch.notes[2],
        ch.notes[3],
        ch.notes[0] + 12,
        ch.notes[1] + 12,
        ch.notes[2] + 12,
      ];
      audioInstruments.ePluck(
        ts,
        pool[arp[si % 8]] + 12 + (vr(10) < 0.25 ? 12 : 0),
        0.05 * L.arp * (si % 4 === 0 ? 1.15 : 0.9),
        (si % 4 < 2 ? -1 : 1) * 0.35,
        0.17,
      );
    }
    /* chord stabs: rhythm bank rotates per phrase */
    if (L.stab && S.stabs[(ph + cyc) % S.stabs.length][si] === 'x')
      audioInstruments.eStab(
        ts,
        ch.notes.slice(1),
        (sec === 'GROOVE' ? 0.05 : 0.06) * STAB,
        sec !== 'GROOVE',
      );
    else if (audio.hype > 0.15 && sec !== 'BREAK' && si === 10 && r < audio.hype)
      audioInstruments.eStab(ts, ch.notes.slice(1), 0.06 * STAB, true);
    /* lead motif bank: rotates per phrase, mutates with cycles, octave lift in FINAL */
    if (L.lead) {
      const mset = S.motifs[(Math.floor(ph / 2) + cyc) % S.motifs.length];
      const pos = (bar % 2) * 16 + si,
        m = mset.find((e) => e.st === pos);
      if (m) {
        const d =
          audioMath.hashRand(ph * 97 + m.st, cyc * 7) < 0.22
            ? audioMath.hashRand(ph * 31 + m.st, cyc * 3) < 0.5
              ? -1
              : 1
            : 0;
        const oct = (sec === 'FINAL' && vr(11) < 0.4) || audio.hype > 0.8 ? 12 : 0;
        audioInstruments.eLead(
          ts,
          audioComposition.pentNote(clamp(m.idx + d, 0, 9)) + oct,
          m.len * s16 * 0.9,
          0.085,
        );
      }
    }
    /* generative pentatonic answer-run at the end of peak phrases - never the same twice */
    if (
      (sec === 'PEAK' || sec === 'FINAL') &&
      bs % 4 === 3 &&
      si >= 8 &&
      si % 2 === 0 &&
      vr(12) < 0.55
    ) {
      let ix = 2 + Math.floor(vr(13) * 6);
      for (let k = 8; k <= si; k += 2)
        ix = clamp(
          ix +
            (audioMath.hashRand(k * 7 + ph * 3, cyc * 13 + 1) < 0.5 ? -1 : 1) *
              (1 + Math.floor(audioMath.hashRand(k * 3 + ph, cyc * 17) * 2)),
          0,
          9,
        );
      audioInstruments.ePluck(
        ts,
        audioComposition.pentNote(ix) + (vr(16) < 0.3 ? 12 : 0),
        0.05,
        (si % 4 < 2 ? -1 : 1) * 0.4,
        0.14,
      );
    }
  }

  /* ---------- scheduler ---------- */
  return { scheduleStep };
}
