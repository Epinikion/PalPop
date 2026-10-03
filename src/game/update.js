import { RM } from '../core/dom.js';
import { FEVER_T, FL, FR, FT, H, LOSE_Y, PRISM, TIERS, W } from '../config.js';
import { clamp } from '../core/math.js';
export function createGameUpdate({
  audio,
  audioReactions,
  audioScheduler,
  game,
  gameActions,
  gameAnimation,
  gameEffects,
  gamePals,
  uiElements,
  uiInterface,
  uiMusicMeter,
}) {
  /* ================= update ================= */
  function update(dt) {
    if (audio.context && audio.analyser && audio.enabled)
      audio.analyser.getByteFrequencyData(audio.frequencyData);
    audio.hype = Math.max(0, audio.hype - dt * 0.2);
    for (const key in audio.stemFlash)
      audio.stemFlash[key] = Math.max(0, audio.stemFlash[key] - dt);
    audioReactions.musicReact(dt);
    audioScheduler.musicTick();
    uiMusicMeter.updateLiveMusic(dt);
    if (game.themeK < 1) game.themeK = Math.min(1, game.themeK + dt * 1.8);
    if (game.iris) {
      game.iris.k += dt / 0.2;
      if (game.iris.k >= 1) {
        if (game.iris.ph === 0) {
          game.iris.ph = 1;
          game.iris.k = 0;
          game.iris.cb && game.iris.cb();
        } else game.iris = null;
      }
    }
    if (game.paused) return;
    const pdt = game.freeze > 0 ? 0 : dt;
    if (game.freeze > 0) game.freeze -= dt;
    if (game.comboTime > 0) {
      game.comboTime -= dt;
      if (game.comboTime <= 0) game.comboCount = 0;
    }
    game.shakeMagnitude = Math.max(0, game.shakeMagnitude - dt * 24);
    game.flashOpacity = Math.max(0, game.flashOpacity - dt * 5);
    if (game.quakeTime > 0) {
      game.quakeTime -= dt;
      if (!RM)
        game.shakeMagnitude = Math.max(
          game.shakeMagnitude,
          2 + (9 * Math.max(0, game.quakeTime)) / 0.55,
        );
    }
    if (game.phase === 'title') {
      game.attractT -= dt;
      if (game.attractT <= 0 && game.bodies.length < 16) {
        game.attractT = 0.5;
        const t = Math.floor(Math.random() * 6),
          r = TIERS[t].r,
          nb = gamePals.mk(t, FL + r + 2 + Math.random() * (FR - FL - 2 * r - 4), 118);
        nb.s = 0.4;
        game.bodies.push(nb);
      }
      gameAnimation.stepBodies(pdt);
    } else if (game.phase === 'play') {
      gameAnimation.stepBodies(pdt * (game.iceTime > 0 ? 0.45 : 1));
      const target = clamp(game.aimX, FL + 8, FR - 8),
        nx = game.carrierX + (target - game.carrierX) * Math.min(1, dt * 30);
      game.carrierVelocity = (nx - game.carrierX) / Math.max(dt, 0.001);
      game.carrierX = nx;
      game.swing +=
        (clamp(-game.carrierVelocity * 0.05, -5, 5) - game.swing) * Math.min(1, dt * 10);
      if (game.dropCooldown > 0) {
        game.dropCooldown -= dt;
        if (game.dropCooldown <= 0) {
          game.held = gamePals.mkHeld(game.nextTier);
          game.nextTier = gamePals.pick();
          game.canSwap = true;
          uiInterface.drawNext();
        }
      }
      if (game.held) {
        const r = TIERS[game.held.t].r;
        game.held.x = clamp(game.carrierX, FL + r + 1, FR - r - 1);
        game.held.sv += (1 - game.held.s) * 340 * dt;
        game.held.sv *= Math.exp(-7 * dt);
        game.held.s += game.held.sv * dt;
        gameAnimation.tickPal(game.held, dt);
      }
      if (game.feverT > 0) {
        game.feverT -= dt;
        game.feverCharge = Math.max(0, game.feverT / FEVER_T);
        if (Math.random() < dt * 22) gameEffects.confetti(FL + Math.random() * (FR - FL), FT + 1);
        if (game.feverT <= 0) {
          game.feverT = 0;
          game.feverCharge = 0;
          audio.feverOn = false;
          gameEffects.popup(W / 2, 90, 'FEVER OVER', '#fff', 1, 0.9);
        }
      } else game.feverCharge = Math.max(0, game.feverCharge - dt * 0.012);
      if (game.goldTime > 0) {
        game.goldTime -= dt;
        if (Math.random() < dt * 14)
          game.parts.push({
            x: FL + Math.random() * (FR - FL),
            y: FT + Math.random() * 10,
            vx: 0,
            vy: 30,
            l: 0.8,
            c: '#ffd23f',
            g: 20,
            star: true,
            sz: 1,
          });
      }
      if (game.iceTime > 0) {
        game.iceTime -= dt;
        if (Math.random() < dt * 22)
          game.parts.push({
            x: FL + Math.random() * (FR - FL),
            y: FT,
            vx: (Math.random() - 0.5) * 10,
            vy: 18 + Math.random() * 12,
            l: 3,
            c: '#eaffff',
            g: 0,
            sz: 1,
          });
        if (game.iceTime <= 0) {
          game.iceTime = 0;
          gameEffects.popup(W / 2, 90, 'THAW', '#9fe2ff', 1, 0.9);
        }
      }
      game.danger = false;
      for (const b of game.bodies) {
        if (b.age > 1.1 && b.y - b.r < LOSE_Y) {
          b.ot += game.iceTime > 0 ? 0 : dt;
          game.danger = true;
          if (b.ot > 2.0) {
            gameActions.gameOver();
            break;
          }
        } else b.ot = Math.max(0, b.ot - dt * 2);
      }
      if (game.danger) {
        game.heartbeatTime -= dt;
        if (game.heartbeatTime <= 0) {
          game.heartbeatTime = 0.72;
          if (game.phase === 'play') audioReactions.reactToEvent('danger');
        }
      } else game.heartbeatTime = 0;
    } else if (game.phase === 'dying') {
      game.danger = false;
      game.dying.acc += dt;
      while (game.dying.acc >= game.dying.step && game.dying.i < game.dying.list.length) {
        game.dying.acc -= game.dying.step;
        const b = game.dying.list[game.dying.i++],
          rp = TIERS[b.t].ramp;
        b.dead = true;
        gameEffects.burst(b.x, b.y, [rp[2], rp[3], '#fff'], 8 + Math.min(b.t, 10) * 2, 70, 120);
        gameEffects.sparkles(b.x, b.y, 2, 50);
        gameEffects.ring(b.x, b.y, b.r + 3, rp[3]);
      }
      game.bodies = game.bodies.filter((b) => !b.dead);
      if (
        game.dying.i >= game.dying.list.length &&
        (!game.parts.length || game.dying.acc > 0.6) &&
        game.phase === 'dying'
      )
        gameActions.finishOver();
    }
    if (game.phase === 'play' || game.phase === 'title') {
      if (game.displayScore < game.score) {
        game.displayScore += Math.max(
          1,
          Math.ceil((game.score - game.displayScore) * Math.min(1, dt * 9)),
        );
        if (game.displayScore > game.score) game.displayScore = game.score;
      }
      const txt = String(game.displayScore);
      if (txt !== game.lastScoreText) {
        game.lastScoreText = txt;
        uiElements.scoreEl.textContent = txt;
        uiElements.bestEl.textContent = String(Math.max(game.bestBase, game.displayScore));
      }
    }
    for (const p of game.parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.l -= dt;
      if (p.conf) {
        p.vx *= 0.97;
        p.x += Math.sin(game.elapsed * 7 + p.ph) * 0.25;
      }
    }
    game.parts = game.parts.filter((p) => p.l > 0 && p.y < H + 4);
    for (const r of game.rings) {
      r.r += (r.rmax - r.r) * Math.min(1, dt * 10);
      r.l -= dt;
    }
    game.rings = game.rings.filter((r) => r.l > 0);
    for (const r of game.rays) r.l -= dt;
    game.rays = game.rays.filter((r) => r.l > 0);
    for (const bl of game.bolts) bl.l -= dt;
    game.bolts = game.bolts.filter((bl) => bl.l > 0);
    for (const p of game.popups) {
      p.y -= 14 * dt;
      p.l -= dt;
    }
    game.popups = game.popups.filter((p) => p.l > 0);
    if (game.banner) {
      game.banner.l -= dt;
      if (game.banner.l <= 0) game.banner = null;
    }
  }

  /* ================= render ================= */
  return { update };
}
