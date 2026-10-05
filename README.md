# Pal Pop

A pixel-art merge game with slippery physics, responsive electronic gameplay sounds and five endless Web Audio soundtracks. Each soundtrack is an endless DJ set of one genre: track after track, each composed from the seed and its number - a key, a chord progression from the genre's vocabulary, a bass riff, a hook, drum grooves and a real track's shape (intro, groove, breakdown, build, drop, second breakdown and drop, outro). The set never plays the same track twice, while each track repeats and develops its loops the way real dance music does.

- **SOLAR RUSH** — euphoric hard trance at 150–158 BPM: a punchy clean kick, a bass that rolls through the three sixteenths after every kick, a seven-saw lead and a sustained saw wall, arpeggios in the breakdowns. Voiced from a measurement of a 156 BPM clip (see _Reference_).
- **BLACKOUT** — hard techno at 142–148 BPM in a minor, Phrygian or harmonic-minor key: a distorted kick with a long tail and a rumble under it, fast hats and rides, a short detuned riff, stabs and a dark pad. Voiced from a measurement of a 144 BPM clip.
- **AFTER HOURS** — melodic techno at 122–128 BPM: a round kick, a rolling bass that moves to the fifth, a plucked motif with a long echo, soft arpeggios and wide pads. Voiced from a measurement of a melodic techno mix.
- **RAVE ANTHEM** — a dancefloor anthem at 134–138 BPM: a bass on every off-beat, a bright plucked riff over a four-chord loop, soft chords and big builds with snare rolls. Voiced from a measurement of a 136 BPM Eurodance record.
- **ALL MY PALS** — vocal trance. The song "All My Pals", a finished recording made with Suno to lyrics written for the game, plays on repeat like a game's theme: verses that name the pals and a chorus in the breakdown ("All my pals, we're shining as one, higher and higher, up to the sun"). It plays untouched, each play right after the last, and the game's clock follows its measured bars; nothing is generated (see _The song_).

The drums are rendered sample by sample and struck live; the synth loops of each track are rendered ahead of time through studio-style synths (free-running unison oscillators, 24 dB filters with envelopes, oversampled saturation) and played like samples, with each layer's filter and sends automated through the track. All five, the recorded song included, sit at about -9.5 to -10.5 LUFS at the default volume with peaks below -0.8 dBFS, without an exciter or a clipping master.

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
| A style's tempo, keys, progressions, riffs, grooves, mix     | `src/audio/gen/styles.js`                                        |
| How a track is composed, arranged and played                 | `src/audio/gen/` (`track`, `set`, `engine`)                      |
| The synths of the melodic loops, and their rendering         | `src/audio/instruments/studio.js`, `src/audio/stems.js`          |
| The recorded song: the file, its measured bars and chords    | `assets/music/`, `src/audio/gen/all-my-pals.js`                  |
| Loading and playing a recorded song                          | `src/audio/records.js`, `src/audio/gen/engine.js`                |
| How each instrument sounds                                   | `src/audio/instruments/`                                         |
| The live reply stab of gameplay                              | `src/audio/instruments/gen.js`, `supersaw.js`                    |
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

Every soundtrack is a **style** in `src/audio/gen/styles.js`; they share one composer and one engine. A style is the vocabulary a producer of that genre works with, as plain data:

- `bpm`, `keys`, `scales` (weighted) and `swing`;
- `progressions`: chord progressions as scale degrees, with how many bars each chord lasts (for example `[[5, 3, 0, 4], 2]`, vi–IV–I–V over eight bars);
- `bass`: bass riffs as sixteen-step rows (`R` root, `O` octave, `F` fifth, `S` the step above, `-` hold, `.` rest), and the range the bass plays in;
- `hookRhythms`, `hookRange` and `hookMoves`: the rhythms a hook may take (`X` a note, `-` hold, `.` rest) and how it moves from note to note;
- `arp` and `stabRhythms`: arpeggio rhythms and orders, chord-stab rhythms (or `null` where the genre has none);
- `drums`: grooves for kick, hats, open hat, clap, ride and percussion (`X` accent, `x`, `o`, `-`, `,` softer, `.` rest);
- `form`: the sections of a track, their lengths, which layers play (`late` ones enter halfway) and the filter and reverb automation of each section;
- `sound`, `mix`, `stems` and `pump`: kick, rumble and synth patches, the drum levels, the loop levels and the synth bus's share of the sidechain;
- `record` (optional): a recorded song that takes every `every`-th track, with its measured bars, chords and sections (see _The song_); the generated tracks of such a style stay in the song's key.

To add a soundtrack, add a style under a new id and an entry to `TRACKS` in `src/audio/catalog.js` with a new numeric ID, a unique `buttonId`, a name, label, description, BPM and the style id as `style`. The picker and stored-choice validation discover it automatically. A new synth sound is a patch in `PATCHES` (`src/audio/instruments/studio.js`).

### How a track is made

Everything is a pure function of the seed and the place (`src/audio/gen/random.js` hashes the coordinates), so any bar can be computed at any time, a session replays exactly, and a test can walk a whole set.

- **Track** (`track.js`). A track draws a key (a new one each track), a scale, a progression, a bass riff, hook and arpeggio rhythms, drum grooves, section lengths and how its synths differ from the last track's (detune, brightness). The hook is written the way riffs are: one motif, carried over every chord - either moving with the chords (a sequence) or staying put and bending its strong notes to each chord - with strong beats on chord tones and the loop resolving at its end. The second drop plays a lifted variant.
- **Set** (`set.js`). Tracks follow each other without gaps. `plan(bar)` says everything that happens in a bar: the section, which layers play, the drum hits (with fills at the end of eight-bar phrases, snare rolls through builds and a silent last beat before most drops), which loops start where, the filter and reverb automation and the transitions. Only a few tracks and bar plans are held at a time.
- **Loops** (`stems.js`). The melodic loops of a track (bass, two hooks, arpeggio, stabs, pads) are rendered once into audio buffers, through the synths in `instruments/studio.js`, in the background while the track opens on its drums; the first track of a session has a short intro so music arrives quickly. A track's loops take about two seconds to render on a desktop CPU, and at most three tracks are held.
- **Engine** (`engine.js`). The scheduler calls it once per sixteenth: it strikes the drums from the kit, starts loops at the bars where their layers come in, and automates each layer's filter and sends through the bar. Live, a song creates about 15 to 20 sound sources per second; the synths cost nothing until their loops are played.

`tests/music.test.js` checks what matters: the same seed gives the same set in any order of asking, a set never repeats a track (every track moves to a new key), every track has an intro, two drops after builds and an outro in whole loops, every loop note is in key and in range, most strong hook notes are chord tones, loops start where their layers come in, builds end in silence, memory stays bounded over 5,000 bars, and every arrangement plays 600 bars of finite, in-time events.

The scheduler dispatches through the registry (`src/audio/song-registry.js`). `resetLiveMusic()` resets gameplay accents without restarting the soundtrack; gameplay hits answer with a stab of the song's own sound on the next beat (`eRave`). Music reactions in `src/audio/reactions.js` close the synth filter while the game is in danger, and the game's hype opens the hook and arpeggio filters a little.

### The song

"All My Pals" (`assets/music/all-my-pals.mp3`, 3:03, 48 kHz stereo MP3 at about 187 kbit/s, the cover art removed, the audio copied bit for bit) was made with Suno to the game's lyrics. A style may carry such a recording (`record` in `styles.js`, here `{ every: 1, ...ALL_MY_PALS }`): every `every`-th track of the set is then the recording, and the set opens with it. ALL MY PALS has nothing else, so the song is the soundtrack and starts again the moment it ends, every 3:03, the way one song runs endlessly in Robot Unicorn Attack. Everything the game needs to play along was measured from the file, offline, and is written down in `src/audio/gen/all-my-pals.js`:

- **Bars.** The song is not on a fixed grid: its tempo drifts from about 136.0 BPM in the intro to 137.2 BPM at the end, so a fixed tempo would put its beat up to a quarter of a beat away from the game's. Its kicks were found by matching a kick template against the low end (the drops), its other bars by following the sixteenth-note onsets of the arpeggio from the first note to the first drop, and the gaps (breakdown, short breaks, outro) were interpolated. Both measurements were brought to the kick's attack (read off the waveform) and the bar lengths smoothed, so each bar's tempo changes by less than 0.05 % from the next. The 105 bar marks lie within 7 ms of the kicks in the drops (most within 1 ms) and within 14 ms of the measured bars elsewhere.
- **Clock.** The set keeps the clock (`secondsAt(step)` and `stepAt(seconds)` in `set.js`): generated tracks run at the session's tempo, the recording at its own, bar by bar. The scheduler, the beat-aligned gameplay replies and the chord lookups all go through it, so the game's sounds land on the song's beat while the recording plays at its own speed: no time-stretching, no resampling beyond the decoder's.
- **Chords, sections, kick and voice.** A chromagram per bar, matched against the chords of A minor: G Dm F C in the intro, then Dm Am F C, two bars each, with G before the first drop and Em before the last. Gameplay replies are voiced over these. The sections come from the level of each bar and of its low end (intro, verse, build, two drop halves, the chorus breakdown, build, drop, outro), the sung bars from a speech recogniser run over every two bars, and the music meter lights KICK and VOX from them.
- **Names.** When the song sings a pal's name, that pal lights up: every one of its kind on the board glows (its halo), pops a little and flashes white as the word starts; "all my pals" and "every pal" light them all. The times of the 20 names (`names`) come from a speech recogniser that times each word (NVIDIA's Parakeet TDT 0.6B, run offline through sherpa-onnx); it heard "Flip and trippy" for "Blipp and Chirpy", which is close enough to place them, and missed "Bolt", which sits where "Boo" sits in the line before. The engine turns each name into a cue at the moment it is sung, in the audio clock (`audio.palCues`), and the board shows it when it is heard, after the device's output latency (`src/render/sung.js`). With flashes off there is no white flash; with reduced motion, no pop.
- **Lyrics.** With LYRICS ON in the sound menu (off by default), the line being sung is written behind the pals, in the board's pixel font, in one or two rows under the coaching hints: it fades in 0.6 s before its first word, each word turns gold as it is sung, and it fades out after the line. The words carry the recogniser's times laid onto the lyrics as written (`lyrics`, `word@seconds`); the engine turns each line into a cue in the audio clock (`audio.lyricCues`) and the board draws it when it is heard. The pixel font gained a comma and an apostrophe for it.
- **Decoders.** The marks are measured on ffmpeg's decode. MP3 decoders differ in how much of the encoder's lead-in they keep, so the player finds the first note (the first sample above 1 % of full scale, 206.5 ms into ffmpeg's decode) in its own decoded buffer and shifts by the difference; Chromium's decode matches ffmpeg's to the sample.

`src/audio/records.js` fetches the file once and decodes it for each session that plays it (a decoded song holds about 70 MB, released with the session; decoding takes 0.6 to 1.3 s in headless Chromium). A set that opens with the song waits for it, up to five seconds, so it starts with its first bar; a song that is not ready when its bar comes joins on the next beat where the music has got to, with a 30 ms fade. The recording is a finished master, so it skips the music bus's EQ, saturation and glue and joins after them, where the game's freeze filter and game-over dip still reach it; its low shelf follows the bass setting from its default, so by default it is flat. At its level (`RECORD_LEVEL` in `graph.js`) the first drop measures -10.3 LUFS through the master, the generated drops -10.2 LUFS; the spectrum comes out unchanged (every band within 0.2 dB of the original after the level), and the master's compressor and soft clip take 1.7 dB off its crest factor. The output chain delays everything the game plays, songs and effects alike, by 17 ms (the compressors' look-ahead).

### Drum kit

Every track plays its drums from one kit (`src/audio/instruments/kit-dsp.js`, played by `kit.js`), so none of them sounds like oscillators and filtered noise. The kit is rendered sample by sample in plain JavaScript: three kicks (a saturated pitch-dropping sine fused with a short knock and a click, retuned to the key), three claps with early reflections, rimshots, six-square metal hats and open hats, ride, crash (long and short), toms, tuned metal hits, industrial blasts, snares and shakers. Each drum is built the first time it is needed (a few milliseconds), the rest are warmed up in timer ticks, and every hit picks one of several variants, so repeats never sound machined. A hit is one buffer source and one gain, which is cheaper than assembling a drum from oscillators and filters.

The engine plays its drums through the kit's vocabulary (`eKick`, `eHat`, `eClap`, `eSnare`, `eShaker`, `eRide`, `eTom`, `ePerc`, `eCrash`): `src/audio/instruments/drums.js` maps each one onto the kit (the `GAIN` table). Kicks are tuned to the key, between 46 and 62 Hz (`kickTuning`), and a style may shift that (`sound.tune`). There are four kick variants: clean (a fast pitch fall whose distortion is filtered away above 1.2 kHz, so the mids belong to the synths), punch, hard (a slower sweep into heavy distortion with a long tail, whose harmonics fall through the mids, for BLACKOUT) and round. BLACKOUT's kick also feeds the rumble: a dark, short reverb, low-passed at 150 Hz, saturated and ducked by the next kick. Open hats decay in under 0.1 s, so the top of the mix is a fine texture rather than bursts of noise.

### Reference

The songs are voiced from measurements of recordings, with one analysis for every file (`tools/reference-report.mjs`): tempo, the level while the kick plays, seven band levels (sub 30–60 Hz, kick 60–120, bass 120–250, low mids 250–500, mids 500–2k, high mids 2–5k, highs 5–10k), side/mid per band and the swing of each band across one beat. Measured, not listened to: the numbers say how loud, bright, wide and busy a record is, not how it sounds, and whether a result sounds good is for ears.

| Song        | Reference                                          | What it showed                                                                                                                                                 |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOLAR RUSH  | a 156 BPM euphoric hard-trance clip in B/E major   | Kick, sub and a bass that sits low (A1 to A2) at about the same level; sixteenth arpeggios; mids 6–13 dB under the kick band; narrow below 500 Hz, wide above. |
| BLACKOUT    | a 144 BPM hard-techno clip                         | A distorted, short kick; a rolling bass; dense mids and highs only 3–9 dB under the kick band.                                                                 |
| AFTER HOURS | a melodic techno mix (126 BPM, A minor, -7.6 LUFS) | A round kick and a bass that carries 120–250 Hz; 2–5 kHz about 11 dB under the kick; layers of pads and plucks up to 6 kHz.                                    |
| RAVE ANTHEM | an Alice Deejay record (136 BPM, -11.3 LUFS)       | A strong kick (10 dB over the bass band), a continuous riff and little above 5 kHz.                                                                            |

What changed after these measurements, and why. The previous version was loud (-7 to -9 LUFS through a clipping master), its highs were bursts of open-hat noise on every beat, its bass was chopped into sixteenths with silences between, its kicks swept audibly through the mids, and its synths were thin single notes created live, dozens per second. The spectrograms of the clips show the opposite: a continuous floor under the kicks, a fine, continuous top, and a dense, held wall of saws. The rebuild follows the clips: rendered loops with held notes and long releases, a smoother sidechain (a 3 ms glide instead of a jump, which is heard as a click on held sounds), short hats, filtered kicks, a rumble for hard techno, and a master that no longer clips.

Where the renders land against the references (a drop, seed 42, bands relative to the kick band, in dB; reference first):

| Song        | sub         | bass         | low mids      | mids          | high mids     | highs         | loudness   |
| ----------- | ----------- | ------------ | ------------- | ------------- | ------------- | ------------- | ---------- |
| SOLAR RUSH  | -1.2 / -2.7 | -6.8 / -5.6  | -13.0 / -9.6  | -7.9 / -6.4   | -12.8 / -12.1 | -15.8 / -15.3 | -10.3 LUFS |
| BLACKOUT    | -0.7 / -2.3 | -3.9 / -2.6  | -6.0 / -5.8   | -6.1 / -8.2   | -7.1 / -11.7  | -9.0 / -12.1  | -9.5 LUFS  |
| AFTER HOURS | -2.4 / -3.0 | -4.4 / -4.8  | -8.8 / -8.5   | -9.6 / -8.0   | -11.1 / -14.0 | -13.9 / -15.5 | -10.6 LUFS |
| RAVE ANTHEM | -8.2 / -7.8 | -10.0 / -8.4 | -14.7 / -12.3 | -14.2 / -11.4 | -19.8 / -18.7 | -19.0 / -19.8 | -10.6 LUFS |

The largest remaining gaps: BLACKOUT is 3 to 5 dB thinner above 2 kHz than its clip, and SOLAR RUSH carries 3 dB more low mids. A click detector (impulses far above their local level) finds 0 to 2 per second in the drops, the same range as the reference records.

```sh
node tools/reference-report.mjs preview.wav                 # compare any file with the reference set
node tools/reference-report.mjs record.mp3 --start 300 --seconds 60
```

Compare passages of similar loudness, and render a window of a song the same way (`tools/audio-check.html` exports WAV previews).

### Mix and mastering

Signal flow: drums feed the dry bus; each melodic layer (bass, hook, arpeggio, stabs, pads) has its own bus with a lowpass filter and echo and reverb sends that the engine automates, feeding the bass or the synth bus. The kick ducks the bass bus fully and the synth bus by the song's `pump` share (a 3 ms glide down, an exponential recovery). The synth bus passes a mid/side widener whose side signal is high-passed at 220 Hz, so bass and low mids stay centred and the mix still folds down cleanly to mono. Each song's output passes its loudness `trim` and the DJ high-pass, then the shared music bus: low cut, bass shelf, a gentle presence (+2 dB at 3.4 kHz) and air (+1.5 dB shelf at 8.5 kHz) lift, soft saturation and a slow-attack glue compressor. The master adds makeup gain (`MASTER_GAIN`), a compressor, a gentle tanh stage, a limiter and a last stage that rounds anything above 0.9 off towards 0.98, so the output stays below -0.5 dBFS and never clips hard.

Dry gameplay effects bypass the music bus and enter at the master, scaled by `SFX_GAIN`. They were measured about 11 LU below the music with transient peaks close to the music's, before the master was made louder; that ratio was not measured again.

Each style keeps a `mix` table (drums) and a `stems` table (loops) with the balance of its layers. Change them there, not in the shared voices, so one song's balance never shifts another's. A song's overall level is its catalog `trim`; the shared makeup is `MASTER_GAIN`.

Tracks follow live-set dramaturgy. Intros open a DJ high-pass filter over the drums. Breakdowns drop the kick and bass, open the reverb and bring the pads, arpeggio and a filtered hook. Builds close the DJ filter, open the hook's filter, add a riser and a quickening snare roll, bring the kick back halfway, swell into a reverse cymbal and leave the last beat silent. Drops land with a crash and an impact; phrase ends get a fill or a crash. Outros strip back to the drums, and the next track starts on a crash.

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

Switches in the Sound sheet: a speaker button on the bar mutes everything with one tap (and shows a red cross while muted), HAPTICS turns vibration off (hidden where the browser has no `navigator.vibrate`, which includes iPhones) and FLASHES turns off the white screen flashes and every blinking animation (`html.calm`). LYRICS (off by default) writes the words of ALL MY PALS behind the board while it plays. BEAT (on by default) is beat mode: every pal on the board pulses with the kick, up to 6 % bigger and back within about a tenth of a second, softer for softer kicks. It changes only how the pals are drawn; the bodies the physics knows keep their size, so nothing collides differently. The engine reports each kick it strikes (and each beat of the recording's kick bars) in the audio clock (`audio.beats`), and the board follows it as it is heard (`src/render/beat.js`); with reduced motion it stays still. All of these are saved. Installed on an iPhone with iOS 26 the page's window is exactly the top safe-area inset too short when the page asks for `viewport-fit=cover` with a translucent status bar (WebKit bug 301108: `innerHeight`, `100dvh` and `100%` stop 62 px above the bottom of an iPhone 16 Pro) and iOS paints nothing below it, so a taller app is simply cut off. The page therefore does not ask for `viewport-fit=cover`: the app sits inside the safe area, the bars above and below it show the page colour (`#1c1432`, the app's own) and the buttons keep clear of the home indicator. `#app` fills whatever window it is given (`position: fixed; inset: 0`). The Sound sheet ends with one line of numbers (window, screen, `100lvh`, app box, insets, installed or browser) to chase problems like that; its helpers are in `src/ui/viewport.js`. The music scheduler widens its look-ahead from 0.24 s up to 0.6 s after a late tick and relaxes again while ticks are on time (`adaptLook` in `src/audio/scheduler.js`), so a slow phone drops frames rather than notes.

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

`tests/music.test.js` covers the generated sets and the recorded song (every track, played over and over, each play right after the last, in A minor with its measured form and chords and nothing generated over it; the bar marks, chords and sections complete, and the last bar ending just inside the MP3, counted from its frames; the clock following the song's bars and the generated tracks' tempo, forwards and back; the engine starting the song with its first bar, or joining it on a beat, past a decoder's extra lead-in, and stopping it with the song bus): the catalog and registry, determinism whatever order bars are asked in, no repeated track (every track moves to a new key, except around a recorded song), the shape of every track, loop notes in key and in range, hooks leaning on chord tones, loops starting where their layers come in, silent beats before drops, bounded memory over 5,000 bars, and 600 bars of every arrangement against recording instruments (finite, in-time events). `tests/mix.test.js` covers the mix: the master chain's bounds, a reachability check that every song-bus node ends in the output, per-song trims, the sweep curve, the filter and silent-beat behaviour of all four arrangements, supersaw symmetry and cleanup, the drum voices' mapping onto the kit (kick variants and tuning, the rumble feed, toms, percussion, crashes), the kick's sidechain glide and the WAV analyzer. `tests/sound.test.js` covers the master's last rounding stage (nothing reaches 0.99, loud peaks are kept, the curve is odd and monotonic), a music bus without an exciter, and the driven, drifting saw stacks behind the voices. `tests/rules.test.js` covers the game rules on the real modules without a browser: chain combos and their window, scoring and fever, limited swaps and their reward, the shake's cost, the squeeze, the fairer death rule and merge grace, Icy, the Sun victory, the drop-count ramp, identical daily pals and goals for every level, the wildcard and Solis rules, the missing bomb, and booking a run. `tests/records.test.js` covers stats, records, quests and the daily. `tests/polish.test.js` covers the coaching hints (order, learned for good, text width), the adaptive look-ahead, the home-indicator rule and the icon files in the manifest and the offline cache. `tests/mutators.test.js` covers the mutators' table, unlocks, offers and the daily mutator, and the badges' conditions, progress and one-time awards; `tests/rules.test.js` also checks what each mutator changes and that finishing a run pays badge XP.

For actual Web Audio rendering in a browser, open `tools/audio-check.html` and press **RUN AUDIO CHECKS**. It renders all songs at several sections, additional seeds, and busy gameplay through the live compressor/limiter and reactive filter. It checks finite samples, clipping, released voices, required cues, and freeze/recovery/death transitions. Choose a soundtrack and export music or music with gameplay feedback using the preview buttons. Previews span 32 bars of a generated song. Automated checks establish signal/runtime behavior; listening establishes musical taste.

### Measuring a mix

Download a preview from the audio check page (previews render at 44.1 kHz), then:

```sh
node tools/analyze-wav.mjs solar-rush.wav --bpm 156
ffmpeg -i solar-rush.wav -af ebur128=peak=true -f null -   # integrated loudness (LUFS) and true peak
```

`tools/reference-report.mjs` compares a file with a reference (see _Reference_). `analyze-wav.mjs` prints, for every bar, RMS and peak in dBFS, the low-mid, high-mid and top-end balance relative to the 20-200 Hz band, and the side/mid ratio. The shipped mixes aim at:

- about -9.5 to -10.5 LUFS integrated, peaks below -0.8 dBFS;
- in drops, the bands relative to the kick band close to the reference table above;
- synth mids and highs that are wide (side/mid between -5 and -2 dB) over a centred kick and bass.

After changing voices or levels, render the previews again and compare. Set the master first, then each song's `trim`, then its `mix` and `stems` tables.
