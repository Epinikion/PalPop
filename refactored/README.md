# Pal Pop — modular edition

The playable refactor lives entirely in this folder. The parent folder retains its original single-file entry point. Both editions offer electro, melodic festival house, and techno. Pixel artwork, scoring, special pals, progression, and lighter physics are retained.

## Run

```sh
cd refactored
npm start
```

Open **http://127.0.0.1:4174/**. Node 22.18 or newer is supported. The app uses native browser ES modules and Web Audio: there is no runtime package dependency or bundling step. Any static HTTP server works as well; opening `index.html` directly as a file does not support module loading.

For another port, set `PORT` before starting. When served by the existing parent project on port 4173, use `/refactored/`.

To play from another device on the same local network, set `HOST` to this computer's LAN IP before starting. In PowerShell, for example: `$env:HOST = '192.168.178.20'; npm start`. Open `http://192.168.178.20:4174/` on the other device. The default host remains `127.0.0.1`.

## Where to change things

| Change                                                      | File / folder                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Friction, gravity, bounces, merge tolerance, fixed timestep | `src/settings.js` → `PHYSICS`                                        |
| Drop speed, cooldown, combo timing                          | `src/settings.js` → `GAMEPLAY`                                       |
| Pal names, sizes, palettes, score values, unlock thresholds | `src/config.js`                                                      |
| Collision and settling rules                                | `src/game/physics.js`                                                |
| Drops, swaps, scoring, merges, retries, game over           | `src/game/actions.js`                                                |
| Special-pal behavior                                        | `src/game/specials.js`                                               |
| Missions and progression                                    | `src/game/progression.js`                                            |
| Visual springs, blinking, trails                            | `src/game/animation.js`                                              |
| Song names, descriptions, picker buttons                    | `src/audio/catalog.js`                                               |
| Melody, key, progressions, chapter renewal                  | `src/audio/songs/`                                                   |
| When instruments play in each section                       | `src/audio/dance.js`, `src/audio/festival.js`, `src/audio/techno.js` |
| How each instrument sounds                                  | `src/audio/instruments/`                                             |
| Mix, delay, reverb, voice cleanup                           | `src/audio/graph.js`                                                 |
| Lookahead timing and background scheduling                  | `src/audio/scheduler.js`                                             |
| Musical reactions to gameplay                               | `src/audio/reactions.js`                                             |
| Board drawing, sprites, backgrounds, pixel text             | `src/render/`                                                        |
| Dialogs, collection, layout, buttons                        | `src/ui/interface.js`                                                |
| Keyboard and pointer controls                               | `src/ui/input.js`                                                    |
| Styling and responsive layout                               | `styles/game.css`                                                    |

`src/main.js` is the composition root. It creates the state and wires the controllers together. Every factory receives its dependencies explicitly. A few gameplay controllers call each other, so the root creates stable controller objects before assigning their implementations. Callbacks run only after assembly. ES module imports remain acyclic.

## State and simulation

`createGameState()` owns each run's data; `createAudioState()` owns preferences and music playback. State is passed explicitly and never attached to `window`. Their optional storage argument makes isolated instances easy to test. Storage catches blocked access and malformed JSON.

Physics runs at a fixed 240 Hz, independently of rendering. Its only external effects are `onMerge`, `onLanding`, and `onCollision` callbacks. Cosmetic animation runs separately. You can instantiate the solver in Node:

```js
import { createGameState } from './src/game/state.js';
import { createGamePals } from './src/game/pals.js';
import { createGamePhysics } from './src/game/physics.js';
import { PHYSICS } from './src/settings.js';

const game = createGameState();
const pals = createGamePals({ game });
game.bodies.push(pals.mk(0, 60, 80));

const simulation = createGamePhysics({
  game,
  settings: { ...PHYSICS, floorDrag: 1 },
  onMerge(a, b, vx, vy) {
    // Decide the new pal, scoring, and any other game rules here.
  },
});
simulation.advance(1 / 60);
```

Pal fields used in the renderer and solver are documented in `src/game/types.js`. Their compact sprite/tier IDs remain stable for saved custom artwork.

## Add or change a song

For another variation of an existing style, add an entry to `TRACKS` in `src/audio/catalog.js` using a new numeric ID, a unique `buttonId`, a name, label, description, BPM, and existing `style`. The picker and stored-choice validation discover it automatically.

For a new musical style:

1. Add a pure composer under `src/audio/songs/`. It should return the same session shape as the dance composer: style, mode/scale, key, BPM, seconds per beat (`spb`), seconds per sixteenth (`s16`), swing, progressions, and pentatonic notes. Include any additional phrase data your arrangement uses.
2. Write a chapter renewal function. Keep the session's tempo/key and supply a 64-bar `form` array of `[exclusiveEndBar, sectionName]` pairs.
3. Add an arrangement factory, following `src/audio/dance.js`. Return a function accepting `(absoluteSixteenthStep, audioTime)`; schedule voices on Web Audio's clock.
4. Register `compose`, `renewChapter`, `introForm`, and `createArrangement` under the style name in `src/audio/song-registry.js`, then add its catalog entry.

The scheduler dispatches through the registry. The chapter cache retains at most three chapters; compositions renew indefinitely. Electro dance develops an A / A variation / B / A reply theme across four eight-bar phrases, then renews the theme. Rhythm, timbre and harmony evolve on different schedules, with a four-phrase cache. It uses minor/Dorian harmony, short saw/pulse leads, stereo synth stabs, and sidechain bass. `resetLiveMusic()` resets gameplay accents without restarting the soundtrack. Music reactions in `src/audio/reactions.js` can be adapted for a new style.

SKYLINE RUSH (`FESTIVAL`, ID 7) is melodic festival house at 126–128 BPM. Its major scale and relative-minor progressions hold each chord for two bars. Piano and an original saw hook answer each other, with the first drop after eight bars. PEAK plays A / varied A and FINAL plays B / exact A reprise; each chapter renews the theme from multiple contours and rhythm families. Breaks and builds omit the lead. Its dedicated piano/saw instruments, gameplay piano replies and brightness limits are isolated from the other two tracks. Keep the four-phrase and three-chapter caches bounded.

`src/audio/game-feedback.js` owns dry gameplay effects. Call `audioReactions.reactToEvent(kind, detail)` from an accepted game action. Drop, swap, impact, merge, shake, goal, discovery, fever, danger, game over, and specials have short electronic cues. Impact pair memory is bounded and repeated contacts are throttled. Seven ordinary effects voices leave two additional slots for controls and one reserved for game over. Musical cascade replies coalesce into the strongest event, at most once per beat. Sound settings expose separate Music and Effects levels; Sound Off mutes both. `src/audio/output.js` provides the shared compressor/limiter for both live playback and audition.

Voice factories use `audioGraph.releaseVoice()` to disconnect nodes after playback. Keep sends and auxiliary sources in that cleanup list when adding a voice. `stopScheduler()` and `audioRuntime.destroy()` release the worker, timers, gesture listeners, silent-audio fallback, and context.

## Saves, artwork, and offline support

The `palpop:` storage keys and existing numeric pal/song IDs are preserved. When both versions are served on the same origin, saved progress, song preferences, and custom sprites are shared. A different port is a separate browser origin with separate saves.

The sprite designer is available through **PALS → PIXEL LAB**, or at `tools/pal-designer.html`. Press Start 2P is bundled as a separate font; its SIL Open Font License is in `assets/fonts/OFL.txt`.

The service worker caches only this app's files and cleans only caches beginning with `palpop-refactored-`. Run `npm run cache:update` after editing shipped assets; `npm start` does this automatically. The generated `precache.js` hashes all runtime files, so changes produce a new offline cache version.

## Verify

Development checks require the parser and formatter:

```sh
npm ci
npm run format
npm run cache:update
npm run verify
```

The Node tests cover original physics trajectories at 30/60/120 FPS, overlap resolution, chain merges, stacks, shakes, injectable balance settings, the original techno composition, evolving electro/festival phrases, 10,000 bounded phrase renewals, 2,000 renewed chapters, 24 chapters of all arrangements, audible festival A/B/reprise development, legacy/modular festival parity, immediate gameplay feedback, impact throttling, essential cue capacity, coalesced musical rewards, mute/retry behavior, and save compatibility. Baselines in `tests/fixtures/` were captured from the original implementation before refactoring; tests import the actual modules directly.

For actual Web Audio rendering in a browser, open `tools/audio-check.html` and press **RUN AUDIO CHECKS**. It renders all songs at several sections, additional seeds, and busy gameplay through the live compressor/limiter and reactive filter. It checks finite samples, clipping, released voices, required cues, and freeze/recovery/death transitions. Choose a soundtrack and export music or music with gameplay feedback using the preview buttons. Festival previews span 48 bars, including intro, build, drop, break and another drop. Automated checks establish signal/runtime behavior; listening establishes musical taste.

To update the original single-file entry point after changing the electro or festival modules, run `node tools/sync-legacy-dance.mjs`. This explicit compatibility step does not run when starting the modular app.
