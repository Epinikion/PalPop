import {
  FL,
  FLOOR,
  FR,
  FT,
  H,
  LOSE_Y,
  PRISM,
  RAIL_Y,
  SPECIALS,
  TIERS,
  VMAX,
  W,
} from '../config.js';
import { VISUAL_THEME } from '../audio/catalog.js';
import { RM } from '../core/dom.js';
import { clamp } from '../core/math.js';
export function createRenderBoard({
  audio,
  game,
  renderSprites,
  renderText,
  renderWorlds,
  uiElements,
}) {
  /* ================= render ================= */
  function drawRing(g, x, y, r, c) {
    g.fillStyle = c;
    const n = Math.max(12, Math.round(r * 6.3));
    let lx = null,
      ly = null;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832,
        px = Math.round(x + Math.cos(a) * r),
        py = Math.round(y + Math.sin(a) * r);
      if (px === lx && py === ly) continue;
      lx = px;
      ly = py;
      g.fillRect(px, py, 1, 1);
    }
  }
  function drawPal(g, p, x, y, s, q, fl) {
    const t = p.t,
      spr = (p.bl > 0 ? renderSprites.SPRB : renderSprites.SPR)[t],
      S = spr.width,
      r = TIERS[t].r;
    x = Math.round(x);
    if (Math.abs(s - 1) < 0.03 && Math.abs(q) < 0.02) {
      y = Math.round(y);
      g.drawImage(spr, x - S / 2, y - S / 2);
      if (fl > 0.02) {
        g.globalAlpha = Math.min(1, fl);
        g.drawImage(renderSprites.WH[t], x - S / 2, y - S / 2);
        g.globalAlpha = 1;
      }
      return;
    }
    const dw = Math.max(2, Math.round(S * s * (1 + q))),
      dh = Math.max(2, Math.round(S * s * (1 - q))),
      cy = Math.round(y + r * q * s),
      dx = x - Math.round(dw / 2),
      dy = cy - Math.round(dh / 2);
    g.drawImage(spr, dx, dy, dw, dh);
    if (fl > 0.02) {
      g.globalAlpha = Math.min(1, fl);
      g.drawImage(renderSprites.WH[t], dx, dy, dw, dh);
      g.globalAlpha = 1;
    }
  }
  function drawRays(g, r) {
    const a0 = game.elapsed * 0.7,
      n = 10,
      R = 120;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = r.c;
    g.globalAlpha = Math.min(1, (r.l / r.L) * 1.6) * 0.2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k * 6.2832) / n;
      g.beginPath();
      g.moveTo(r.x, r.y);
      g.lineTo(r.x + Math.cos(a - 0.09) * R, r.y + Math.sin(a - 0.09) * R);
      g.lineTo(r.x + Math.cos(a + 0.09) * R, r.y + Math.sin(a + 0.09) * R);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  function drawAmbient(g, ti) {
    const th = renderWorlds.THEMES[ti],
      w = renderWorlds.WORLD[ti];
    for (const s of w.stars)
      if (Math.sin(game.elapsed * 2.2 + s.p) > 0.2) {
        g.fillStyle = '#fff';
        g.fillRect(s.x, s.y, 1, 1);
      }
    for (let k = 0; k < 3; k++) {
      const cx = Math.round(((game.elapsed * (2.5 + k * 1.3) + k * 47) % (W + 40)) - 20),
        cy = 22 + k * 22;
      g.fillStyle = th.cloud;
      g.fillRect(cx, cy, 16, 3);
      g.fillRect(cx + 3, cy - 2, 9, 2);
      g.fillRect(cx + 8, cy - 3, 4, 1);
    }
    if (ti === 0) {
      if (!game.shoot && Math.random() < 0.004)
        game.shoot = {
          x: 20 + Math.random() * 80,
          y: 8 + Math.random() * 30,
          l: 0,
        };
      if (game.shoot) {
        game.shoot.l += 1 / 60;
        const k = game.shoot.l / 0.5;
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i < 2 ? '#fff' : 'rgba(255,220,255,' + (1 - i / 8).toFixed(2) + ')';
          g.fillRect(
            Math.round(game.shoot.x + k * 40 - i * 2),
            Math.round(game.shoot.y + k * 16 - i * 0.8),
            1,
            1,
          );
        }
        if (k >= 1) game.shoot = null;
      }
    } else if (ti === 1) {
      g.fillStyle = 'rgba(160,200,255,.4)';
      for (let k = 0; k < 34; k++) {
        const sp = 100 + (k % 5) * 18,
          y = ((game.elapsed * sp + k * 53) % (H + 20)) - 10,
          x = Math.round((k * 29.7 + y * 0.3) % W);
        g.fillRect(x, Math.round(y), 1, 3);
      }
    } else if (ti === 4 || ti === 6) {
      g.globalCompositeOperation = 'lighter';
      const LC = ['#ff4fd8', '#4ff0ff', '#ffe45c'];
      for (let k = 0; k < 5; k++) {
        const ox = [14, 42, 60, 78, 106][k],
          a = -Math.PI / 2 + Math.sin(game.elapsed * (0.7 + k * 0.13) + k * 1.3) * 0.75,
          dx = Math.cos(a) * 170,
          dy = Math.sin(a) * 170,
          n = 170;
        g.fillStyle = LC[k % 3];
        g.globalAlpha = 0.22;
        for (let i = 0; i <= n; i += 1) {
          g.fillRect(Math.round(ox + (dx * i) / n), Math.round(150 + (dy * i) / n), 1, 1);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    } else if (ti === 5) {
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (let k = 0; k < 40; k++) {
        const sp = 8 + (k % 5) * 4,
          y = ((game.elapsed * sp + k * 37) % (H + 10)) - 5,
          x = Math.round((k * 31.3 + Math.sin(game.elapsed * 0.8 + k) * 5 + W) % W);
        g.fillRect(x, Math.round(y), 1, 1);
        if (k % 4 === 0) g.fillRect(x + 1, Math.round(y), 1, 1);
      }
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.05 + 0.03 * Math.sin(game.elapsed * 0.9);
      g.fillStyle = '#3ad8ff';
      g.fillRect(0, 30, W, 60);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    } else if (ti === 3) {
      const CB = [
        ['#ff5a7a', '#ffe45c'],
        ['#4ab8ff', '#ffffff'],
        ['#a77bff', '#ffa04a'],
      ];
      for (let k = 0; k < 3; k++) {
        const y = Math.round(
            H * 0.92 - ((game.elapsed * (3.2 + k * 0.7) + k * 70) % (H * 0.92 + 24)),
          ),
          x = Math.round(24 + k * 36 + Math.sin(game.elapsed * 0.6 + k * 2) * 6),
          c = CB[k];
        for (let yy = -6; yy <= 5; yy++)
          for (let xx = -5; xx <= 5; xx++)
            if ((xx * xx) / 25 + (yy * yy) / 36 <= 1) {
              g.fillStyle = ((xx + 6) >> 1) % 2 ? c[0] : c[1];
              g.fillRect(x + xx, y + yy, 1, 1);
            }
        g.fillStyle = '#e8d9ff';
        g.fillRect(x - 2, y + 5, 1, 3);
        g.fillRect(x + 2, y + 5, 1, 3);
        g.fillStyle = '#8a5a2a';
        g.fillRect(x - 1, y + 8, 3, 2);
      }
      g.fillStyle = 'rgba(255,255,255,.7)';
      for (let k = 0; k < 3; k++) {
        const bx = Math.round(((game.elapsed * (8 + k * 3) + k * 40) % (W + 30)) - 15),
          by = 60 + k * 26 + Math.round(Math.sin(game.elapsed * 3 + k) * 2);
        g.fillRect(bx - 2, by, 1, 1);
        g.fillRect(bx - 1, by + 1, 1, 1);
        g.fillRect(bx, by, 1, 1);
        g.fillRect(bx + 1, by + 1, 1, 1);
        g.fillRect(bx + 2, by, 1, 1);
      }
    } else {
      g.fillStyle = 'rgba(255,120,190,.75)';
      for (let k = 0; k < 9; k++) {
        const y = Math.round(H - ((game.elapsed * 9 + k * 41) % (H + 20))),
          x = Math.round((k * 23 + Math.sin(game.elapsed * 1.5 + k) * 4 + W) % W);
        g.fillRect(x, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
        g.fillRect(x, y + 1, 3, 1);
        g.fillRect(x + 1, y + 2, 1, 1);
      }
    }
  }
  function drawEQ(g) {
    if (!audio.frequencyData || !audio.enabled || !audio.context) return;
    const n = 18,
      bw = (FR - FL) / n;
    g.fillStyle = renderWorlds.THEMES[VISUAL_THEME].eq;
    for (let i = 0; i < n; i++) {
      const b = 1 + Math.floor(Math.pow(i / n, 1.5) * 46),
        v = audio.frequencyData[b] / 255,
        h = Math.round(v * v * 64 * (game.feverT > 0 ? 1.3 : 1));
      if (h < 1) continue;
      const x = Math.round(FL + i * bw + 1),
        w = Math.max(1, Math.round(bw) - 2);
      g.globalAlpha = RM ? 0.18 : 0.24;
      for (let y = FLOOR - h; y < FLOOR; y += 2) g.fillRect(x, y, w, 1);
      g.globalAlpha = 0.4;
      g.fillRect(x, FLOOR - h - 1, w, 1);
    }
    g.globalAlpha = 1;
  }
  function render() {
    const g = uiElements.ctx;
    g.save();
    if (game.shakeMagnitude > 0)
      g.translate(
        Math.round((Math.random() * 2 - 1) * game.shakeMagnitude),
        Math.round((Math.random() * 2 - 1) * game.shakeMagnitude),
      );
    const ti = VISUAL_THEME,
      tw = renderWorlds.WORLD[ti];
    if (game.themeK < 1 && game.themeFrom >= 0) {
      g.drawImage(renderWorlds.WORLD[game.themeFrom].sky, 0, 0);
      g.globalAlpha = game.themeK;
    }
    g.drawImage(tw.sky, 0, 0);
    g.globalAlpha = 1;
    drawAmbient(g, ti);
    g.drawImage(tw.panel, 0, 0);
    drawEQ(g);
    if (game.feverT > 0) {
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.32;
      g.fillStyle = 'hsl(' + (((game.elapsed * 120) % 360) | 0) + ',100%,60%)';
      g.fillRect(FL, FT, FR - FL, FLOOR - FT);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (game.iceTime > 0) {
      g.globalAlpha = 0.14 + 0.05 * Math.sin(game.elapsed * 6);
      g.fillStyle = '#9fe2ff';
      g.fillRect(FL, FT, FR - FL, FLOOR - FT);
      g.globalAlpha = 1;
    }
    if (game.goldTime > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 + 0.05 * Math.sin(game.elapsed * 10);
      g.fillStyle = '#ffcf3f';
      g.fillRect(FL, FT, FR - FL, FLOOR - FT);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = game.danger
      ? ((game.elapsed * 8) | 0) % 2
        ? '#ff4d6d'
        : '#ffb3c0'
      : 'rgba(255,255,255,.2)';
    for (let x = FL + 1; x < FR - 1; x += 6) g.fillRect(x, LOSE_Y, 3, 1);
    if (game.phase === 'play' && game.held) {
      const r = TIERS[game.held.t].r;
      let yl = FLOOR - r;
      for (const b of game.bodies) {
        const dx = Math.abs(b.x - game.held.x),
          rs = b.r + r;
        if (dx < rs) {
          const yy = b.y - Math.sqrt(rs * rs - dx * dx);
          if (yy < yl) yl = yy;
        }
      }
      const gx = Math.round(game.held.x);
      g.fillStyle = 'rgba(255,255,255,.3)';
      for (let y = Math.round(game.held.y + r + 3); y < yl + r - 2; y += 4) g.fillRect(gx, y, 1, 2);
      if (yl > game.held.y + 4) {
        g.globalAlpha = 0.22;
        const S = renderSprites.SPR[game.held.t].width;
        g.drawImage(renderSprites.SPR[game.held.t], gx - S / 2, Math.round(yl) - S / 2);
        g.globalAlpha = 1;
      }
    }
    g.globalCompositeOperation = 'lighter';
    for (const b of game.bodies) {
      const a = b.t >= PRISM ? 0.4 : game.feverT > 0 ? 0.38 : b.t >= 7 ? 0.14 : 0;
      if (a <= 0) continue;
      const hs = renderSprites.HALO[b.t].width;
      g.globalAlpha = a;
      g.drawImage(renderSprites.HALO[b.t], Math.round(b.x - hs / 2), Math.round(b.y - hs / 2));
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const b of game.bodies)
      drawPal(g, b, b.x, b.y, b.s, b.q - (clamp(b.vy, 0, VMAX) / VMAX) * 0.16, b.flash);
    for (const r of game.rays) drawRays(g, r);
    if (game.phase === 'play') {
      const cx = Math.round(clamp(game.carrierX, FL + 4, FR - 4));
      g.fillStyle = '#ffcf3f';
      g.fillRect(cx - 3, RAIL_Y - 1, 7, 4);
      g.fillStyle = '#fff4b0';
      g.fillRect(cx - 3, RAIL_Y - 1, 7, 1);
      g.fillStyle = '#b8860b';
      g.fillRect(cx - 3, RAIL_Y + 2, 7, 1);
      if (game.held) {
        const r = TIERS[game.held.t].r,
          hx = Math.round(game.held.x + game.swing),
          hy = Math.round(game.held.y + Math.sin(game.elapsed * 5)),
          y0 = RAIL_Y + 3,
          y1 = hy - Math.round(r) + 1;
        g.fillStyle = '#e8d9ff';
        for (let y = y0; y < y1; y += 2) {
          const f = (y - y0) / Math.max(1, y1 - y0);
          g.fillRect(Math.round(cx + (hx - cx) * f), y, 1, 1);
        }
        if (game.held.t === PRISM) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.4;
          const hs = renderSprites.HALO[PRISM].width;
          g.drawImage(renderSprites.HALO[PRISM], hx - hs / 2, hy - hs / 2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
        }
        drawPal(g, game.held, hx, hy, game.held.s, Math.sin(game.elapsed * 6) * 0.04, 0);
      }
    }
    for (const r of game.rings) drawRing(g, r.x, r.y, r.r, r.c);
    for (const bl of game.bolts) {
      g.fillStyle = ((game.elapsed * 30) | 0) % 2 ? '#ffffff' : '#fff36a';
      let ax = bl.x0,
        ay = bl.y0;
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const f = i / n,
          nx = bl.x0 + (bl.x1 - bl.x0) * f + (i < n ? (Math.random() - 0.5) * 8 : 0),
          ny = bl.y0 + (bl.y1 - bl.y0) * f + (i < n ? (Math.random() - 0.5) * 8 : 0);
        const dx = nx - ax,
          dy = ny - ay,
          m = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)) | 0);
        for (let j = 0; j <= m; j++)
          g.fillRect(Math.round(ax + (dx * j) / m), Math.round(ay + (dy * j) / m), 1, 1);
        ax = nx;
        ay = ny;
      }
    }
    for (const p of game.parts) {
      if (p.l < 0.15 && ((game.elapsed * 40) | 0) % 2) continue;
      g.fillStyle = p.c;
      const X = Math.round(p.x),
        Y = Math.round(p.y);
      if (p.star) {
        g.fillRect(X - 1, Y, 3, 1);
        g.fillRect(X, Y - 1, 1, 3);
      } else if (p.conf) {
        if (((game.elapsed * 12 + p.ph) | 0) % 2) g.fillRect(X, Y, 2, 1);
        else g.fillRect(X, Y, 1, 2);
      } else g.fillRect(X, Y, p.sz, p.sz);
    }
    if (game.themeK < 1 && game.themeFrom >= 0) {
      g.drawImage(renderWorlds.WORLD[game.themeFrom].fg, 0, 0);
      g.globalAlpha = game.themeK;
    }
    g.drawImage(tw.fg, 0, 0);
    g.globalAlpha = 1;
    // fever meter
    g.fillStyle = '#1c1040';
    g.fillRect(FL - 1, 1, FR - FL + 2, 4);
    const fw = Math.round(game.feverCharge * (FR - FL));
    for (let x = 0; x < fw; x++) {
      g.fillStyle =
        'hsl(' +
        (((x * 5 + game.elapsed * (game.feverT > 0 ? 420 : 70)) % 360) | 0) +
        ',100%,' +
        (game.feverT > 0 ? 62 : 55) +
        '%)';
      g.fillRect(FL + x, 2, 1, 2);
    }
    if (game.goldTime > 0) {
      g.fillStyle = '#ffcf3f';
      g.fillRect(FL, 5, Math.round((game.goldTime / 7) * (FR - FL)), 2);
    }
    if (game.iceTime > 0) {
      g.fillStyle = '#9fe2ff';
      g.fillRect(FL, 7, Math.round((game.iceTime / 7) * (FR - FL)), 2);
    }
    if (game.feverT > 0) {
      for (let y = FT; y < FLOOR; y += 2) {
        g.fillStyle =
          'hsl(' + (((((y * 5 - game.elapsed * 420) % 360) + 360) | 0) % 360) + ',100%,60%)';
        g.fillRect(FL - 1, y, 1, 2);
        g.fillRect(FR, y, 1, 2);
      }
    }
    for (const p of game.popups) {
      if (p.l < 0.25 && ((game.elapsed * 30) | 0) % 2) continue;
      const sc = p.L - p.l < 0.12 ? p.sc + 1 : p.sc,
        hw = renderText.textW(String(p.txt), sc) / 2;
      renderText.drawText(
        g,
        p.txt,
        clamp(p.x, FL + 2 + hw, FR - 2 - hw),
        Math.round(p.y),
        p.col,
        sc,
      );
    }
    if (game.banner) {
      const T = renderSprites.SPR[game.banner.t],
        S = T.width,
        sc = S > 34 ? 34 / S : 1,
        sd = Math.round(S * sc),
        a = Math.min(1, game.banner.l * 3),
        top = 60,
        bh = sd + 30;
      g.globalAlpha = a;
      g.fillStyle = 'rgba(14,6,40,.84)';
      g.fillRect(FL + 6, top, FR - FL - 12, bh);
      g.fillStyle = '#ffcf3f';
      g.fillRect(FL + 6, top, FR - FL - 12, 1);
      g.fillRect(FL + 6, top + bh - 1, FR - FL - 12, 1);
      renderText.drawText(g, 'NEW PAL!', W / 2, top + 5, '#ffe45c', 2);
      g.drawImage(
        T,
        Math.round(W / 2 - sd / 2),
        top + 19 + Math.round(Math.sin(game.elapsed * 8) * 1.5),
        sd,
        sd,
      );
      renderText.drawText(g, TIERS[game.banner.t].n, W / 2, top + 21 + sd, '#fff', 1);
      g.globalAlpha = 1;
    }
    if (game.phase === 'play' && !game.banner) {
      let hint = null;
      if (!game.didDrop) hint = 'DRAG & RELEASE';
      else if (!game.didMerge) hint = 'SAME PALS MERGE!';
      else if (game.merges < 4 && !game.didSwap && game.score < 12) hint = 'TAP NEXT TO SWAP';
      else if (game.held && game.held.t >= PRISM && (game.spSeen[game.held.t] || 0) < 2)
        hint = SPECIALS.find((x) => x.t === game.held.t).hint;
      if (hint) renderText.drawText(g, hint, W / 2, 56, '#fff', 1);
    }
    if (game.danger) {
      const a = (0.18 + 0.14 * Math.sin(game.elapsed * 12)).toFixed(2);
      g.fillStyle = 'rgba(255,40,80,' + a + ')';
      g.fillRect(FL, FT, 3, FLOOR - FT);
      g.fillRect(FR - 3, FT, 3, FLOOR - FT);
      g.fillRect(FL, FT, FR - FL, 3);
    }
    if (game.flashOpacity > 0) {
      g.fillStyle =
        'rgba(255,255,255,' + Math.min(RM ? 0.2 : 0.6, game.flashOpacity).toFixed(2) + ')';
      g.fillRect(-4, -4, W + 8, H + 8);
    }
    g.restore();
    if (game.iris) {
      const k = game.iris.ph === 0 ? 1 - game.iris.k : game.iris.k,
        r = Math.max(0, k * 130);
      g.fillStyle = '#0e0628';
      g.beginPath();
      g.rect(0, 0, W, H);
      g.arc(W / 2, 110, r, 0, 6.2832, true);
      g.fill('evenodd');
    }
  }

  /* ================= DOM: next, ladder, radio, sizing ================= */
  return { render };
}
