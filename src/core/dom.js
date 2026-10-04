const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (s) => document.querySelector(s);
const mkc = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
/** Player switches for the two physical effects; the Sound sheet flips them and saves them. */
const feel = { haptics: true, flashes: true };
const vib = (p) => {
  if (!feel.haptics) return;
  try {
    navigator.vibrate && navigator.vibrate(p);
  } catch (e) {}
};

/* ================= effects ================= */
export { RM, $, mkc, vib, feel };
