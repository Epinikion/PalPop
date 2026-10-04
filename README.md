# Pal Pop

A pixel-art merge game with slippery physics, responsive electronic gameplay sounds and six continuously evolving Web Audio soundtracks:

- **NEON CIRCUIT** — pumping electro with sidechained bass, supersaw stabs and plucked arpeggios.
- **LIVE TECHNO** — rolling bass, acid lines and dub chords.
- **WAREHOUSE** — dark, drum-led techno: a hard kick, rolling rumble, hats and claps rendered like samples, percussion that drifts against the beat, and almost no synth.
- **GOLDEN HOUR** — melodic vocal house: warm, wordless sung melodies over piano, plucks and a soft four-on-the-floor, with verses, builds, sing-along choruses and a bridge.
- **HORIZON LINE** — bright, wide trance at 138–144 BPM: a bass that rolls into every kick, hats on every sixteenth, a wall of supersaws with a sixteenth arpeggio, long builds and short breakdowns. Voiced from a measurement of a Tomorrowland live set (see _Reference_).
- **SKYLINE RUSH** — melodic festival house: piano, a seven-voice supersaw hook, DJ-style builds, silent beats before the drops and a piano breakdown that replays the theme.

All six are mixed and mastered like records: about -13 LUFS at the default volume, glued by bus and master compression, with a wide synth bus, sidechain pumping and a high-pass sweep through intros and builds.

The game is written as native ES modules. Physics, game rules, rendering, interface, composition, arrangement and instrument synthesis are separate modules. There is no bundler and no runtime dependency.

## Project layout

```
index.html            entry point
manifest.webmanifest  PWA manifest (icons live next to it, incl. padded maskable ones)
sw.js, precache.js    offline support; precache.js is generated
src/                  game, audio, render and UI modules
styles/               game.css
assets/fonts/         bundled Press Start 2P font and its licence
tools/                dev server, checks, cache generator, audio check page, mix analysis, pixel designer
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
| Goals (the strip above the board)                            | `src/game/progression.js`                                            |
| Run records, quests, the daily challenge                     | `src/game/records.js`                                                |
| Mutators and badges                                          | `src/game/mutators.js`, `src/game/badges.js`                         |
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

### HORIZON LINE

HORIZON LINE (`TRANCE`, ID 10) is trance at 138–144 BPM in a major or minor key (about 60 % major). `src/audio/songs/trance-composition.js` draws a chapter's material once: a chord loop for each part of the song (two bars a chord), a sixteenth-note arpeggio over the triad, hat velocities and which beats the bass leaps an octave on. The arrangement (`src/audio/trance.js`) builds the rhythm section the measurements describe: a tuned clean kick (a fourth kit variant with almost nothing above the sub but the click), a bass that plays the three sixteenths after every kick and leans hardest into the next one (`eDanceBass`, notes held past their step so they overlap), closed hats on every sixteenth except the off-beat eighths, which are open. Over it sits the wall: a five-saw chord held for two bars (`eTranceChord`) and an arpeggio of overlapping saws (`eTranceArp`), with the festival hook (`eFestivalLead`) on top. The kick ducks the bass hard and the synths barely (`pump` 0.2 in the catalog), so the middle of the mix never opens up. Breakdowns are short and only about 3 dB quieter than drops: a held chord, broken-chord piano, the hook replayed on piano and the arpeggio coming back.

### Reference

The mix and the trance track follow a measurement of a 62-minute live set (Armin van Buuren, Tomorrowland 2026, as a 56 kbps MP3, so nothing above about 11 kHz could be read). It was measured, not listened to, with the same analysis for every file (`tools/reference-report.mjs`). What the set showed, and what changed because of it:

- **Tempo.** Mostly 137–140 BPM, 144–145 in the last third; four-on-the-floor throughout. HORIZON LINE uses 138–144.
- **Key.** No single key; the set moves through many, roughly 60 % major frames. Sessions pick a key and mode per song.
- **Loudness.** -13.0 LUFS integrated, a loudness range of only 2.2 LU, and breakdowns about 3 dB under the drops. The soundtracks already sat at -13 LUFS; HORIZON LINE's breakdowns now follow the 3 dB figure.
- **Tonal balance.** In the kick-driven passages the set carries 3–7 dB more energy between 500 Hz and 10 kHz than our tracks did, and a little less sub. The shared music bus now has +5 dB of presence (3.4 kHz) and +5 dB of air (7.5 kHz shelf, up from +1.5 and +2.5), the kick sits 1.5–3 dB lower in the arrangements, and the vocal bus gives most of the extra brightness back so GOLDEN HOUR's voice is unchanged (within 0.3 dB).
- **Width.** The mids and highs are close to uncorrelated (side/mid about -2 dB between 500 Hz and 5 kHz). The synth bus's side signal is doubled (`SYNTH_WIDTH` 2); bass and kick stay centred.
- **Pumping.** The mids swing by only 1.6 dB across a beat, far less than a hard sidechain gives. The kick still ducks the bass bus fully, but the synth bus now takes only a share of the dip (`pump` per track in `src/audio/catalog.js`: 0.2 to 0.6, 1 for WAREHOUSE).
- **Rhythm.** The bass leans into the next kick; hats are continuous sixteenths; the mids stay nearly flat across a beat. That is what HORIZON LINE's arrangement does.

Limits: this is one set seen through a low-bitrate MP3. The measurements say how bright, wide, loud and busy it is, not how it sounds; whether a result sounds good is for ears.

```sh
node tools/reference-report.mjs preview.wav                 # compare any file with the reference
node tools/reference-report.mjs set.mp3 --start 300 --seconds 600
```

It prints tempo, the level while the kick plays, seven band levels next to the reference, side/mid per band and the swing of each band across one beat. Compare tracks of similar loudness.

### Mix and mastering

Signal flow: voices feed the dry, bass and synth buses of the current song. The kick ducks the bass bus fully and the synth bus by the song's `pump` share (instant dip, exponential recovery). The synth bus passes a mid/side widener whose side signal is high-passed at 220 Hz, so bass and low mids stay centred and the mix still folds down cleanly to mono. Each song's output passes its loudness `trim` and the DJ high-pass, then the shared music bus: low cut, bass shelf, presence (+5 dB at 3.4 kHz) and air (+5 dB shelf at 7.5 kHz) EQ, soft saturation and a slow-attack glue compressor. The master adds makeup gain (`MASTER_GAIN`), a compressor, a tanh soft clipper and a limiter, so the output stays below -2 dBFS.

Dry gameplay effects bypass the music bus and enter at the master, scaled by `SFX_GAIN`. They sit about 11 LU below the music with transient peaks close to the music's.

Each arrangement keeps a `LEVEL` table with the balance of its voices (kick, bass, clap, hats, lead, chords or wall, piano, plucks). Change it there, not in the shared voices, so one track's balance never shifts another's. A track's overall level is its catalog `trim`; the shared makeup is `MASTER_GAIN`.

Arrangements follow live-set dramaturgy. Intros open a DJ high-pass filter over four-on-the-floor drums. Builds close the filter, add a riser, a plucked arpeggio, quickening chord stabs and a snare roll, swell into a reverse cymbal and leave the last beat silent. Drops land with a crash and an impact, and every eighth bar gets a crash or a snare fill. Breakdowns open the reverb (`eSpace`); in SKYLINE RUSH the piano replays the hook there. Every 64 bars, when the material renews, an impact and a swell hand the song over like a DJ mixing into the next track.

`src/audio/game-feedback.js` owns dry gameplay effects. Call `audioReactions.reactToEvent(kind, detail)` from an accepted game action. Drop, swap, impact, merge, shake, goal, discovery, fever, danger, game over, and specials have short electronic cues. Impact pair memory is bounded and repeated contacts are throttled. Seven ordinary effects voices leave two additional slots for controls and one reserved for game over. Musical cascade replies coalesce into the strongest event, at most once per beat. Sound settings expose separate Music and Effects levels; Sound Off mutes both. `src/audio/output.js` provides the shared master chain for both live playback and audition.

Voice factories use `audioGraph.releaseVoice()` to disconnect nodes after playback. Keep sends and auxiliary sources in that cleanup list when adding a voice. `stopScheduler()` and `audioRuntime.destroy()` release the worker, timers, gesture listeners, silent-audio fallback, and context.

## Rules, records and the daily

Four critics (gameplay, pixel art, mobile UI, retention) played the game in a phone-sized browser and with bots, and the rules follow what they measured. The numbers below come from a headless harness that drove the real rule modules with bots (random, centre-column and a careful bot with perfect aim, 40 runs each; the harness is not part of the repo, `tests/helpers/headless-game.js` is the same idea in test form). A perfect-aim bot is easier than a person, so read them as ratios, not promises.

- **Combos are chains.** A combo grows only when a merge consumes the pal the previous merge made, within `GAMEPLAY.chainWindow` (0.9 s). Dropping quickly no longer builds one: for a bot that taps at random every half second a combo of five or more happened in every run before and in 60 % now, and fever, which chains charge, was up 19 % of the time instead of 37 %.
- **No hidden tempo ramp.** The old speed-up changed nothing measurable and is gone, as is the unseen penalty for dropping in one column. Pieces get bigger with the number of drops, not with score or time (`pals.js`).
- **The room shrinks.** After `squeezeStart` seconds the lose line creeps down a pixel every `squeezeEvery` seconds, by at most `squeezeMax`; a ring fills around every pal that is over the line, and the line counts the pal's top edge a little inside (70 % of its radius). Pals made by a merge get `mergeGrace` extra seconds.
- **Shake and swap cost something.** The shake needs `CH_MAX` merges and breaks the chain and halves a building fever. Swaps are limited (`swapsAtStart`, up to `swapsMax`) and earned by goals; the NEXT button shows how many are left.
- **Specials help when it matters.** A pile that has climbed into the top half with no special for 25 drops is owed a Boomer; Icy really holds the countdown; Zappy only upgrades small pals; a Solis standing in the box brings a wildcard within ten drops, and the Sun is a victory: it clears the small pals, starts a fever and is counted.
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

`tests/vocal.test.js` covers the vocal song: deterministic sessions and valid forms, singable parts (range, steps, chord tones on strong beats, rests, density), the returning hook, the voice's formants, vibrato and soft onset, cleanup and the arrangement's silences. `tests/warehouse.test.js` covers the techno track: the kit is deterministic, normalised and click-free, kicks have a 46 Hz fundamental, punch and a finite tail, hats are bright and claps sit in the mids, each hit is one cleaned-up voice, the kick retunes and ducks, and the arrangement keeps its floor, silent beat, drop and drifting percussion. `tests/mix.test.js` covers the mix: the master chain's bounds, a reachability check that every song-bus node ends in the output, per-song trims, the sweep curve, filter and silent-beat behaviour of all three arrangements, supersaw symmetry and cleanup, the drum voices' mapping onto the kit (kick variants and tuning, the rumble feed, toms, percussion, crashes), the kick's sidechain envelope and the WAV analyzer. `tests/trance.test.js` covers HORIZON LINE: deterministic, valid sessions (about 60 % major), chapters that keep key and tempo, the tuned clean kick and its silent beat before drops, a bass that rolls on every sixteenth after the kick and never on it, hats on every sixteenth, a gap-free arpeggio and chord wall, the drop and the breakdown, and the two new voices. The `mix` tests also cover the synth bus's pump share. `tests/rules.test.js` covers the game rules on the real modules without a browser: chain combos and their window, scoring and fever, limited swaps and their reward, the shake's cost, the squeeze, the fairer death rule and merge grace, Icy, the Sun victory, the drop-count ramp, identical daily pals and goals for every level, the Boomer and Solis rules, and booking a run. `tests/records.test.js` covers stats, records, quests and the daily. `tests/polish.test.js` covers the coaching hints (order, learned for good, text width), the adaptive look-ahead and the maskable icons in the manifest and the offline cache. `tests/mutators.test.js` covers the mutators' table, unlocks, offers and the daily mutator, and the badges' conditions, progress and one-time awards; `tests/rules.test.js` also checks what each mutator changes and that finishing a run pays badge XP.

For actual Web Audio rendering in a browser, open `tools/audio-check.html` and press **RUN AUDIO CHECKS**. It renders all songs at several sections, additional seeds, and busy gameplay through the live compressor/limiter and reactive filter. It checks finite samples, clipping, released voices, required cues, and freeze/recovery/death transitions. Choose a soundtrack and export music or music with gameplay feedback using the preview buttons. Festival previews span 48 bars, including intro, build, drop, break and another drop. Automated checks establish signal/runtime behavior; listening establishes musical taste.

### Measuring a mix

Download a preview from the audio check page (previews render at 44.1 kHz), then:

```sh
node tools/analyze-wav.mjs skyline-rush.wav --bpm 127
ffmpeg -i skyline-rush.wav -af ebur128=peak=true -f null -   # integrated loudness (LUFS) and true peak
```

`tools/reference-report.mjs` compares a file with the reference set (see _Reference_). `analyze-wav.mjs` prints, for every bar, RMS and peak in dBFS, the low-mid, high-mid and top-end balance relative to the 20-200 Hz band, and the side/mid ratio. The shipped mixes aim at:

- about -13 to -14 LUFS integrated, peaks below -2 dBFS, drops about 4 dB louder than breakdowns;
- in drops, relative to the low band (20-200 Hz): low mids about -8 dB, high mids about -12 dB, top end about -14 dB (brighter than before; the reference set is brighter still);
- a side/mid ratio around -10 dB in SKYLINE RUSH's drops (a wide hook over a centred kick and bass); HORIZON LINE's mids sit near -2 dB, like the reference.

After changing voices or levels, render the previews again and compare. Set the master first, then each track's `trim`, then the `LEVEL` tables.
