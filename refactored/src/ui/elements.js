import { $ } from '../core/dom.js';
export function createUiElements({ game }) {
  /* ================= state ================= */
  const cv = $('#game');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const scoreEl = $('#score');
  const bestEl = $('#best');
  bestEl.textContent = game.best;
  return { scoreEl, bestEl, ctx, cv };
}
