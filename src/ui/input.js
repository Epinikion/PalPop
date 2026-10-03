import { $ } from '../core/dom.js';
import { FL, FR, W } from '../config.js';
import { clamp } from '../core/math.js';
export function createUiInput({ audioRuntime, game, gameActions, uiElements, uiInterface }) {
  /* ================= input ================= */
  const app = $('#app');
  let down = false;
  const toX = (e) => {
    const r = uiElements.cv.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  app.addEventListener('pointerdown', (e) => {
    if (
      e.target.closest('button,input') ||
      !uiInterface.radio.hidden ||
      !uiInterface.book.hidden ||
      game.iris
    )
      return;
    if (!e.target.closest('#wrap')) return;
    uiElements.cv.focus({
      preventScroll: true,
    });
    audioRuntime.initAudio();
    game.aimX = toX(e);
    if (game.phase === 'title') {
      gameActions.irisTo(gameActions.newGame);
      down = false;
      return;
    }
    if (game.phase !== 'play') return;
    uiElements.cv.setPointerCapture(e.pointerId);
    down = true;
    game.carrierX += (clamp(game.aimX, FL + 8, FR - 8) - game.carrierX) * 0.6;
  });
  app.addEventListener('pointermove', (e) => {
    if (down || e.pointerType === 'mouse') game.aimX = toX(e);
  });
  app.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    game.aimX = toX(e);
    gameActions.drop();
  });
  app.addEventListener('pointercancel', () => {
    down = false;
  });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest && e.target.closest('#app')) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => {
    if (!uiInterface.book.hidden) {
      if (e.key === 'Escape' || e.key === 'b') uiInterface.closeBook();
      return;
    }
    if (!uiInterface.radio.hidden) {
      if (e.key === 'Escape' || e.key === 'm') uiInterface.closeRadio();
      return;
    }
    if (e.target.closest('button,input,a') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(e.key)) {
      audioRuntime.initAudio();
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft') game.aimX = game.carrierX - 6;
    else if (e.key === 'ArrowRight') game.aimX = game.carrierX + 6;
    else if (e.key === ' ' || e.key === 'ArrowDown') {
      if (game.phase === 'title') gameActions.irisTo(gameActions.newGame);
      else gameActions.drop();
      e.preventDefault();
    } else if (e.key === 'Enter' && (game.phase === 'title' || game.phase === 'over'))
      gameActions.irisTo(gameActions.newGame);
    else if (e.key === 's' || e.key === 'S') gameActions.swap();
    else if (e.key === 'm') uiInterface.openRadio();
    else if (e.key === 'b') uiInterface.openBook();
  });
  $('#nextBtn').addEventListener('click', gameActions.swap);
  $('#shakeBtn').addEventListener('click', () => {
    audioRuntime.initAudio();
    gameActions.doShake();
  });
  $('#sndBtn').addEventListener('click', uiInterface.openRadio);
  $('#againBtn').addEventListener('click', () => gameActions.irisTo(gameActions.newGame));
  $('#shareBtn').addEventListener('click', gameActions.share);

  /* ================= boot ================= */
  return {};
}
