import { $, feel, vib } from '../core/dom.js';
import { H, MAXT, PRISM, SPECIALS, TIERS, W } from '../config.js';
import { TRACK_IDS, TRACKS } from '../audio/catalog.js';
import { dailyNumber, dailyState, dayKey, streak } from '../game/records.js';
import { BADGE_XP, badgeRows } from '../game/badges.js';
import { dailyMutator } from '../game/mutators.js';
import { store } from '../core/storage.js';
import { isStandalone, readInsets } from './viewport.js';
import { fmt, fmtK } from '../core/math.js';
export function createUiInterface({
  audio,
  audioReactions,
  audioRuntime,
  game,
  gameActions,
  gameProgression,
  renderSprites,
  renderWorlds,
  uiElements,
}) {
  /* ================= DOM: next, ladder, radio, sizing ================= */
  let dpr = window.devicePixelRatio || 1;
  function blitFit(canvas, spr, box) {
    if (canvas.width !== box || canvas.height !== box) {
      canvas.width = box;
      canvas.height = box;
    }
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, box, box);
    const k = Math.floor(box / spr.width);
    if (k >= 1) {
      g.imageSmoothingEnabled = false;
      const s = spr.width * k,
        ox = Math.floor((box - s) / 2),
        oy = Math.floor((box - spr.height * k) / 2);
      g.drawImage(spr, ox, oy, s, spr.height * k);
    } else {
      // Too big to fit at 1:1: scale down without smoothing, so pixels stay hard-edged.
      g.imageSmoothingEnabled = false;
      const s = Math.min(box / spr.width, box / spr.height);
      g.drawImage(
        spr,
        Math.floor((box - spr.width * s) / 2),
        Math.floor((box - spr.height * s) / 2),
        Math.round(spr.width * s),
        Math.round(spr.height * s),
      );
    }
  }
  /** The NEXT button doubles as the swap counter: swaps are limited and earned by goals. */
  function updSwaps() {
    const label = $('#nextBtn .lbl');
    if (label) label.textContent = 'NEXT x' + game.swaps;
    $('#nextBtn').classList.toggle('empty', game.swaps <= 0);
  }
  function drawNext() {
    blitFit($('#nextCv'), renderSprites.SPR[game.nextTier], Math.round(44 * dpr));
  }
  const ladder = $('#ladder');
  const chips = [];
  for (let i = 0; i <= MAXT; i++) {
    const d = document.createElement('div');
    d.className = 'chip';
    d.title = TIERS[i].n;
    const c = document.createElement('canvas');
    d.appendChild(c);
    ladder.appendChild(d);
    chips.push({
      d,
      c,
    });
  }
  function drawLadder(fresh) {
    chips.forEach((ch, i) => {
      blitFit(
        ch.c,
        game.dex[i] ? renderSprites.SPR[i] : renderSprites.DK[i],
        Math.max(16, Math.round(Math.max(12, ch.d.clientWidth - 4) * dpr)),
      );
      ch.d.classList.toggle('got', game.phase !== 'title' && i > 0 && i === game.highestTier);
      if (fresh && i === game.highestTier) {
        ch.d.classList.remove('fresh');
        void ch.d.offsetWidth;
        ch.d.classList.add('fresh');
      }
    });
  }
  /* ---- game-over summary: records, daily result and quests ---- */
  const line = (parent, className, text) => {
    const row = document.createElement('div');
    row.className = className;
    row.textContent = text;
    parent.append(row);
    return row;
  };
  const QUEST_TEXT = {
    reach: (n) => 'REACH ' + TIERS[n].n.toUpperCase(),
    chain: (n) => 'CHAIN X' + n,
    score: (n) => 'SCORE ' + fmtK(n),
    merges: (n) => 'MERGE ' + n + ' PALS',
    fevers: (n) => 'FEVER X' + n,
    specials: (n) => 'SPECIALS X' + n,
  };
  const questCount = (q, n) =>
    q.type === 'reach' ? n + 1 + '/' + (q.target + 1) : n + '/' + q.target;
  function renderOver({
    level,
    mutator,
    unlocked,
    offer,
    badges,
    score,
    best,
    recap,
    quests,
    daily,
    dailyNo,
    streak,
  }) {
    $('#goBest').textContent = recap.newBest
      ? 'BEST ' + fmt(best)
      : recap.nearMiss
        ? fmt(recap.gap) + ' SHORT OF BEST'
        : 'BEST ' + fmt(best);
    const fresh = $('#goNew');
    fresh.hidden = !recap.newBest;
    fresh.textContent = recap.newBest
      ? 'NEW BEST!' + (recap.previousBest ? ' +' + fmt(score - recap.previousBest) : '')
      : '';
    const recapBox = $('#goRecap');
    recapBox.replaceChildren();
    for (const record of recap.records.slice(0, 2))
      line(recapBox, 'rec hot', 'NEW ' + record + '!');
    if (mutator) line(recapBox, 'rec', mutator.name + ' RUN  SCORE X' + mutator.mult);
    for (const m of unlocked) line(recapBox, 'rec hot', 'NEW MUTATOR: ' + m.name + '!');
    for (const b of badges.slice(0, 3))
      line(recapBox, 'rec hot', 'BADGE: ' + b.name + ' +' + BADGE_XP + ' XP');
    if (badges.length > 3) line(recapBox, 'rec hot', '+' + (badges.length - 3) + ' MORE BADGES!');
    if (recap.runs >= 3) line(recapBox, 'rec', 'AVERAGE OF LAST 5  ' + fmt(recap.average));
    const dailyBox = $('#goDaily');
    dailyBox.hidden = !dailyNo;
    if (dailyNo)
      dailyBox.textContent =
        'DAILY #' +
        dailyNo +
        '  BEST ' +
        fmt(daily.best) +
        '  TRY ' +
        daily.tries +
        (streak >= 2 ? '  ' + streak + ' DAYS' : '');
    $('#freeBtn').hidden = !dailyNo;
    // Tapping a mutator card IS the retry: two taps fewer than choosing and then starting.
    const cards = $('#goMut');
    cards.replaceChildren();
    cards.hidden = !offer.length;
    if (offer.length) {
      line(cards, 'qhead', 'NEXT RUN WITH...');
      const row = document.createElement('div');
      row.className = 'mrow';
      for (const m of offer) {
        const card = document.createElement('button');
        card.className = 'pbtn mcard';
        card.dataset.id = m.id;
        card.title = m.desc;
        line(card, 'mname', m.name);
        line(card, 'mmult', 'X' + m.mult);
        row.append(card);
      }
      cards.append(row);
    }
    const questBox = $('#goQuests');
    questBox.replaceChildren();
    if (quests.length) line(questBox, 'qhead', 'QUESTS');
    for (const q of quests) {
      const row = document.createElement('div');
      row.className = 'quest' + (q.done ? ' done' : '');
      line(row, 'qtxt', QUEST_TEXT[q.type](q.target));
      line(row, 'qnum', q.done ? '+' + q.xp + ' XP' : questCount(q, q.after));
      const bar = document.createElement('i');
      bar.style.width = Math.min(100, (q.after / q.target) * 100) + '%';
      row.append(bar);
      questBox.append(row);
    }
  }
  function renderTitle() {
    const today = dayKey(),
      state = dailyState(store, today),
      days = streak(store, today);
    $('#dailyBtn').textContent = 'DAILY #' + dailyNumber(today);
    const mutator = dailyMutator(today);
    $('#tDaily').textContent =
      (mutator ? mutator.name + ' DAY\n' : '') +
      (state.tries
        ? 'TODAY: BEST ' + fmt(state.best)
        : days
          ? days + ' DAY' + (days > 1 ? 'S' : '') + ' IN A ROW'
          : 'NEW PALS EVERY DAY');
  }
  const radio = $('#radio');
  const songButtons = TRACK_IDS.map((id) => {
    const song = TRACKS[id],
      button = document.createElement('button');
    button.id = song.buttonId;
    button.className = 'pbtn';
    const name = document.createElement('b'),
      description = document.createElement('small');
    name.textContent = song.name;
    description.textContent = song.label;
    button.append(name, description);
    $('#songChoices').append(button);
    button.addEventListener('click', () => {
      audioRuntime.initAudio();
      audioReactions.setTrack(id);
    });
    return { id, button };
  });
  // A pixel speaker on the bar: waves while the sound is on, a red cross while it is muted.
  const muteGfx = $('#muteCv').getContext('2d');
  function drawMute() {
    muteGfx.clearRect(0, 0, 11, 9);
    muteGfx.fillStyle = audio.enabled ? '#fbeed8' : '#ff6b8a';
    for (const [x, y, w, h] of [
      [0, 3, 2, 3],
      [2, 2, 1, 5],
      [3, 1, 1, 7],
    ])
      muteGfx.fillRect(x, y, w, h);
    const dots = audio.enabled
      ? [
          [5, 3, 1, 3],
          [7, 2, 1, 5],
          [9, 1, 1, 7],
        ]
      : [6, 7, 8, 9, 10].flatMap((x, i) => [
          [x, 2 + i, 1, 1],
          [x, 6 - i, 1, 1],
        ]);
    for (const [x, y, w, h] of dots) muteGfx.fillRect(x, y, w, h);
    $('#muteBtn').setAttribute('aria-pressed', String(!audio.enabled));
    $('#muteBtn').setAttribute(
      'aria-label',
      audio.enabled ? 'Sound on. Tap to mute everything' : 'Sound off. Tap to turn it back on',
    );
  }
  function renderRadio() {
    $('#musTog').setAttribute('aria-pressed', String(audio.enabled));
    $('#musTog').textContent = 'SOUND ' + (audio.enabled ? 'ON' : 'OFF');
    drawMute();
    for (const { id: i, button: b } of songButtons) {
      b.classList.toggle('on', audio.trackId === i);
      b.setAttribute('aria-pressed', String(audio.trackId === i));
    }
    $('#engineName').textContent = TRACKS[audio.trackId].name;
    $('#songDescription').textContent = TRACKS[audio.trackId].description;
  }
  // One line that says how big the phone thinks the window is, to chase layout problems that only
  // show up in an installed iOS app: the page's window, the real screen, the app box and the insets.
  function viewInfo() {
    const { top, bottom, lvh } = readInsets(),
      app = $('#app').getBoundingClientRect();
    $('#viewInfo').textContent =
      `WINDOW ${window.innerWidth}X${window.innerHeight} / SCREEN ${window.screen.width}X${window.screen.height} / ` +
      `LVH ${lvh} / APP ${Math.round(app.width)}X${Math.round(app.height)} / INSET ${top}+${bottom} / ` +
      (isStandalone() ? 'INSTALLED' : 'BROWSER');
  }
  function openRadio() {
    audioRuntime.initAudio();
    viewInfo();
    radio.hidden = false;
    game.paused = true;
    renderRadio();
    openDialog(radio);
  }
  function closeRadio() {
    radio.hidden = true;
    game.paused = false;
    closeDialog();
  }
  function setPage() {
    document.body.style.backgroundColor = '#161027';
    $('#liveGenre').textContent = 'LIVE ' + TRACKS[audio.trackId].style.toUpperCase();
    // Once a session exists, the music meter owns its live tempo and section labels.
    if (!audio.session) {
      $('#trackLabel').textContent =
        (audio.enabled ? '' : 'PAUSED · ') + TRACKS[audio.trackId].name;
      $('#tempoLabel').textContent = TRACKS[audio.trackId].bpm + ' BPM';
    }
  }
  const ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15];
  const book = $('#book');
  const grid = $('#bookGrid');
  const binfo = $('#bookInfo');
  let selPal = 0;
  const unlocked = (i) =>
    i <= MAXT
      ? !!game.dex[i]
      : i === PRISM
        ? true
        : store.get('lvl', 1) >= SPECIALS.find((x) => x.t === i).req;
  function palCount() {
    let n = 0;
    for (const i of ORDER) if (unlocked(i)) n++;
    return n;
  }
  const cellEls = ORDER.map((i) => {
    const b = document.createElement('button'),
      c = document.createElement('canvas');
    b.className = 'cell' + (i >= PRISM ? ' sp' : '');
    b.setAttribute('aria-label', TIERS[i].n);
    b.appendChild(c);
    grid.appendChild(b);
    b.addEventListener('click', () => {
      selPal = i;
      renderBook();
    });
    return {
      b,
      c,
      i,
    };
  });
  function renderBook() {
    let worlds = 0;
    for (let w = 0; w < 7; w++) if (store.get('worlds', 0) & (1 << w)) worlds++;
    $('#bookTitle').textContent =
      'PALBOOK ' + palCount() + '/' + ORDER.length + '  WORLDS ' + worlds + '/7';
    for (const ce of cellEls) {
      const u = unlocked(ce.i);
      ce.b.classList.toggle('lock', !u);
      ce.b.classList.toggle('sel', ce.i === selPal);
      blitFit(
        ce.c,
        u ? renderSprites.SPR[ce.i] : renderSprites.DK[ce.i],
        Math.max(16, Math.round(Math.max(20, ce.b.clientWidth - 4) * dpr)),
      );
    }
    const rows = badgeRows(store, {
        dailyDays: (store.get('days', []) || []).length,
        worlds,
      }),
      got = rows.filter((row) => row.got).length,
      list = $('#badgeList');
    $('#badgeTitle').textContent = 'BADGES ' + got + '/' + rows.length;
    list.replaceChildren();
    for (const { badge, value, got: earned } of rows) {
      const row = document.createElement('div');
      row.className = 'badge' + (earned ? ' got' : '');
      line(row, 'bname', earned ? badge.name : '???');
      line(row, 'bhint', badge.hint);
      line(row, 'bnum', earned ? 'DONE' : value + '/' + badge.goal);
      const bar = document.createElement('i');
      bar.style.width = (earned ? 1 : value / badge.goal) * 100 + '%';
      row.append(bar);
      list.append(row);
    }
    const i = selPal,
      T = TIERS[i];
    let txt;
    if (i <= MAXT)
      txt = unlocked(i)
        ? T.n.toUpperCase() +
          ' - EVOLUTION ' +
          (i + 1) +
          ' OF 11' +
          (i === MAXT ? '. THE SUN!' : '')
        : '??? - MERGE TWO ' + TIERS[i - 1].n.toUpperCase() + ' TO DISCOVER IT';
    else {
      const sp = SPECIALS.find((x) => x.t === i);
      txt = unlocked(i)
        ? T.n.toUpperCase() + ' - SPECIAL. ' + sp.desc
        : '??? - SPECIAL PAL. REACH LEVEL ' + sp.req + ' TO UNLOCK IT';
    }
    if (unlocked(i) && renderSprites.CUSTOM[i]) txt = 'CUSTOM PAL - ' + txt;
    binfo.textContent = txt;
  }
  function openBook() {
    audioRuntime.initAudio();
    book.hidden = false;
    game.paused = true;
    renderBook();
    requestAnimationFrame(renderBook);
    openDialog(book);
  }
  function closeBook() {
    book.hidden = true;
    game.paused = false;
    gameActions.setTitleInfo();
    closeDialog();
  }
  $('#bookBtn').addEventListener('click', openBook);
  $('#labBtn').addEventListener('click', () => {
    window.open('tools/pal-designer.html', '_blank', 'noopener');
  });
  $('#bookClose').addEventListener('click', closeBook);
  book.addEventListener('click', (e) => {
    if (e.target === book) closeBook();
  });
  function toggleSound() {
    audioRuntime.initAudio();
    audio.enabled = !audio.enabled;
    store.set('mus', audio.enabled);
    audioRuntime.applyAudio();
    renderRadio();
  }
  $('#musTog').addEventListener('click', toggleSound);
  $('#muteBtn').addEventListener('click', toggleSound);
  // Haptics and screen flashes can be switched off; both choices are saved.
  feel.haptics = store.get('haptics', true) !== false;
  feel.flashes = store.get('flashes', true) !== false;
  // The words of ALL MY PALS behind the board, while the song plays; off unless switched on.
  feel.lyrics = store.get('lyrics', false) === true;
  // iPhones have no web vibration, so the switch would do nothing there.
  if (!navigator.vibrate) $('#vibTog').hidden = true;
  function renderFeel() {
    for (const [id, on, label] of [
      ['vibTog', feel.haptics, 'HAPTICS'],
      ['flashTog', feel.flashes, 'FLASHES'],
      ['lyricsTog', feel.lyrics, 'LYRICS'],
    ]) {
      $('#' + id).setAttribute('aria-pressed', String(on));
      $('#' + id).textContent = label + (on ? ' ON' : ' OFF');
    }
    document.documentElement.classList.toggle('calm', !feel.flashes);
  }
  $('#vibTog').addEventListener('click', () => {
    feel.haptics = !feel.haptics;
    store.set('haptics', feel.haptics);
    renderFeel();
    vib(20);
  });
  $('#flashTog').addEventListener('click', () => {
    feel.flashes = !feel.flashes;
    store.set('flashes', feel.flashes);
    renderFeel();
  });
  $('#lyricsTog').addEventListener('click', () => {
    feel.lyrics = !feel.lyrics;
    store.set('lyrics', feel.lyrics);
    renderFeel();
  });
  renderFeel();
  // A phone can hold on to an old copy of the app. This throws the saved copy away and loads the
  // newest version from the network; the saved scores and settings are not touched.
  $('#updateBtn').addEventListener('click', async () => {
    $('#updateBtn').textContent = 'UPDATING...';
    try {
      const workers = (await navigator.serviceWorker?.getRegistrations?.()) || [];
      await Promise.all(workers.map((worker) => worker.unregister()));
      for (const key of (await window.caches?.keys?.()) || [])
        if (key.startsWith('palpop-')) await window.caches.delete(key);
    } catch {}
    window.location.reload();
  });
  $('#radioClose').addEventListener('click', closeRadio);
  let focusReturn = null;
  function openDialog(el) {
    focusReturn = document.activeElement;
    $('#app').inert = true;
    el.querySelector('button').focus();
  }
  function closeDialog() {
    $('#app').inert = false;
    // Back in a run the keyboard should still steer the pal, so focus goes to the board.
    if (game.phase === 'play') uiElements.cv.focus({ preventScroll: true });
    else if (focusReturn && focusReturn.focus) focusReturn.focus();
  }
  document.addEventListener('keydown', (e) => {
    const modal = !radio.hidden ? radio : !book.hidden ? book : null;
    if (!modal || e.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button,input,a[href]')],
      first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });
  for (const [id, out, key, read, write] of [
    ['musicVol', 'musicValue', 'musicVol', () => audio.volume, (v) => (audio.volume = v)],
    ['bassAmt', 'bassValue', 'bassAmt', () => audio.bassAmount, (v) => (audio.bassAmount = v)],
    [
      'effectsVol',
      'effectsValue',
      'effectsVol',
      () => audio.effectsVolume,
      (v) => (audio.effectsVolume = v),
    ],
  ]) {
    const input = $('#' + id),
      output = $('#' + out);
    input.value = read();
    output.value = read() + '%';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      write(v);
      output.value = v + '%';
      store.set(key, v);
      audioRuntime.initAudio();
      audioRuntime.applyAudio();
    });
  }
  radio.addEventListener('click', (e) => {
    if (e.target === radio) closeRadio();
  });
  const wrap = $('#wrap');
  const stage = $('#stage');
  function fit() {
    dpr = window.devicePixelRatio || 1;
    const portraitMobile = window.matchMedia(
      '(max-width:699px) and (orientation:portrait)',
    ).matches;
    const aw = stage.clientWidth - (portraitMobile ? 10 : 14);
    const ah = stage.clientHeight - (portraitMobile ? 20 : 14);
    const v = Math.min((aw * dpr) / W, (ah * dpr) / H);
    // Board is fitted to the visible width AND height in whole device pixels per game pixel:
    // fractional steps make every second pixel row and column a different width.
    const ds = Math.max(1, Math.floor(v));
    const cw = (W * ds) / dpr,
      ch = (H * ds) / dpr;
    uiElements.cv.style.width = cw + 'px';
    uiElements.cv.style.height = ch + 'px';
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    wrap.style.setProperty('--u', ds / dpr + 'px');
    drawNext();
    drawLadder();
    gameProgression.setGoal();
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ================= input ================= */
  return {
    setPage,
    renderRadio,
    radio,
    drawLadder,
    blitFit,
    get dpr() {
      return dpr;
    },
    set dpr(value) {
      dpr = value;
    },
    drawNext,
    updSwaps,
    renderOver,
    renderTitle,
    palCount,
    book,
    closeBook,
    closeRadio,
    openRadio,
    openBook,
    fit,
  };
}
