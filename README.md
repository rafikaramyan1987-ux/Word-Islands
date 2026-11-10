# Word Islands

A cozy word-connect puzzle for desktop and mobile browsers. Drag across the letters on the wheel to
spell words that fill a small crossword. Every solved level restores and decorates a 3D island —
palm trees, a hut, a pier, a lighthouse that lights up at night — and a finished island sends your
little sailboat off to the next one.

**Status: Phase A (art & feel preview)** — title screen, two islands (Sunny Lagoon, morning;
Frost Harbor, night), 3 playable levels each in English, French and Russian, island growth and the
sailing transition. The UI is translated into all six launch languages (EN, FR, DE, ES, IT, RU).

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
```

## Platforms

`VITE_PLATFORM=web | crazygames | gd | gamepix | playgama` selects the platform layer at build time
(`src/platform`). Phase A ships the web layer (no SDK, no ads, localStorage); the portal SDKs plug in
behind the same interface in Phase B.

## Save data

Progress is stored under the single localStorage key `word-islands.save.v1` (or the platform storage):
language, audio settings, coins, tutorial flag and per-language level progress.

## Controls

Drag across letters (mouse, touch or pen) and release to submit, or type: letters use
`KeyboardEvent.key`, so AZERTY/QWERTZ/Cyrillic layouts work; Enter submits, Backspace deletes.
Escape is never used for game actions.
