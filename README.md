# Pal Pop

A pixel-art merge game with slippery physics, responsive electronic gameplay sounds and four endless Web Audio soundtracks. Every song is composed while it plays and never loops: tempo, key, scale, chords, bass lines, arpeggios, drum patterns, melodies and the order of intros, builds, drops and breakdowns are drawn from a seed, so no two sessions are the same and no stretch of a session comes back.

- **SOLAR RUSH** — euphoric hard trance at 150–158 BPM in a major key: a raw kick, a bass that rolls through every sixteenth, arpeggios that never stop, a big seven-saw lead, long builds and breakdowns. Voiced from a measurement of a 156 BPM clip (see _Reference_).
- **BLACKOUT** — hard techno at 142–148 BPM in a minor, Phrygian or harmonic-minor key: a distorted kick, a rolling bass, wide rave stabs and heavy percussion. Voiced from a measurement of a 144 BPM clip.
- **AFTER HOURS** — melodic techno at 122–128 BPM: a round kick, a moving bass, plucked arpeggios, wide pads and long melodies that turn over slowly. Voiced from a measurement of a melodic techno mix.
- **RAVE ANTHEM** — a classic dancefloor anthem at 134–138 BPM: a bright synth riff over a straight kick, big builds with snare rolls and drops. Voiced from a measurement of a 136 BPM Eurodance record.

All four are mixed and mastered to the loudness of the records they are voiced after (about -8.5 to -11 LUFS at the default volume, peaks below -0.5 dBFS), glued by bus and master compression, with a wide synth bus, sidechain pumping and a high-pass sweep through intros and builds. The top of the mix is not boosted by an exciter or a strong EQ: it comes from the voices themselves.

The game is written as native ES modules. Physics, game rules, rendering, interface, composition, arrangement and instrument synthesis are separate modules. There is no bundler and no runtime dependency.

## Project layout

```
index.html            entry point
manifest.webmanifest  PWA manifest (icons live next to it, incl. padded maskable ones)
sw.js, precache.js    offline support; precache.js is generated
src/                  game, audio, render and UI modules
styles/               game.css
assets/fonts/         bundled Press Start 2P font and its licence
tools/                dev server, checks, cache generator, audio check page, mix analysis, pixel designer, icon generator
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

| Change                                                       | File / folder                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Friction, gravity, bounces, merge tolerance, fixed timestep  | `src/settings.js` → `PHYSICS`                                    |
| Drop speed, cooldown, combo timing                           | `src/settings.js` → `GAMEPLAY`                                   |
| Pal names, sizes, palettes, score values, unlock thresholds  | `src/config.js`                                                  |
| Collision and settling rules                                 | `src/game/physics.js`                                            |
| Drops, swaps, scoring, merges, retries, game over            | `src/game/actions.js`                                            |
| Special-pal behavior                                         | `src/game/specials.js`                                           |
| Goals (the strip above the board)                            | `src/game/progression.js`                                        |
| Run records, quests, the daily challenge                     | `src/game/records.js`                                            |
| Mutators and badges                                          | `src/game/mutators.js`, `src/game/badges.js`                     |
| Visual springs, blinking, trails                             | `src/game/animation.js`                                          |
| Song names, descriptions, picker buttons                     | `src/audio/catalog.js`                                           |
| A song's tempo, key, chords, form, layers and mix            | `src/audio/gen/profiles.js`                                      |
| How a song is generated and played                           | `src/audio/gen/` (`harmony`, `form`, `layers`, `engine`)         |
| How each instrument sounds                                   | `src/audio/instruments/`                                         |
| Supersaw voices (hook, stabs, plucks)                        | `src/audio/instruments/supersaw.js`                              |
| Mix bus, EQ, glue, stereo widener, delay, reverb, cleanup    | `src/audio/graph.js`                                             |
| Loudness: makeup gain, master compressor, soft clip, limiter | `src/audio/output.js`, per-song `trim` in `src/audio/catalog.js` |
| DJ filter through intros and builds                          | `src/audio/sweep.js`                                             |
| Lookahead timing and background scheduling                   | `src/audio/scheduler.js`                                         |
| Musical reactions to gameplay                                | `src/audio/reactions.js`                                         |
| Board drawing, sprites, backgrounds, pixel text              | `src/render/`                                                    |
| Dialogs, collection, layout, buttons                         | `src/ui/interface.js`                                            |
| Keyboard and pointer controls                                | `src/ui/input.js`                                                |
| Styling and responsive layout                                | `styles/game.css`                                                |

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

Every song is a **profile** in `src/audio/gen/profiles.js`; the four songs share one generator. A profile is plain data:

- `bpm`, `keys`, `scales` (weighted) and `swing`: what a session may draw once, from its seed;
- `harmony`: the chord graph (`moves`), chord-loop shapes (`loops`), how often a phrase repeats the last one (`keep`), changes one chord (`tweak`) or starts a new walk, and the weighted chord colours (`qualities`: triads, suspended, ninths);
- `form`: the segments (`INTRO`, `GROOVE`, `BUILD`, `DROP`, `BREAK`), their lengths and energies, and which segment may follow which;
- `layers`: per layer (kick, bass, hats, open hat, clap, percussion, snare, stab, arp, acid, lead, pad) a sixteen-step probability row (`row('X...x...o...,...')`: `X` always, `x` 85 %, `o` 55 %, `c` 35 %, `,` 18 %, `.` never), the notes it may draw, its range and in which segments it plays (`on(intro, groove, build, drop, break)`);
- `sound`: the kick variant and tuning, how hard the kick ducks, and which voice preset the stabs, arpeggios and lead use;
- `mix`: the level of every layer. Change it here, not in the shared voices, so one song's balance never shifts another's.

To add a song of an existing kind, copy a profile under a new id, add it to `PROFILE_IDS`, and add an entry to `TRACKS` in `src/audio/catalog.js` with a new numeric ID, a unique `buttonId`, a name, label, description, BPM and the profile id as `style`. The picker and stored-choice validation discover it automatically. A new voice preset goes into `src/audio/instruments/gen.js`.

### How a song is generated

Everything is a pure function of `(seed, bar, layer)` (`src/audio/gen/random.js` hashes the coordinates), so any bar can be computed at any time, a session can be replayed exactly, and a test can walk a whole song.

- **Harmony** (`harmony.js`). Chords come in phrases of four (eight in AFTER HOURS) bars. Each phrase repeats the previous one, changes a single chord, or starts a new walk over the chord graph; the voicing glides from chord to chord; the colour drifts every three phrases.
- **Form** (`form.js`). The song is an endless chain of segments drawn from the profile's graph, with lengths and energies drawn from its ranges. A build always lands in a drop, the same section never comes three times running, and inside a segment single layers switch on and off from phrase to phrase.
- **Layers** (`layers.js`). Each layer has a pattern that is redrawn a little every phrase: a few steps are drawn again from the template, the rest stay, so a groove keeps its character yet is never the same two phrases running. Bass lines, arpeggios and stabs draw their notes from the current chord; the lead plays two-bar motifs that answer and rest. Every sixteen phrases everything is drawn fresh, which is not heard (a pattern that has been redrawn that often is a new one anyway) and keeps memory and work bounded: a session of any length holds about a hundred small items.
- **Engine** (`engine.js`). The scheduler calls it once per sixteenth; it reads the bar's plan and plays the voices. Builds close the DJ filter, add a riser and a quickening kick and snare roll, leave the last beat silent in many cases and swell into a reverse cymbal; drops land with a crash and an impact; breakdowns open the reverb.

`tests/music.test.js` checks the properties that matter: the same seed gives the same song in any order of asking, no sixteen-bar stretch comes back within 512 bars (for every song and three seeds), the harmony keeps moving, every note is in the key and in range, forms are valid, and the memory stays bounded over 6,000 bars.

The scheduler dispatches through the registry (`src/audio/song-registry.js`). `resetLiveMusic()` resets gameplay accents without restarting the soundtrack; gameplay hits answer with a stab of the song's own sound on the next beat (`eRave`). Music reactions in `src/audio/reactions.js` close the synth filter while the game is in danger.

### Drum kit

Every track plays its drums from one kit (`src/audio/instruments/kit-dsp.js`, played by `kit.js`), so none of them sounds like oscillators and filtered noise. The kit is rendered sample by sample in plain JavaScript: three kicks (a saturated pitch-dropping sine fused with a short knock and a click, retuned to the key), three claps with early reflections, rimshots, six-square metal hats and open hats, ride, crash (long and short), toms, tuned metal hits, industrial blasts, snares and shakers. Each drum is built the first time it is needed (a few milliseconds), the rest are warmed up in timer ticks, and every hit picks one of several variants, so repeats never sound machined. A hit is one buffer source and one gain, which is cheaper than assembling a drum from oscillators and filters.

The engine plays its drums through the kit's vocabulary (`eKick`, `eHat`, `eClap`, `eSnare`, `eShaker`, `eRide`, `eTom`, `ePerc`, `eCrash`): `src/audio/instruments/drums.js` maps each one onto the kit and holds its loudness at what the profiles were balanced with (the `GAIN` table). Kicks are tuned to the key, between 46 and 62 Hz (`kickTuning`): the root where it lies there, otherwise the fifth (the fourth for F), and a profile may shift that (`sound.tune`). There are six kick variants: three soft and punchy ones, a long one, a hard one for BLACKOUT (a 300 Hz drop and a hard saturation) and a raw one for SOLAR RUSH.

### Reference

The songs are voiced from measurements of recordings, with one analysis for every file (`tools/reference-report.mjs`): tempo, the level while the kick plays, seven band levels (sub 30–60 Hz, kick 60–120, bass 120–250, low mids 250–500, mids 500–2k, high mids 2–5k, highs 5–10k), side/mid per band and the swing of each band across one beat. Measured, not listened to: the numbers say how loud, bright, wide and busy a record is, not how it sounds, and whether a result sounds good is for ears.

| Song        | Reference                                          | What it showed                                                                                                                                                 |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOLAR RUSH  | a 156 BPM euphoric hard-trance clip in B/E major   | Kick, sub and a bass that sits low (A1 to A2) at about the same level; sixteenth arpeggios; mids 6–13 dB under the kick band; narrow below 500 Hz, wide above. |
| BLACKOUT    | a 144 BPM hard-techno clip                         | A distorted, short kick; a rolling bass; dense mids and highs only 3–9 dB under the kick band.                                                                 |
| AFTER HOURS | a melodic techno mix (126 BPM, A minor, -7.6 LUFS) | A round kick and a bass that carries 120–250 Hz; 2–5 kHz about 11 dB under the kick; layers of pads and plucks up to 6 kHz.                                    |
| RAVE ANTHEM | an Alice Deejay record (136 BPM, -11.3 LUFS)       | A strong kick (10 dB over the bass band), a continuous riff and little above 5 kHz.                                                                            |

The first version of the shared mix followed a 62-minute live set (-13 LUFS, peaks at -3 dBFS); the records above are 4 to 6 dB louder and denser, so the master was made louder (`MASTER_GAIN` 1.05, a harder soft clipper, a last rounding stage) and the voices were rebuilt as saturated, drifting saw stacks (`drive` and `drift` in `superSaw`). An earlier version also added a parallel exciter and +5 dB of presence and air at the end of the chain; it made the top end glassy, and it is gone. The voices' own saturation is oversampled, so the extra harmonics do not fold back as hiss.

Where the renders land against the references (a drop, seed 42, bands relative to the kick band, in dB; reference first):

| Song        | sub         | bass         | low mids      | mids          | high mids     | highs         | loudness  |
| ----------- | ----------- | ------------ | ------------- | ------------- | ------------- | ------------- | --------- |
| SOLAR RUSH  | -1.2 / -3.9 | -6.8 / -8.6  | -13.0 / -11.0 | -7.9 / -9.2   | -12.8 / -14.9 | -15.8 / -14.0 | -8.1 LUFS |
| BLACKOUT    | -0.7 / -1.6 | -3.9 / -7.6  | -6.0 / -8.8   | -6.1 / -10.9  | -7.1 / -14.3  | -9.0 / -11.3  | -9.6 LUFS |
| AFTER HOURS | -2.4 / -2.0 | -4.4 / -3.1  | -8.8 / -7.7   | -9.6 / -8.9   | -11.1 / -14.3 | -13.9 / -13.8 | -8.4 LUFS |
| RAVE ANTHEM | -8.2 / -9.1 | -10.0 / -6.8 | -14.7 / -11.9 | -14.2 / -12.8 | -19.8 / -17.7 | -19.0 / -18.2 | -8.0 LUFS |

BLACKOUT is still 4 to 7 dB too thin above 2 kHz compared with its reference, and its highs are narrower than the clip's (side/mid -12 dB against -5 dB); that is the largest known gap.

```sh
node tools/reference-report.mjs preview.wav                 # compare any file with the reference set
node tools/reference-report.mjs record.mp3 --start 300 --seconds 60
```

Compare passages of similar loudness, and render a window of a song the same way (`tools/audio-check.html` exports WAV previews).

### Mix and mastering

Signal flow: voices feed the dry, bass and synth buses of the current song. The kick ducks the bass bus fully and the synth bus by the song's `pump` share (instant dip, exponential recovery). The synth bus passes a mid/side widener whose side signal is high-passed at 220 Hz, so bass and low mids stay centred and the mix still folds down cleanly to mono. Each song's output passes its loudness `trim` and the DJ high-pass, then the shared music bus: low cut, bass shelf, a gentle presence (+2 dB at 3.4 kHz) and air (+1.5 dB shelf at 8.5 kHz) lift, soft saturation and a slow-attack glue compressor. The master adds makeup gain (`MASTER_GAIN`), a compressor, a tanh soft clipper, a limiter and a last stage that rounds anything above 0.9 off towards 0.98, so the output stays below -0.5 dBFS and never clips hard.

Dry gameplay effects bypass the music bus and enter at the master, scaled by `SFX_GAIN`. They were measured about 11 LU below the music with transient peaks close to the music's, before the master was made louder; that ratio was not measured again.

Each profile keeps a `mix` table with the balance of its layers (kick, bass, hats, claps, percussion, stabs, arpeggio, lead, pad). Change it there, not in the shared voices, so one song's balance never shifts another's. A song's overall level is its catalog `trim`; the shared makeup is `MASTER_GAIN`.

Songs follow live-set dramaturgy. Intros open a DJ high-pass filter over the drums. Builds close the filter, add a riser, a quickening kick and snare roll, swell into a reverse cymbal and often leave the last beat silent. Drops land with a crash and an impact, and some phrase ends get a crash or a fill. Breakdowns open the reverb (`eSpace`) and keep the arpeggios and pads over a kick-less floor.

`src/audio/game-feedback.js` owns dry gameplay effects. Call `audioReactions.reactToEvent(kind, detail)` from an accepted game action. Drop, swap, impact, merge, shake, goal, discovery, fever, danger, game over, and specials have short electronic cues. Impact pair memory is bounded and repeated contacts are throttled. Seven ordinary effects voices leave two additional slots for controls and one reserved for game over. Musical cascade replies coalesce into the strongest event, at most once per beat. Sound settings expose separate Music and Effects levels; Sound Off mutes both. `src/audio/output.js` provides the shared master chain for both live playback and audition.

Voice factories use `audioGraph.releaseVoice()` to disconnect nodes after playback. Keep sends and auxiliary sources in that cleanup list when adding a voice. `stopScheduler()` and `audioRuntime.destroy()` release the worker, timers, gesture listeners, silent-audio fallback, and context.

## Rules, records and the daily

Four critics (gameplay, pixel art, mobile UI, retention) played the game in a phone-sized browser and with bots, and the rules follow what they measured. The numbers below come from a headless harness that drove the real rule modules with bots (random, centre-column and a careful bot with perfect aim, 40 runs each; the harness is not part of the repo, `tests/helpers/headless-game.js` is the same idea in test form). A perfect-aim bot is easier than a person, so read them as ratios, not promises.

- **Combos are chains.** A combo grows only when a merge consumes the pal the previous merge made, within `GAMEPLAY.chainWindow` (0.9 s). Dropping quickly no longer builds one: for a bot that taps at random every half second a combo of five or more happened in every run before and in 60 % now, and fever, which chains charge, was up 19 % of the time instead of 37 %.
- **No hidden tempo ramp.** The old speed-up changed nothing measurable and is gone, as is the unseen penalty for dropping in one column. Pieces get bigger with the number of drops, not with score or time (`pals.js`).
- **The room shrinks.** After `squeezeStart` seconds the lose line creeps down a pixel every `squeezeEvery` seconds, by at most `squeezeMax`; a ring fills around every pal that is over the line, and the line counts the pal's top edge a little inside (70 % of its radius). Pals made by a merge get `mergeGrace` extra seconds.
- **Shake and swap cost something.** The shake needs `CH_MAX` merges and breaks the chain and halves a building fever. Swaps are limited (`swapsAtStart`, up to `swapsMax`) and earned by goals; the NEXT button shows how many are left.
- **Specials help when it matters.** A pile that has climbed into the top half with no special for 25 drops is owed a wildcard; Icy really holds the countdown; Zappy only upgrades small pals; a Solis standing in the box brings a wildcard within ten drops (the bomb is gone: tier 12 stays reserved so saved Palbooks stay valid, and the Palbook now lists 15 pals), and the Sun is a victory: it clears the small pals, starts a fever and is counted.
- **Goals** teach, then steer: make a pal, chain merges, start a fever. They pay a swap and XP, not score.
- **Worlds.** The sky changes as the pals climb (`WORLD_OF_TIER` in `config.js`); visited worlds are counted in the Palbook.
- **Records.** At the end of a run `recordRun` books lifetime stats and the last ten scores and the panel says what the run was: a new best (with the margin), how far short of the best it fell, the average of the last five, a new best pal, chain or run length. Passing your best mid-run is announced once. The best of a run is kept even if the tab is closed.
- **Quests.** Three open quests (reach a pal, chain, score, merges, fevers, specials) whose progress survives death and which pay XP. Targets grow with the level; a completed quest is replaced by one of another kind.
- **Mutators.** One unlocks at every other level from level 4 (`src/game/mutators.js`): LUCKY (specials two and a half times as often), HEAVY (faster, score x1.5), FEVER FIZZ (fever charges faster but lasts six seconds), LONG FUSE (three seconds to fix a full box, score x0.8), NO SWAP (x1.5), BIG SHOTS (x1.4) and SMALL FRY (x0.8). After a run the panel offers two of the unlocked ones and tapping a card starts the next run with it, so choosing costs no extra tap. A mutator moves the score to match what it does: harder runs pay more, easier ones less. The daily carries a mutator on two days out of three, the same for everyone. This also gives levels 4 to 16 something to unlock.
- **Badges.** Twenty-one badges (`src/game/badges.js`) earned from the lifetime stats: pals evolved, the Sun, chains, fevers, specials, merges, a five-minute run, a 4000-point run, seven daily days, all seven worlds, fifteen quests and ten mutator runs. Each pays 100 XP once; the Palbook lists them with progress bars and the game-over panel names the new ones.
- **Coaching.** New players get one-line hints on the board (`src/game/hints.js`): drag and release, same pals merge, tap NEXT to swap, stay under the line, shake when it is charged. Each disappears for good, saved under `hints`, once the player has done the thing; anyone with a finished run already knows the first three.
- **Daily.** The DAILY button on the title screen plays a run that deals the same pals and goals to everyone that day (the seed is the date, specials included whatever the level), as often as you like; the best counts, and PLAY AGAIN repeats it. The result is shared as `Pal Pop DAILY #n`. Missing a day costs nothing: there is a count of days in a row, never a threat.

With the new rules the careful bot's runs last a median 222 s instead of 270 s, it reaches the Sun in 18 % of runs instead of 65 %, and random players are unaffected (about 100 s, never the Sun). Tuning knobs: `GAMEPLAY` in `src/settings.js`, `CH_MAX`, `SCORE` and `WORLD_OF_TIER` in `src/config.js`.

## Saves, artwork, and offline support

Saves use the `palpop:` storage keys and stable numeric pal/song IDs. Saved progress, song preferences and custom sprites belong to the browser origin (host and port) that served the game.

The sprite designer is available through **PALS → PIXEL LAB**, or at `tools/pal-designer.html`. Press Start 2P is bundled as a separate font; its SIL Open Font License is in `assets/fonts/OFL.txt`.

Switches in the Sound sheet: a speaker button on the bar mutes everything with one tap (and shows a red cross while muted), HAPTICS turns vibration off (hidden where the browser has no `navigator.vibrate`, which includes iPhones) and FLASHES turns off the white screen flashes and every blinking animation (`html.calm`). All three are saved. Installed on an iPhone with iOS 26 the page's window is exactly the top safe-area inset too short when the page asks for `viewport-fit=cover` with a translucent status bar (WebKit bug 301108: `innerHeight`, `100dvh` and `100%` stop 62 px above the bottom of an iPhone 16 Pro) and iOS paints nothing below it, so a taller app is simply cut off. The page therefore does not ask for `viewport-fit=cover`: the app sits inside the safe area, the bars above and below it show the page colour (`#1c1432`, the app's own) and the buttons keep clear of the home indicator. `#app` fills whatever window it is given (`position: fixed; inset: 0`). The Sound sheet ends with one line of numbers (window, screen, `100lvh`, app box, insets, installed or browser) to chase problems like that; its helpers are in `src/ui/viewport.js`. The music scheduler widens its look-ahead from 0.24 s up to 0.6 s after a late tick and relaxes again while ticks are on time (`adaptLook` in `src/audio/scheduler.js`), so a slow phone drops frames rather than notes.

The app icon (the Blipp berry, big, on a dithered night-sky gradient with a glow) is drawn from the game's own sprites by `tools/icon-art.js`; open `tools/icons.html` through `npm start` to see all five sizes (`icon-192`, `icon-512`, `apple-touch-icon`, and the padded `icon-maskable-192` and `-512`) and save them next to `index.html`. The art is built on a 128 pixel grid at whole-number scale, and the maskable version keeps everything inside the circle Android may crop to. Installed on an iPhone, `src/ui/viewport.js` adds `html.home-bar` on tall screens so the button bar keeps 30 px clear of the home indicator, which iOS no longer reports without `viewport-fit=cover`.

The service worker caches only this app's files and cleans only caches beginning with `palpop-`. Run `npm run cache:update` after editing shipped assets; `npm start` does this automatically. The generated `precache.js` hashes all runtime files, so changes produce a new offline cache version. A new version installs and takes over by itself (`skipWaiting` and `clients.claim`), and the update check bypasses the HTTP cache; the page that is open still runs the old build, so `src/main.js` reloads it once the player is on the title screen (never mid-run, never with a sheet open).

## Verify

Development checks require the parser and formatter:

```sh
npm ci
npm run format
npm run cache:update
npm run verify
```

The Node tests cover original physics trajectories at 30/60/120 FPS, overlap resolution, chain merges, stacks, shakes, injectable balance settings, the generated songs, immediate gameplay feedback, impact throttling, essential cue capacity, coalesced musical rewards, mute/retry behavior, and save compatibility. A baseline in `tests/fixtures/` pins the physics trajectories; tests import the actual modules directly.

`tests/music.test.js` covers the generated songs: the catalog and registry, determinism whatever order bars are asked in, no sixteen-bar stretch repeating within 512 bars (every song, three seeds), moving harmony, patterns that change from phrase to phrase, valid forms (builds land in drops, no section three times running), notes in the key and in range, bounded memory over 6,000 bars, and 1,024 bars of every arrangement against recording instruments (finite, in-time events). `tests/mix.test.js` covers the mix: the master chain's bounds, a reachability check that every song-bus node ends in the output, per-song trims, the sweep curve, the filter and silent-beat behaviour of all four arrangements, supersaw symmetry and cleanup, the drum voices' mapping onto the kit (kick variants and tuning, the rumble feed, toms, percussion, crashes), the kick's sidechain envelope and the WAV analyzer. `tests/sound.test.js` covers the master's last rounding stage (nothing reaches 0.99, loud peaks are kept, the curve is odd and monotonic), a music bus without an exciter, and the driven, drifting saw stacks behind the voices. `tests/rules.test.js` covers the game rules on the real modules without a browser: chain combos and their window, scoring and fever, limited swaps and their reward, the shake's cost, the squeeze, the fairer death rule and merge grace, Icy, the Sun victory, the drop-count ramp, identical daily pals and goals for every level, the wildcard and Solis rules, the missing bomb, and booking a run. `tests/records.test.js` covers stats, records, quests and the daily. `tests/polish.test.js` covers the coaching hints (order, learned for good, text width), the adaptive look-ahead, the home-indicator rule and the icon files in the manifest and the offline cache. `tests/mutators.test.js` covers the mutators' table, unlocks, offers and the daily mutator, and the badges' conditions, progress and one-time awards; `tests/rules.test.js` also checks what each mutator changes and that finishing a run pays badge XP.

For actual Web Audio rendering in a browser, open `tools/audio-check.html` and press **RUN AUDIO CHECKS**. It renders all songs at several sections, additional seeds, and busy gameplay through the live compressor/limiter and reactive filter. It checks finite samples, clipping, released voices, required cues, and freeze/recovery/death transitions. Choose a soundtrack and export music or music with gameplay feedback using the preview buttons. Previews span 32 bars of a generated song. Automated checks establish signal/runtime behavior; listening establishes musical taste.

### Measuring a mix

Download a preview from the audio check page (previews render at 44.1 kHz), then:

```sh
node tools/analyze-wav.mjs solar-rush.wav --bpm 156
ffmpeg -i solar-rush.wav -af ebur128=peak=true -f null -   # integrated loudness (LUFS) and true peak
```

`tools/reference-report.mjs` compares a file with a reference (see _Reference_). `analyze-wav.mjs` prints, for every bar, RMS and peak in dBFS, the low-mid, high-mid and top-end balance relative to the 20-200 Hz band, and the side/mid ratio. The shipped mixes aim at:

- about -8 to -11 LUFS integrated, peaks below -0.5 dBFS;
- in drops, the bands relative to the kick band close to the reference table above;
- synth mids and highs that are wide (side/mid between -5 and -2 dB) over a centred kick and bass.

After changing voices or levels, render the previews again and compare. Set the master first, then each song's `trim`, then its `mix` table.
