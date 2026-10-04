import { BAY, TIERS } from '../config.js';
import { mkc } from '../core/dom.js';
export function createRenderSprites({}) {
  function paint(i, r, m, bl) {
    const ramp = TIERS[i].ramp,
      S = 2 * Math.ceil(r + m),
      c0 = S / 2,
      D = '#1b1230';
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
    function body(rad, rp, ox, oy) {
      ox = ox || 0;
      oy = oy || 0;
      const R = Math.ceil(rad) + 2;
      for (let y = Math.floor(oy - R); y <= Math.ceil(oy + R); y++)
        for (let x = Math.floor(ox - R); x <= Math.ceil(ox + R); x++) {
          const dx = x + 0.5 - ox,
            dy = y + 0.5 - oy,
            d = Math.hypot(dx, dy);
          if (d > rad) continue;
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
    switch (i) {
      case 0:
        // Blipp - slime with a sprout
        body(r, ramp);
        mrect(0, -8, 1, 2, '#2f9e4f');
        mrect(1, -10, 2, 2, '#5fe08a');
        mrect(1, -9, 1, 1, '#2f9e4f');
        meye(2, -2, 1.3, 1.5);
        smile(2, 2, D);
        mx(4, 1, '#ff8fb5');
        break;
      case 1:
        // Chirpy - chick
        body(r, ramp);
        mrect(0, -9, 1, 2, ramp[2]);
        mrect(0, -10, 1, 1, ramp[0]);
        mrect(1, -9, 1, 2, ramp[0]);
        mrect(6, 0, 2, 3, ramp[1]);
        mrect(6, 0, 1, 1, ramp[3]);
        meye(3, -2, 1.3, 1.5);
        rect(-1, 1, 2, 1, '#ffb02a');
        rect(-1, 2, 2, 1, '#e0701a');
        mx(5, 1, '#ff8f9f');
        break;
      case 2:
        // Bunbun - bunny
        mrect(2, -14, 4, 9, ramp[0]);
        mrect(3, -13, 2, 8, ramp[3]);
        mrect(4, -12, 1, 5, '#ff7fae');
        body(r, ramp);
        meye(3, -1, 1.3, 1.6);
        rect(-1, 2, 2, 1, '#d63a70');
        rect(-1, 4, 2, 2, '#ffffff');
        mx(1, 4, '#8a2a52');
        mx(0, 3, '#8a2a52');
        mrect(5, 3, 2, 1, '#ff6a9c');
        break;
      case 3:
        // Froggo - frog
        body(4.5, ramp, 5, -8);
        body(4.5, ramp, -5, -8);
        body(r, ramp);
        disc(5, -8, 3.4, '#ffffff', D);
        disc(-5, -8, 3.4, '#ffffff', D);
        mrect(4, -9, 2, 2, D);
        mx(4, -9, '#ffffff');
        smile(5, 4, ramp[0]);
        mrect(7, 2, 2, 2, '#ff8fa8');
        mx(1, 0, ramp[0]);
        break;
      case 4:
        // Tabby - cat
        mtri2([3, -11], [12, -6], [10, -17], ramp[2], ramp[0], '#ff9aa8');
        body(r, ramp);
        rect(-1, -12, 2, 4, ramp[1]);
        mrect(3, -11, 1, 3, ramp[1]);
        ell(0, 4.5, 5.2, 3.6, ramp[4]);
        meye(4, -3, 1.7, 2.2);
        rect(-1, 2, 2, 1, '#ff6f8f');
        mx(0, 3, D);
        mx(1, 4, D);
        mx(2, 4, D);
        mrect(8, 2, 5, 1, ramp[4]);
        mrect(8, 4, 4, 1, ramp[4]);
        mrect(7, 0, 2, 1, '#ff9aa8');
        break;
      case 5:
        // Pandi - panda
        disc(10, -11, 4.4, ramp[0], ramp[0]);
        disc(-10, -11, 4.4, ramp[0], ramp[0]);
        body(r, ramp);
        ell(5.5, -1, 3.3, 4.3, ramp[0]);
        ell(-5.5, -1, 3.3, 4.3, ramp[0]);
        mrect(5, -3, 2, 2, '#ffffff');
        mx(6, 0, '#ffffff');
        rect(-1, 3, 2, 1, D);
        mx(0, 4, D);
        mx(1, 5, D);
        mx(2, 5, D);
        mrect(9, 4, 3, 2, '#ffb3c6');
        break;
      case 6:
        // Boo - ghost
        disc(17, 3, 3.4, ramp[2], ramp[0]);
        disc(-17, 3, 3.4, ramp[2], ramp[0]);
        body(r, ramp);
        rect(-1, -19, 2, 2, ramp[2]);
        rect(0, -21, 2, 2, ramp[2]);
        px(0, -20, ramp[1]);
        meye(6, -4, 2.2, 2.8);
        ell(0, 6, 3.2, 3.6, '#3a0f4a', D);
        ell(0, 8.2, 2, 1.4, '#ff7fa8');
        mrect(10, 3, 3, 2, '#ff8fc0');
        break;
      case 7: {
        // Hootie - owl
        mtri2([3, -19], [13, -15], [9, -24], ramp[1], ramp[0], ramp[3]);
        body(r, ramp);
        ell(15.5, 4, 3.3, 9, ramp[1], ramp[0]);
        ell(-15.5, 4, 3.3, 9, ramp[1], ramp[0]);
        ell(0, 10, 10.5, 8.5, ramp[3]);
        for (let j = 0; j < 4; j++) {
          const y = 5 + j * 4;
          for (let x = -8 + (j % 2) * 2; x <= 7; x += 4) {
            const ex = x / 10.5,
              ey = (y - 10) / 8.5;
            if (ex * ex + ey * ey < 0.8) {
              px(x, y, ramp[2]);
              px(x + 1, y + 1, ramp[2]);
              px(x + 2, y, ramp[2]);
            }
          }
        }
        disc(7, -5, 6.6, ramp[4], D);
        disc(-7, -5, 6.6, ramp[4], D);
        disc(7, -5, 3.7, '#ffb42a', '#a85a10');
        disc(-7, -5, 3.7, '#ffb42a', '#a85a10');
        ell(6.5, -5, 1.7, 2.3, D);
        ell(-7.5, -5, 1.7, 2.3, D);
        px(5, -7, '#fff');
        px(5, -6, '#fff');
        px(-8, -7, '#fff');
        px(-8, -6, '#fff');
        mrect(12, 1, 3, 2, '#ff9aa8');
        tri([-3, -1], [3, -1], [0, 7], '#7a3a08');
        tri([-2, 0], [2, 0], [0, 5], '#ffb02a');
        break;
      }
      case 8:
        // Bolt - robot
        rect(-1, -25, 2, 3, ramp[1]);
        rect(-2, -26, 4, 2, '#ff5a7a');
        px(-1, -26, '#fff');
        body(r, ramp);
        mrect(20, -4, 4, 8, ramp[0]);
        mrect(21, -3, 2, 6, ramp[3]);
        rr(-13, -11, 26, 20, ramp[0]);
        rr(-12, -10, 24, 18, '#0c2233');
        rect(-10, -9, 8, 1, '#245779');
        mrect(4, -7, 3, 4, '#4dffb0');
        mrect(4, -7, 1, 2, '#eafff5');
        rect(-3, 3, 7, 1, '#4dffb0');
        px(-4, 2, '#4dffb0');
        px(4, 2, '#4dffb0');
        mrect(7, 1, 2, 2, '#ff7aa8');
        mx(15, -15, ramp[4]);
        mx(15, 14, ramp[4]);
        rect(-6, 12, 12, 1, ramp[1]);
        rect(-6, 14, 12, 1, ramp[1]);
        break;
      case 9: {
        // Drako - friendly round dragon: scalloped bat wings, swept horns, golden slit eyes, spade tail
        const poly = (pts, col) => {
          let y0 = 1e9,
            y1 = -1e9;
          for (const p of pts) {
            if (p[1] < y0) y0 = p[1];
            if (p[1] > y1) y1 = p[1];
          }
          for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
            const yy = y + 0.5,
              xc = [];
            for (let k = 0; k < pts.length; k++) {
              const a = pts[k],
                b = pts[(k + 1) % pts.length];
              if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy))
                xc.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
            }
            xc.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xc.length; k += 2)
              for (let x = Math.ceil(xc[k] - 0.5); x <= Math.floor(xc[k + 1] - 0.5); x++)
                px(x, y, col);
          }
        };
        const mpoly = (pts, col) => {
          poly(pts, col);
          poly(
            pts.map((p) => [-1 - p[0], p[1]]),
            col,
          );
        };
        line(12, 15, 19, 21, ramp[0]);
        line(13, 14, 20, 20, ramp[0]);
        line(12, 16, 19, 22, ramp[0]);
        line(19, 21, 25, 19, ramp[0]);
        line(20, 20, 26, 18, ramp[0]);
        line(19, 22, 25, 20, ramp[0]);
        tri2([23, 14], [31, 18], [22, 23], '#b01e30', '#4a0a18');
        mpoly(
          [
            [12, -16],
            [30, -28],
            [29, -14],
            [25, -15],
            [26, -6],
            [21, -8],
            [16, -4],
          ],
          ramp[2],
        );
        mline(12, -16, 30, -28, ramp[0]);
        mline(13, -17, 29, -27, ramp[3]);
        mline(30, -28, 26, -6, ramp[0]);
        mline(30, -28, 16, -4, ramp[0]);
        mline(30, -28, 26, -6, ramp[0]);
        mline(30, -28, 16, -4, ramp[0]);
        mtri2([6, -24], [12, -21], [18, -30], '#ffe9c8', '#7a3a1a');
        tri2([-3, -24], [3, -24], [0, -31], '#ffd9a0', '#7a3a1a');
        body(r, ramp);
        for (let y = 5; y <= 23; y++)
          for (let x = -11; x <= 10; x++) {
            const ex = (x + 0.5) / 10.5,
              ey = (y + 0.5 - 13.5) / 9;
            if (ex * ex + ey * ey > 1) continue;
            px(x, y, y % 3 === 2 ? '#e8a86a' : '#ffd9a0');
          }
        ell(8, 22, 4.2, 2.8, ramp[3], ramp[0]);
        ell(-8, 22, 4.2, 2.8, ramp[3], ramp[0]);
        meye(6, -9, 2.2, 2.8);
        mrect(10, -3, 3, 2, '#ff8a7a');
        mx(2, -4, ramp[0]);
        smile(6, 1, '#7a1a28');
        px(3, 2, '#fff');
        px(3, 3, '#fff');
        px(-4, 2, '#fff');
        px(-4, 3, '#fff');
        break;
      }
      case 10: {
        // Solis - sun
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6 + Math.PI / 12,
            rb = r - 2,
            tip = r + 6.2,
            h = 0.2;
          tri2(
            [rb * Math.cos(a - h), rb * Math.sin(a - h)],
            [rb * Math.cos(a + h), rb * Math.sin(a + h)],
            [tip * Math.cos(a), tip * Math.sin(a)],
            '#ffd21a',
            '#7a3200',
          );
        }
        body(r, ramp);
        ell(9, -4, 2.4, 3, '#5a2200');
        ell(-10, -4, 2.4, 3, '#5a2200');
        px(8, -6, '#fff');
        px(8, -5, '#fff');
        px(-9, -6, '#fff');
        px(-9, -5, '#fff');
        px(10, -2, '#fff');
        px(-11, -2, '#fff');
        mrect(13, 1, 4, 2, '#ff6a4a');
        for (let y = 2; y <= 11; y++)
          for (let x = -11; x <= 10; x++) {
            const dx = (x + 0.5) / 10,
              dy = (y + 0.5 - 2) / 8.5,
              e = dx * dx + dy * dy;
            if (e > 1) continue;
            let col = e > 0.8 ? '#5a2200' : '#5a1400';
            if (y <= 3 && e <= 0.8) col = '#fffbe8';
            if (e <= 0.8 && y > 3) {
              const tx = (x + 0.5) / 5,
                ty = (y + 0.5 - 10) / 2.6;
              if (tx * tx + ty * ty <= 1) col = '#ff6f8a';
            }
            px(x, y, col);
          }
        for (const p of [
          [-16, -15],
          [-11, -19],
          [17, -11],
        ]) {
          const x = p[0],
            y = p[1];
          px(x, y, '#fffdf0');
          px(x - 1, y, '#fffdf0');
          px(x + 1, y, '#fffdf0');
          px(x, y - 1, '#fffdf0');
          px(x, y + 1, '#fffdf0');
        }
        break;
      }
      case 11: {
        // Prism - wildcard
        body(r, ramp);
        const RB = ['#ff5a7a', '#ffa04a', '#ffe45c', '#6fe48a', '#56b8ff', '#a77bff'],
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
        meye(2, -2, 1.3, 1.5);
        smile(2, 2, D);
        mx(4, 1, '#ff8fb5');
        for (const p of [
          [7, -8],
          [-8, 6],
        ]) {
          const x = p[0],
            y = p[1];
          px(x, y, '#fff');
          px(x - 1, y, '#fff');
          px(x + 1, y, '#fff');
          px(x, y - 1, '#fff');
          px(x, y + 1, '#fff');
        }
        break;
      }
      case 12:
        // Boomer - bomb pal
        body(r, ramp);
        rect(-3, -10, 6, 3, ramp[3]);
        rect(-3, -10, 6, 1, ramp[4]);
        rect(-3, -8, 6, 1, ramp[0]);
        line(1, -11, 3, -13, '#d9b26a');
        px(4, -13, '#ffe45c');
        px(5, -13, '#ff9a3c');
        px(4, -12, '#ff9a3c');
        meye(3, -3, 1.4, 1.6, '#6a3018');
        smile(2, 3, D);
        mx(0, 4, '#ff7fa8');
        mrect(5, 1, 2, 1, '#ff8fb5');
        break;
      case 13:
        // Goldie - golden coin pal
        body(r, ramp);
        for (let y = -9; y <= 9; y++)
          for (let x = -9; x <= 9; x++) {
            const d = Math.hypot(x + 0.5, y + 0.5);
            if (d > r - 3.5 && d < r - 2.4) px(x, y, ramp[1]);
          }
        meye(3, -2, 1.4, 1.6);
        smile(3, 3, '#7a3d00');
        mx(5, 1, '#ff8fb5');
        for (const p of [
          [6, -7],
          [-7, 4],
        ]) {
          const x = p[0],
            y = p[1];
          px(x, y, '#fff');
          px(x - 1, y, '#fff');
          px(x + 1, y, '#fff');
          px(x, y - 1, '#fff');
          px(x, y + 1, '#fff');
        }
        break;
      case 14:
        // Zappy - electric pal
        tri2([-6, -7], [-2, -8], [-5, -13], ramp[3], ramp[0]);
        tri2([-2, -8], [2, -8], [0, -13], ramp[3], ramp[0]);
        tri2([2, -8], [6, -7], [5, -13], ramp[3], ramp[0]);
        body(r, ramp);
        tri([2, 3], [-2, 6], [1, 6], '#3a4a00');
        tri([0, 5], [4, 5], [-1, 10], '#3a4a00');
        tri([1, 2], [-3, 5], [0, 5], '#ffffff');
        tri([-1, 4], [3, 4], [-2, 9], '#ffffff');
        meye(3, -4, 1.4, 1.6);
        smile(2, 0, D);
        mrect(5, 1, 2, 1, '#ff8fb5');
        break;
      case 15:
        // Icy - frost pal
        tri2([-7, -6], [-3, -8], [-6, -12], ramp[3], ramp[0]);
        tri2([-2, -8], [2, -8], [0, -13], ramp[4], ramp[0]);
        tri2([3, -8], [7, -6], [6, -12], ramp[3], ramp[0]);
        body(r, ramp);
        rect(-1, -6, 2, 2, '#fff');
        rect(-1, -8, 2, 1, '#fff');
        rect(-1, -3, 2, 1, '#fff');
        rect(-3, -6, 1, 2, '#fff');
        rect(2, -6, 1, 2, '#fff');
        meye(3, -1, 1.4, 1.6);
        smile(2, 3, ramp[0]);
        mrect(5, 2, 2, 1, '#ffb0d0');
        for (let y = 5; y <= 6; y++)
          for (let x = -9; x <= 8; x++)
            if (Math.hypot(x + 0.5, y + 0.5) < r - 1) px(x, y, '#e8443c');
        break;
    }
    if (bl)
      switch (i) {
        case 0:
          mrect(1, -4, 3, 4, ramp[2]);
          mrect(2, -3, 2, 1, D);
          mx(1, -2, D);
          mx(4, -2, D);
          break;
        case 1:
          mrect(2, -4, 3, 4, ramp[2]);
          mrect(3, -3, 2, 1, D);
          mx(2, -2, D);
          mx(5, -2, D);
          break;
        case 2:
          mrect(2, -3, 3, 4, ramp[2]);
          mrect(3, -2, 2, 1, D);
          mx(2, -1, D);
          mx(5, -1, D);
          break;
        case 3:
          disc(5, -8, 3.4, ramp[2], ramp[0]);
          disc(-5, -8, 3.4, ramp[2], ramp[0]);
          mrect(3, -8, 5, 1, ramp[0]);
          break;
        case 4:
          mrect(2, -5, 4, 5, ramp[2]);
          mrect(3, -4, 2, 1, D);
          mx(2, -3, D);
          mx(5, -3, D);
          break;
        case 5:
          mrect(5, -3, 2, 2, ramp[0]);
          mx(6, 0, ramp[0]);
          mrect(5, -3, 2, 1, '#d9deee');
          mx(4, -2, '#d9deee');
          mx(7, -2, '#d9deee');
          break;
        case 6:
          ell(6, -4, 2.6, 3.2, ramp[2]);
          ell(-7, -4, 2.6, 3.2, ramp[2]);
          mrect(5, -5, 2, 1, D);
          mx(4, -4, D);
          mx(7, -4, D);
          break;
        case 7:
          disc(7, -5, 6.6, ramp[2], ramp[0]);
          disc(-7, -5, 6.6, ramp[2], ramp[0]);
          mrect(2, -5, 10, 1, D);
          mx(2, -6, D);
          mx(11, -6, D);
          tri([-3, -1], [3, -1], [0, 7], '#7a3a08');
          tri([-2, 0], [2, 0], [0, 5], '#ffb02a');
          break;
        case 8:
          mrect(4, -7, 3, 4, '#0c2233');
          mrect(4, -6, 2, 1, '#4dffb0');
          mx(3, -5, '#4dffb0');
          mx(6, -5, '#4dffb0');
          break;
        case 9:
          ell(6, -9, 2.6, 3.2, ramp[2]);
          ell(-7, -9, 2.6, 3.2, ramp[2]);
          mrect(5, -10, 2, 1, D);
          mx(4, -9, D);
          mx(7, -9, D);
          break;
        case 10:
          ell(9, -4, 2.6, 3.2, ramp[2]);
          ell(-10, -4, 2.6, 3.2, ramp[2]);
          mrect(8, -5, 2, 1, '#5a2200');
          mx(7, -4, '#5a2200');
          mx(10, -4, '#5a2200');
          break;
        case 11:
          mrect(1, -4, 3, 4, '#ffffff');
          mrect(2, -3, 2, 1, D);
          mx(1, -2, D);
          mx(4, -2, D);
          break;
        case 12:
          mrect(2, -5, 2, 4, ramp[3]);
          mrect(2, -4, 2, 1, '#a05030');
          mx(1, -3, '#a05030');
          mx(4, -3, '#a05030');
          break;
        case 13:
          mrect(2, -4, 2, 4, ramp[2]);
          mrect(2, -3, 2, 1, D);
          mx(1, -2, D);
          mx(4, -2, D);
          break;
        case 14:
          mrect(2, -6, 2, 4, ramp[2]);
          mrect(2, -5, 2, 1, D);
          mx(1, -4, D);
          mx(4, -4, D);
          break;
        case 15:
          mrect(2, -3, 2, 4, ramp[2]);
          mrect(2, -2, 2, 1, D);
          mx(1, -1, D);
          mx(4, -1, D);
          break;
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
