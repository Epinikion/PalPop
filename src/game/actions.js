import { GAMEPLAY } from '../settings.js';
import { $, RM, vib } from '../core/dom.js';
import {
  CH_MAX,
  FEVER_T,
  FL,
  FLOOR,
  FR,
  FT,
  G,
  MAXT,
  PRISM,
  SCORE,
  SPAWN_Y,
  SPECIALS,
  TIERS,
  W,
  need,
  rank,
} from '../config.js';
import { store } from '../core/storage.js';
import { clamp, fmt } from '../core/math.js';
import { TRACKS } from '../audio/catalog.js';
export function createGameActions({
  audio,
  audioReactions,
  audioRuntime,
  game,
  gameEffects,
  gamePals,
  gameProgression,
  gameSpecials,
  renderSprites,
  uiElements,
  uiInterface,
}) {
  /* ================= game flow ================= */
  function addScore(p) {
    game.score += p;
    gameEffects.bumpEl(uiElements.scoreEl);
    if (game.score > game.best) game.best = game.score;
    gameProgression.misEvent('score', game.score);
  }
  function updShake() {
    const b = $('#shakeBtn'),
      ready = game.charge >= CH_MAX;
    b.classList.toggle('ready', ready);
    $('#shakeFill').style.width = (game.charge / CH_MAX) * 100 + '%';
    $('#shakeTxt').textContent = ready ? 'SHAKE NOW!' : 'SHAKE';
  }
  function irisTo(cb) {
    if (game.iris) return;
    if (RM) {
      cb();
      return;
    }
    game.iris = {
      k: 0,
      ph: 0,
      cb,
    };
  }
  function newGame() {
    audioRuntime.initAudio();
    audioReactions.resetLiveMusic();
    game.bodies = [];
    game.parts = [];
    game.popups = [];
    game.rings = [];
    game.rays = [];
    game.banner = null;
    game.dying = null;
    game.merging = [];
    game.physicsAccumulator = 0;
    game.score = 0;
    game.displayScore = 0;
    game.lastScoreText = '';
    game.newBest = false;
    game.comboCount = 0;
    game.comboTime = 0;
    game.charge = 0;
    game.dropCooldown = 0;
    game.canSwap = true;
    game.pickCount = 0;
    game.merges = 0;
    game.drops = 0;
    game.highestTier = 0;
    game.pace = 1;
    game.freeze = 0;
    game.flashOpacity = 0;
    game.quakeTime = 0;
    game.dropXs = [];
    game.repeatDropMultiplier = 1;
    game.spamWarn = 0;
    game.goldTime = 0;
    game.iceTime = 0;
    game.bolts = [];
    game.feverCharge = 0;
    game.feverT = 0;
    audio.feverOn = false;
    game.missionIndex = 0;
    game.missionsDone = 0;
    game.discoveries = 0;
    game.heartbeatTime = 0;
    game.bestBase = store.get('best', 0);
    game.best = game.bestBase;
    game.didDrop = game.didMerge = game.didSwap = false;
    game.danger = false;
    uiElements.scoreEl.textContent = '0';
    uiElements.bestEl.textContent = fmt(game.bestBase);
    updShake();
    game.phase = 'play';
    audioReactions.reactToEvent('start');
    game.held = gamePals.mkHeld(gamePals.pick());
    game.nextTier = gamePals.pick();
    game.mission = gameProgression.genMission(0);
    gameProgression.setGoal();
    $('#title').hidden = true;
    $('#over').hidden = true;
    $('#goUp').hidden = true;
    $('#goUnlock').hidden = true;
    $('#nextBtn').classList.remove('used');
    uiInterface.drawNext();
    uiInterface.drawLadder();
  }
  function drop() {
    if (game.phase !== 'play' || !game.held || game.dropCooldown > 0 || game.paused) return;
    const radius = TIERS[game.held.t].r;
    game.held.x = clamp(game.aimX, FL + radius + 1, FR - radius - 1);
    game.carrierX = game.held.x;
    {
      const x = game.held.x;
      let near = 0;
      for (const v of game.dropXs) if (Math.abs(v - x) <= 9) near++;
      game.dropXs.push(x);
      if (game.dropXs.length > 6) game.dropXs.shift();
      game.repeatDropMultiplier = near >= 5 ? 0.4 : near >= 4 ? 0.55 : near >= 3 ? 0.75 : 1;
      if (game.repeatDropMultiplier < 1 && game.elapsed - game.spamWarn > 7) {
        game.spamWarn = game.elapsed;
        gameEffects.popup(W / 2, 74, 'MIX IT UP!', '#ff9a3c', 1, 1.4);
      }
    }
    const b = gamePals.mk(game.held.t, game.held.x, SPAWN_Y);
    audioReactions.reactToEvent('drop', { tier: game.held.t, x: game.held.x });
    b.vy = GAMEPLAY.dropVelocity;
    b.qv = -0.5;
    game.bodies.push(b);
    gameEffects.burst(game.held.x, SPAWN_Y - 2, ['#ffffff', '#e6d8ff', '#ffe45c'], 7, 42, 30);
    gameEffects.ring(game.held.x, SPAWN_Y, TIERS[game.held.t].r + 4, '#e6d8ff');
    if (game.held.t >= PRISM) {
      game.spSeen[game.held.t] = (game.spSeen[game.held.t] || 0) + 1;
    }
    game.held = null;
    game.dropCooldown = GAMEPLAY.dropCooldown / game.pace;
    game.drops++;
    game.didDrop = true;
    game.canSwap = true;
    $('#nextBtn').classList.remove('used');
  }
  function swap() {
    if (game.phase !== 'play' || !game.held || !game.canSwap || game.paused) return;
    const t = game.held.t;
    game.held.t = game.nextTier;
    game.nextTier = t;
    game.canSwap = false;
    audioReactions.reactToEvent('swap', { x: game.held.x });
    game.didSwap = true;
    game.held.s = 0.6;
    game.held.sv = 0;
    $('#nextBtn').classList.add('used');
    uiInterface.drawNext();
  }
  function doShake() {
    if (game.phase !== 'play' || game.charge < CH_MAX || game.paused) return;
    audioReactions.reactToEvent('shake');
    game.charge = 0;
    updShake();
    for (const b of game.bodies) {
      const room = Math.max(0, b.y - b.r - FT - 2),
        maxUp = Math.sqrt(2 * G * game.pace * room);
      b.vy = -Math.min(maxUp, 260 + Math.random() * 220);
      b.vx += (Math.random() - 0.5) * 300;
      b.qv += 0.6;
      b.flash = 0.6;
    }
    for (let i = 0; i < 26; i++)
      gameEffects.dust(FL + 4 + Math.random() * (FR - FL - 8), FLOOR - 1, 260);
    gameEffects.ring(W / 2, FLOOR - 4, 70, '#fff');
    gameEffects.ring(W / 2, FLOOR - 4, 46, '#ffe45c');
    gameEffects.popup(W / 2, 96, 'SHAKE!', '#ffe45c', 2, 0.9);
    gameEffects.shake(11);
    game.quakeTime = 0.55;
    game.flashOpacity = 0.4;
    game.freeze = 0.05;
    vib([40, 30, 80]);
  }
  function discover(t) {
    audioReactions.reactToEvent('discover', { tier: t });
    game.dex[t] = true;
    game.discoveries++;
    store.set(
      'dex',
      game.dex.map((v, i) => (v ? i : -1)).filter((v) => v >= 0),
    );
    game.banner = {
      t,
      l: 2.0,
    };
    game.flashOpacity = Math.max(game.flashOpacity, 0.45);
    game.rays.push({
      x: W / 2,
      y: 90,
      l: 2,
      L: 2,
      c: '#ffe45c',
    });
    uiInterface.drawLadder(true);
    vib([20, 30, 20]);
    gameEffects.shake(3);
  }
  function startFever() {
    audioReactions.reactToEvent('fever');
    game.feverT = FEVER_T;
    audio.feverOn = true;
    game.feverCharge = 1;
    game.flashOpacity = 0.6;
    gameEffects.shake(4);
    gameEffects.popup(W / 2, 82, 'FEVER!', 'rainbow', 3, 1.5);
    gameEffects.popup(W / 2, 102, 'SCORE X2', '#fff', 1, 1.5);
    game.rays.push({
      x: W / 2,
      y: 96,
      l: 1.4,
      L: 1.4,
      c: '#ff9ad5',
    });
    for (let i = 0; i < 30; i++) gameEffects.confetti(FL + Math.random() * (FR - FL), FT + 2);
    vib([30, 30, 30]);
    gameProgression.misEvent('fever', 1);
  }
  function doMerge(a, b, mvx, mvy) {
    // The title-screen demo animates pals without awarding gameplay progress.
    if (game.phase === 'title') {
      a.dead = b.dead = true;
      const t = Math.min(MAXT, Math.max(a.t, b.t) + 1),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      if (a.t < MAXT) {
        const pal = gamePals.mk(t, x, y);
        pal.s = 0.3;
        pal.vx = mvx || 0;
        pal.vy = mvy || 0;
        game.bodies.push(pal);
      }
      gameEffects.burst(x, y, TIERS[t].ramp.slice(2), 8, 50, 60);
      return;
    }
    a.dead = b.dead = true;
    game.merges++;
    game.didMerge = true;
    let t = a.t === PRISM && b.t === PRISM ? 3 : a.t === PRISM ? b.t : a.t;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2,
      wild = a.t === PRISM || b.t === PRISM,
      mult = gameSpecials.curMult();
    game.comboCount = game.comboTime > 0 ? game.comboCount + 1 : 1;
    game.comboTime =
      GAMEPLAY.comboWindow +
      Math.min(GAMEPLAY.maxExtraComboSteps, game.comboCount - 1) * GAMEPLAY.extraComboTime;
    gameProgression.misEvent('combo', game.comboCount);
    audioReactions.reactToMerge(t + 1, game.comboCount, x);
    const cm = Math.min(game.comboCount, 5),
      sf = game.repeatDropMultiplier;
    game.charge = Math.min(CH_MAX, game.charge + 1);
    if (game.charge === CH_MAX && !updShake.rdy) {
      updShake.rdy = true;
    }
    if (game.charge < CH_MAX) updShake.rdy = false;
    updShake();
    const np = 1 + Math.min(0.35, game.merges * 0.005);
    if (Math.floor((np - 1) * 10) > Math.floor((game.pace - 1) * 10)) {
      gameEffects.popup(W / 2, 62, 'FASTER!', '#ff9a3c', 2, 1.2);
      gameEffects.shake(3);
    }
    game.pace = np;
    if (game.feverT <= 0) {
      game.feverCharge +=
        (0.04 + 0.01 * Math.min(t, 8)) *
        (1 + 0.3 * Math.min(game.comboCount - 1, 4)) *
        (sf < 1 ? 0.5 : 1);
      if (game.feverCharge >= 1) startFever();
    }
    if (a.ot > 0.9 || b.ot > 0.9) {
      addScore(50 * mult);
      gameEffects.popup(x, y - 18, 'CLUTCH!', '#7dffc4', 1, 1.2);
      gameEffects.sparkles(x, y, 10, 90);
    }
    if (wild) {
      gameEffects.sparkles(x, y, 14, 110);
      gameEffects.ring(x, y, 24, '#ff9ad5');
    }
    if (t >= MAXT) {
      const pts = Math.round(500 * cm * mult * sf);
      addScore(pts);
      gameEffects.burst(x, y, ['#fff', '#ffe45c', '#ffc400', '#ff9500'], 50, 150, 60);
      gameEffects.sparkles(x, y, 24, 130);
      gameEffects.ring(x, y, 44, '#fff');
      gameEffects.ring(x, y, 30, '#ffe45c');
      gameEffects.ring(x, y, 58, '#ffc400');
      game.rays.push({
        x,
        y,
        l: 1.8,
        L: 1.8,
        c: '#ffe45c',
      });
      gameEffects.popup(x, y - 6, 'SUN BURST!', '#ffe45c', 1, 1.6);
      gameEffects.popup(x, y + 6, '+' + pts, '#fff', 1, 1.6);
      for (const o of game.bodies) o.flash = 1;
      gameEffects.shake(9);
      game.freeze = 0.1;
      game.flashOpacity = 0.8;
      vib([40, 40, 80]);
      return;
    }
    const nb = gamePals.mk(t + 1, x, y);
    nb.vx = clamp(mvx || 0, -100, 100);
    nb.vy = clamp((mvy || 0) - 38, -85, 35);
    nb.s = 0.3;
    nb.flash = 1;
    nb.age = 0.7;
    game.bodies.push(nb);
    /* A small local nudge helps the new, larger pal settle into its next match. */
    for (const o of game.bodies) {
      if (o === nb || o.dead || o.mg) continue;
      const dx = o.x - x,
        dy = o.y - y,
        d = Math.hypot(dx, dy),
        reach = nb.r + o.r + 8;
      if (d > 0 && d < reach) {
        const push = 22 * (1 - d / reach);
        o.vx += (dx / d) * push;
        o.vy += Math.max(0, dy / d) * push;
        o.qv += 0.16;
      }
    }
    for (const o of game.bodies) {
      if (o !== nb && !o.dead && !o.mg) {
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < 48) {
          o.qv += 0.32 * (1 - d / 48);
          o.bt = Math.min(o.bt, 0.22);
        }
      }
    } /* neighbors cheer */
    const pts = Math.max(1, Math.round(SCORE[t + 1] * cm * mult * sf));
    addScore(pts);
    const rp = TIERS[t + 1].ramp;
    gameEffects.burst(x, y, [rp[2], rp[3], rp[4], '#fff'], 10 + t * 3, 60 + t * 12);
    gameEffects.sparkles(x, y, 2 + t, 50 + t * 8);
    gameEffects.ring(x, y, TIERS[t + 1].r + 6, rp[3]);
    if (t >= 2) gameEffects.ring(x, y, TIERS[t + 1].r + 15, '#fff');
    if (t + 1 >= 8)
      game.rays.push({
        x,
        y,
        l: 0.9,
        L: 0.9,
        c: rp[3],
      });
    gameEffects.popup(
      x,
      y - TIERS[t + 1].r * 0.4,
      '+' + pts,
      mult > 1 ? '#ffe45c' : '#fff',
      1,
      0.8,
    );
    if (game.comboCount > 1)
      gameEffects.popup(
        x,
        y - TIERS[t + 1].r - 6,
        'COMBO X' + Math.min(game.comboCount, 5) + (game.comboCount > 5 ? '+' : ''),
        game.comboCount >= 5 ? 'rainbow' : game.comboCount > 3 ? '#ffe45c' : '#7dffc4',
        game.comboCount >= 4 ? 2 : 1,
        1.1,
      );
    vib(t > 4 ? 25 : 10);
    if (t >= 4) gameEffects.shake(Math.min(6, (t - 3) * 1.2));
    if (t + 1 >= 6) game.freeze = 0.045;
    if (t + 1 >= 8) game.flashOpacity = Math.max(game.flashOpacity, 0.35);
    gameProgression.misEvent('make', 0, t + 1);
    if (t + 1 > game.highestTier) {
      game.highestTier = t + 1;
      uiInterface.drawLadder(true);
    }
    if (!game.dex[t + 1]) discover(t + 1);
  }
  function gameOver() {
    if (game.phase !== 'play') return;
    audioReactions.reactToEvent('over');
    game.phase = 'dying';
    game.held = null;
    game.charge = 0;
    updShake();
    game.feverT = 0;
    audio.feverOn = false;
    game.feverCharge = 0;
    const list = game.bodies.slice().sort((p, q) => p.y - q.y);
    game.dying = {
      list,
      i: 0,
      acc: 0,
      step: Math.min(0.05, 0.9 / Math.max(1, list.length)),
    };
    gameEffects.shake(7);
    vib([60, 40, 60]);
  }
  function finishOver() {
    game.phase = 'over';
    const prev = store.get('best', 0);
    if (game.score > prev) {
      store.set('best', game.score);
      game.newBest = true;
    }
    game.bestBase = Math.max(prev, game.score);
    game.displayScore = game.score;
    game.lastScoreText = String(game.score);
    uiElements.scoreEl.textContent = fmt(game.score);
    uiElements.bestEl.textContent = fmt(game.bestBase);
    const gain = Math.floor(game.score / 25) + game.missionsDone * 30 + game.discoveries * 40;
    const L0 = store.get('lvl', 1),
      X0 = store.get('xp', 0);
    let L = L0,
      X = X0 + gain;
    while (X >= need(L)) {
      X -= need(L);
      L++;
    }
    const unl = SPECIALS.filter((x) => x.t !== PRISM && x.req > L0 && x.req <= L);
    store.set('lvl', L);
    store.set('xp', X);
    const gs = $('#goScore');
    gs.textContent = '0';
    $('#goBest').textContent =
      'BEST ' + fmt(game.bestBase) + (game.missionsDone ? '   GOALS ' + game.missionsDone : '');
    $('#goName').textContent = TIERS[game.highestTier].n.toUpperCase();
    $('#goNew').hidden = !game.newBest;
    $('#goUp').hidden = true;
    $('#goLvl').textContent = 'LV ' + L0 + ' ' + rank(L0);
    $('#goXpTxt').textContent = '+' + gain + ' XP';
    $('#goXp').style.width = (X0 / need(L0)) * 100 + '%';
    uiInterface.blitFit(
      $('#goCv'),
      renderSprites.SPR[game.highestTier],
      Math.round(Math.max(64, $('#goCv').clientWidth * uiInterface.dpr)),
    );
    setTitleInfo();
    setTimeout(() => {
      if (game.phase !== 'over') return;
      $('#over').hidden = false;
      const s0 = performance.now();
      (function tick(now) {
        const k = Math.min(1, (now - s0) / 900);
        gs.textContent = fmt(Math.round(game.score * (1 - Math.pow(1 - k, 3))));
        if (k < 1 && game.phase === 'over') requestAnimationFrame(tick);
        else gs.textContent = fmt(game.score);
      })(s0);
      setTimeout(() => animXP(L0, X0, gain, unl), 500);
    }, 350);
  }
  function showUnlock(list) {
    const t = list[list.length - 1];
    $('#goUnTxt').textContent =
      'NEW PAL: ' + list.map((x) => TIERS[x.t].n.toUpperCase()).join(' + ');
    uiInterface.blitFit(
      $('#goUnCv'),
      renderSprites.SPR[t.t],
      Math.round(Math.max(48, $('#goUnCv').clientWidth * uiInterface.dpr)),
    );
    $('#goUnlock').hidden = false;
    vib([20, 30, 20]);
  }
  function animXP(L, X, gain, unl) {
    let left = gain,
      last = performance.now();
    const rate = Math.max(60, gain / 1.3);
    (function tick(now) {
      if (game.phase !== 'over') return;
      const add = Math.min(left, (rate * (now - last)) / 1000);
      last = now;
      left -= add;
      X += add;
      while (X >= need(L)) {
        X -= need(L);
        L++;
        $('#goLvl').textContent = 'LV ' + L + ' ' + rank(L);
        $('#goUp').hidden = false;
        vib([20, 20, 40]);
      }
      $('#goXp').style.width = (X / need(L)) * 100 + '%';
      if (left > 0.01) requestAnimationFrame(tick);
      else if (unl && unl.length) showUnlock(unl);
    })(last);
  }
  function setTitleInfo() {
    const L = store.get('lvl', 1);
    $('#tLvl').textContent =
      'LV ' + L + ' ' + rank(L) + ' - PALS ' + uiInterface.palCount() + '/16';
    $('#tNp').textContent = (audio.enabled ? 'RADIO / ' : 'PAUSED / ') + TRACKS[audio.trackId].name;
  }
  async function share() {
    const url = location.href.split('#')[0],
      L = store.get('lvl', 1);
    const text =
      'I evolved to ' +
      TIERS[game.highestTier].n +
      ' in Pal Pop and scored ' +
      game.score +
      ' (level ' +
      L +
      '). Can you reach the Sun?';
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Pal Pop',
          text,
          url,
        });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text + ' ' + url);
      gameEffects.toast('COPIED!');
    } catch (e) {
      gameEffects.toast('SHARE NOT AVAILABLE');
    }
  }

  /* ================= physics ================= */
  return {
    setTitleInfo,
    discover,
    addScore,
    doMerge,
    gameOver,
    finishOver,
    irisTo,
    newGame,
    drop,
    swap,
    doShake,
    share,
  };
}
