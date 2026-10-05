import { BAY, TIERS } from '../config.js';

/** Colours as [r, g, b], parsed once. */
const rgb = new Map();
function rgbOf(hex) {
  if (!rgb.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    rgb.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  return rgb.get(hex);
}

let scratch = null;

/**
 * Liquid between pals: every blob `{ x, y, r, ramp }` adds to one field (the way metaballs do),
 * and every pixel where the field reaches 1 is drawn. Two blobs close to each other grow a neck
 * between them, so they look like drops of water running together. Each pixel takes the colour of
 * the blob that adds the most to it, outlined and lit like the game's spheres.
 */
export function drawBlobs(g, blobs) {
  blobs = blobs.filter((b) => b.r > 0.6);
  if (!blobs.length) return;
  const x0 = Math.floor(Math.min(...blobs.map((b) => b.x - b.r))) - 2,
    y0 = Math.floor(Math.min(...blobs.map((b) => b.y - b.r))) - 2,
    x1 = Math.ceil(Math.max(...blobs.map((b) => b.x + b.r))) + 2,
    y1 = Math.ceil(Math.max(...blobs.map((b) => b.y + b.r))) + 2,
    w = x1 - x0 + 1,
    h = y1 - y0 + 1,
    field = new Float32Array(w * h),
    owner = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = x0 + i + 0.5,
        py = y0 + j + 0.5;
      let sum = 0,
        most = 0,
        who = 0;
      for (let k = 0; k < blobs.length; k++) {
        // (r / d)⁴ rather than (r / d)²: each blob keeps its own round shape, and only a slim neck
        // grows where two come close, instead of one fat capsule
        const b = blobs[k],
          v = ((b.r * b.r) / ((px - b.x) ** 2 + (py - b.y) ** 2 + 1e-3)) ** 2;
        sum += v;
        if (v > most) {
          most = v;
          who = k;
        }
      }
      field[j * w + i] = sum;
      owner[j * w + i] = who;
    }
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, w);
    scratch.height = Math.max(scratch.height, h);
  }
  const sg = scratch.getContext('2d'),
    image = sg.createImageData(w, h),
    data = image.data,
    inside = (i, j) => i >= 0 && j >= 0 && i < w && j < h && field[j * w + i] >= 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      const b = blobs[owner[j * w + i]],
        ramp = b.ramp;
      let hex;
      if (!inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1))
        hex = ramp[0];
      else {
        // lit as part of its own blob; pixels of a neck lie past the blob's edge and stay darker
        const dx = x0 + i + 0.5 - b.x,
          dy = y0 + j + 0.5 - b.y,
          R = Math.max(b.r, Math.hypot(dx, dy) + 0.5),
          nx = dx / R,
          ny = dy / R,
          nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)),
          x = x0 + i,
          y = y0 + j;
        let l = -0.45 * nx - 0.62 * ny + 0.64 * nz;
        l += (BAY[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)] / 16 - 0.5) * 0.13;
        hex =
          l > 0.95
            ? '#ffffff'
            : l > 0.8
              ? ramp[4]
              : l > 0.56
                ? ramp[3]
                : l > 0.27
                  ? ramp[2]
                  : ramp[1];
      }
      const [r, gr, bl] = rgbOf(hex),
        o = (j * w + i) * 4;
      data[o] = r;
      data[o + 1] = gr;
      data[o + 2] = bl;
      data[o + 3] = 255;
    }
  sg.clearRect(0, 0, w, h);
  sg.putImageData(image, 0, 0);
  g.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
}

/**
 * A merge as liquid: the two pals that merged (from where they touched) run into the new one,
 * shrinking as they go, while the new pal grows; necks of goo join them until only the new pal is
 * left. `sprites` are the pals' pictures: the two keep their faces while they are big enough.
 */
export function drawGoo(g, goo, sprites) {
  const p = Math.min(1, goo.age / goo.life),
    ease = p * p * (3 - 2 * p),
    pal = goo.pal,
    blobs = goo.from.map((f) => ({
      x: f.x + (pal.x - f.x) * ease,
      y: f.y + (pal.y - f.y) * ease,
      r: TIERS[f.t].r * (1 - p) ** 0.8,
      ramp: TIERS[f.t].ramp,
    }));
  blobs.push({
    x: pal.x,
    y: pal.y,
    r: TIERS[pal.t].r * Math.min(1, pal.s),
    ramp: TIERS[pal.t].ramp,
  });
  drawBlobs(g, blobs);
  goo.from.forEach((f, k) => {
    // the faces shrink faster than the liquid around them, so the colour is seen flowing in
    const k2 = (blobs[k].r / TIERS[f.t].r) ** 2.2,
      sprite = sprites[f.t];
    if (k2 < 0.3) return;
    const dw = Math.max(2, Math.round(sprite.width * k2));
    g.drawImage(sprite, Math.round(blobs[k].x - dw / 2), Math.round(blobs[k].y - dw / 2), dw, dw);
  });
}
