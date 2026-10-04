/**
 * The real game rules (actions, progression, specials, update) wired to stand-ins for the DOM and
 * the audio engine, so rules can be tested without a browser. Import this module before any game
 * module: it installs the browser globals they expect.
 */
const element = (() => {
  const target = function () {};
  const proxy = new Proxy(target, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'length' ? 0 : proxy),
    apply: () => proxy,
    set: () => true,
  });
  return proxy;
})();
const memory = new Map();
Object.assign(globalThis, {
  window: globalThis,
  matchMedia: () => ({ matches: false }),
  devicePixelRatio: 1,
  document: { querySelector: () => element, createElement: () => element, body: element },
  localStorage: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
  },
});
Object.defineProperty(globalThis, 'navigator', { value: { vibrate() {} }, configurable: true });
export const timers = [];
globalThis.setTimeout = (callback, ms = 0) => timers.push({ callback, ms }) && timers.length;
globalThis.requestAnimationFrame = () => 0;

const { createGameState } = await import('../../src/game/state.js');
const { createGamePals } = await import('../../src/game/pals.js');
const { createGameEffects } = await import('../../src/game/effects.js');
const { createGameSpecials } = await import('../../src/game/specials.js');
const { createGameProgression } = await import('../../src/game/progression.js');
const { createGameActions } = await import('../../src/game/actions.js');
const { createGameUpdate } = await import('../../src/game/update.js');
const { createGameAnimation } = await import('../../src/game/animation.js');
const { createGamePhysics } = await import('../../src/game/physics.js');
const { createStorage } = await import('../../src/core/storage.js');
const { PHYSICS } = await import('../../src/settings.js');

/** Resets the saved data every call, so tests never see each other's progress. */
export function headlessGame() {
  memory.clear();
  timers.length = 0;
  const noop = () => {},
    quiet = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : noop) }),
    game = createGameState(),
    audio = { enabled: false, feverOn: false, hype: 0, stemFlash: {}, trackId: 6 },
    events = [],
    audioReactions = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) =>
            events.push({ name: String(key), args }),
      },
    ),
    uiInterface = {
      drawNext: noop,
      drawLadder: noop,
      blitFit: noop,
      updSwaps: noop,
      renderOver: noop,
      renderTitle: noop,
      dpr: 1,
      palCount: () => 0,
    },
    uiElements = { scoreEl: element, bestEl: element, cv: element },
    renderSprites = {
      SPR: new Proxy([], { get: () => element }),
      ICON: new Proxy({}, { get: () => element }),
    },
    gameEffects = createGameEffects({ game }),
    gamePals = createGamePals({ game }),
    gameSpecials = {},
    gameProgression = {},
    gameActions = {};
  Object.assign(
    gameSpecials,
    createGameSpecials({
      game,
      audioReactions,
      gameProgression,
      uiInterface,
      gameActions,
      gameEffects,
      gamePals,
    }),
  );
  Object.assign(
    gameProgression,
    createGameProgression({
      game,
      audioReactions,
      uiInterface,
      renderSprites,
      gameEffects,
      uiElements,
    }),
  );
  Object.assign(
    gameActions,
    createGameActions({
      game,
      gameEffects,
      uiElements,
      gameProgression,
      audioRuntime: quiet,
      audioReactions,
      audio,
      gamePals,
      uiInterface,
      gameSpecials,
      renderSprites,
    }),
  );
  const gamePhysics = createGamePhysics({
      game,
      settings: PHYSICS,
      onMerge: (...args) => gameActions.doMerge(...args),
      onLanding: noop,
      onCollision: noop,
    }),
    gameAnimation = createGameAnimation({ game, gamePhysics, gameEffects, gameSpecials }),
    gameUpdate = createGameUpdate({
      audio,
      audioReactions,
      audioScheduler: { musicTick: noop },
      game,
      gameActions,
      gameAnimation,
      gameEffects,
      gamePals,
      uiElements,
      uiInterface,
      uiMusicMeter: { updateLiveMusic: noop },
    });
  const store = createStorage(() => globalThis.localStorage);
  /** A settled pal of tier `t` at (x, y), old enough to count for the lose line. */
  const pal = (t, x, y) => {
    const body = gamePals.mk(t, x, y);
    body.age = 2;
    game.bodies.push(body);
    return body;
  };
  /** Pinned pals hang in the air at a fixed height, so a test can hold one over the lose line. */
  const pinned = new Map(),
    pin = (body, y) => pinned.set(body, y);
  /** Advances the game by `seconds` of real time in 60 Hz steps. */
  const run = (seconds) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      game.elapsed += 1 / 60;
      gameUpdate.update(1 / 60);
      for (const [body, y] of pinned) Object.assign(body, { y, vx: 0, vy: 0 });
    }
  };
  return { game, gameActions, gamePals, gameProgression, gameUpdate, store, events, pal, pin, run };
}
