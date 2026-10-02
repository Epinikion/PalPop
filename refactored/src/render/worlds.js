import { mkc } from '../core/dom.js';
import { BAY, FL, FLOOR, FR, FT, H, RAIL_Y, W } from '../config.js';
import { seeded } from '../core/math.js';
export function createRenderWorlds({}) {
  /* ================= themed worlds ================= */
  const THEMES = [
    {
      bands: [
        '#1a0b3d',
        '#2b1560',
        '#43206f',
        '#66287f',
        '#8f3186',
        '#c04a88',
        '#ea6f87',
        '#ff9c7b',
        '#ffc98b',
      ],
      stars: true,
      starC: ['#ffe9ff', '#b9a8ff'],
      cloud: 'rgba(255,220,240,.5)',
      eq: '#ff6fae',
      body: 'sun',
      panel: 'rgba(14,6,40,.56)',
      brick: ['#4b3590', '#6a52ae', '#2a1a55'],
      rail: '#8a72c8',
      page: '#f2dfc0',
      pageD: '#150a2e',
    },
    {
      bands: [
        '#050a1c',
        '#0a1430',
        '#0f1c44',
        '#152553',
        '#1c2f63',
        '#243a70',
        '#2e467b',
        '#3a5386',
        '#476190',
      ],
      stars: true,
      starC: ['#ffffff', '#a9c0ff'],
      cloud: 'rgba(160,180,240,.3)',
      eq: '#6fb6ff',
      body: 'moon',
      panel: 'rgba(3,6,22,.5)',
      brick: ['#2b3a6e', '#405498', '#141c40'],
      rail: '#7a8fd0',
      page: '#dfe6f5',
      pageD: '#0a1030',
    },
    {
      bands: [
        '#3cc8ff',
        '#5ad0ff',
        '#7cd8ff',
        '#9fdfff',
        '#c3e6ff',
        '#ffd6ee',
        '#ffbfe1',
        '#ffa8d4',
        '#ff91c8',
      ],
      stars: false,
      starC: ['#ffffff', '#fff6b0'],
      cloud: 'rgba(255,255,255,.9)',
      eq: '#ffffff',
      body: 'rainbow',
      panel: 'rgba(48,12,72,.5)',
      brick: ['#c64a8e', '#e86fae', '#7c2659'],
      rail: '#ffd1ea',
      page: '#ffe3f1',
      pageD: '#2a0c2c',
    },
    {
      bands: [
        '#1f1f58',
        '#37287c',
        '#623a94',
        '#9a4698',
        '#d1587f',
        '#f27c66',
        '#ffa663',
        '#ffcb78',
        '#ffe7a0',
      ],
      stars: true,
      starC: ['#ffe9ff', '#ffd0f0'],
      cloud: 'rgba(255,196,214,.6)',
      eq: '#ffd36b',
      body: 'dawn',
      panel: 'rgba(34,10,52,.5)',
      brick: ['#8a4a8a', '#b56cae', '#4a2450'],
      rail: '#ffd08a',
      page: '#ffe8c8',
      pageD: '#241030',
    },
    {
      bands: [
        '#07020f',
        '#12041f',
        '#1e0632',
        '#2c0a48',
        '#3d0f5e',
        '#521574',
        '#6b1a8a',
        '#8a2098',
        '#b02aa6',
      ],
      stars: false,
      starC: ['#ff9af0', '#9af0ff'],
      cloud: 'rgba(255,120,230,.22)',
      eq: '#ff4fd8',
      body: 'club',
      panel: 'rgba(10,2,26,.5)',
      brick: ['#3a1a5e', '#6a2a9a', '#180a30'],
      rail: '#ff7ae8',
      page: '#f4d9ff',
      pageD: '#0d0418',
    },
    {
      bands: [
        '#020b1a',
        '#04162b',
        '#062338',
        '#0a3145',
        '#0f4152',
        '#16525e',
        '#22646a',
        '#33777a',
        '#4a8b8a',
      ],
      stars: true,
      starC: ['#ffffff', '#bff6ff'],
      cloud: 'rgba(150,230,230,.2)',
      eq: '#7dffd0',
      body: 'aurora',
      panel: 'rgba(2,10,24,.5)',
      brick: ['#2b5a66', '#4a8a96', '#123038'],
      rail: '#8ae8e0',
      page: '#d9f5f2',
      pageD: '#031018',
    },
  ];
  function buildTheme(ti) {
    const th = THEMES[ti],
      c = mkc(W, H),
      g = c.getContext('2d'),
      rnd = seeded(1000 + ti * 77),
      stars = [];
    const P = (x, y, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    };
    const bands = th.bands,
      nb = bands.length - 1;
    for (let y = 0; y < H; y++) {
      const t = Math.min(nb - 0.001, (y / (H * 0.92)) * nb),
        i = Math.floor(t),
        f = t - i;
      for (let x = 0; x < W; x++)
        P(x, y, f > BAY[(y & 3) * 4 + (x & 3)] / 16 ? bands[i + 1] : bands[i]);
    }
    if (th.stars)
      for (let k = 0; k < 52; k++) {
        const x = (rnd() * W) | 0,
          y = (rnd() * 100) | 0;
        P(x, y, k % 3 === 0 ? th.starC[0] : th.starC[1]);
        if (k % 4 === 0)
          stars.push({
            x,
            y,
            p: rnd() * 6,
          });
      }
    const ridge = (base, amp, col, seed, fr) => {
      const hs = [];
      g.fillStyle = col;
      for (let x = 0; x < W; x++) {
        const h = Math.round(
          base + Math.sin(x * fr + seed) * amp + Math.sin(x * fr * 2.3 + seed * 1.7) * amp * 0.5,
        );
        hs.push(h);
        g.fillRect(x, h, 1, H - h);
      }
      return hs;
    };
    if (th.body === 'sun') {
      for (let y = 112; y <= 148; y++)
        for (let x = 64; x <= 104; x++) {
          const d = Math.hypot(x + 0.5 - 84, y + 0.5 - 130);
          if (d > 17) continue;
          if (y > 131 && (y - 131) % 4 < (y - 128) / 9) continue;
          P(x, y, (y - 113) / 34 > BAY[(y & 3) * 4 + (x & 3)] / 16 ? '#ff8a70' : '#ffe9a8');
        }
      ridge(150, 9, '#5a2a86', 1, 0.05);
      ridge(163, 7, '#3c1c66', 4, 0.07);
      ridge(176, 6, '#28104e', 2, 0.09);
    } else if (th.body === 'moon') {
      for (let y = 36; y <= 80; y++)
        for (let x = 62; x <= 106; x++) {
          const d = Math.hypot(x + 0.5 - 84, y + 0.5 - 58);
          if (d <= 13) {
            const l = (-(x - 84) * 0.5 - (y - 58) * 0.6) / 13;
            P(x, y, l > -0.25 || BAY[(y & 3) * 4 + (x & 3)] < 5 ? '#f6f1d0' : '#d8cfa0');
          } else if (d < 19 && ((19 - d) / 6) * 10 > BAY[(y & 3) * 4 + (x & 3)]) P(x, y, '#3a5288');
        }
      for (const cr of [
        [80, 54, 2.4],
        [89, 62, 1.8],
        [85, 49, 1.2],
        [78, 63, 1.4],
      ])
        for (let y = -3; y <= 3; y++)
          for (let x = -3; x <= 3; x++)
            if (Math.hypot(x, y) < cr[2]) P(cr[0] + x, cr[1] + y, '#cbc293');
      ridge(150, 8, '#1b2a55', 2, 0.05);
      let x = 0;
      while (x < W) {
        const w = 6 + ((rnd() * 8) | 0),
          h = 18 + ((rnd() * 34) | 0),
          top = 190 - h;
        g.fillStyle = '#0b1230';
        g.fillRect(x, top, w, h);
        g.fillStyle = '#172146';
        g.fillRect(x, top, 1, h);
        for (let wy = top + 3; wy < 187; wy += 4)
          for (let wx = x + 2; wx < x + w - 1; wx += 3)
            P(wx, wy, rnd() < 0.3 ? '#ffd27a' : '#1a2550');
        if (rnd() < 0.35) {
          g.fillStyle = '#0b1230';
          g.fillRect(x + (w >> 1), top - 4, 1, 4);
          P(x + (w >> 1), top - 5, '#ff5a7a');
        }
        x += w + ((rnd() * 3) | 0);
      }
    } else if (th.body === 'club') {
      let x = 0;
      while (x < W) {
        const w = 7 + ((rnd() * 9) | 0),
          h = 24 + ((rnd() * 46) | 0),
          top = 150 - h;
        g.fillStyle = '#0a0316';
        g.fillRect(x, top, w, h + 40);
        g.fillStyle = '#22093f';
        g.fillRect(x, top, 1, h + 40);
        for (let wy = top + 3; wy < 148; wy += 4)
          for (let wx = x + 2; wx < x + w - 1; wx += 3)
            if (rnd() < 0.35) P(wx, wy, rnd() < 0.5 ? '#ff4fd8' : '#4ff0ff');
        if (rnd() < 0.4) {
          P(x + (w >> 1), top - 1, '#ff4fd8');
          P(x + (w >> 1), top - 2, '#ff4fd8');
        }
        x += w + ((rnd() * 3) | 0);
      }
      for (let a = 0; a < 360; a += 2) {
        const c = Math.cos((a * Math.PI) / 180),
          sn = Math.sin((a * Math.PI) / 180);
        P(Math.round(86 + c * 16), Math.round(52 + sn * 16), '#ff4fd8');
        P(Math.round(86 + c * 15), Math.round(52 + sn * 15), '#9a2a88');
      }
      for (let y = 150; y < H; y++) for (let xx = 0; xx < W; xx++) P(xx, y, '#12041f');
      g.fillStyle = '#ff4fd8';
      g.fillRect(0, 150, W, 1);
      for (let k = 1; k <= 8; k++) {
        g.fillStyle = k % 2 ? '#6a1a88' : '#8a2aa8';
        g.fillRect(0, 150 + Math.round(Math.pow(k / 8, 1.7) * 44), W, 1);
      }
      g.fillStyle = '#6a1a88';
      for (let k = -10; k <= 10; k++)
        for (let y = 151; y < H; y++) {
          const f = (y - 150) / 44,
            xx = Math.round(60 + k * (6 + f * 22));
          if (xx >= 0 && xx < W) g.fillRect(xx, y, 1, 1);
        }
    } else if (th.body === 'aurora') {
      const AU = ['#2af5a0', '#3ad8ff', '#8a7cff'];
      for (let band = 0; band < 3; band++)
        for (let x = 0; x < W; x++) {
          const yc =
            44 + band * 14 + Math.sin(x * 0.07 + band * 1.7) * 9 + Math.sin(x * 0.13 + band) * 4;
          for (let dy = -10; dy <= 16; dy++) {
            const a = dy < 0 ? 1 + dy / 10 : 1 - dy / 16,
              yy = Math.round(yc + dy);
            if (a * 16 > BAY[(yy & 3) * 4 + (x & 3)]) P(x, yy, AU[band]);
          }
        }
      for (let y = 22; y <= 42; y++)
        for (let x = 90; x <= 110; x++) {
          const d = Math.hypot(x + 0.5 - 100, y + 0.5 - 32);
          if (d < 8 && Math.hypot(x + 0.5 - 104, y + 0.5 - 30) > 7) P(x, y, '#f6f1d0');
        }
      ridge(160, 6, '#0d2a36', 3, 0.06);
      for (let k = 0; k < 15; k++) {
        const x = 4 + k * 8 + ((rnd() * 4) | 0),
          h = 14 + ((rnd() * 14) | 0),
          base = 172 + ((rnd() * 5) | 0);
        for (let yy = 0; yy < h; yy++) {
          const wd = Math.max(1, Math.round((yy / h) * 6));
          g.fillStyle = '#08202a';
          g.fillRect(x - wd, base - h + yy, wd * 2 + 1, 1);
          if (rnd() < 0.18) P(x - wd + ((rnd() * wd * 2) | 0), base - h + yy, '#d9f5ff');
        }
      }
      for (let y = 178; y < H; y++)
        for (let x = 0; x < W; x++)
          P(x, y, (y - 178) / 22 > BAY[(y & 3) * 4 + (x & 3)] / 16 ? '#0c3a4a' : '#1a6a78');
    } else if (th.body === 'dawn') {
      for (let y = 126; y <= 152; y++)
        for (let x = 30; x <= 90; x++) {
          const d = Math.hypot(x + 0.5 - 60, y + 0.5 - 152);
          if (d > 27) continue;
          P(x, y, (152 - y) / 27 > BAY[(y & 3) * 4 + (x & 3)] / 16 ? '#fff2b0' : '#ffc85a');
        }
      ridge(147, 3, '#7a3f8f', 2, 0.11);
      ridge(149, 2, '#5b2f78', 6, 0.16);
      for (let y = 151; y < H; y++)
        for (let x = 0; x < W; x++) {
          const f = (y - 151) / 44;
          P(x, y, f > BAY[(y & 3) * 4 + (x & 3)] / 16 ? '#3b2a82' : '#e0708a');
        }
      for (let y = 152; y < H; y += 2) {
        const w = Math.max(2, Math.round(22 - (y - 151) * 0.42));
        g.fillStyle = y & 2 ? '#ffdf98' : '#ffb35a';
        g.fillRect(60 - (w >> 1), y, w, 1);
      }
      for (let k = 0; k < 70; k++) {
        const x = (rnd() * W) | 0,
          y = 154 + ((rnd() * 36) | 0);
        if (Math.abs(x - 60) > 18) P(x, y, k % 3 ? '#f7a3b0' : '#b56cae');
      }
    } else {
      const RC = ['#ff5a5a', '#ff9f3c', '#ffe14a', '#5fe07a', '#4ab8ff', '#7a6cff', '#c86cff'];
      for (let y = 100; y < 182; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x + 0.5 - 60, y + 0.5 - 182);
          const j = Math.floor((72 - d) / 3);
          if (j >= 0 && j < 7 && ((x + y) & 1 || j % 2 === 0)) P(x, y, RC[j]);
        }
      for (let y = 14; y <= 36; y++)
        for (let x = 90; x <= 112; x++) {
          const d = Math.hypot(x + 0.5 - 101, y + 0.5 - 25);
          if (d < 8) P(x, y, d < 6 ? '#fff3a0' : '#ffd23f');
        }
      for (const cl of [
        [20, 60, 1],
        [70, 40, 0.8],
        [34, 98, 0.7],
      ]) {
        const [cx, cy, k] = cl;
        for (const b of [
          [0, 0, 7],
          [7, -3, 6],
          [-7, -1, 5],
          [13, 1, 4.5],
        ])
          for (let y = -8; y <= 8; y++)
            for (let x = -8; x <= 8; x++) {
              const r = b[2] * k;
              if (Math.hypot(x, y) < r)
                P(
                  Math.round(cx + b[0] * k + x),
                  Math.round(cy + b[1] * k + y),
                  y > r * 0.45 ? '#e2f2ff' : '#ffffff',
                );
            }
      }
      ridge(158, 8, '#ffa9d6', 1, 0.06);
      const h2 = ridge(170, 6, '#ff7ab8', 3, 0.08);
      ridge(181, 5, '#e35aa0', 5, 0.1);
      const SP = ['#ffffff', '#ffe45c', '#5fe07a', '#4ab8ff'];
      for (let k = 0; k < 60; k++) {
        const x = (rnd() * W) | 0,
          y = h2[x] + 2 + ((rnd() * 8) | 0);
        if (y < 181) P(x, y, SP[k % 4]);
      }
    }
    const pc = mkc(W, H),
      pg = pc.getContext('2d');
    pg.fillStyle = th.panel;
    pg.fillRect(FL, FT, FR - FL, FLOOR - FT);
    pg.fillStyle = 'rgba(255,255,255,.06)';
    for (let y = FT + 3; y < FLOOR; y += 6)
      for (let x = FL + 3; x < FR; x += 6) pg.fillRect(x, y, 1, 1);
    pg.fillStyle = 'rgba(0,0,0,.28)';
    pg.fillRect(FL, FT, 2, FLOOR - FT);
    pg.fillRect(FR - 2, FT, 2, FLOOR - FT);
    pg.fillRect(FL, FLOOR - 2, FR - FL, 2);
    const fc = mkc(W, H),
      fg = fc.getContext('2d'),
      B = th.brick;
    const bricks = (x0, y0, w, h) => {
      for (let y = y0, row = 0; y < y0 + h; y += 4, row++) {
        const hh = Math.min(4, y0 + h - y);
        fg.fillStyle = B[0];
        fg.fillRect(x0, y, w, hh);
        fg.fillStyle = B[1];
        fg.fillRect(x0, y + 1, w, 1);
        fg.fillStyle = B[2];
        fg.fillRect(x0, y, w, 1);
        for (let x = x0 + (row % 2 ? 3 : 0); x < x0 + w; x += 6) fg.fillRect(x, y, 1, hh);
      }
    };
    bricks(0, 6, FL, FLOOR - 6);
    bricks(FR, 6, W - FR, FLOOR - 6);
    bricks(0, FLOOR, W, H - FLOOR);
    fg.fillStyle = '#1c1040';
    fg.fillRect(FL - 1, FT, 1, FLOOR - FT);
    fg.fillRect(FR, FT, 1, FLOOR - FT);
    fg.fillRect(FL, FLOOR, FR - FL, 1);
    for (const x of [1, FR + 1]) {
      fg.fillStyle = '#7a5a10';
      fg.fillRect(x, 6, 4, 5);
      fg.fillStyle = '#ffcf3f';
      fg.fillRect(x, 7, 4, 3);
      fg.fillStyle = '#fff4b0';
      fg.fillRect(x + 1, 7, 1, 1);
    }
    fg.fillStyle = th.rail;
    fg.fillRect(FL, RAIL_Y, FR - FL, 1);
    fg.fillStyle = '#2a1a55';
    fg.fillRect(FL, RAIL_Y + 1, FR - FL, 1);
    return {
      sky: c,
      panel: pc,
      fg: fc,
      stars,
    };
  }
  THEMES.push({
    ...THEMES[4],
    bands: [
      '#080f20',
      '#10172e',
      '#1b1e42',
      '#292451',
      '#343066',
      '#403f73',
      '#51558a',
      '#6773a0',
      '#899bb8',
    ],
    stars: true,
    eq: '#78f5da',
    rail: '#b8fa63',
    brick: ['#233447', '#3b546a', '#12202f'],
    panel: 'rgba(4,12,23,.55)',
    pageD: '#090c16',
  });
  const WORLD = THEMES.map((_, i) => buildTheme(i));

  /* ================= state ================= */
  return { THEMES, WORLD };
}
