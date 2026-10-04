import { $, vib } from '../core/dom.js';
import { FL, FR, FT, TIERS, W } from '../config.js';
export function createGameProgression({
  audioReactions,
  game,
  gameEffects,
  renderSprites,
  uiInterface,
}) {
  /* ================= missions & progression ================= */
  /**
   * The goal strip. Goals teach the game, then keep steering it: make a pal, chain merges, start
   * a fever. They pay a swap (and XP at the end of the run), not score, so a lucky goal cannot
   * decide a run. `game.rand` keeps a daily run's goals the same for everyone.
   */
  function genMission(k) {
    const rand = game.rand;
    let m;
    if (k === 0) m = { type: 'make', t: 2, n: 3 };
    else if (k === 1) m = { type: 'combo', n: 2 };
    else if (k === 2) m = { type: 'make', t: 4, n: 2 };
    else {
      const r = rand();
      if (r < 0.6) {
        const t = Math.min(8, 3 + Math.floor(rand() * Math.min(6, k - 1)));
        m = { type: 'make', t, n: t >= 7 ? 1 : t >= 5 ? 2 : 3 };
      } else if (r < 0.9) m = { type: 'combo', n: Math.min(5, 2 + Math.floor(k / 3)) };
      else m = { type: 'fever', n: 1 };
    }
    m.p = 0;
    m.k = k;
    m.reward = 25;
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
          : 'START A FEVER';
    updGoal();
  }
  function updGoal() {
    const m = game.mission;
    if (!m) return;
    $('#goalNum').textContent = m.done ? 'DONE' : m.type === 'combo' ? 'X' + m.p : m.p + '/' + m.n;
    $('#goalBar').style.width = Math.min(1, m.p / m.n) * 100 + '%';
  }
  function misEvent(type, val, t) {
    const m = game.mission;
    if (game.phase !== 'play' || !m || m.done || m.type !== type) return;
    if (type === 'make') {
      if (t !== m.t) return;
      m.p++;
    } else if (type === 'combo') m.p = Math.max(m.p, val);
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
    game.swaps = Math.min(game.swapsCap, game.swaps + 1);
    uiInterface.updSwaps();
    gameEffects.popup(W / 2, 70, 'GOAL!', '#7dffc4', 1, 1.2);
    gameEffects.popup(W / 2, 82, game.swapsCap ? '+1 SWAP' : '+XP', '#fff', 1, 1.2);
    for (let i = 0; i < 14; i++) gameEffects.confetti(FL + Math.random() * (FR - FL), FT + 2);
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
