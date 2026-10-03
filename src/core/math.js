const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seeded = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const fmt = (n) => String(n);
const fmtK = (n) =>
  n >= 10000 ? Math.floor(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
export { clamp, seeded, fmt, fmtK };

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
