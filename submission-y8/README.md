# Word Islands — Y8 submission

- **App ID:** `6af4b1c73c0f1c5e7ad96ecf` · **Game ID:** `292549` (already in the build)
- **Hosting:** direct upload of the zip (Builds tab). Word Islands is a single-player game, so it is uploaded to Y8
  and not iframe-hosted.

## Files to upload

| Y8 Studio tab → slot | File (in this folder) | Spec checked by `tools/y8/check.mjs` |
|---|---|---|
| **Builds** → upload build | `word-islands-y8-v1.zip` | `index.html` at the zip root, relative paths only, about 1.7 MB |
| **Media** → Standard Screenshot (4:3), 4 slots | `media/screenshot-760x570-1.jpg`, `-2.jpg`, `-3.jpg`, `-4.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Widescreen Screenshot (16:9), 4 slots | `media/screenshot-1280x720-1.jpg`, `-2.jpg`, `-3.jpg`, `-4.jpg` | 1280x720 JPG, < 5 MB |
| **Media** → Landscape Promo | `media/promo-landscape-1920x1080.jpg` | 1920x1080 JPG, < 5 MB |
| **Media** → Portrait Promo | `media/promo-portrait-1080x1920.jpg` | 1080x1920 JPG, < 5 MB |
| **Media** → Game Card Promo | `media/promo-card-760x570.jpg` | 760x570 JPG, < 2 MB |
| **Media** → Gameplay Video (16:9) | `media/gameplay-1280x720.mp4` | H.264 MP4 1280x720, 26 s, no sound, < 50 MB |
| **Media** → Gameplay Video (4:3) | `media/gameplay-960x720.mp4` | H.264 MP4 960x720, the same clip, < 50 MB |

Screenshots (the same four real gameplay moments at both sizes, no menus):
1. Windmill Meadows, level 26: a crossword half solved
2. Sunny Lagoon, level 10: the island fully restored ("Splendid!")
3. Sunset Dunes, level 41
4. Blossom Isle, level 77

Promos: the cover scene (a fully restored island) with the Word Islands logo and SAIL letter tiles, as on the other
portals' covers: Sunny Lagoon for the landscape promo, Blossom Isle for the portrait promo, Frost Harbor for the card.

Video: one scripted take of real play, no intro, no edits, no sound. After a second on the menu, Play: the last level
of Sunny Lagoon is solved word by word, the island is fully restored at about 9 s, Next, and the boat sails to Frost
Harbor (about 12–15 s, all inside the first 20 s); the first level there is then solved too ("Wonderful!" at about
24 s). The 960x720 clip
is the same scripted take rendered at 4:3, so the board and wheel stay in frame (a crop of the 16:9 video would cut
them off).

## Basic info (ready to paste)

**Game name**

```
Word Islands
```

**Description**

```
Sail across a sunny archipelago and bring each island back to life with words!

Swipe across the letter wheel to spell words and fill the little crossword. Every solved level grows your 3D island: palm trees, a hut, a windmill, a glowing lighthouse and more. Finish an island and set sail for the next one.

- Campaign: 100 hand-checked levels on 8 islands (Sunny Lagoon, Frost Harbor, Windmill Meadows, Sunset Dunes, Blossom Isle and more)
- Daily puzzle with streaks
- Bonus words, hints, reveals and 13 achievements
- Plays in English, French, German, Spanish, Italian and Russian

Progress is saved automatically. No login needed.
```

**Instructions**

```
Drag across the letters on the wheel and release to make a word (or type the letters on your keyboard and press Enter; Backspace deletes). Words that fit the crossword fly into the grid; fill the whole grid to finish the level and grow your island.

Extra valid words are bonus words and give coins. Shuffle is free, Hint reveals one letter (the first hint in each level is free) and Reveal shows a whole word. Out of coins? "Watch an ad: +25 coins" is optional; nothing in the game needs it.
```

**Controls:** mouse or touch: drag across the letters, release to submit. Keyboard: type the letters, Enter to
submit, Backspace to delete.

**Supported platforms:** Desktop (Windows, macOS, Linux, ChromeOS: mouse and keyboard) and mobile / tablet (Android,
iOS: touch), in any modern browser. Portrait and landscape: the layout adapts to any frame size. Suggested frame
1280x720.

**Category:** Puzzle (Word) · **Tags:** `word, puzzle, crossword, word connect, casual, relaxing, 3d, islands, brain,
vocabulary, family, html5, mobile`

**Languages:** English (default from the browser), French, German, Spanish, Italian, Russian (switchable in Settings).

**Multiplayer:** No. **Login:** not required (guests play everything; a Y8 account is recognised if signed in).
**In-app purchases:** none.

## Ads in this build (Y8 SDK)

- `y8.min.js` is loaded from Y8's CDN only (`<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async>` in
  `<head>`), never bundled, and initialized exactly as the portal snippet: a `y8sdk.ready` listener (once) runs
  `y8Sdk = y8.sdk()`, `y8Sdk.init({ appId, autoLogin: true }, { gameId, preloadAdBreaks: 'on', sound: 'on', onReady })`
  and `y8Sdk.onAuth(…)`, then `window.y8.emitReadyEvent()` in case the SDK had already loaded. No ad call before init.
- Interstitials only after a click, never during a level: `start` on the player's first **Play / Continue** click,
  `next` on **Next** of a level-complete screen and **Main menu** of the daily-puzzle result. No frequency cap of our
  own (the SDK paces them); if no ad is shown, the game goes on at once.
- `beforeAd` pauses the game and mutes all audio; `afterAd` resumes and restores audio through the player's own
  settings. Every request settles exactly once (`adBreakDone`, `.catch()`, or a timeout).
- Rewarded (`reward`): only from the "Watch an ad: +25 coins" button, which states the reward first. `showAdFn()` is
  called in `beforeReward`; the 25 coins are granted only in `adViewed`; `adDismissed` gives nothing; no ad shows
  "No ad available right now, try later" and the game goes on. Nothing essential is behind ads.
- The game pauses and mutes when the page is hidden (`visibilitychange`) or the window loses focus (`blur`) and resumes
  on return.
- With an ad blocker (no SDK) the game is fully playable and shows no "Watch an ad" button.
- No other ad network, no "More games" button, no external links. Saves stay in localStorage (`word-islands.save.v1`).

## Rebuild

```sh
npm ci
npm run submission:y8   # build (dist-y8/, base ./) + zip + checks
npm run e2e:y8          # Playwright smoke test of dist-y8 with a stubbed SDK
# media: npm run build:web && npx vite preview --outDir dist/web --port 4173 &  node tools/y8/media.mjs
```
