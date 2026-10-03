const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = (s) => document.querySelector(s);
const mkc = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const vib = (p) => {
  try {
    navigator.vibrate && navigator.vibrate(p);
  } catch (e) {}
};

/* ================= effects ================= */
export { RM, $, mkc, vib };
