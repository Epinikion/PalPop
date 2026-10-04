/**
 * iOS 26 home-screen apps report a window that is exactly the top safe-area inset too short
 * (WebKit bug 301108): innerHeight, 100dvh and 100% all stop above the bottom of the screen and
 * leave an empty band, while the screen height and 100lvh are right. This notices that exact
 * signature and gives the app the real screen height; everywhere else it does nothing.
 */

/** The full window height to use, or null when the window is not short in this way. */
export function fullHeight({
  standalone,
  innerWidth,
  innerHeight,
  screenWidth,
  screenHeight,
  topInset,
}) {
  if (!standalone) return null;
  // iOS keeps screen.width/height in portrait terms, so pick the edge that matches the window.
  const portrait = innerHeight >= innerWidth,
    full = portrait ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight),
    short = full - innerHeight;
  return short > 8 && Math.abs(short - topInset) <= 3 ? full : null;
}

export const isStandalone = () =>
  !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

/** Safe-area insets in CSS pixels, read through a hidden probe element. */
export function readInsets() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;height:100lvh;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)';
  document.body.append(probe);
  const style = window.getComputedStyle(probe),
    top = parseFloat(style.paddingTop) || 0,
    bottom = parseFloat(style.paddingBottom) || 0,
    lvh = Math.round(probe.getBoundingClientRect().height);
  probe.remove();
  return { top, bottom, lvh };
}

/** Keeps `--app-h` on the page in step with the real window; iOS corrects its numbers late. */
export function watchViewport() {
  const root = document.documentElement;
  function fit() {
    const height = fullHeight({
      standalone: isStandalone(),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      topInset: readInsets().top,
    });
    if (height) root.style.setProperty('--app-h', height + 'px');
    else root.style.removeProperty('--app-h');
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  document.addEventListener('visibilitychange', () => document.hidden || fit());
  for (const ms of [300, 1000, 2500]) setTimeout(fit, ms);
}
