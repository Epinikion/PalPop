import { BAY, TIERS } from '../config.js';
import { mkc } from '../core/dom.js';
/** Whether a pixel lies inside a circle of radius r around (ox, oy). */
const circle =
  (r, ox = 0, oy = 0) =>
  (x, y) =>
    Math.hypot(x + 0.5 - ox, y + 0.5 - oy) <= r;
export function createRenderSprites({}) {
  function paint(i, r, m, bl) {
    const ramp = TIERS[i].ramp,
      S = 2 * Math.ceil(r + m),
      c0 = S / 2,
      D = '#1b1230',
      WHITE = '#ffffff';
    const cv = mkc(S, S),
      g = cv.getContext('2d');
    const px = (x, y, c) => {
      g.fillStyle = c;
      g.fillRect(c0 + x, c0 + y, 1, 1);
    };
    const mx = (x, y, c) => {
      px(x, y, c);
      px(-1 - x, y, c);
    };
    const rect = (x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(c0 + x, c0 + y, w, h);
    };
    const mrect = (x, y, w, h, c) => {
      rect(x, y, w, h, c);
      rect(-x - w, y, w, h, c);
    };
    const rr = (x, y, w, h, c) => {
      rect(x + 1, y, w - 2, h, c);
      rect(x, y + 1, w, h - 2, c);
    };
    const line = (x0, y0, x1, y1, c) => {
      let dx = Math.abs(x1 - x0),
        dy = -Math.abs(y1 - y0),
        sx = x0 < x1 ? 1 : -1,
        sy = y0 < y1 ? 1 : -1,
        e = dx + dy;
      for (;;) {
        px(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) {
          e += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          e += dx;
          y0 += sy;
        }
      }
    };
    const mline = (x0, y0, x1, y1, c) => {
      line(x0, y0, x1, y1, c);
      line(-1 - x0, y0, -1 - x1, y1, c);
    };
    const ell = (cx, cy, rx, ry, c, e) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx,
            dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy > 1) continue;
          let col = c;
          if (e) {
            const ix = (x + 0.5 - cx) / Math.max(0.5, rx - 1),
              iy = (y + 0.5 - cy) / Math.max(0.5, ry - 1);
            if (ix * ix + iy * iy > 1) col = e;
          }
          px(x, y, col);
        }
    };
    const disc = (cx, cy, rad, c, e) => ell(cx, cy, rad, rad, c, e);
    const tri = (a, b, c2, col) => {
      const x0 = Math.floor(Math.min(a[0], b[0], c2[0])),
        x1 = Math.ceil(Math.max(a[0], b[0], c2[0]));
      const y0 = Math.floor(Math.min(a[1], b[1], c2[1])),
        y1 = Math.ceil(Math.max(a[1], b[1], c2[1]));
      const sg = (p, q, s) => (p[0] - s[0]) * (q[1] - s[1]) - (q[0] - s[0]) * (p[1] - s[1]);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const p = [x + 0.5, y + 0.5],
            d1 = sg(p, a, b),
            d2 = sg(p, b, c2),
            d3 = sg(p, c2, a);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) px(x, y, col);
        }
    };
    const tri2 = (a, b, c2, fill, edge, inner) => {
      tri(a, b, c2, edge);
      const cx = (a[0] + b[0] + c2[0]) / 3,
        cy = (a[1] + b[1] + c2[1]) / 3;
      const sh = (p, k) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k];
      tri(sh(a, 0.66), sh(b, 0.66), sh(c2, 0.66), fill);
      if (inner) tri(sh(a, 0.36), sh(b, 0.36), sh(c2, 0.36), inner);
    };
    const mtri2 = (a, b, c2, f, e, n) => {
      tri2(a, b, c2, f, e, n);
      tri2([-a[0], a[1]], [-b[0], b[1]], [-c2[0], c2[1]], f, e, n);
    };
    const smile = (hw, y, c) => {
      for (let k = 0; k < hw; k++) mx(k, k === hw - 1 && hw > 1 ? y - 1 : y, c);
    };
    const eye1 = (cx, cy, rx, ry, col) => {
      ell(cx, cy, rx, ry, col || D);
      const x0 = Math.round(cx - rx),
        y0 = Math.round(cy - ry);
      px(x0 + 1, y0 + 1, '#fff');
      if (ry >= 2) px(x0 + 1, y0 + 2, '#fff');
      if (rx >= 1.6) px(Math.round(cx + rx) - 1, Math.round(cy + ry) - 1, '#fff');
    };
    const meye = (cx, cy, rx, ry, col) => {
      eye1(cx, cy, rx, ry, col);
      eye1(-1 - cx, cy, rx, ry, col);
    };
    function body(rad, rp, ox, oy, keep) {
      ox = ox || 0;
      oy = oy || 0;
      const R = Math.ceil(rad) + 2;
      for (let y = Math.floor(oy - R); y <= Math.ceil(oy + R); y++)
        for (let x = Math.floor(ox - R); x <= Math.ceil(ox + R); x++) {
          const dx = x + 0.5 - ox,
            dy = y + 0.5 - oy,
            d = Math.hypot(dx, dy);
          if (d > rad) continue;
          if (keep && !keep(x, y)) continue;
          let col;
          if (d > rad - 1.05) col = rp[0];
          else {
            const nx = dx / rad,
              ny = dy / rad,
              nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            let l = -0.45 * nx - 0.62 * ny + 0.64 * nz;
            l += (BAY[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] / 16 - 0.5) * 0.13;
            col =
              l > 0.95 ? '#ffffff' : l > 0.8 ? rp[4] : l > 0.56 ? rp[3] : l > 0.27 ? rp[2] : rp[1];
          }
          px(x, y, col);
        }
    }
    const sparkle = (x, y, c = '#fffdf0') => {
      px(x, y, c);
      px(x - 1, y, c);
      px(x + 1, y, c);
      px(x, y - 1, c);
      px(x, y + 1, c);
    };
    /** An ellipse turned by `ang` (radians), filled with `c` and edged with `e`. */
    const rell = (cx, cy, rx, ry, ang, c, e) => {
      const R = Math.ceil(Math.max(rx, ry)) + 1,
        co = Math.cos(ang),
        si = Math.sin(ang);
      for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
        for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
          const dx = x + 0.5 - cx,
            dy = y + 0.5 - cy,
            u = (dx * co + dy * si) / rx,
            v = (-dx * si + dy * co) / ry;
          const d = u * u + v * v;
          if (d > 1) continue;
          const ui = (dx * co + dy * si) / Math.max(0.5, rx - 1),
            vi = (-dx * si + dy * co) / Math.max(0.5, ry - 1);
          px(x, y, e && ui * ui + vi * vi > 1 ? e : c);
        }
    };
    /** One glossy eye in a w×h box at (x, y): rounded, a coloured lower part, a big and a small shine. */
    function eye(x, y, w, h, iris) {
      const round = w >= 4 && h >= 4;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          if (round && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
          const low = iris && j >= h - Math.max(1, Math.round(h * 0.38));
          px(x + i, y + j, low ? iris : D);
        }
      // the big shine up left (in the left column of a narrow eye), the small one down right
      rect(x + (w >= 4 ? 1 : 0), y + (h >= 4 ? 1 : 0), w >= 5 ? 2 : 1, h >= 5 ? 2 : 1, WHITE);
      if (h >= 6) px(x + w - 2, y + h - 2, WHITE);
    }
    /** A closed, happy eye (an arch) in the same box. */
    function shut(x, y, w, h, c = D) {
      const yy = y + Math.floor(h / 2);
      if (w <= 2) {
        rect(x, yy, w, 1, c);
        return;
      }
      rect(x + 1, yy - 1, w - 2, 1, c);
      px(x, yy, c);
      px(x + w - 1, yy, c);
    }
    /** Both eyes: the right one's box starts at x, the left one mirrors it. */
    const eyes = (x, y, w, h, iris, closed) => {
      for (const ex of [x, -x - w]) closed ? shut(ex, y, w, h) : eye(ex, y, w, h, iris);
    };
    /** Rosy cheeks, mirrored: a w×h patch whose right one starts at x. */
    function cheeks(x, y, w, h, c) {
      for (const cx of [x, -x - w])
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++) {
            if (w >= 4 && h >= 3 && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
            px(cx + i, y + j, c);
          }
    }
    /** A cat's ω mouth, six pixels wide. */
    const omega = (y, c = D) => {
      mx(2, y, c);
      mx(0, y, c);
      mx(1, y + 1, c);
    };
    /** A small u-shaped smile, 2·hw wide. */
    const smileU = (y, hw, c = D) => {
      mx(hw - 1, y, c);
      for (let k = 0; k < hw - 1; k++) mx(k, y + 1, c);
    };
    /** An open, laughing mouth (2·hw wide, h tall) with a tongue in its lower half. */
    function laugh(y, hw, h, c = '#4a1030', tongue = '#ff7f9f') {
      for (let j = 0; j < h; j++) {
        const w = hw - (j === h - 1 ? 1 : 0) - (j === 0 ? 0 : 0);
        for (let k = 0; k < w; k++) mx(k, y + j, c);
      }
      for (let j = Math.ceil(h / 2); j < h; j++) {
        const w = hw - (j === h - 1 ? 2 : 1);
        for (let k = 0; k < w; k++) mx(k, y + j, tongue);
      }
    }
    /**
     * Any shape, outlined and lit like the game's spheres: `test(x, y)` says which pixels belong to
     * it; the light follows a sphere of radius `rad` around (ox, oy).
     */
    function blob(test, rp, rad, ox = 0, oy = 0, R = rad + 4) {
      for (let y = Math.floor(oy - R); y <= Math.ceil(oy + R); y++)
        for (let x = Math.floor(ox - R); x <= Math.ceil(ox + R); x++) {
          if (!test(x, y)) continue;
          let col;
          if (!test(x - 1, y) || !test(x + 1, y) || !test(x, y - 1) || !test(x, y + 1)) col = rp[0];
          else {
            const dx = (x + 0.5 - ox) / rad,
              dy = (y + 0.5 - oy) / rad,
              nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
            let l = -0.45 * dx - 0.62 * dy + 0.64 * nz;
            l += (BAY[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] / 16 - 0.5) * 0.13;
            col =
              l > 0.95 ? '#ffffff' : l > 0.8 ? rp[4] : l > 0.56 ? rp[3] : l > 0.27 ? rp[2] : rp[1];
          }
          px(x, y, col);
        }
    }
    switch (i) {
      case 0: {
        // Blipp - a little blue slime with a two-leaf sprout
        body(r, ramp);
        const L = '#5fe08a';
        px(0, -7, '#2f9e4f');
        for (const [x, y] of [
          [-1, -8],
          [-2, -8],
          [-2, -9],
          [-3, -9],
          [1, -8],
          [1, -9],
          [2, -9],
          [2, -10],
          [3, -10],
        ])
          px(x, y, L);
        px(-2, -9, '#b8ffd0');
        px(2, -10, '#b8ffd0');
        eyes(1, -1, 2, 3, null, bl);
        mx(0, 2, D);
        mrect(3, 1, 2, 1, '#ff8fc0');
        break;
      }
      case 1: {
        // Chirpy - a round chick with a curl on top, tiny wings and feet
        mrect(1, 7, 2, 1, '#ff9a2a');
        ell(7.2, 1.5, 1.6, 2.6, ramp[1], ramp[0]);
        ell(-7.2, 1.5, 1.6, 2.6, ramp[1], ramp[0]);
        body(r, ramp);
        for (const [x, y] of [
          [0, -8],
          [0, -9],
          [1, -10],
          [-1, -9],
        ])
          px(x, y, ramp[1]);
        px(0, -9, ramp[2]);
        eyes(2, -1, 2, 3, null, bl);
        rect(-1, 1, 2, 1, '#ffb02a');
        rect(-1, 2, 2, 1, '#e0701a');
        mrect(4, 1, 2, 1, '#ff8f9f');
        break;
      }
      case 2: {
        // Bunbun - a bunny with round ears, a yellow bow, a pink nose and a little mouth
        for (const s of [1, -1]) {
          ell(s * 3.6, -9.6, 2.4, 4.6, ramp[2], ramp[0]);
          ell(s * 3.6, -9.2, 1.1, 3.2, '#ff8fbd');
        }
        body(r, ramp);
        for (const [x, y] of [
          [1, -10],
          [2, -10],
          [5, -10],
          [6, -10],
          [1, -9],
          [2, -9],
          [5, -9],
          [6, -9],
          [1, -8],
          [2, -8],
          [5, -8],
          [6, -8],
          [3, -9],
          [4, -9],
        ])
          px(x, y, '#ffd23f');
        px(3, -9, '#e39a1c');
        px(4, -9, '#e39a1c');
        px(1, -10, '#fff2a0');
        px(5, -10, '#fff2a0');
        eyes(2, -2, 4, 4, null, bl);
        mx(0, 2, '#ff4f8a');
        mx(1, 3, '#8a2a52');
        mrect(5, 2, 2, 1, '#ff5c95');
        break;
      }
      case 3: {
        // Froggo - a frog with big round eyes on top, a soft smile, rosy cheeks and little feet
        body(4.8, ramp, 5.5, -8);
        body(4.8, ramp, -5.5, -8);
        body(r, ramp);
        for (const s of [1, -1]) ell(s * 4.5, 10.6, 2.4, 1.4, ramp[2], ramp[0]);
        eyes(4, -10, 4, 4, null, bl);
        smileU(1, 3, ramp[0]);
        cheeks(6, 0, 3, 2, '#ff8fa8');
        break;
      }
      case 4: {
        // Tabby - a cat with pink ears, big green eyes, whiskers and white paws
        mtri2([3.5, -10.5], [11.5, -6], [10.5, -16], ramp[2], ramp[0], '#ff9aa8');
        body(r, ramp);
        rect(-1, -12, 2, 3, ramp[1]);
        mrect(3, -11, 1, 2, ramp[1]);
        ell(0, 3.5, 4.8, 3.2, ramp[4]);
        eyes(3, -5, 4, 5, '#2f8a3a', bl);
        rect(-1, 1, 2, 1, '#ff6f8f');
        omega(2, D);
        cheeks(7, 1, 3, 2, '#ff9aa8');
        for (const s of [1, -1]) {
          line(s > 0 ? 9 : -10, 2, s > 0 ? 13 : -14, 1, ramp[4]);
          line(s > 0 ? 9 : -10, 4, s > 0 ? 13 : -14, 5, ramp[4]);
          ell(s * 4.5, 11.6, 2.6, 1.6, ramp[4], ramp[0]);
        }
        break;
      }
      case 5: {
        // Pandi - a panda with sparkly eyes in its patches, a tiny nose and a bamboo leaf
        disc(10.5, -11, 4.2, ramp[0], ramp[0]);
        disc(-10.5, -11, 4.2, ramp[0], ramp[0]);
        body(r, ramp);
        rell(6.2, -1, 3.6, 4.8, -0.45, ramp[0]);
        rell(-6.2, -1, 3.6, 4.8, 0.45, ramp[0]);
        for (const x of [5, -7])
          if (bl) shut(x - 1, -2, 4, 3, '#ffffff');
          else {
            rect(x, -3, 2, 2, '#ffffff');
            px(x + 1, 0, '#ffffff');
          }
        rect(-1, 3, 2, 1, D);
        omega(4, D);
        cheeks(9, 4, 3, 2, '#ffb3c6');
        rell(2.5, -14.2, 2.8, 1.1, -0.35, '#6fd36a', '#2f8a3a');
        px(4, -15, '#b8f5a8');
        break;
      }
      case 6: {
        // Boo - a ghost with a wavy hem, waving arms, big eyes and an open "oo" mouth
        const hem = (x) => 14 - 2.6 * Math.abs(Math.sin(((x + 0.5) * Math.PI) / 7));
        ell(16.5, 1, 3.2, 2.4, ramp[2], ramp[0]);
        ell(-16.5, 1, 3.2, 2.4, ramp[2], ramp[0]);
        blob((x, y) => circle(r)(x, y) && y + 0.5 < hem(x) + 3.5, ramp, r);
        rect(-1, -19, 2, 2, ramp[2]);
        rect(0, -21, 2, 2, ramp[2]);
        px(0, -20, ramp[1]);
        eyes(4, -7, 5, 7, '#5b3fb0', bl);
        ell(0, 4, 2.2, 2.4, '#3a0f4a');
        ell(0, 5.2, 1.4, 1, '#ff7fa8');
        cheeks(10, 1, 4, 2, '#ff8fc0');
        break;
      }
      case 7: {
        // Hootie - a night owl: heart-shaped face, amber eyes, tucked wings and two stars
        mtri2([5, -16], [11, -13], [12, -22], ramp[2], ramp[0], ramp[3]);
        body(r, ramp);
        ell(16.5, 5, 3.4, 9, ramp[1], ramp[0]);
        ell(-16.5, 5, 3.4, 9, ramp[1], ramp[0]);
        ell(0, 11, 9.5, 7.5, ramp[3]);
        for (const [x, y] of [
          [-5, 8],
          [2, 8],
          [-2, 12],
          [5, 12],
          [-6, 14],
          [1, 15],
        ]) {
          px(x, y, ramp[2]);
          px(x + 1, y + 1, ramp[2]);
          px(x + 2, y, ramp[2]);
        }
        disc(6.5, -4, 7.2, '#fff4dc', '#e6c48e');
        disc(-6.5, -4, 7.2, '#fff4dc', '#e6c48e');
        ell(0, -1, 9, 6, '#fff4dc');
        eyes(4, -8, 5, 7, '#c06a14', bl);
        tri([-2, 0], [2, 0], [0, 3], '#ffb02a');
        px(-1, 0, '#ffd88a');
        cheeks(10, 1, 4, 2, '#ff9ab8');
        mrect(4, 19, 2, 2, '#ffb02a');
        mrect(7, 19, 2, 2, '#ffb02a');
        sparkle(-17, -16, '#fff3a8');
        sparkle(18, -9, '#fff3a8');
        break;
      }
      case 8: {
        // Bolt - a robot with a screen face, round LED eyes, pink blush lights and a heart antenna
        // a little heart on top, like an antenna light
        mx(1, -26, '#ff5a7a');
        mx(2, -26, '#ff5a7a');
        for (let x = -3; x <= 2; x++) px(x, -25, '#ff5a7a');
        for (let x = -2; x <= 1; x++) px(x, -24, '#ff5a7a');
        px(-2, -26, '#ffb3c6');
        body(r, ramp);
        mx(0, -23, '#ff5a7a');
        mrect(20, -4, 4, 8, ramp[0]);
        mrect(21, -3, 2, 6, ramp[3]);
        rr(-14, -12, 28, 22, ramp[0]);
        rr(-13, -11, 26, 20, '#0c2233');
        rect(-11, -10, 9, 1, '#245779');
        const led = '#4dffb0';
        for (const x of [4, -8])
          if (bl) {
            rect(x + 1, -5, 2, 1, led);
            px(x, -4, led);
            px(x + 3, -4, led);
          } else {
            rect(x + 1, -7, 2, 5, led);
            rect(x, -6, 4, 3, led);
            px(x + 1, -6, '#eafff5');
            px(x + 1, -5, '#eafff5');
          }
        omega(1, led);
        for (const x of [8, -11]) rect(x, 0, 3, 1, '#ff7aa8');
        mx(15, -15, ramp[4]);
        mx(15, 14, ramp[4]);
        rect(-6, 13, 12, 1, ramp[1]);
        rect(-6, 15, 12, 1, ramp[1]);
        break;
      }
      case 9: {
        // Drako - a little ringed planet with a happy face and a sleepy moon
        const ring = (front) => {
          for (let y = -6; y <= 14; y++)
            for (let x = -31; x <= 30; x++) {
              const tx = x + 0.5,
                ty = y + 0.5 - 4 + tx * 0.12,
                e = (tx / 30.5) ** 2 + (ty / 7.5) ** 2;
              if (e > 1 || e < 0.5 || ty > 0 !== front) continue;
              if (!front && Math.hypot(tx, y + 0.5) < r) continue;
              px(
                x,
                y,
                e > 0.93 ? '#a8543a' : e < 0.57 ? '#c8683e' : e < 0.74 ? '#ffd6a8' : '#ffa86a',
              );
            }
        };
        ring(false);
        body(r, ramp);
        for (let x = -24; x <= 23; x++)
          for (const [y0, c] of [
            [-17, ramp[3]],
            [-13, ramp[3]],
            [17, ramp[1]],
            [21, ramp[1]],
          ]) {
            const y = y0 + Math.round(Math.sin(x * 0.35 + y0));
            if (Math.hypot(x + 0.5, y + 0.5) < r - 1.5) {
              px(x, y, c);
              px(x, y + 1, c);
            }
          }
        ring(true);
        eyes(5, -10, 6, 8, '#0f5560', bl);
        omega(0, D);
        cheeks(12, -2, 4, 2, '#ff9ab8');
        // the moon, asleep
        disc(-24, -21, 3.6, '#e6e8f6', '#8a8fb0');
        px(-26, -21, '#6a6f90');
        px(-25, -20, '#6a6f90');
        px(-23, -21, '#6a6f90');
        px(-22, -20, '#6a6f90');
        px(-23, -19, '#ffb3c6');
        sparkle(24, -22, '#fffdf0');
        sparkle(-28, 12, '#ffe45c');
        break;
      }
      case 10: {
        // Solis - the sun: soft round rays, big sparkly eyes and a big laugh
        for (let n = 0; n < 12; n++) {
          const a = (n * Math.PI) / 6 + Math.PI / 12,
            long = n % 2 === 0,
            rb = r - 2,
            tip = r + (long ? 6.2 : 4.2),
            h = long ? 0.2 : 0.17;
          tri2(
            [rb * Math.cos(a - h), rb * Math.sin(a - h)],
            [rb * Math.cos(a + h), rb * Math.sin(a + h)],
            [tip * Math.cos(a), tip * Math.sin(a)],
            long ? '#ffd21a' : '#ffb21a',
            '#7a3200',
          );
        }
        body(r, ramp);
        eyes(6, -11, 6, 9, '#8a3a00', bl);
        laugh(1, 6, 7, '#5a1400', '#ff6f8a');
        cheeks(13, -1, 5, 3, '#ff7a5a');
        sparkle(-16, -15, '#fffdf0');
        sparkle(-11, -19, '#fffdf0');
        sparkle(17, -11, '#fffdf0');
        break;
      }
      case 11: {
        // Prism - the wildcard: soft rainbow stripes, big eyes and a star on top
        body(r, ramp);
        const RB = ['#ff8fa8', '#ffbe7a', '#fff08a', '#9ff0a8', '#8fd0ff', '#c6a8ff'],
          R = r - 1.05,
          C = Math.ceil(r);
        for (let y = -C; y <= C; y++)
          for (let x = -C; x <= C; x++) {
            const dx = x + 0.5,
              dy = y + 0.5;
            if (Math.hypot(dx, dy) > R) continue;
            let col = RB[((Math.floor((dx - dy + 40) / 2.5) % 6) + 6) % 6];
            if (
              (-0.45 * dx - 0.62 * dy) / r > 0.3 &&
              BAY[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] < 8
            )
              col = '#ffffff';
            px(x, y, col);
          }
        eyes(2, -1, 2, 3, null, bl);
        mx(0, 2, D);
        mrect(4, 1, 2, 1, '#ff6f9f');
        sparkle(0, -9, '#fffbe0');
        px(-1, -9, '#ffe45c');
        break;
      }
      case 12:
        // Boomer - bomb pal (retired from play; its sprite stays so saves and ids hold)
        body(r, ramp);
        rect(-3, -10, 6, 3, ramp[3]);
        rect(-3, -10, 6, 1, ramp[4]);
        rect(-3, -8, 6, 1, ramp[0]);
        line(1, -11, 3, -13, '#d9b26a');
        px(4, -13, '#ffe45c');
        px(5, -13, '#ff9a3c');
        px(4, -12, '#ff9a3c');
        meye(3, -3, 1.4, 1.6, '#6a3018');
        if (bl) {
          mrect(2, -5, 2, 4, ramp[3]);
          mrect(2, -4, 2, 1, '#a05030');
          mx(1, -3, '#a05030');
          mx(4, -3, '#a05030');
        }
        smile(2, 3, D);
        mx(0, 4, '#ff7fa8');
        mrect(5, 1, 2, 1, '#ff8fb5');
        break;
      case 13: {
        // Goldie - a shiny coin pal with a star on its forehead
        body(r, ramp);
        for (let y = -9; y <= 9; y++)
          for (let x = -9; x <= 9; x++) {
            const d = Math.hypot(x + 0.5, y + 0.5);
            if (d > r - 2.4 && d < r - 1.4) px(x, y, ramp[1]);
          }
        eyes(2, -2, 4, 4, null, bl);
        mx(0, 2, '#7a3d00');
        mrect(5, 2, 2, 1, '#ff8fb5');
        rect(-1, -6, 2, 1, '#fff2b0');
        mx(1, -5, '#fff2b0');
        mx(0, -5, '#ffffff');
        sparkle(6, -6, '#fff');
        break;
      }
      case 14: {
        // Zappy - an electric pal with spiky hair and a lightning cheek
        tri2([-6, -7], [-2, -8], [-5, -13], ramp[3], ramp[0]);
        tri2([-2, -8], [2, -8], [0, -14], ramp[3], ramp[0]);
        tri2([2, -8], [6, -7], [5, -13], ramp[3], ramp[0]);
        body(r, ramp);
        eyes(2, -2, 4, 4, null, bl);
        mx(0, 2, D);
        mrect(5, 2, 2, 1, '#ff8fb5');
        for (const [x, y] of [
          [4, 3],
          [5, 3],
          [3, 4],
          [4, 4],
          [3, 5],
          [4, 5],
          [5, 5],
          [4, 6],
          [3, 7],
        ])
          px(x, y, '#ffffff');
        break;
      }
      case 15: {
        // Icy - a frost pal with icicle hair, a snowflake and a red scarf
        tri2([-7, -6], [-3, -8], [-6, -12], ramp[3], ramp[0]);
        tri2([-2, -8], [2, -8], [0, -13], ramp[4], ramp[0]);
        tri2([3, -8], [7, -6], [6, -12], ramp[3], ramp[0]);
        body(r, ramp);
        rect(-1, -6, 2, 1, '#fff');
        mx(1, -7, '#fff');
        mx(1, -5, '#fff');
        eyes(2, -3, 4, 4, null, bl);
        mx(0, 1, ramp[0]);
        mrect(5, 0, 2, 1, '#ffb0d0');
        for (let y = 3; y <= 4; y++)
          for (let x = -9; x <= 8; x++)
            if (Math.hypot(x + 0.5, y + 0.5) < r - 1) px(x, y, y === 3 ? '#ff5a5a' : '#c8302c');
        rect(3, 5, 2, 3, '#e8443c');
        px(3, 7, '#c8302c');
        break;
      }
    }
    return cv;
  }
  function silhouette(spr, color) {
    const c = mkc(spr.width, spr.height),
      g = c.getContext('2d');
    g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /* Locked pals show as a silhouette that still reads against the dark panel. */
  const LOCKED = '#54447f';
  const SPR = TIERS.map((t, i) => paint(i, t.r, t.m, false));
  const SPRB = TIERS.map((t, i) => paint(i, t.r, t.m, true));
  const WH = SPR.map((s) => silhouette(s, '#ffffff'));
  const DK = SPR.map((s) => silhouette(s, LOCKED));
  /* ---- custom pals designed in tools/pal-designer.html (stored in localStorage) ---- */
  const CUSTOM = (() => {
    const out = {};
    let defs = null;
    try {
      const raw = localStorage.getItem('palpop:customSprites');
      defs = raw ? JSON.parse(raw) : null;
    } catch (e) {}
    if (!defs) return out;
    const build = (fr) => {
      if (!fr || !fr.w || !fr.h || !Array.isArray(fr.px)) return null;
      const c = mkc(fr.w, fr.h),
        g = c.getContext('2d'),
        pal = fr.pal || [];
      for (let i = 0; i < fr.px.length; i++) {
        const k = fr.px[i];
        if (!k) continue;
        g.fillStyle = pal[k - 1] || '#fff';
        g.fillRect(i % fr.w, (i / fr.w) | 0, 1, 1);
      }
      return c;
    };
    for (const key in defs) {
      const t = +key;
      if (!(t >= 0 && t < TIERS.length)) continue;
      const d = defs[key] || {},
        o = build(d.open);
      if (!o) continue;
      const blinky =
        d.blink && Array.isArray(d.blink.px) && d.blink.px.some((v) => v) ? build(d.blink) : null;
      SPR[t] = o;
      SPRB[t] = blinky || o;
      WH[t] = silhouette(SPR[t], '#ffffff');
      DK[t] = silhouette(SPR[t], LOCKED);
      out[t] = 1;
    }
    return out;
  })();
  /** A white one-pixel outline around a sprite: the landing spot is drawn with it. */
  const OUT = SPR.map((spr) => {
    const w = spr.width + 2,
      h = spr.height + 2,
      src = mkc(w, h),
      g = src.getContext('2d');
    g.drawImage(spr, 1, 1);
    const data = g.getImageData(0, 0, w, h).data,
      solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 40,
      out = mkc(w, h),
      o = out.getContext('2d');
    o.fillStyle = '#ffffff';
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (
          !solid(x, y) &&
          (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))
        )
          o.fillRect(x, y, 1, 1);
    return out;
  });
  const HALO = TIERS.map((T) => {
    const R = T.r + 7,
      S = Math.ceil(R) * 2,
      c = mkc(S, S),
      g = c.getContext('2d'),
      c0 = S / 2;
    g.fillStyle = T.ramp[3];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - c0, y + 0.5 - c0),
          k = 1 - (d - T.r * 0.7) / (R - T.r * 0.7);
        if (k > 0 && Math.min(1, k) * 16 > BAY[(y & 3) * 4 + (x & 3)]) g.fillRect(x, y, 1, 1);
      }
    return c;
  });
  function iconFrom(rows, pal) {
    const c = mkc(rows[0].length, rows.length),
      g = c.getContext('2d');
    rows.forEach((r, y) =>
      [...r].forEach((ch, x) => {
        if (pal[ch]) {
          g.fillStyle = pal[ch];
          g.fillRect(x, y, 1, 1);
        }
      }),
    );
    return c;
  }
  const IPAL = {
    o: '#1b1230',
    y: '#ffd23f',
    r: '#ff5a3c',
    w: '#fff7d0',
  };
  const ICON = {
    combo: iconFrom(
      [
        '....oooo.',
        '...oyyo..',
        '..oyyo...',
        '.oyyyyyo.',
        '.ooooyyo.',
        '....oyo..',
        '...oyo...',
        '..oyo....',
        '..oo.....',
      ],
      IPAL,
    ),
    score: iconFrom(
      [
        '....o....',
        '...oyo...',
        'oooyyyooo',
        'oyyywyyyo',
        '.oyyyyyo.',
        '..oyyyo..',
        '.oyyoyyo.',
        '.oyo.oyo.',
        '.oo...oo.',
      ],
      IPAL,
    ),
    fever: iconFrom(
      [
        '....o....',
        '...oyo...',
        '..oyyo...',
        '..oyyyo..',
        '.oyyryyo.',
        '.oyrrryo.',
        'oyyrrryyo',
        '.oyyryyo.',
        '..ooooo..',
      ],
      IPAL,
    ),
  };

  /* ================= themed worlds ================= */
  return { SPR, ICON, SPRB, WH, HALO, DK, OUT, CUSTOM };
}
