# Word lists, blocklists and letter rules

## Source and method

No dictionary was downloaded. Every list in `tools/wordlists/<lang>.txt` was written by hand for this
project: common, everyday words that a normal adult knows (household objects, food, nature, animals,
weather, places, simple verbs and adjectives), 3 to 7 letters long, chosen with an eye on words that
combine well on a letter wheel (anagram families such as *stare/tears/rates*). The lists deliberately
exclude:

- proper nouns (names, places, brands) — the loader also rejects any capitalised token,
- abbreviations and words with hyphens or apostrophes (rejected by the loader),
- offensive, vulgar, sexual, violent, drug/alcohol-related, political and religious words.

On top of that, `tools/blocklists/<lang>.txt` lists words that must never appear in a grid or as a
bonus word, even if someone later adds them to a word list. The loader drops blocklisted words, and the
validator independently fails CI if any grid or bonus word is blocklisted.

Each list is loaded by `tools/lib/dict.ts`: comments (`#`) are stripped, words are normalised with the
letter rules below, filtered to the language alphabet and 3–7 letters, deduplicated, and blocklisted
words removed. The levels report (`docs/levels-report.md`) shows the resulting list sizes.

| Language | Status in Phase A |
|---|---|
| English (`en`) | word list + blocklist + 3 levels |
| French (`fr`) | word list + blocklist + 3 levels |
| Russian (`ru`) | word list + blocklist + 3 levels |
| German, Spanish, Italian | UI translated; word lists and levels come in Phase B |

## Letter rules per language (one rule each, applied everywhere)

The same `normalizeWord()` function (`src/core/alphabet.ts`) is used for the word lists, the generated
levels and the player's keyboard input, so the display letters, the grid and typing always agree.

| Language | Rule |
|---|---|
| English | A–Z only. |
| French | Accents are folded: the wheel shows unaccented letters (É/È/Ê/Ë→E, À/Â→A, Ç→C, Î/Ï→I, Ô→O, Ù/Û/Ü→U), ligatures are expanded (Œ→OE, Æ→AE). Typing *é* or *e* both enter E. |
| German | Ä, Ö, Ü are distinct wheel letters (they have their own keys on QWERTZ). ß is written SS (the standard uppercase spelling), so *Straße* becomes STRASSE. |
| Spanish | Accents are folded (Á→A, É→E, Í→I, Ó→O, Ú/Ü→U); Ñ stays a distinct letter. |
| Italian | Accents are folded (À→A, È/É→E, Ì→I, Ò→O, Ù→U). |
| Russian | Cyrillic А–Я. Ё is treated as Е (in the word lists, the grid and typing); Й stays a distinct letter. |

## Keyboard input

The game reads `KeyboardEvent.key` (the character the layout produces), never `code`, so AZERTY,
QWERTZ and Cyrillic layouts all work; the typed character goes through the same normalisation.
Enter submits, Backspace removes the last letter; Escape is never used for game actions.

## Levels

`npm run levels:generate` builds `src/data/levels/<lang>.json` deterministically from the word list:

1. A smooth difficulty curve (`tools/levels.config.ts`): level 1 has 3 letters / 3 words, then letters
   grow 4 → 7 and grid words 3 → 10 over about 90 levels.
2. For each level a base word with the target number of letters is picked (never reusing a letter set);
   all dictionary words that can be spelled from its letters are collected.
3. The base word plus a varied mix of the others is laid out as a compact, connected crossword
   (`src/core/crossword.ts`); all remaining spellable words become the level's bonus words.

`npm run levels:validate` re-checks every level independently and writes `docs/levels-report.md`;
CI fails on any error:

- every grid word and bonus word is in the word list and not blocklisted,
- every word uses only the wheel letters (respecting letter counts),
- the crossword is valid (every horizontal/vertical run of letters is exactly one placed word, no
  conflicts, no accidental words) and connected, within the 8×8 size limit,
- every spellable dictionary word is either in the grid or a bonus word,
- island/stage numbering matches the island sizes,
- difficulty grows smoothly (no jump of more than one letter or two words between levels, never above
  the curve).

CI also regenerates the packs and fails if the committed JSON differs from the generator output.
