# Pal Pop

A pixel-art merge game with slippery physics, responsive electronic gameplay sounds and five continuously evolving Web Audio soundtracks:

- **NEON CIRCUIT** — pumping electro with sidechained bass, supersaw stabs and plucked arpeggios.
- **LIVE TECHNO** — rolling bass, acid lines and dub chords.
- **WAREHOUSE** — dark, drum-led techno: a hard kick, rolling rumble, hats and claps rendered like samples, percussion that drifts against the beat, and almost no synth.
- **GOLDEN HOUR** — melodic vocal house: warm, wordless sung melodies over piano, plucks and a soft four-on-the-floor, with verses, builds, sing-along choruses and a bridge.
- **SKYLINE RUSH** — melodic festival house: piano, a seven-voice supersaw hook, DJ-style builds, silent beats before the drops and a piano breakdown that replays the theme.

All five are mixed and mastered like records: about -13 LUFS at the default volume, glued by bus and master compression, with a wide synth bus, sidechain pumping and a high-pass sweep through intros and builds.

The game is written as native ES modules. Physics, game rules, rendering, interface, composition, arrangement and instrument synthesis are separate modules. There is no bundler and no runtime dependency.

## Project layout

```
index.html            entry point
manifest.webmanifest  PWA manifest (icons live next to it)
sw.js, precache.js    offline support; precache.js is generated
src/                  game, audio, render and UI modules
styles/               game.css
assets/fonts/         bundled Press Start 2P font and its licence
tools/                dev server, checks, cache generator, audio check page, pixel designer
tests/                node:test suites and fixtures
```

## Run

Use Node.js 22.18 or newer:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:4174/**. The app uses native browser ES modules and Web Audio: any static HTTP server works as well, but opening `index.html` directly as a file does not support module loading.

For another port, set `PORT` before starting. To play from another device on the same local network, set `HOST` to this computer's LAN IP before starting. In PowerShell, for example: `$env:HOST = '192.168.178.20'; npm start`. Open `http://192.168.178.20:4174/` on the other device. The default host remains `127.0.0.1`.

## Where to change things

| Change                                                       | File / folder                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Friction, gravity, bounces, merge tolerance, fixed timestep  | `src/settings.js` → `PHYSICS`                                        |
| Drop speed, cooldown, combo timing                           | `src/settings.js` → `GAMEPLAY`                                       |
| Pal names, sizes, palettes, score values, unlock thresholds  | `src/config.js`                                                      |
| Collision and settling rules                                 | `src/game/physics.js`                                                |
| Drops, swaps, scoring, merges, retries, game over            | `src/game/actions.js`                                                |
| Special-pal behavior                                         | `src/game/specials.js`                                               |
| Missions and progression                                     | `src/game/progression.js`                                            |
| Visual springs, blinking, trails                             | `src/game/animation.js`                                              |
| Song names, descriptions, picker buttons                     | `src/audio/catalog.js`                                               |
| Melody, key, progressions, chapter renewal                   | `src/audio/songs/`                                                   |
| When instruments play in each section, and their `LEVEL`s    | `src/audio/dance.js`, `src/audio/festival.js`, `src/audio/techno.js` |
| How each instrument sounds                                   | `src/audio/instruments/`                                             |
| Supersaw voices (hook, stabs, plucks)                        | `src/audio/instruments/supersaw.js`                                  |
| Mix bus, EQ, glue, stereo widener, delay, reverb, cleanup    | `src/audio/graph.js`                                                 |
| Loudness: makeup gain, master compressor, soft clip, limiter | `src/audio/output.js`, per-song `trim` in `src/audio/catalog.js`     |
| DJ filter through intros and builds                          | `src/audio/sweep.js`                                                 |
| Lookahead timing and background scheduling                   | `src/audio/scheduler.js`                                             |
| Musical reactions to gameplay                                | `src/audio/reactions.js`                                             |
| Board drawing, sprites, backgrounds, pixel text              | `src/render/`                                                        |
| Dialogs, collection, layout, buttons                         | `src/ui/interface.js`                                                |
| Keyboard and pointer controls                                | `src/ui/input.js`                                                    |
| Styling and responsive layout                                | `styles/game.css`                                                    |

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

GOLDEN HOUR (`VOCAL`, ID 8) is melodic vocal house at 120–124 BPM in a minor or major key. Its form is a real song: intro, verse, pre-chorus build, chorus, bridge, second build, final chorus and outro, in 64-bar chapters whose later forms rotate (one opens on the chorus). One chord per bar over four-chord loops; the intro and outro share the chorus chords because they tease its hook. `src/audio/songs/vocal-composition.js` writes the sung lines: the lead stays between G3 and E5 so it never turns shrill, held notes on strong beats are chord tones, passing notes move by step, leaps are rare, verses leave whole bars empty, and the chorus hook returns unchanged in both of its phrases and in every chorus (only the cadence changes, and the final chorus lifts its last note). `src/audio/vocal.js` arranges it: a lead, a doubled take, a tenor an octave below and a third above in later choruses, an "ooh" choir in the bridge, and an instrumental part that reuses the festival piano, saw plucks and supersaw chords. Vocals drop out while the game is in danger, and the bar before a chorus goes silent on its last beat.

The voice (`src/audio/instruments/vocal.js`) is synthesized, not recorded: a smooth harmonic source passes four parallel vowel formants (alto and tenor tables), with a late-arriving vibrato of about 5 Hz and 25 cents, slow pitch drift, a breath that is strongest at the start of a note, a soft attack, scoops into phrases and fall-offs at their ends, legato glides between joined notes and a loudness normalisation so every vowel and pitch sits at the same level. It sings wordless syllables ("ooh", "ah", "oh", "la", "na", hums), because real words need recordings. Lead and backing vocals share their own bus with a low cut, a boxy-range dip, a presence lift, a de-esser, a soft top and a compressor, and the kick ducks that bus only about a third as much as the synths.

### Drum kit

Every track plays its drums from one kit (`src/audio/instruments/kit-dsp.js`, played by `kit.js`), so none of them sounds like oscillators and filtered noise. The kit is rendered sample by sample in plain JavaScript: three kicks (a saturated pitch-dropping sine fused with a short knock and a click, retuned to the key), three claps with early reflections, rimshots, six-square metal hats and open hats, ride, crash (long and short), toms, tuned metal hits, industrial blasts, snares and shakers. Each drum is built the first time it is needed (a few milliseconds), the rest are warmed up in timer ticks, and every hit picks one of several variants, so repeats never sound machined. A hit is one buffer source and one gain, which is cheaper than assembling a drum from oscillators and filters.

The four older arrangements keep their vocabulary (`eKick`, `eHat`, `eClap`, `eSnare`, `eShaker`, `eRide`, `eTom`, `ePerc`, `eCrash`): `src/audio/instruments/drums.js` maps each one onto the kit and holds its loudness at what the arrangement was balanced with (the `GAIN` table), so the `LEVEL` tables still mean what they did. Kicks are tuned to the key, between 46 and 62 Hz (`kickTuning`): the root where it lies there, otherwise the fifth (the fourth for F). NEON CIRCUIT uses the punch kick, LIVE TECHNO the long one, SKYLINE RUSH and GOLDEN HOUR the thud, with the punch kick in drops and choruses.

### WAREHOUSE

WAREHOUSE (`WAREHOUSE`, ID 9) is dark techno at 132–138 BPM, built the way techno records are: around the drums. Its kit is the one above, played directly through the `eKit*` voices. The rumble is a low tail swelling between the kicks, cut into a pulse by the kick's sidechain; the bass is a saturated reese; the room is slow filtered noise. `src/audio/songs/warehouse-composition.js` draws a chapter's rhythm material once (hat velocity map, rim, a percussion cycle that is 10, 12 or 14 steps long and so drifts against the bar, metal hits, bass mask, stabs, ping melody) and the arrangement (`src/audio/warehouse.js`) adds, filters and removes layers around it: kick-only intro, groove, peak, a kick-less breakdown with pad and pings, a build with a quickening snare roll and a silent last beat, and the final peak.

### Mix and mastering

Signal flow: voices feed the dry, bass and synth buses of the current song. The kick ducks the bass and synth buses (instant dip, exponential recovery). The synth bus passes a mid/side widener whose side signal is high-passed at 220 Hz, so bass and low mids stay centred and the mix still folds down cleanly to mono. Each song's output passes its loudness `trim` and the DJ high-pass, then the shared music bus: low cut, bass shelf, presence and air EQ, soft saturation and a slow-attack glue compressor. The master adds makeup gain (`MASTER_GAIN`), a compressor, a tanh soft clipper and a limiter, so the output stays below -2 dBFS.

Dry gameplay effects bypass the music bus and enter at the master, scaled by `SFX_GAIN`. They sit about 11 LU below the music with transient peaks close to the music's.

Each arrangement keeps a `LEVEL` table with the balance of its voices (kick, bass, clap, hats, lead, chords, piano, plucks). Change it there, not in the shared voices, so one track's balance never shifts another's. A track's overall level is its catalog `trim`; the shared makeup is `MASTER_GAIN`.

Arrangements follow live-set dramaturgy. Intros open a DJ high-pass filter over four-on-the-floor drums. Builds close the filter, add a riser, a plucked arpeggio, quickening chord stabs and a snare roll, swell into a reverse cymbal and leave the last beat silent. Drops land with a crash and an impact, and every eighth bar gets a crash or a snare fill. Breakdowns open the reverb (`eSpace`); in SKYLINE RUSH the piano replays the hook there. Every 64 bars, when the material renews, an impact and a swell hand the song over like a DJ mixing into the next track.

`src/audio/game-feedback.js` owns dry gameplay effects. Call `audioReactions.reactToEvent(kind, detail)` from an accepted game action. Drop, swap, impact, merge, shake, goal, discovery, fever, danger, game over, and specials have short electronic cues. Impact pair memory is bounded and repeated contacts are throttled. Seven ordinary effects voices leave two additional slots for controls and one reserved for game over. Musical cascade replies coalesce into the strongest event, at most once per beat. Sound settings expose separate Music and Effects levels; Sound Off mutes both. `src/audio/output.js` provides the shared master chain for both live playback and audition.

Voice factories use `audioGraph.releaseVoice()` to disconnect nodes after playback. Keep sends and auxiliary sources in that cleanup list when adding a voice. `stopScheduler()` and `audioRuntime.destroy()` release the worker, timers, gesture listeners, silent-audio fallback, and context.

## Saves, artwork, and offline support

Saves use the `palpop:` storage keys and stable numeric pal/song IDs. Saved progress, song preferences and custom sprites belong to the browser origin (host and port) that served the game.

The sprite designer is available through **PALS → PIXEL LAB**, or at `tools/pal-designer.html`. Press Start 2P is bundled as a separate font; its SIL Open Font License is in `assets/fonts/OFL.txt`.

The service worker caches only this app's files and cleans only caches beginning with `palpop-`. Run `npm run cache:update` after editing shipped assets; `npm start` does this automatically. The generated `precache.js` hashes all runtime files, so changes produce a new offline cache version.

## Verify

Development checks require the parser and formatter:

```sh
npm ci
npm run format
npm run cache:update
npm run verify
```

The Node tests cover original physics trajectories at 30/60/120 FPS, overlap resolution, chain merges, stacks, shakes, injectable balance settings, the techno composition, evolving electro/festival phrases, 10,000 bounded phrase renewals, 2,000 renewed chapters, 24 chapters of all arrangements, audible festival A/B/reprise development, immediate gameplay feedback, impact throttling, essential cue capacity, coalesced musical rewards, mute/retry behavior, and save compatibility. Baselines in `tests/fixtures/` pin the techno composition and the physics trajectories; tests import the actual modules directly.

`tests/vocal.test.js` covers the vocal song: deterministic sessions and valid forms, singable parts (range, steps, chord tones on strong beats, rests, density), the returning hook, the voice's formants, vibrato and soft onset, cleanup and the arrangement's silences. `tests/warehouse.test.js` covers the techno track: the kit is deterministic, normalised and click-free, kicks have a 46 Hz fundamental, punch and a finite tail, hats are bright and claps sit in the mids, each hit is one cleaned-up voice, the kick retunes and ducks, and the arrangement keeps its floor, silent beat, drop and drifting percussion. `tests/mix.test.js` covers the mix: the master chain's bounds, a reachability check that every song-bus node ends in the output, per-song trims, the sweep curve, filter and silent-beat behaviour of all three arrangements, supersaw symmetry and cleanup, the drum voices' mapping onto the kit (kick variants and tuning, the rumble feed, toms, percussion, crashes), the kick's sidechain envelope and the WAV analyzer.

For actual Web Audio rendering in a browser, open `tools/audio-check.html` and press **RUN AUDIO CHECKS**. It renders all songs at several sections, additional seeds, and busy gameplay through the live compressor/limiter and reactive filter. It checks finite samples, clipping, released voices, required cues, and freeze/recovery/death transitions. Choose a soundtrack and export music or music with gameplay feedback using the preview buttons. Festival previews span 48 bars, including intro, build, drop, break and another drop. Automated checks establish signal/runtime behavior; listening establishes musical taste.

### Measuring a mix

Download a preview from the audio check page (previews render at 44.1 kHz), then:

```sh
node tools/analyze-wav.mjs skyline-rush.wav --bpm 127
ffmpeg -i skyline-rush.wav -af ebur128=peak=true -f null -   # integrated loudness (LUFS) and true peak
```

`analyze-wav.mjs` prints, for every bar, RMS and peak in dBFS, the low-mid, high-mid and top-end balance relative to the 20-200 Hz band, and the side/mid ratio. The shipped mixes aim at:

- about -13 to -14 LUFS integrated, peaks below -2 dBFS, drops about 4 dB louder than breakdowns;
- in drops, relative to the low band: low mids about -8 dB, high mids about -15 dB, top end about -18 dB;
- a side/mid ratio around -15 dB in SKYLINE RUSH's drops (a wide hook over a centred kick and bass).

After changing voices or levels, render the previews again and compare. Set the master first, then each track's `trim`, then the `LEVEL` tables.
