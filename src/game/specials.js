import { GOLDIE, SCORE, TIERS, W, ZAPPY } from '../config.js';
/** Icy's frost: how far it reaches, the largest tier it shatters, and how many pals at most. */
const FROST_REACH = 40;
const FROST_TIER = 2;
const FROST_MAX = 5;
import { vib } from '../core/dom.js';
export function createGameSpecials({
  audioReactions,
  game,
  gameActions,
  gameEffects,
  gamePals,
  gameProgression,
  uiInterface,
}) {
  /* ================= special pals ================= */
  const SPT = {
    13: 0.9,
    14: 0.9,
    15: 0.9,
  };
  const curMult = () => 1 + (game.feverT > 0 ? 1 : 0) + (game.goldTime > 0 ? 2 : 0);
  function noteTier(nt) {
    gameProgression.misEvent('make', 0, nt);
    if (nt > game.highestTier) {
      game.highestTier = nt;
      uiInterface.drawLadder(true);
      gameActions.ascend();
    }
    if (!game.dex[nt]) gameActions.discover(nt);
  }
  function goldRush(b) {
    audioReactions.reactToEvent('gold', { x: b.x });
    b.dead = true;
    game.goldTime = 7;
    gameEffects.burst(b.x, b.y, ['#ffd23f', '#ffe66a', '#fff8c8', '#d99a00'], 40, 120, 60);
    gameEffects.sparkles(b.x, b.y, 16, 100);
    gameEffects.ring(b.x, b.y, 30, '#ffd23f');
    gameEffects.popup(W / 2, 82, 'GOLD RUSH!', '#ffd23f', 2, 1.4);
    gameEffects.popup(W / 2, 102, 'SCORE X3', '#fff', 1, 1.4);
    game.flashOpacity = Math.max(game.flashOpacity, 0.3);
    gameEffects.shake(3);
    vib([20, 20, 40]);
  }
  function zap(b) {
    audioReactions.reactToEvent('zap', { x: b.x });
    b.dead = true;
    const mult = curMult(),
      add = [];
    const tg = game.bodies
      .filter(
        (o) =>
          o !== b &&
          !o.dead &&
          !o.mg &&
          o.t <= Math.min(8, Math.max(2, game.highestTier - 2)) &&
          Math.hypot(o.x - b.x, o.y - b.y) < 75,
      )
      .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))
      .slice(0, 4);
    let pts = 0;
    for (const o of tg) {
      game.bolts.push({
        x0: b.x,
        y0: b.y,
        x1: o.x,
        y1: o.y,
        l: 0.3,
      });
      o.dead = true;
      const nb = gamePals.mk(o.t + 1, o.x, o.y - 1);
      nb.vx = o.vx;
      nb.vy = o.vy;
      nb.s = 0.4;
      nb.flash = 1;
      nb.age = 0.7;
      nb.ot = -1.5;
      add.push(nb);
      pts += SCORE[o.t + 1] * mult;
      const rp = TIERS[o.t + 1].ramp;
      gameEffects.burst(o.x, o.y, [rp[2], rp[3], '#fff36a', '#fff'], 14, 100, 60);
      gameEffects.ring(o.x, o.y, TIERS[o.t + 1].r + 5, '#fff36a');
    }
    for (const nb of add) {
      game.bodies.push(nb);
      noteTier(nb.t);
    }
    if (pts > 0) gameActions.addScore(pts);
    gameEffects.burst(b.x, b.y, ['#d2ff2a', '#fff36a', '#fff'], 26, 130, 50);
    gameEffects.ring(b.x, b.y, 22, '#d2ff2a');
    gameEffects.popup(
      b.x,
      b.y - 14,
      tg.length ? 'ZAP!' : 'FIZZLE',
      tg.length ? '#fff36a' : '#fff',
      2,
      1,
    );
    if (pts > 0) gameEffects.popup(b.x, b.y + 2, '+' + pts, '#fff', 1, 1);
    gameEffects.shake(tg.length ? 5 : 1);
    game.flashOpacity = Math.max(game.flashOpacity, 0.25);
    vib([25, 20, 40]);
  }
  /** The small pals around Icy (Blipp, Chirpy, Bunbun) shatter: they make room and pay points. */
  function shatter(b) {
    const mult = curMult(),
      near = game.bodies
        .filter(
          (o) =>
            o !== b &&
            !o.dead &&
            !o.mg &&
            o.t <= FROST_TIER &&
            Math.hypot(o.x - b.x, o.y - b.y) < FROST_REACH + o.r,
        )
        .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))
        .slice(0, FROST_MAX);
    let pts = 0;
    for (const o of near) {
      o.dead = true;
      pts += SCORE[o.t + 1] * mult;
      const rp = TIERS[o.t].ramp;
      gameEffects.burst(o.x, o.y, [rp[2], rp[3], '#d2f4ff', '#ffffff'], 12, 90, 70);
      gameEffects.ring(o.x, o.y, TIERS[o.t].r + 3, '#d2f4ff');
    }
    if (pts > 0) {
      gameActions.addScore(pts);
      gameEffects.popup(b.x, Math.max(16, b.y - 14), 'SHATTER +' + pts, '#d2f4ff', 1, 1);
    }
  }
  function freezeTime(b) {
    audioReactions.reactToEvent('freeze', { x: b.x });
    b.dead = true;
    shatter(b);
    game.iceTime = 7;
    for (const o of game.bodies) o.ot = 0;
    gameEffects.burst(b.x, b.y, ['#9fe2ff', '#d2f4ff', '#ffffff'], 36, 110, 40);
    gameEffects.sparkles(b.x, b.y, 14, 90);
    gameEffects.ring(b.x, b.y, 34, '#9fe2ff');
    gameEffects.ring(b.x, b.y, 20, '#fff');
    gameEffects.popup(W / 2, 82, 'FREEZE!', '#9fe2ff', 2, 1.4);
    gameEffects.popup(W / 2, 102, 'TIME SLOWS DOWN', '#fff', 1, 1.4);
    game.flashOpacity = Math.max(game.flashOpacity, 0.35);
    vib([20, 30, 20]);
  }
  function actSpecials() {
    const list = game.bodies.filter(
      (b) => b.t >= GOLDIE && !b.dead && !b.mg && !b.act && b.age >= SPT[b.t],
    );
    for (const b of list) {
      b.act = true;
      game.runStats.specials++;
      if (b.t === GOLDIE) goldRush(b);
      else if (b.t === ZAPPY) zap(b);
      else freezeTime(b);
    }
    if (list.length) game.bodies = game.bodies.filter((b) => !b.dead);
  }

  /* ================= missions & progression ================= */
  return { curMult, actSpecials };
}
