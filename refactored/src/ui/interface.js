import { $ } from '../core/dom.js';
import { H, MAXT, PRISM, SPECIALS, TIERS, W } from '../config.js';
import { TRACK_IDS, TRACKS, VISUAL_THEME } from '../audio/catalog.js';
import { store } from '../core/storage.js';
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
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(spr, 0, 0, box, box);
    }
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
  function renderRadio() {
    $('#musTog').setAttribute('aria-pressed', String(audio.enabled));
    $('#musTog').textContent = 'SOUND ' + (audio.enabled ? 'ON' : 'OFF');
    for (const { id: i, button: b } of songButtons) {
      b.classList.toggle('on', audio.trackId === i);
      b.setAttribute('aria-pressed', String(audio.trackId === i));
    }
    $('#engineName').textContent = TRACKS[audio.trackId].name;
    $('#songDescription').textContent = TRACKS[audio.trackId].description;
  }
  function openRadio() {
    audioRuntime.initAudio();
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
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = renderWorlds.THEMES[VISUAL_THEME].bands[0];
  }
  const ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
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
    $('#bookTitle').textContent = 'PALBOOK ' + palCount() + '/' + ORDER.length;
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
  $('#musTog').addEventListener('click', () => {
    audioRuntime.initAudio();
    audio.enabled = !audio.enabled;
    store.set('mus', audio.enabled);
    audioRuntime.applyAudio();
    renderRadio();
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
    if (focusReturn && focusReturn.focus) focusReturn.focus();
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
    let v = Math.min((aw * dpr) / W, (ah * dpr) / H);
    // Board is fitted to the visible width AND height. Half-device-pixel steps keep it large
    // while retaining the crisp nearest-neighbour pixel look.
    let ds = portraitMobile ? Math.floor(v * 2) / 2 : Math.floor(v);
    if (!portraitMobile && dpr < 3 && v - ds >= 0.5) ds += 0.5;
    ds = Math.max(1, ds);
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
    palCount,
    book,
    closeBook,
    closeRadio,
    openRadio,
    openBook,
    fit,
  };
}
