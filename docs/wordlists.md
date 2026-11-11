# Word lists, blocklists and letter rules

## Source and method

No dictionary was downloaded. Every list in `tools/wordlists/<lang>.txt` was written for this project
from general knowledge of the language: common, everyday words that a normal adult knows (home, food,
nature, animals, weather, town, school, work, hobbies, simple verbs and adjectives), 3 to 7 letters
long, with many 6- and 7-letter words so the harder letter wheels have plenty of material.

Each file has two sections:

1. **Base forms** (singular nouns, infinitives, adjectives in their dictionary form, everyday function
   words). Only these are used as wheel words and grid words.
2. After the line `#@inflections`: **inflected forms** of common words — plurals, feminine forms,
   frequent verb forms, Russian case forms. They are accepted only as **bonus words**, so players who
   type a natural form (e.g. *cats*, *chats*, *Katzen*, *gatos*, *gatti*, *коты*) are rewarded, while
   the grid always shows base forms. Regular inflections were produced from hand-picked base lists with
   the language's spelling rules (and their exceptions); irregular forms were written by hand. Every
   form was then checked by the same loader and blocklist as the base words.

The lists deliberately exclude:

- proper nouns (names, places, brands) — the loader also rejects any capitalised token,
- abbreviations and words with hyphens or apostrophes (rejected by the loader),
- rare, archaic, technical, slang and regional words,
- offensive, vulgar, sexual, violent, morbid, drug/alcohol/tobacco, gambling, political and religious
  words — including words that are harmless in one country but vulgar in another (e.g. Spanish
  *coger*, *concha*; Italian slang meanings).

`tools/blocklists/<lang>.txt` (250–480 entries per language, with their inflections) lists words that
must never appear in a grid or as a bonus word, even if someone later adds them to a word list. The
loader drops blocklisted words; the validator independently fails CI if any grid word, bonus word or
wheel order is blocklisted. Because letters are folded (accents, Ё), blocklist entries that would also
block an innocent word after folding were left out (e.g. French *rosé* would block *rose*).

`tools/lib/dict.ts` loads the lists: comments (`#`) are stripped, words are normalised with the letter
rules below, filtered to the language alphabet and 3–7 letters, deduplicated, and blocklisted words
removed. `npx tsx tools/count-words.ts` prints the statistics; the validator requires at least 3,000
words per language.

| Language | Words (3–7 letters) | Base forms | Inflected forms | Blocklist |
|---|---|---|---|---|
| English (`en`) | 4,633 | 3,197 | 1,436 | 482 |
| French (`fr`) | 6,427 | 2,600 | 3,827 | 368 |
| German (`de`) | 4,723 | 2,571 | 2,152 | 247 |
| Spanish (`es`) | 7,048 | 2,569 | 4,479 | 396 |
| Italian (`it`) | 7,045 | 2,570 | 4,475 | 259 |
| Russian (`ru`) | 7,402 | 2,749 | 4,653 | 327 |

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

1. 8 islands with 10, 12, 12, 12, 13, 13, 14 and 14 levels (100 per language).
2. A smooth difficulty curve (`tools/levels.config.ts`). The first island is quick and rewarding:
   level 1 has 3 letters and 3 words, levels 2–10 have 4 letters and 3–4 short words. Then the wheel
   grows slowly (5 letters from level 13, 6 from level 36, 7 from level 66) and the grid from 4 to 10
   words by level 95.
3. For each level a base-form word with the target number of letters is picked (never reusing a letter
   set); all base forms that can be spelled from its letters are candidates for the grid.
4. The base word plus a varied mix of the others is laid out as a compact, connected crossword of at
   most 8×8 (`src/core/crossword.ts`); every other spellable word, including inflected forms, becomes
   a bonus word. The wheel letters are shuffled so they never already spell a word.
5. 60 daily puzzles per language (5–6 letters, 5–6 words, letter sets not used by the main levels);
   the game picks one per calendar day.

`npm run levels:validate` re-checks every level independently and writes `docs/levels-report.md`;
CI fails on any error:

- the word list has at least 3,000 words; the pack has 8 islands of 10–15 levels and 60 daily puzzles,
- every grid word is a base form, every grid and bonus word is in the word list and not blocklisted,
- every word uses only the wheel letters (respecting letter counts),
- the crossword is valid (every horizontal/vertical run of letters is exactly one placed word, no
  conflicts, no accidental words) and connected, within the 8×8 size limit,
- every spellable dictionary word is either in the grid or a bonus word,
- island/stage numbering matches the island sizes,
- difficulty grows smoothly (no jump of more than one letter or two words between levels, never above
  the curve).

CI also regenerates the packs and fails if the committed JSON differs from the generator output.
