import { $ } from '../core/dom.js';
import { TRACKS } from '../audio/catalog.js';
import { TIERS } from '../config.js';
import { sungGlow } from '../render/sung.js';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export function createUiMusicMeter({ audio, uiInterface }) {
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
      bar = audio.bar + 1,
      muted = !audio.enabled || audio.volume === 0,
      key = audio.key
        ? NAMES[audio.key.pc] + ' ' + audio.key.scale.toUpperCase()
        : S.kname + ' ' + S.mname;
    setTxt(
      '#liveMixState',
      muted
        ? 'MUTED'
        : (audio.onRecord ? 'PLAYING' : 'GENERATING') + ' \u00b7 ' + section + ' \u00b7 BAR ' + bar,
    );
    setTxt('#liveClock', S.bpm + ' BPM \u00b7 ' + key);
    setTxt(
      '#trackLabel',
      (audio.enabled ? '' : 'PAUSED \u00b7 ') + TRACKS[audio.trackId].name + ' / ' + section,
    );
    setTxt('#tempoLabel', S.bpm + ' BPM');
    if (!uiInterface.radio.hidden)
      setTxt(
        '#engineInfo',
        S.bpm +
          ' BPM \u00b7 ' +
          key +
          ' \u00b7 ' +
          (muted ? 'MUTED' : section + ' \u00b7 BAR ' + bar),
      );
    // The evolution chain lights the pals the song is singing about.
    const context = audio.context,
      sung =
        audio.enabled && audio.palCues?.length
          ? sungGlow(
              audio.palCues,
              context.currentTime - (context.outputLatency || context.baseLatency || 0),
              TIERS.length,
            )
          : null;
    uiInterface.markSung?.((i) => sung && sung.glow[i] > 0.25);
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
