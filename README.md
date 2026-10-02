# Pal Pop

A pixel-art merge game with slippery physics, responsive electronic gameplay sounds, and three continuously evolving Web Audio soundtracks:

- **NEON CIRCUIT** — electro with pumping bass and short synth stabs.
- **LIVE TECHNO** — rolling bass, acid lines and dub chords.
- **SKYLINE RUSH** — melodic festival house with piano chords, a wide synth hook, builds and drops.

The modular edition lives in [`refactored/`](refactored/). Its native ES modules separate physics, game rules, rendering, interface, composition, arrangement and instrument synthesis. The root `index.html` retains the compatible single-file edition.

## Run locally

Use Node.js 22.18 or newer:

```sh
cd refactored
npm ci
npm start
```

Open [http://127.0.0.1:4174/](http://127.0.0.1:4174/). No bundler or runtime package dependency is required.

To play on another device in your local network, set `HOST` to your computer's LAN IP before starting. For example, in PowerShell:

```powershell
$env:HOST = '192.168.1.50' # Replace with your computer's LAN IP.
npm start
```

The root edition can be served by any static HTTP server, for example `python -m http.server 4173 --bind 127.0.0.1` from this repository's root.

## Verify and extend

```sh
cd refactored
npm run verify
```

Verification checks module bindings, circular imports, formatting, offline assets and 34 tests covering physics, save compatibility, procedural composition, voice cleanup, gameplay reactions and parity between the festival engines in both editions. Browser audio checks and preview exports are available at `http://127.0.0.1:4174/tools/audio-check.html`.

See [`refactored/README.md`](refactored/README.md) for architecture, tuning, new instruments and adding songs. After changing shipped files, run `npm run cache:update`. Use `node tools/sync-legacy-dance.mjs` from `refactored/` to sync electro/festival changes into the root edition.
