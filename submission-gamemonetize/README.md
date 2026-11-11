# Word Islands — GameMonetize submission

- **Game ID:** `0cqkyktpv3nnr3nokt7jhqbzryqmfh2h` (already in the build)
- **Upload:** `word-islands-gamemonetize-v1.zip`: `index.html`, `assets/`, `models/` and `favicon.svg` at the zip root,
  relative paths only (Game Management > My games > select the game > drop the file; then "Verify Game" and
  "REQUEST ACTIVATION").
- **Images:** `word-islands-512x384.jpg`, `word-islands-512x512.jpg`, `word-islands-512x340.jpg`: the cover / title
  scene (the fully restored Sunny Lagoon island) rendered from the game with no text and no logo, each under 300 KB
  (32–34 KB).

## Form fields (ready to paste)

**Name**

```
Word Islands
```

**Category** (pick 2–3): Puzzles, 3D, Hypercasual

**Tags**

```
word, puzzle, crossword, word connect, casual, relaxing, 3d, islands, brain, vocabulary, family, html5, mobile
```

**Width / Height:** `1280` x `720` (landscape 16:9; the game fills any frame size, landscape or portrait)

**Optimized for Mobile Devices:** Yes (touch controls, portrait and landscape layouts)

**Description** (456 characters, limit 600)

```
Sail across a sunny archipelago and bring each island back to life with words! Swipe across the letter wheel to spell words and fill the little crossword; every solved level grows your 3D island with palm trees, huts, windmills and lighthouses. Modes: Campaign with 100 levels on 8 islands, and a Daily puzzle with streaks. Bonus words, hints and 13 achievements. Languages: English, French, German, Spanish, Italian, Russian. Progress saves automatically.
```

**Controls** (254 characters, limit 350)

```
Desktop: drag across the letters with the mouse and release to submit, or type the letters and press Enter (Backspace deletes). Mobile: drag a finger across the letters and lift to submit. Buttons: Shuffle (free), Hint (one letter) and Reveal (one word).
```

## Ads in this build (GameMonetize SDK)

- `window.SDK_OPTIONS = { gameId, onEvent }` is set, then `https://api.gamemonetize.com/sdk.js` is inserted once while
  the game boots (`<script id="gamemonetize-sdk">` before the first script, as the SDK README's loader does), never
  from a click. If it fails to load (ad blocker, offline), the game plays on without ads.
- `SDK_GAME_PAUSE`: the game pauses and all audio is muted. `SDK_GAME_START`: the game resumes and audio comes back
  through the player's own Music / Sound settings. `SDK_READY`: interstitials can be shown.
- Interstitials (`sdk.showBanner()`) only at the same natural break as the GameDistribution build: the **Next** click
  on a level-complete screen, at most one every ~2 minutes, never during a level, never on a timer. Every request
  settles exactly once (`SDK_GAME_START`, an error, or not started within 8 s), so the game cannot get stuck.
- **No rewarded ads:** the GameMonetize SDK has no rewarded API, so this build has no "Watch an ad" buttons (the
  "not enough coins" offer and the pause-menu button are hidden; hints and reveals are bought with coins earned in
  play).
- No other ad network, no "More games" button, no external links. Saves stay in localStorage
  (`word-islands.save.v1`).

## Rebuild

```sh
npm ci
npm run submission:gamemonetize   # build (dist-gamemonetize/, base ./) + zip + checks
npm run e2e:gamemonetize          # Playwright smoke test of dist-gamemonetize with a stubbed SDK
# images: npm run build:web && npx vite preview --outDir dist/web --port 4173 &  node tools/gamemonetize/images.mjs
```
