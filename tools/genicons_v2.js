const fs = require('fs'), zlib = require('zlib'), path = require('path');
const out = a => path.join(__dirname, '..', a);

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

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function icon(size) {
  const R = size * .295, cx = size / 2, cy = size * .51;
  const body = hex('#ff9a3c'), bodyD = hex('#7a3208'), bodyL = [255, 236, 200];
  const C = {
    bg0: hex('#0a0616'), bg1: hex('#160d2e'), glow: hex('#7a5cff'),
    rim: [255, 255, 255], ink: hex('#241640'), white: [255, 255, 255], blush: hex('#ff78a0'),
    star: hex('#cfe8ff')
  };
  const px = new Uint8ClampedArray(size * size * 4);
  const S = 4;
  /* deterministic stars */
  const stars = [];
  let sd = 12345; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 40; i++) stars.push([rnd() * size, rnd() * size, rnd() < .3 ? 2 : 1]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const px0 = x + (sx + .5) / S, py0 = y + (sy + .5) / S;
      const fx = px0 - cx, fy = py0 - cy, d = Math.hypot(fx, fy);
      /* sky */
      const k = py0 / size;
      let c = mix(C.bg0, C.bg1, k);
      for (const st of stars) if (Math.abs(px0 - st[0]) < st[2] && Math.abs(py0 - st[1]) < st[2]) c = C.star;
      /* glow */
      const gk = Math.max(0, 1 - Math.abs(d - R * 1.32) / (R * .5));
      c = mix(c, C.glow, .35 * gk);
      if (d < R) {
        /* body gradient from top-left light */
        const lx = (fx + R * .42) / (R * .95), ly = (fy + R * .5) / (R * .95);
        const l = Math.max(0, 1 - Math.hypot(lx, ly));
        c = mix(bodyD, body, Math.min(1, .35 + l * .75));
        c = mix(c, bodyL, Math.max(0, l - .55) * .9);
        /* rim light */
        if (d > R * .9 && fy < 0 && fx < R * .3) c = mix(c, C.rim, .55);
        /* cheeks */
        for (const s of [-1, 1]) if (Math.hypot(fx - s * R * .60, fy - R * .20) < R * .15) c = mix(c, C.blush, .5);
        /* eyes */
        for (const s of [-1, 1]) {
          if (Math.hypot(fx - s * R * .30, fy + R * .07) < R * .165) c = C.ink;
          if (Math.hypot(fx - s * R * .30 + R * .05, fy + R * .07 + R * .06) < R * .06) c = C.white;
        }
        /* smile */
        const my = fy - R * .11, md = Math.hypot(fx, my), ma = Math.atan2(my, fx);
        if (ma > .35 && ma < 2.79 && md > R * .33 && md < R * .43) c = C.ink;
      }
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    const n = S * S, o = (y * size + x) * 4;
    px[o] = acc[0] / n; px[o + 1] = acc[1] / n; px[o + 2] = acc[2] / n; px[o + 3] = 255;
  }
  return png(size, size, px);
}

fs.writeFileSync(out('SickVersion2/icon-192.png'), icon(192));
fs.writeFileSync(out('SickVersion2/icon-512.png'), icon(512));
fs.writeFileSync(out('SickVersion2/apple-touch-icon.png'), icon(180));
console.log('v2 icons written');
