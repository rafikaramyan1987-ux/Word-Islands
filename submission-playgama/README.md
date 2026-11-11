# Word Islands

## Short description
Connect letters, fill cozy crosswords and restore a chain of 3D islands as you sail between them.

## Description
Sail across a sunny archipelago and bring each island back to life with words! Swipe across the letter wheel to spell words and fill the little crossword. Every solved level grows your island: palm trees, a hut, a windmill, a glowing lighthouse and more. 100 levels on 8 hand-crafted islands, a daily puzzle with streaks, bonus words, hints and achievements. Plays in English, French, German, Spanish, Italian and Russian.

## How to play
Drag across the letters on the wheel (or type them on your keyboard and press Enter) to make a word. Words that fit the crossword fly into the grid; fill the whole grid to finish the level and grow your island. Extra valid words are bonus words and give coins. Shuffle is free; Hint reveals one letter (the first hint in each level is free) and Reveal shows a whole word.

## Controls
Mouse / touch: drag across letters, release to submit. Keyboard: type letters, Enter to submit, Backspace to delete.

## Tags
word, puzzle, crossword, casual, relaxing, 3d, islands, brain, vocabulary, family

## Languages
English, French, German, Spanish, Italian, Russian (auto-detected from the platform, switchable in Settings).

## Playgama build (v2: `word-islands-playgama-v2.zip`)
- Bridge is the official build from Playgama's CDN (`https://bridge.playgama.com/v2/stable/playgama-bridge.js`), the
  first script in `<head>`; an inline boot script calls `bridge.initialize()` and the game bundle starts only after it
  has settled, so Playgama's checker (`?platform_id=qa_tool`) receives the initialize handshake. A failed
  initialization is logged with `console.error` and the game stays playable.
- `game_ready` is sent once the loading screen is gone and before any gameplay message (`level_started`,
  `level_completed`, `player_got_achievement`).
- Interstitials: requested at every natural break between levels; Bridge alone decides with Playgama's defaults
  (`playgama-bridge-config.json` is `{}`), no timer in the game.
- The save lives in Bridge Storage only (no localStorage in this build).
- Checked by `tools/playgama/check.mjs` (includes Playgama's precheck: no FAIL, no WARN) and the QA Tool harness
  `tools/playgama/qa.mjs`. `word-islands-playgama.zip` (v1) is kept for reference.
