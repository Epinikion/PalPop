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
  LOSE_Y,
  MAXT,
  PRISM,
  SCORE,
  SPAWN_Y,
  SPECIALS,
  TIERS,
  W,
  WORLD_OF_TIER,
  need,
  rank,
} from '../config.js';
import { store } from '../core/storage.js';
import { clamp, fmt, mulberry32 } from '../core/math.js';
import {
  advanceQuests,
  dailyNumber,
  dailySeed,
  dailyState,
  dayKey,
  recordDaily,
  recordRun,
  streak,
} from './records.js';
import { learnHint, loadHints } from './hints.js';
import { TRACKS } from '../audio/catalog.js';
import { BADGE_XP, checkBadges } from './badges.js';
import { dailyMutator, mutatorById, newMutators, offerMutators } from './mutators.js';
/** How long two merged pals take to run together into the new one, as liquid (s). */
const GOO_LIFE = 0.24;
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
    // A mutator moves the score to match what it does to the run.
    if (game.mut && p > 0) p = Math.max(1, Math.round(p * game.mut.mult));
    game.score += p;
    gameEffects.bumpEl(uiElements.scoreEl);
    if (game.score > game.best) game.best = game.score;
    // Passing your best is a moment of its own, not a label quietly changing.
    if (!game.bestAnnounced && game.bestStart >= 300 && game.score > game.bestStart) {
      game.bestAnnounced = true;
      audioReactions.reactToEvent('goal');
      gameEffects.popup(W / 2, 70, 'NEW BEST!', 'rainbow', 1, 1.6);
      gameEffects.ring(W / 2, 74, 40, '#ffe45c');
      gameEffects.shake(2);
    }
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
  function newGame(daily = false, mutatorId = null) {
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
    game.goos = [];
    game.physicsAccumulator = 0;
    game.score = 0;
    game.displayScore = 0;
    game.lastScoreText = '';
    game.newBest = false;
    game.comboCount = 0;
    game.comboTime = 0;
    game.charge = 0;
    game.dropCooldown = 0;
    game.queuedDrop = false;
    game.canSwap = true;
    game.pickCount = 0;
    game.merges = 0;
    game.drops = 0;
    game.highestTier = 0;
    game.lastNb = null;
    game.runTime = 0;
    game.lastSpecialDrop = 0;
    game.runStats = { fevers: 0, specials: 0, suns: 0, combo: 0 };
    game.theme = 6;
    game.themeFrom = -1;
    game.themeK = 1;
    store.set('worlds', store.get('worlds', 0) | (1 << 6));
    game.daily = daily ? dayKey() : null;
    game.rand = daily ? mulberry32(dailySeed(game.daily)) : Math.random;
    // The day's mutator is the same for everyone; free play uses the card that was tapped.
    game.mut = daily ? dailyMutator(game.daily) : mutatorById(mutatorId);
    game.pace = game.mut?.pace ?? 1;
    game.fuse = game.mut?.fuse ?? 2;
    game.feverLen = game.mut?.feverTime ?? FEVER_T;
    game.swaps = game.mut?.swaps ?? GAMEPLAY.swapsAtStart;
    game.swapsCap = game.mut?.swaps === 0 ? 0 : GAMEPLAY.swapsMax;
    game.freeze = 0;
    game.flashOpacity = 0;
    game.quakeTime = 0;
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
    game.bestStart = game.bestBase;
    game.bestAnnounced = false;
    game.didDrop = game.didMerge = game.didSwap = false;
    game.hints = loadHints(store);
    game.danger = false;
    game.loseY = LOSE_Y;
    uiElements.scoreEl.textContent = '0';
    uiElements.bestEl.textContent = fmt(game.bestBase);
    updShake();
    uiInterface.updSwaps();
    game.phase = 'play';
    audioReactions.reactToEvent('start');
    game.held = gamePals.mkHeld(gamePals.pick());
    game.nextTier = gamePals.pick();
    game.mission = gameProgression.genMission(0);
    gameProgression.setGoal();
    if (game.mut) gameEffects.popup(W / 2, 60, game.mut.name + ' RUN', '#ffe45c', 1, 2);
    $('#title').hidden = true;
    $('#over').hidden = true;
    $('#goUp').hidden = true;
    $('#goUnlock').hidden = true;
    $('#nextBtn').classList.remove('used');
    uiInterface.drawNext();
    uiInterface.drawLadder();
  }
  function drop() {
    // A tap that lands during the short cooldown is kept and played the moment the next pal arrives.
    if (game.phase === 'play' && !game.held && game.dropCooldown > 0 && !game.paused) {
      game.queuedDrop = true;
      return;
    }
    if (game.phase !== 'play' || !game.held || game.dropCooldown > 0 || game.paused) return;
    const radius = TIERS[game.held.t].r;
    game.held.x = clamp(game.aimX, FL + radius + 1, FR - radius - 1);
    game.carrierX = game.held.x;
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
    learnHint(store, game.hints, 'drop');
    game.canSwap = true;
    $('#nextBtn').classList.remove('used');
  }
  function swap() {
    if (game.phase !== 'play' || !game.held || !game.canSwap || game.swaps <= 0 || game.paused)
      return;
    game.swaps--;
    uiInterface.updSwaps();
    const t = game.held.t;
    game.held.t = game.nextTier;
    game.nextTier = t;
    game.canSwap = false;
    audioReactions.reactToEvent('swap', { x: game.held.x });
    game.didSwap = true;
    learnHint(store, game.hints, 'swap');
    game.held.s = 0.6;
    game.held.sv = 0;
    $('#nextBtn').classList.add('used');
    uiInterface.drawNext();
  }
  function doShake() {
    if (game.phase !== 'play' || game.charge < CH_MAX || game.paused) return;
    audioReactions.reactToEvent('shake');
    learnHint(store, game.hints, 'shake');
    game.charge = 0;
    game.comboTime = 0;
    game.comboCount = 0;
    if (game.feverT <= 0) game.feverCharge *= 0.5;
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
  /** Each stretch of the evolution chain has its own sky: the world changes as the pals climb. */
  function ascend() {
    const world = WORLD_OF_TIER[Math.min(MAXT, game.highestTier)];
    if (world === game.theme) return;
    game.themeFrom = game.theme;
    game.theme = world;
    game.themeK = 0;
    const seen = store.get('worlds', 0) | (1 << world);
    store.set('worlds', seen);
    gameEffects.popup(W / 2, 40, 'NEW WORLD!', '#9fe2ff', 1, 1.4);
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
      l: 1.3,
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
    game.feverT = game.feverLen;
    game.runStats.fevers++;
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
  /** The merged pals run into the new one like drops of water, for a moment (render/goo.js). */
  function goo(pal, from) {
    if (!from) return;
    game.goos.push({ pal, from, age: 0, life: GOO_LIFE });
    if (game.goos.length > 12) game.goos.shift();
  }
  function doMerge(a, b, mvx, mvy, from) {
    // The title-screen demo animates pals without awarding gameplay progress.
    if (game.phase === 'title') {
      a.dead = b.dead = true;
      const t = Math.min(MAXT, Math.max(a.t, b.t) + 1),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      if (a.t < MAXT) {
        const pal = gamePals.mk(t, x, y);
        pal.s = 0.55;
        pal.vx = mvx || 0;
        pal.vy = mvy || 0;
        game.bodies.push(pal);
        goo(pal, from);
      }
      gameEffects.burst(x, y, TIERS[t].ramp.slice(2), 8, 50, 60);
      return;
    }
    a.dead = b.dead = true;
    game.merges++;
    game.didMerge = true;
    learnHint(store, game.hints, 'merge');
    let t = a.t === PRISM && b.t === PRISM ? 3 : a.t === PRISM ? b.t : a.t;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2,
      wild = a.t === PRISM || b.t === PRISM,
      mult = gameSpecials.curMult();
    // A combo is a chain reaction: this merge consumed the pal the previous one made, within the
    // window. Dropping fast does not make one, so tempo alone can no longer inflate the score.
    const chained = game.comboTime > 0 && (a === game.lastNb || b === game.lastNb);
    game.comboCount = chained ? game.comboCount + 1 : 1;
    game.comboTime = GAMEPLAY.chainWindow;
    game.runStats.combo = Math.max(game.runStats.combo, game.comboCount);
    gameProgression.misEvent('combo', game.comboCount);
    audioReactions.reactToMerge(t + 1, game.comboCount, x);
    const cm = Math.min(game.comboCount, 5);
    game.charge = Math.min(CH_MAX, game.charge + 1);
    updShake();
    if (game.feverT <= 0) {
      // Fever is earned by chains: each link makes the next one charge far more.
      game.feverCharge +=
        (0.02 + 0.006 * Math.min(t, 8)) *
        (1 + 0.8 * Math.min(game.comboCount - 1, 4)) *
        (game.mut?.feverGain ?? 1);
      if (game.feverCharge >= 1) startFever();
    }
    // Saving a pal that was about to lose you the game pays more the later you leave it.
    const late = Math.max(a.ot, b.ot);
    if (late > 0.9) {
      addScore(Math.round(30 + 40 * Math.min(1, late - 0.9)) * mult);
      gameEffects.popup(x, Math.max(16, y - 18), 'CLUTCH!', '#7dffc4', 1, 1.2);
      gameEffects.sparkles(x, y, 10, 90);
    }
    if (wild) {
      gameEffects.sparkles(x, y, 14, 110);
      gameEffects.ring(x, y, 24, '#ff9ad5');
    }
    if (t >= MAXT) {
      const pts = Math.round(600 * cm * mult);
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
      gameEffects.popup(x, Math.max(16, y - 14), 'SUN BURST!', '#ffe45c', 1, 1.6);
      gameEffects.popup(x, Math.max(24, y), '+' + pts, '#fff', 1, 1.6);
      for (const o of game.bodies) o.flash = 1;
      // The Sun is the win: it also clears the small pals, starts a fever and is counted for good.
      let swept = 0;
      for (const o of game.bodies) {
        if (o.dead || o.mg || o.t > 5) continue;
        o.dead = true;
        swept += SCORE[o.t];
        const rp = TIERS[o.t].ramp;
        gameEffects.burst(o.x, o.y, [rp[2], rp[3], '#fff'], 6, 80, 80);
      }
      if (swept) addScore(swept * mult);
      game.runStats.suns++;
      if (game.feverT <= 0) startFever();
      gameEffects.shake(5);
      game.freeze = 0.1;
      game.flashOpacity = 0.8;
      vib([40, 40, 80]);
      return;
    }
    const nb = gamePals.mk(t + 1, x, y);
    nb.vx = clamp(mvx || 0, -100, 100);
    nb.vy = clamp((mvy || 0) - 38, -85, 35);
    nb.s = 0.55;
    nb.flash = 1;
    nb.age = 0.7;
    nb.ot = -GAMEPLAY.mergeGrace;
    game.lastNb = nb;
    game.bodies.push(nb);
    goo(nb, from);
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
    const pts = Math.max(1, Math.round(SCORE[t + 1] * cm * mult));
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
    // Popups sit above the new pal, never on its face, and stay small enough to read the board.
    const above = Math.max(16, y - TIERS[t + 1].r - 4);
    gameEffects.popup(x, above, '+' + pts, mult > 1 ? '#ffe45c' : '#fff', 1, 0.8);
    if (game.comboCount > 1)
      gameEffects.popup(
        x,
        Math.max(16, above - 8),
        'COMBO X' + Math.min(game.comboCount, 5) + (game.comboCount > 5 ? '+' : ''),
        game.comboCount >= 5 ? 'rainbow' : game.comboCount > 3 ? '#ffe45c' : '#7dffc4',
        1,
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
      ascend();
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
  /** Keeps a new best if the tab is closed mid-run; the run itself is only booked when it ends. */
  function checkpoint() {
    if (game.phase === 'play' && game.score > store.get('best', 0)) store.set('best', game.score);
  }
  function finishOver() {
    game.phase = 'over';
    const run = {
        score: game.score,
        tier: game.highestTier,
        secs: game.runTime,
        merges: game.merges,
        combo: game.runStats.combo,
        suns: game.runStats.suns,
        fevers: game.runStats.fevers,
        specials: game.runStats.specials,
        mutator: !!game.mut,
      },
      L0 = store.get('lvl', 1),
      X0 = store.get('xp', 0),
      // The best before this run began, so a checkpoint mid-run cannot hide a new best.
      recap = recordRun(store, { ...run, previousBest: game.bestStart }),
      daily = game.daily ? recordDaily(store, game.daily, run) : null,
      quests = advanceQuests(store, Math.random, run, L0),
      best = Math.max(store.get('best', 0), game.score),
      days = store.get('days', []),
      badges = checkBadges(store, {
        dailyDays: Array.isArray(days) ? days.length : 0,
        worlds: [0, 1, 2, 3, 4, 5, 6].filter((w) => store.get('worlds', 0) & (1 << w)).length,
      });
    store.set('best', best);
    game.newBest = recap.newBest;
    game.bestBase = best;
    game.displayScore = game.score;
    game.lastScoreText = String(game.score);
    uiElements.scoreEl.textContent = fmt(game.score);
    uiElements.bestEl.textContent = fmt(best);
    const gain =
      Math.floor(game.score / 40) +
      game.missionsDone * 25 +
      game.discoveries * 40 +
      quests.xp +
      badges.length * BADGE_XP;
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
    uiInterface.renderOver({
      level: L,
      mutator: game.mut,
      unlocked: newMutators(L0, L),
      offer: game.daily ? [] : offerMutators(L, Math.random, game.mut?.id),
      badges,
      score: game.score,
      best,
      recap,
      quests: quests.rows,
      daily,
      dailyNo: game.daily ? dailyNumber(game.daily) : 0,
      streak: game.daily ? streak(store, game.daily) : 0,
    });
    $('#goName').textContent = TIERS[game.highestTier].n.toUpperCase();
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
      $('#againBtn').focus({ preventScroll: true });
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
      'LV ' + L + ' ' + rank(L) + ' - PALS ' + uiInterface.palCount() + '/15';
    $('#tNp').textContent = (audio.enabled ? 'RADIO / ' : 'PAUSED / ') + TRACKS[audio.trackId].name;
    uiInterface.renderTitle();
  }
  const PAL_MARK = ['🔵', '🐤', '🐰', '🐸', '🐱', '🐼', '👻', '🦉', '⚡', '🐲', '☀️'];
  async function share() {
    const url = location.href.split('#')[0],
      L = store.get('lvl', 1),
      tier = TIERS[game.highestTier].n,
      mark = PAL_MARK.slice(0, game.highestTier + 1).join('');
    const text = game.daily
      ? 'Pal Pop DAILY #' +
        dailyNumber(game.daily) +
        '  ' +
        fmt(game.score) +
        '\n' +
        mark +
        '\nSame pals for everyone today. Beat it!'
      : 'I evolved to ' +
        tier +
        ' in Pal Pop and scored ' +
        fmt(game.score) +
        ' (level ' +
        L +
        ').\n' +
        mark +
        '\nCan you reach the Sun?';
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
    checkpoint,
    ascend,
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
