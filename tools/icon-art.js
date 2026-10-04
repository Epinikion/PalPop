import { createRenderSprites } from '../src/render/sprites.js';

/**
 * The app icon, drawn from the game's own sprites: the Blipp berry, big, on a soft night-sky
 * gradient with a glow behind it. Everything is placed on a 128 x 128 pixel grid and rendered at
 * a whole-number scale so the pixels stay square.
 */
const GRID = 128;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const SKY = [
  [0, '#120a30'],
  [50, '#2a1465'],
  [96, '#5a2a9a'],
  [128, '#7a3cb8'],
];
const BERRY = { x: 64, y: 70, scale: 6 };
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

/** Two dithered rings of light around the berry: blue close in, violet further out. */
function glow(g, o) {
  for (const [radius, color, strength] of [
    [62, '#7a5cff', 0.5],
    [44, '#4c9dff', 0.7],
  ])
    for (let y = BERRY.y - radius; y <= BERRY.y + radius; y++)
      for (let x = BERRY.x - radius; x <= BERRY.x + radius; x++) {
        const d = Math.hypot(x - BERRY.x, y - BERRY.y);
        if (d > radius) continue;
        const p = Math.pow(1 - d / radius, 1.7) * strength;
        if (p * 16 > BAYER[(y + 64) & 3][(x + 64) & 3]) {
          g.fillStyle = color;
          g.globalAlpha = 0.65;
          g.fillRect(x + o, y + o, 1, 1);
        }
      }
  g.globalAlpha = 1;
}

function stars(g, o, span) {
  const rand = mulberry(11);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rand() * (GRID + 2 * span)) - span,
      y = Math.floor(rand() * (GRID + 2 * span)) - span,
      kind = rand();
    if (Math.hypot(x - BERRY.x, y - BERRY.y) < 46) continue;
    g.fillStyle = kind < 0.6 ? '#ffffff' : kind < 0.85 ? '#9fe8ff' : '#ffd0f0';
    g.globalAlpha = 0.5 + rand() * 0.5;
    g.fillRect(x + o, y + o, 1, 1);
    if (kind > 0.9) {
      g.fillRect(x + o - 1, y + o, 3, 1);
      g.fillRect(x + o, y + o - 1, 1, 3);
    }
  }
  g.globalAlpha = 1;
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
  sky(g, size, o);
  glow(g, o);
  stars(g, o, o + 4);
  const berry = SPR[0],
    w = berry.width * BERRY.scale,
    h = berry.height * BERRY.scale;
  g.drawImage(berry, BERRY.x - w / 2 + o, BERRY.y - h / 2 + o, w, h);
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
