/**
 * Helpers for the one line of window numbers at the end of the Sound sheet. Installed iOS 26 apps
 * report a window that is one top inset too short (WebKit bug 301108) and paint nothing below it,
 * so layout problems there can only be chased with the real numbers.
 */
export const isStandalone = () =>
  !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

/** Safe-area insets and the large viewport height in CSS pixels, read through a hidden probe. */
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
