# Word Islands

A cozy word-connect puzzle for desktop and mobile browsers. Drag across the letters on the wheel to
spell words that fill a small crossword. Every solved level restores and decorates a 3D island —
palm trees, a hut, a pier, a lighthouse that lights up at night — and a finished island sends your
little sailboat off to the next one.

**8 islands, 100 levels per language** in English, French, German, Spanish, Italian and Russian, each
with its own hand-written word list (3,000+ everyday words) and its own generated levels. Also: a daily
puzzle with streaks, 13 achievements, bonus words, hints, coins, and builds for the web, CrazyGames,
GameDistribution, GamePix and Playgama.

| # | Island | Time of day | Landmark |
|---|---|---|---|
| 1 | Sunny Lagoon | morning | stilt hut, pier, palms |
| 2 | Frost Harbor | night (stars, aurora, snow) | lighthouse that lights up |
| 3 | Windmill Meadows | noon | turning windmill, sheep, hay |
| 4 | Sunset Dunes | sunset | sandstone arch, oasis, cacti |
| 5 | Maple Hollow | golden afternoon (falling leaves) | hot-air balloon, cabin, pumpkins |
| 6 | Firefly Lagoon | dusk (fireflies) | treehouse, glowing mushrooms |
| 7 | Blossom Isle | dawn (petals) | gazebo, fountain, blossom trees |
| 8 | Ember Peak | ember sky (rising embers) | smoking volcano with lava |

Preview media: [`docs/preview/`](docs/preview) · Level report: [`docs/levels-report.md`](docs/levels-report.md) ·
Word lists & letter rules: [`docs/wordlists.md`](docs/wordlists.md) · Credits: [`CREDITS.md`](CREDITS.md)

## Tech

TypeScript, Vite (`base: './'`), Three.js. No runtime dependencies besides three.js and the bundled
Nunito font; all sounds and music are synthesised with Web Audio.

```
src/core       pure logic shared by the game and the tools (letter rules, crossword layout/checks)
src/game       game flow (menus, levels, helpers, coins, save)
src/ui         DOM UI: letter wheel, grid, tutorial, styles, icons
src/scene      Three.js world: sky, water shader, islands, hand-made props, effects
src/audio      Web Audio SFX and pre-rendered, seamlessly looping music
src/platform   build-time platform layer (VITE_PLATFORM)
src/i18n       one JSON per language
tools          asset pipeline, level generator + validator, size check, preview capture
```

## Commands

```bash
npm ci
npm run dev                 # local dev server
npm run build:web           # dist/web  (also: build:crazygames, build:gd, build:gamepix, build:playgama, build:all)
npm run lint && npm run typecheck && npm test
npm run levels:generate     # regenerate src/data/levels/*.json from tools/wordlists
npm run levels:validate     # validate all packs, write docs/levels-report.md (CI fails on errors)
npm run e2e                 # Playwright tests against dist/web
npm run size:check          # every build must stay under 10 MB
npm run assets:build        # rebuild public/models/*.glb from assets-src/
npx tsx tools/count-words.ts # word-list statistics per language
```

## Platforms

`VITE_PLATFORM=web | crazygames | gd | gamepix | playgama` selects the platform layer at build time
(`src/platform`); each build only contains its own SDK.

| Build | SDK | Saves | Ads |
|---|---|---|---|
| web | none | localStorage | none (rewarded button hidden) |
| crazygames | CrazyGames SDK v3 (init with timeout, loading/gameplay events de-duplicated, happytime, user locale, `muteAudio` followed live) | Data module | midgame + rewarded through one wrapper that settles once, 8 s timeout |
| gd | GameDistribution HTML5 SDK, game ID `53ecfdcc22b1483c86e809d8c324febe` in `src/platform/gd.ts` (CI fails if the bundle lacks it) | localStorage | `gdsdk.showAd()`, rewarded only on `SDK_REWARDED_WATCH_COMPLETE` |
| gamepix | GamePix JS SDK v3 in index.html with `GamePixConfig = { lifecycle: 'manual' }`: `lifecycle.loading/loaded/gameStart`, `events.on(pause/resume/soundOff/soundOn)` + legacy assignments, `GamePix.lang()`, `happyMoment('level_complete')` | localStorage (one known key) | `ads.interstitial()`, `ads.reward()` (reward only when `success === true`) |
| playgama | Playgama Bridge v2 (`game_ready`, gameplay/level messages, `platform.language`) | `bridge.storage` | interstitial/rewarded state events, 120 s minimum delay in `playgama-bridge-config.json` |

Interstitials are only shown between levels, at most once every 2 minutes, never during a level.
Rewarded ads are only offered from a clearly labelled "Watch an ad: +25 coins" button and only pay out
when the ad really completed; if no ad is available the game says so for 2.5 s.

Submission folders (`submission*/`) are produced by `npm run submission` (zips, covers, thumbnails,
icons, screenshots, trailers and texts).

## Save data

Progress is stored under the single localStorage key `word-islands.save.v1` (or the platform storage):
language, audio settings, coins, tutorial flag and per-language level progress.

## Controls

Drag across letters (mouse, touch or pen) and release to submit, or type: letters use
`KeyboardEvent.key`, so AZERTY/QWERTZ/Cyrillic layouts work; Enter submits, Backspace deletes.
Escape is never used for game actions.
