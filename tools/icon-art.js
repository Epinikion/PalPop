import { createRenderSprites } from '../src/render/sprites.js';

/**
 * The app icon, drawn from the game's own sprites: the Sun the whole game climbs towards, rising
 * over the neon skyline, with three pals cheering on the grid floor. Everything is placed on a
 * 128 x 128 pixel grid; `drawIcon` renders it at a whole-number scale so the pixels stay square.
 */
const GRID = 128;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const SKY = [
  [0, '#0f0828'],
  [30, '#22114f'],
  [56, '#5b2a88'],
  [74, '#b83f8c'],
  [88, '#ff7a5a'],
  [100, '#ffbb5c'],
];
const HORIZON = 100;
const SUN = { x: 64, y: 42 };
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** An ordered-dither pick between two colours: `t` is how much of `b` shows up. */
const dither = (a, b, t, x, y) => (t * 16 > BAYER[y & 3][x & 3] ? b : a);

function sky(g, size, o) {
  for (let y = -o; y < size - o; y++) {
    let i = SKY.findIndex(([at]) => at > y);
    if (i < 0) i = SKY.length - 1;
    if (i === 0) i = 1;
    const [y0, c0] = SKY[i - 1],
      [y1, c1] = SKY[i],
      t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    for (let x = -o; x < size - o; x++) {
      g.fillStyle = dither(c0, c1, t, x + 64, y + 64);
      g.fillRect(x + o, y + o, 1, 1);
    }
  }
}

function glow(g, o) {
  const warm = hex('#ff9a6a');
  for (let y = SUN.y - 52; y <= SUN.y + 52; y++)
    for (let x = SUN.x - 52; x <= SUN.x + 52; x++) {
      const d = Math.hypot(x - SUN.x, y - SUN.y);
      if (d > 50 || y >= HORIZON) continue;
      const p = Math.pow(1 - d / 50, 2.4) * 0.7;
      if (p * 16 > BAYER[(y + 64) & 3][(x + 64) & 3]) {
        g.fillStyle = rgb(warm);
        g.globalAlpha = 0.5;
        g.fillRect(x + o, y + o, 1, 1);
      }
    }
  g.globalAlpha = 1;
}

function stars(g, o, span) {
  const rand = mulberry(7);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * (GRID + 2 * span)) - span,
      y = Math.floor(rand() * (46 + span)) - span,
      kind = rand();
    if (Math.hypot(x - SUN.x, y - SUN.y) < 48) continue;
    g.fillStyle = kind < 0.6 ? '#ffffff' : kind < 0.85 ? '#9fe8ff' : '#ffd0f0';
    g.globalAlpha = 0.55 + rand() * 0.45;
    g.fillRect(x + o, y + o, 1, 1);
    if (kind > 0.93) {
      g.fillRect(x + o - 1, y + o, 3, 1);
      g.fillRect(x + o, y + o - 1, 1, 3);
    }
  }
  g.globalAlpha = 1;
}

function skyline(g, o, span) {
  const rand = mulberry(21);
  for (const [layer, color, lo, hi] of [
    [0, '#2a1260', 8, 20],
    [1, '#150a36', 10, 26],
  ]) {
    let x = -span - 6;
    while (x < GRID + span) {
      const w = 7 + Math.floor(rand() * 9),
        h = lo + Math.floor(rand() * (hi - lo)),
        top = HORIZON + 4 - h;
      g.fillStyle = color;
      g.fillRect(x + o, top + o, w, h + 2);
      if (layer === 1) {
        if (rand() > 0.6) g.fillRect(x + o + 2, top + o - 3, 1, 3);
        for (let wy = top + 3; wy < HORIZON + 1; wy += 3)
          for (let wx = x + 1; wx < x + w - 1; wx += 3)
            if (rand() > 0.55) {
              const k = rand();
              g.fillStyle = k < 0.45 ? '#ff6fae' : k < 0.8 ? '#7ff0ff' : '#ffd45c';
              g.fillRect(wx + o, wy + o, 1, 1);
            }
      }
      x += w + (layer ? 1 : 0) + Math.floor(rand() * 2);
    }
  }
}

function floor(g, o, size) {
  const top = HORIZON + 4;
  g.fillStyle = '#190c3b';
  g.fillRect(0, top + o, size, size - top - o);
  g.fillStyle = '#ff4fb0';
  g.fillRect(0, top + o, size, 1);
  g.fillStyle = '#7a2fb0';
  for (const y of [top + 5, top + 11, top + 19, top + 29, top + 41])
    if (y + o < size) g.fillRect(0, y + o, size, 1);
  g.fillStyle = '#4b1f86';
  for (let k = -14; k <= 14; k++) {
    let x0 = 64,
      y0 = top,
      x1 = 64 + k * 17,
      y1 = top + 48;
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      if (y0 > top) g.fillRect(x0 + o, y0 + o, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) {
        e += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        e += dx;
        y0++;
      }
    }
  }
}

/**
 * Draws the icon on a canvas of `size` art pixels with the 128 pixel art placed at offset `o`
 * (the extra margin carries the background out to the edges, which a maskable icon needs).
 */
export function drawArt(size = GRID, o = 0) {
  const { SPR } = createRenderSprites({}),
    cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const span = o + 4;
  sky(g, size, o);
  glow(g, o);
  stars(g, o, span);
  skyline(g, o, span);
  floor(g, o, size);
  const sun = SPR[10];
  g.drawImage(sun, SUN.x - sun.width / 2 + o, SUN.y - sun.height / 2 + o);
  // Three pals on the floor, the tabby in front. Feet sit on the same line.
  const feet = HORIZON + 22;
  for (const [tier, x] of [
    [2, 22],
    [3, 78],
    [4, 44],
  ]) {
    const s = SPR[tier],
      y = feet - s.height + 4;
    g.fillStyle = 'rgba(8,3,26,.55)';
    g.fillRect(x + o + 3, feet + o + 1, s.width - 6, 2);
    g.drawImage(s, x + o, y + o);
  }
  return cv;
}

/**
 * A square PNG canvas. The art is first drawn at 512 pixels with whole-number pixel scale (4 for
 * the normal icon, 3 with extra margin for the maskable one) and smaller sizes are scaled down
 * from that, so no size has pixels of uneven width.
 */
export function drawIcon(out, maskable) {
  const big = 512,
    scale = maskable ? 3 : big / GRID,
    size = Math.ceil(big / scale),
    o = maskable ? Math.round((size - GRID) / 2) : 0,
    art = drawArt(size, o),
    full = document.createElement('canvas');
  full.width = full.height = big;
  const f = full.getContext('2d');
  f.imageSmoothingEnabled = false;
  const drawn = size * scale;
  f.drawImage(art, -(drawn - big) / 2, -(drawn - big) / 2, drawn, drawn);
  if (out === big) return full;
  const cv = document.createElement('canvas');
  cv.width = cv.height = out;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(full, 0, 0, out, out);
  return cv;
}
