const fs = require('fs'), zlib = require('zlib'), path = require('path');
const out = a => path.join(__dirname, '..', a);

/* ---------- tiny PNG encoder ---------- */
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- circle-pal icon (4x supersampled painter) ---------- */
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function icon(size) {
  const R = size * .30, cx = size / 2, cy = size * .52;
  const col = { bg: hex('#0d0a1a'), glow: hex('#7a5cff'), rim: hex('#7a3200'), body: hex('#ffc400'), ink: hex('#241640'), white: [255, 255, 255], blush: hex('#ff78a0') };
  const px = new Uint8ClampedArray(size * size * 4);
  const S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const fx = x + (sx + .5) / S - cx, fy = y + (sy + .5) / S - cy;
      const d = Math.hypot(fx, fy);
      let c = col.bg;
      if (d < R * 1.22) c = mix(c, col.glow, .22 * (1 - Math.min(1, (d - R) / (R * .22))));
      if (d < R) c = col.rim;
      if (d < R * .955) c = col.body;
      /* gloss */
      if (d < R) {
        const gx = (fx + R * .32) / (R * .34), gy = (fy + R * .40) / (R * .22);
        const gd = Math.hypot(gx, gy);
        if (gd < 1) c = mix(c, col.white, .55 * (1 - gd * .6));
      }
      /* cheeks */
      for (const s of [-1, 1]) if (Math.hypot(fx - s * R * .62, fy - R * .22) < R * .15) c = mix(c, col.blush, .5);
      /* eyes + highlights */
      for (const s of [-1, 1]) {
        if (Math.hypot(fx - s * R * .30, fy + R * .06) < R * .17) c = col.ink;
        if (Math.hypot(fx - s * R * .30 + R * .05, fy + R * .06 + R * .06) < R * .06) c = col.white;
      }
      /* smile */
      const my = fy - (R * .10);
      const md = Math.hypot(fx, my), ma = Math.atan2(my, fx);
      if (fx * 0 + ma > .35 && ma < 2.79 && md > R * .34 && md < R * .44) c = col.ink;
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const n = S * S, o = (y * size + x) * 4;
    px[o] = acc[0] / n; px[o + 1] = acc[1] / n; px[o + 2] = acc[2] / n; px[o + 3] = 255;
  }
  return png(size, size, px);
}

fs.writeFileSync(out('SickVersion/icon-192.png'), icon(192));
fs.writeFileSync(out('SickVersion/icon-512.png'), icon(512));
fs.writeFileSync(out('SickVersion/apple-touch-icon.png'), icon(180));
console.log('circle icons written');
