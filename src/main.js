import { createAudioMath } from './audio/math.js';
import { $ } from './core/dom.js';
import { FLOOR } from './config.js';
import { createGameState } from './game/state.js';
import { createAudioState } from './audio/state.js';
import { createArrangements } from './audio/song-registry.js';
import { createAudioRuntime } from './audio/runtime.js';
import { createAudioComposition } from './audio/composition.js';
import { createAudioGraph } from './audio/graph.js';
import { createAudioInstruments } from './audio/instruments.js';
import { createAudioScheduler } from './audio/scheduler.js';
import { createAudioReactions } from './audio/reactions.js';
import { createGameAudio } from './audio/game-feedback.js';
import { createUiMusicMeter } from './ui/music-meter.js';
import { createRenderSprites } from './render/sprites.js';
import { createRenderText } from './render/text.js';
import { createRenderWorlds } from './render/worlds.js';
import { createUiElements } from './ui/elements.js';
import { createGamePals } from './game/pals.js';
import { createGameEffects } from './game/effects.js';
import { createGameSpecials } from './game/specials.js';
import { createGameProgression } from './game/progression.js';
import { createGameActions } from './game/actions.js';
import { createGamePhysics } from './game/physics.js';
import { createGameAnimation } from './game/animation.js';
import { createGameUpdate } from './game/update.js';
import { createRenderBoard } from './render/board.js';
import { createUiInterface } from './ui/interface.js';
import { createUiInput } from './ui/input.js';
const game = createGameState(),
  audio = createAudioState();
// Stable controller references let callbacks connect game/UI/audio without circular imports.
// Complete assembly before starting the first frame or handling a user gesture.
const audioMath = createAudioMath(audio);
const audioRuntime = {};
const audioComposition = {};
const audioGraph = {};
const audioInstruments = {};
const audioScheduler = {};
const audioReactions = {};
const gameAudio = {};
const uiMusicMeter = {};
const renderSprites = {};
const renderText = {};
const renderWorlds = {};
const uiElements = {};
const gamePals = {};
const gameEffects = {};
const gameSpecials = {};
const gameProgression = {};
const gameActions = {};
const gamePhysics = {};
const gameAnimation = {};
const gameUpdate = {};
const renderBoard = {};
const uiInterface = {};
Object.assign(
  audioRuntime,
  createAudioRuntime({ audio, audioScheduler, audioGraph, onSettingsChange: refreshMusicSettings }),
);
Object.assign(audioComposition, createAudioComposition({ audio }));
Object.assign(audioGraph, createAudioGraph({ audio }));
Object.assign(audioInstruments, createAudioInstruments({ audio, audioGraph, audioMath }));
Object.assign(gameAudio, createGameAudio({ audio, audioGraph, audioMath, audioComposition }));
const arrangements = createArrangements({
  audio,
  game,
  audioComposition,
  audioMath,
  audioInstruments,
});
Object.assign(
  audioScheduler,
  createAudioScheduler({ audio, audioComposition, arrangements, audioInstruments, audioGraph }),
);
Object.assign(
  audioReactions,
  createAudioReactions({
    audio,
    game,
    audioScheduler,
    audioRuntime,
    audioComposition,
    audioInstruments,
    gameAudio,
  }),
);
Object.assign(uiMusicMeter, createUiMusicMeter({ audio, uiInterface }));
Object.assign(renderSprites, createRenderSprites({}));
Object.assign(renderText, createRenderText({ game }));
Object.assign(renderWorlds, createRenderWorlds({}));
Object.assign(uiElements, createUiElements({ game }));
Object.assign(gamePals, createGamePals({ game }));
Object.assign(gameEffects, createGameEffects({ game }));
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
    audioRuntime,
    audioReactions,
    audio,
    gamePals,
    uiInterface,
    gameSpecials,
    renderSprites,
  }),
);
Object.assign(
  gamePhysics,
  createGamePhysics({
    game,
    onMerge: (...args) => gameActions.doMerge(...args),
    onLanding: (pal, speed) => {
      gameEffects.dust(pal.x, FLOOR - 1, speed);
      if (game.phase === 'play')
        gameAudio.play('impact', { tier: pal.t, x: pal.x, speed, pair: `floor:${pal.id}` });
    },
    onCollision: (x, y, speed, a, b) => {
      if (game.phase === 'play')
        gameAudio.play('impact', { tier: Math.max(a.t, b.t), x, speed, pair: `${a.id}:${b.id}` });
      if (game.parts.length >= 500) return;
      for (let i = 0; i < 3; i++)
        game.parts.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          l: 0.2,
          c: '#fff',
          sz: 1,
          g: 0,
        });
    },
  }),
);
Object.assign(gameAnimation, createGameAnimation({ game, gamePhysics, gameEffects, gameSpecials }));
Object.assign(
  gameUpdate,
  createGameUpdate({
    audio,
    audioReactions,
    audioScheduler,
    uiMusicMeter,
    game,
    gamePals,
    gameAnimation,
    uiInterface,
    gameEffects,
    gameActions,
    uiElements,
  }),
);
Object.assign(
  renderBoard,
  createRenderBoard({ renderSprites, game, renderWorlds, audio, uiElements, renderText }),
);
Object.assign(
  uiInterface,
  createUiInterface({
    renderSprites,
    game,
    audio,
    audioRuntime,
    renderWorlds,
    gameActions,
    audioReactions,
    uiElements,
    gameProgression,
  }),
);
createUiInput({ uiElements, uiInterface, game, audioRuntime, gameActions });
function refreshMusicSettings() {
  if (!uiInterface.renderRadio) return;
  gameActions.setTitleInfo();
  uiInterface.setPage();
  uiInterface.renderRadio();
}
/* ================= boot ================= */
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  game.elapsed += dt;
  gameUpdate.update(dt);
  renderBoard.render();
}
uiInterface.blitFit($('#cabinetPal'), renderSprites.SPR[3], 128);
game.nextTier = 0;
game.mission = gameProgression.genMission(0);
audioRuntime.applyAudio();
gameActions.setTitleInfo();
uiInterface.setPage();
uiInterface.fit();
uiInterface.drawLadder();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((registration) => registration.update())
      .catch(() => {});
  });
}
