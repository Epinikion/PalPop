import { $, vib } from '../core/dom.js';
import { FL, FR, FT, TIERS, W } from '../config.js';
import { fmtK } from '../core/math.js';
export function createGameProgression({
  audioReactions,
  game,
  gameEffects,
  renderSprites,
  uiElements,
  uiInterface,
}) {
  /* ================= missions & progression ================= */
  function genMission(k) {
    let m;
    if (k === 0)
      m = {
        type: 'make',
        t: 2,
        n: 3,
      };
    else if (k === 1)
      m = {
        type: 'combo',
        n: 3,
      };
    else if (k === 2)
      m = {
        type: 'make',
        t: 4,
        n: 2,
      };
    else {
      const r = Math.random();
      if (r < 0.45) {
        const t = Math.min(8, 3 + Math.floor(Math.random() * Math.min(6, k - 1)));
        m = {
          type: 'make',
          t,
          n: t >= 7 ? 1 : t >= 5 ? 2 : 3,
        };
      } else if (r < 0.65)
        m = {
          type: 'combo',
          n: Math.min(7, 3 + Math.floor(k / 2)),
        };
      else if (r < 0.85)
        m = {
          type: 'score',
          n: Math.ceil((game.score + 400 + k * 350) / 100) * 100,
        };
      else
        m = {
          type: 'fever',
          n: 1,
        };
    }
    m.p = m.type === 'score' ? game.score : 0;
    m.k = k;
    m.reward = Math.min(400, 50 + k * 40);
    return m;
  }
  function setGoal() {
    const m = game.mission;
    if (!m) return;
    uiInterface.blitFit(
      $('#goalCv'),
      m.type === 'make' ? renderSprites.SPR[m.t] : renderSprites.ICON[m.type],
      Math.round(26 * uiInterface.dpr),
    );
    $('#goalTxt').textContent =
      m.type === 'make'
        ? 'MAKE ' + m.n + ' ' + TIERS[m.t].n.toUpperCase()
        : m.type === 'combo'
          ? 'HIT COMBO X' + m.n
          : m.type === 'score'
            ? 'REACH ' + fmtK(m.n) + ' POINTS'
            : 'START A FEVER';
    updGoal();
  }
  function updGoal() {
    const m = game.mission;
    if (!m) return;
    $('#goalNum').textContent = m.done
      ? 'DONE'
      : m.type === 'score'
        ? fmtK(m.p)
        : m.type === 'combo'
          ? 'X' + m.p
          : m.p + '/' + m.n;
    $('#goalBar').style.width = Math.min(1, m.p / m.n) * 100 + '%';
  }
  function misEvent(type, val, t) {
    const m = game.mission;
    if (game.phase !== 'play' || !m || m.done || m.type !== type) return;
    if (type === 'make') {
      if (t !== m.t) return;
      m.p++;
    } else if (type === 'combo') m.p = Math.max(m.p, val);
    else if (type === 'score') m.p = Math.min(m.n, val);
    else m.p = 1;
    if (m.p >= m.n) completeMission();
    else updGoal();
  }
  function completeMission() {
    audioReactions.reactToEvent('goal');
    const m = game.mission;
    m.done = true;
    m.p = m.n;
    game.missionsDone++;
    updGoal();
    game.score += m.reward;
    gameEffects.bumpEl(uiElements.scoreEl);
    gameEffects.popup(W / 2, 70, 'GOAL!', '#7dffc4', 2, 1.2);
    gameEffects.popup(W / 2, 84, '+' + m.reward, '#fff', 1, 1.2);
    for (let i = 0; i < 40; i++) gameEffects.confetti(FL + Math.random() * (FR - FL), FT + 2);
    const el = $('#goal');
    el.classList.remove('done');
    void el.offsetWidth;
    el.classList.add('done');
    vib([15, 20, 15]);
    setTimeout(() => {
      if (game.phase === 'play' && game.mission === m) {
        game.missionIndex++;
        game.mission = genMission(game.missionIndex);
        setGoal();
      }
    }, 900);
  }

  /* ================= game flow ================= */
  return { misEvent, genMission, setGoal };
}
