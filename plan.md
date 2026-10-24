# Spell Sigils plan

Open and proposed work as of 2026-10-23. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line references are to the files as they were on 2026-10-22.

Remove completed items as the details will be in git history.

## Before the page goes public

51. **Keyboard access.** The filter chips (`js/ui.js` lines 32, 57, 90) and the list items are `div` or `li` elements with click handlers only. Make the chips `<button>` elements with `aria-pressed`, as the toolbar's parchment and max glow toggles already are, let the list take focus with arrow-key navigation and Enter to draw, and give the SVG `role="img"` with an `aria-label` naming the spell.

## Bugs

53. **`particles:false` turns particles on.** `rideComet` sets `withParticles = opts.particles !== true` (`js/sigil.js` line 122). `energyLoop` passes `{particles:false}` (line 243) and still spawns particles. If the settled loops are meant to be particle-free, change the test to `!== false`. This changes the ambient look of every settled sigil, so compare screenshots before and after.

54. **The glyph "pop" is only a fade.** The `pop` keyframe (`js/sigil.js` line 811) turns the SVG `transform` attribute into a CSS transform such as `translate(300,300) scale(0.001,2)`. CSS requires units on `translate`, so Chrome rejects the keyframe (`CSS.supports` returns false) and only the opacity animates. Even if it parsed, it would squash horizontally only, and `'scale(0.001,'.replace(', ',',')` is a no-op. Either animate a wrapper `<g>` with a valid CSS transform and `transform-box: fill-box`, or remove the transform and treat it as a fade.

## Repository and CI

58. **CI on pull requests:** `node --check` on the scripts and `npm test`, which already serves the folder, fails on any page error and compares every sigil with `test/sigils.snapshot`. Pushes to `main` deploy, so the deploy workflow could also run the tests first and stop on a failure.

59. **Scheduled data refresh.** Add a weekly GitHub Actions job that runs `refresh-data.mjs` and opens a pull request when `data/spells.json` changes, with the script's list of additions, removals and changes as the description.

## Polish

60. **Self-host the fonts.** Cinzel and EB Garamond load from Google Fonts (`index.html` line 9), so every visitor makes a third-party request. Both fonts are under the SIL Open Font License, so subsetted WOFF2 files can be served from a `fonts/` folder with their licence texts.

62. **Confirm copy image across browsers.** Copy works on the published https site in Safari, Chrome and Firefox on macOS, and in Safari on iPhone and iPad (confirmed 2026-10-24). An iPad failure seen earlier was the page being reached over plain http, where the clipboard API is missing. Still to confirm: Chrome and Firefox on Android. A missing API already says so in the readout and points to Save image; a write that the browser rejects still only turns the button red, and could say the same.

64. **Share previews.** Add `og:` and Twitter meta tags with a representative sigil image so links unfurl in chat apps. Per-spell previews would need pre-rendered images for all 2018 spells, which a static host can serve but which adds roughly 2000 files to the repo.

67. **Mythic filter.** Add a Mythic chip beside Ritual and Focus (`js/ui.js`, the category chips). Mythic is a trait rather than a category, so it spans all three: of the 33 mythic spells, 17 are rituals, 14 are spells and 2 are focus spells, and 14 have traditions. Ritual and Focus exclude each other and the tradition chips, because a spell has only one category. Mythic could join that group and show all 33, or it could narrow whatever else is selected, so that Mythic with Ritual shows the 17 mythic rituals. The second suits a trait better, but Mythic would then be the only chip in its row that combines with the others, so it should look different or sit on its own row. Item 51 turns the chips into buttons, so do this first or together with it.

71. **Glyphs in the trait pills.** A curated trait's glyph appears in its medallion, but its pill in the readout shows only the name (`.trait-tag.curated`). Drawing the glyph small at the start of the pill would let a reader match each medallion to its trait. Check how it reads at the pills' size, how wide the pills become in the corner layout's 230px traits block, and whether a curated trait can lack a medallion on spells with more curated traits than the ring holds.

72. **Random mode.** A toggle that, a few seconds after a sigil finishes drawing, draws another spell at random from those the current search and filters show, and carries on until switched off. Decide the pause, whether to work through a shuffled queue so nothing repeats until the selection is used up, and that a manual pick or a filter change stops it. The URL already follows each spell drawn. `design.md` lists every use of `Math.random`; add this one.

73. **Help page.** Explain how to read a sigil: what rank, traditions, traits, focus spells, rituals and mythic spells change in the drawing, with examples, and link the symbol atlas (`atlas.html`). It could be a separate `help.html` linked from the sidebar and the phone's top bar, or an overlay. Keep it in step with `design.md`'s Structure section, and carry the Paizo notice.

74. **Copy the animation.** Offer the drawing animation as an animated GIF or a WebM video, whichever proves easier. WebM is probably easier: `MediaRecorder` can record a canvas stream in Chrome and Firefox, and Safari records MP4 instead, but each frame would have to be drawn onto the canvas from the SVG, as `captureSigilSvg` does for a still. A GIF needs an encoder library and is limited to 256 colours, which may band the glow. Browsers can't put a video or GIF on the clipboard, so this is likely a save rather than a copy.

## Sigil design

Every idea below changes existing sigils, so they cost least before the page goes public. `npm test` names exactly which sigils each one moves.

65. **Rank 10 breaks the rules.** Tradition spells are drawn with more precision than cantrips or focus spells, and rank 10 is the exception that breaks that rule. Two candidate treatments: a hand-drawn line quality, with a gentle radial wobble, strokes that overlap themselves where they close and runes on an uneven baseline; and offsetting the main geometry from the center so the sigil reads as slightly misaligned. Rank 10 once had a "reality-fracturing" crack effect, which was removed. The double-ruled polygon on mythic spells is a separate signal tied to the trait, not to rank. Draw any new randomness from a separate seeded stream so each sigil keeps its layout and only its line quality changes. One ring medallion anchors to a polygon vertex, so an offset has to carry through to that placement.

66. **Word spacing in medallion rune bands.** The main bands group their rune marks into words of 2 to 5, but the miniature band around each ring medallion still spaces 5 to 16 marks evenly (`js/sigil.js` line 611). The loop could take the same treatment. At those counts a band holds only two to four words, so render candidates before committing. The word lengths draw from `rng()`, and every spell has at least one ring medallion, so this changes every sigil.

68. **Review the linguistic and incorporeal glyphs.** `GLYPHS.linguistic` is a speech bubble with lines of text, a modern comic and chat convention that looks out of place among the other marks. `GLYPHS.incorporeal` is a domed ghost with two eyes and a zigzag hem, which reads as a Pac-Man ghost. Linguistic is on 33 spells, among them Command and Biting Words; incorporeal is on one, the Aspirational State ritual. Candidates for linguistic: a mouth or tongue with sound marks, a quill, or a line of script on a scroll. For incorporeal: a figure drawn only in a broken or dashed outline, or a trailing wisp with no face. Mock up candidates and compare them against neighbouring glyphs in `atlas.html` for line weight and level of detail. A glyph change alters only the sigils of spells with that trait.

70. **Bands that spell words.** The rune bands are random script: `pickRune` draws each mark from the spell's vocabulary and the word lengths are random. Instead, give each tradition a full alphabet and write real text in a fixed cipher, so the outer band spells the spell's name, repeated round the ring between separator marks the way Sigil Loom's inscription rings repeat their words. The bands would still look like unreadable script, and `atlas.html` could print each tradition's key so a sigil can be decoded. The rune sets are too small for this: arcane and divine have 8 runes and primal 9, so each needs about 17 more, or fewer if rare letters share a rune. Occult already has 29, and its 26 Cosmic Caravan marks give exactly one per letter. Write each band in the alphabet of the tradition whose colour it takes; traditionless spells need a rule of their own, such as cycling through the four alphabets. Inner bands could carry the traits or the tradition. The name could also be written larger than the surrounding script, in a ring of its own, like Sigil Loom's rings of larger glyphs. Keep the focus double-spacing. This changes every sigil.
