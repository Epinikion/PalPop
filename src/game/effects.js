import { $, RM } from '../core/dom.js';
export function createGameEffects({ game }) {
  /* ================= effects ================= */
  const CONF = ['#ff5a7a', '#ffa04a', '#ffe45c', '#6fe48a', '#56b8ff', '#a77bff', '#ffffff'];
  function burst(x, y, cols, n, spd, grav) {
    for (let i = 0; i < n && game.parts.length < 650; i++) {
      const a = Math.random() * 6.283,
        s = spd * (0.3 + Math.random() * 0.9);
      game.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 25,
        l: 0.45 + Math.random() * 0.5,
        c: cols[i % cols.length],
        sz: Math.random() < 0.3 ? 2 : 1,
        g: grav == null ? 150 : grav,
      });
    }
  }
  function sparkles(x, y, n, spd) {
    for (let i = 0; i < n && game.parts.length < 650; i++) {
      const a = Math.random() * 6.283,
        sp = spd * (0.4 + Math.random() * 0.7);
      game.parts.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 15,
        l: 0.5 + Math.random() * 0.5,
        c: i % 2 ? '#ffffff' : '#ffe45c',
        sz: 1,
        g: 40,
        star: true,
      });
    }
  }
  function confetti(x, y) {
    if (game.parts.length < 650)
      game.parts.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 50,
        vy: Math.random() * 25,
        l: 1.3 + Math.random() * 0.9,
        c: CONF[(Math.random() * 7) | 0],
        g: 40,
        conf: true,
        ph: Math.random() * 6,
        sz: 1,
      });
  }
  function dust(x, y, iv) {
    const n = Math.min(6, 2 + ((iv / 80) | 0));
    for (let i = 0; i < n && game.parts.length < 650; i++) {
      const sg = i % 2 ? 1 : -1;
      game.parts.push({
        x: x + Math.random() * 6 - 3,
        y,
        vx: sg * (15 + Math.random() * 35),
        vy: -10 - Math.random() * 25,
        l: 0.28 + Math.random() * 0.2,
        c: '#e6d8ff',
        sz: Math.random() < 0.5 ? 2 : 1,
        g: 60,
      });
    }
  }
  function ring(x, y, rmax, c) {
    game.rings.push({
      x,
      y,
      r: 2,
      rmax,
      c,
      l: 0.32,
    });
  }
  function popup(x, y, txt, col, sc, life) {
    game.popups.push({
      x,
      y,
      txt,
      col,
      sc: sc || 1,
      l: life || 0.9,
      L: life || 0.9,
    });
  }
  function shake(m) {
    if (!RM) game.shakeMagnitude = Math.max(game.shakeMagnitude, m);
  }
  function bumpEl(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove('on'), 1600);
  }

  /* ================= special pals ================= */
  return { burst, ring, popup, shake, sparkles, bumpEl, confetti, dust, toast };
}
