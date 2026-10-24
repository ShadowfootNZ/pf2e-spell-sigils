# Spell Sigils plan

Open and proposed work as of 2026-10-24. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line references are to the files as they were on 2026-10-22.

Remove completed items as the details will be in git history.

## Repository and CI

58. **CI on pull requests:** `node --check` on the scripts and `npm test`, which already serves the folder, fails on any page error and compares every sigil with `test/sigils.snapshot`. Pushes to `main` deploy, so the deploy workflow could also run the tests first and stop on a failure.

## Polish

60. **Self-host the fonts.** Cinzel and EB Garamond load from Google Fonts (`index.html` line 9), so every visitor makes a third-party request. Both fonts are under the SIL Open Font License, so subsetted WOFF2 files can be served from a `fonts/` folder with their licence texts.

64. **Share previews.** Add `og:` and Twitter meta tags with a representative sigil image so links unfurl in chat apps. Per-spell previews would need pre-rendered images for all 2018 spells, which a static host can serve but which adds roughly 2000 files to the repo.

67. **Mythic filter.** Add a Mythic chip beside Ritual and Focus (`js/ui.js`, the category chips). Mythic is a trait rather than a category, so it spans all three: of the 33 mythic spells, 17 are rituals, 14 are spells and 2 are focus spells, and 14 have traditions. Ritual and Focus exclude each other and the tradition chips, because a spell has only one category. Mythic could join that group and show all 33, or it could narrow whatever else is selected, so that Mythic with Ritual shows the 17 mythic rituals. The second suits a trait better, but Mythic would then be the only chip in its row that combines with the others, so it should look different or sit on its own row. Item 51 turns the chips into buttons, so do this first or together with it.

71. **Glyphs in the trait pills.** A curated trait's glyph appears in its medallion, but its pill in the readout shows only the name (`.trait-tag.curated`). Drawing the glyph small at the start of the pill would let a reader match each medallion to its trait. Check how it reads at the pills' size, how wide the pills become in the corner layout's 230px traits block, and whether a curated trait can lack a medallion on spells with more curated traits than the ring holds.

72. **Random mode.** A toggle that, a few seconds after a sigil finishes drawing, draws another spell at random from those the current search and filters show, and carries on until switched off. Decide the pause, whether to work through a shuffled queue so nothing repeats until the selection is used up, and that a manual pick or a filter change stops it. The URL already follows each spell drawn. `design.md` lists every use of `Math.random`; add this one.

## Sigil design

Every idea below changes existing sigils, so they cost least before the page goes public. `npm test` names exactly which sigils each one moves.

68. **Review the linguistic and incorporeal glyphs.** `GLYPHS.linguistic` is a speech bubble with lines of text, a modern comic and chat convention that looks out of place among the other marks. `GLYPHS.incorporeal` is a domed ghost with two eyes and a zigzag hem, which reads as a Pac-Man ghost. Linguistic is on 33 spells, among them Command and Biting Words; incorporeal is on one, the Aspirational State ritual. Candidates for linguistic: a mouth or tongue with sound marks, a quill, or a line of script on a scroll. For incorporeal: a figure drawn only in a broken or dashed outline, or a trailing wisp with no face. Mock up candidates and compare them against neighbouring glyphs in `atlas.html` for line weight and level of detail. A glyph change alters only the sigils of spells with that trait.

70. **Bands that spell words.** The rune bands are random script: `pickRune` draws each mark from the spell's vocabulary and the word lengths are random. Instead, give each tradition a full alphabet and write real text in a fixed cipher, so the outer band spells the spell's name, repeated round the ring between separator marks the way Sigil Loom's inscription rings repeat their words. The bands would still look like unreadable script, and `atlas.html` could print each tradition's key so a sigil can be decoded. The rune sets are too small for this: arcane and divine have 8 runes and primal 9, so each needs about 17 more, or fewer if rare letters share a rune. Occult already has 29, and its 26 Cosmic Caravan marks give exactly one per letter. Write each band in the alphabet of the tradition whose colour it takes; traditionless spells need a rule of their own, such as cycling through the four alphabets. Inner bands could carry the traits or the tradition. The name could also be written larger than the surrounding script, in a ring of its own, like Sigil Loom's rings of larger glyphs. Keep the focus double-spacing. This changes every sigil.
