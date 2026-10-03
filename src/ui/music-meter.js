import { $ } from '../core/dom.js';
import { TRACKS } from '../audio/catalog.js';
export function createUiMusicMeter({ audio, uiInterface }) {
  /* ==== end techno engine v4 ==== */

  /* ---- UI glue: only writes to the DOM when text actually changes ---- */
  const uiTxt = {};
  let stemEls = null;
  let eqEls = null;
  const setTxt = (sel, txt) => {
    if (uiTxt[sel] === txt) return;
    uiTxt[sel] = txt;
    const e = $(sel);
    if (e) e.textContent = txt;
  };
  function updateLiveMusic(dt) {
    if (!audio.context || audio.context.state !== 'running' || !audio.graph || !audio.session)
      return;
    const S = audio.session,
      section = audio.section,
      bar = (audio.bar % 64) + 1,
      muted = !audio.enabled || audio.volume === 0,
      key = S.kname + ' ' + S.mname;
    setTxt(
      '#liveMixState',
      muted ? 'MUTED' : 'GENERATING \u00b7 ' + section + ' \u00b7 BAR ' + bar + '/64',
    );
    setTxt('#liveClock', S.bpm + ' BPM \u00b7 ' + key);
    setTxt(
      '#trackLabel',
      (audio.enabled ? '' : 'PAUSED \u00b7 ') +
        TRACKS[audio.trackId].name +
        ' / ' +
        section +
        ' / SET ' +
        (Math.floor(audio.bar / 64) + 1),
    );
    setTxt('#tempoLabel', S.bpm + ' BPM');
    if (!uiInterface.radio.hidden)
      setTxt(
        '#engineInfo',
        S.bpm +
          ' BPM \u00b7 ' +
          key +
          ' \u00b7 ' +
          (muted
            ? 'MUTED'
            : 'SET ' + (Math.floor(audio.bar / 64) + 1) + ' / ' + section + ' BAR ' + bar + '/64'),
      );
    if (!stemEls) stemEls = [...document.querySelectorAll('#stemMeter [data-stem]')];
    for (const el of stemEls)
      el.classList.toggle('on', audio.enabled && audio.stemFlash[el.dataset.stem] > 0);
    if (!eqEls) eqEls = [...document.querySelectorAll('.mini-eq i')];
    eqEls.forEach((barEl, i) => {
      const level = audio.frequencyData ? audio.frequencyData[2 + i * 6] / 255 : 0;
      const h = 3 + Math.round(level * 4) * 3 + 'px';
      if (barEl.style.height !== h) barEl.style.height = h;
    });
  }
  return { updateLiveMusic };
}
