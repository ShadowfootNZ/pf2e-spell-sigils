# Spell Sigils plan

Open and proposed work as of 2026-10-22. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line numbers refer to `index.html` as it was on 2026-10-22.

Remove completed items as the details will be in git history.

## Before the page goes public

48. **Make the layout work on phones.** The sidebar is a fixed 320 px column and `body` has `overflow:hidden` (lines 21 to 23). At 390 px wide the page lays out 602 px wide, can't scroll, and the sigil sits mostly off-screen. Below a breakpoint, stack the stage above the spell list or move the list into a drawer, size `.circle-wrap` from the viewport width, and keep the toolbar clear of the sigil. The Paizo notice at the foot of the sidebar must stay visible without opening the drawer. Verify with Puppeteer screenshots at 390×844, 768×1024 and a desktop size.

49. **Permalinks.** The page draws a random spell on load (line 1624) and never updates the URL. Write `#<slug>` on selection, read it on load and on `hashchange`, and only fall back to a random spell when the hash is empty or unknown. Encode the hash with `encodeURIComponent`, since 127 slugs contain apostrophes. Rendering is deterministic, so a link reproduces the exact sigil. Scroll the selected spell into view in the list.

51. **Keyboard access.** The filter chips (lines 1376, 1401, 1433), the max-glow toggle and the list items are `div` or `li` elements with click handlers only. Make chips and toggles `<button>` elements with `aria-pressed`, let the list take focus with arrow-key navigation and Enter to draw, and give the SVG `role="img"` with an `aria-label` naming the spell.

52. **Settle the glow experiments and remove dead code.** TEST #1 (line 218) disables the near-glow merge node. TEST #3 (lines 652, 674, 785) replaced continuous breathing with a one-off flash and left the breathing code commented out. Choose the final behavior and delete the alternative, then remove whatever that leaves unused: `holdWave` (line 585), the `pts.forEach` whose body is entirely commented-out spoke code (line 1226), and the `fadeHalf` timeline branch that nothing schedules.

## Bugs

53. **`particles:false` turns particles on.** `rideComet` sets `withParticles = opts.particles !== true` (line 686). `energyLoop` passes `{particles:false}` (line 807) and still spawns particles. If the settled loops are meant to be particle-free, change the test to `!== false`. This changes the ambient look of every settled sigil, so compare screenshots before and after.

54. **The glyph "pop" is only a fade.** The `pop` keyframe (line 1288) turns the SVG `transform` attribute into a CSS transform such as `translate(300,300) scale(0.001,2)`. CSS requires units on `translate`, so Chrome rejects the keyframe (`CSS.supports` returns false) and only the opacity animates. Even if it parsed, it would squash horizontally only, and `'scale(0.001,'.replace(', ',',')` is a no-op. Either animate a wrapper `<g>` with a valid CSS transform and `transform-box: fill-box`, or remove the transform and treat it as a fade.

42. **Ritual treatment.** Rituals take more time, effort and planning than ordinary spells, and should read that way. Today they differ only through caster-scaled extra colors and a ritual badge, and the 163 traditionless rituals still draw their bands as open arcs (`isTraditionless`, line 867). Those arcs are a leftover from when they meant a focus spell's circle can't close; focus spells now draw no band lines at all. Design the ritual look as a whole and close those arcs as part of it. One idea is a station on the outer ring for each secondary caster: 129 rituals have 1 to 8, and 37 have none.

## Data pipeline

55. **Rebuild full records from the compendium.** `refresh-data.mjs` only refreshes `category`, `casters` and `focusClass`; the other fields came from a one-off export on 2026-08-27. Upstream now has 26 spells missing locally, including Choking Fog, Turnip Lantern and Shadow Form, and no longer has Divine Vessel. Extend the script to build `name`, `rank`, `traditions`, `traits` and `rarity` from each spell file, with these constraints:
    - Preserve every existing slug. 127 keep apostrophes and differ from the compendium file names, and changing them changes those sigils.
    - Give new spells a slug in one documented format, most simply the file name.
    - Map cantrips to rank 0. Upstream stores them as level 1 with a `cantrip` trait.
    - Report additions, removals and field changes, and decide whether a spell removed upstream is dropped or kept. A rename upstream looks like one removal plus one addition and gives the spell a new sigil.
    - Re-run the counts listed in `design.md` afterwards, since the UI depends on them: every traditionless spell is focus or ritual, and no focus spell has a tradition.

47. **Class color manifest.** Each class's hue comes from its position in `FOCUS_CLASS_ORDER` (line 319), so appending a class gives it a golden-angle color without anyone choosing one. Replace this with a hand-edited, checked-in `focus-class-colors.json` that maps each class name to its color. `hueForClass()` reads from it, and `embed-data.mjs` or a small new step bakes it into `index.html` the same way as the spell data. After pulling the class roster from `packs/pf2e/classes`, `refresh-data.mjs` should diff it against the manifest's keys and exit non-zero with a clear error when a class has no color, so a new class can't slip through a script or CI run unnoticed. Seed the manifest with today's golden-angle values so no existing color changes.

56. **Check that the embedded data matches.** Add `node embed-data.mjs --check`, which exits non-zero when the `SPELLS` in `index.html` differs from `spells-data.json`, for use in CI and as a pre-commit check.

## Stability

57. **Render regression snapshots.** A sigil depends on the code as well as the spell's name and slug, so a refactor can silently change published images. Add a Puppeteer script that builds a fixed sample of spells and hashes the SVG structure `buildSigil` produces before animations start, which excludes the `Math.random` particle jitter. Compare against a checked-in baseline. The sample should cover every rank, single and multi-tradition spells, traditionless rituals, rituals with traditions, class and classless focus spells, mythic spells, and spells with 7 or more curated traits. Intentional changes update the baseline in the same commit, so the diff shows exactly which spells changed. Also show a small version stamp on the page.

## Repository and CI

58. **CI on pull requests:** `node --check` on both scripts, the embed check from item 56, a Puppeteer smoke test that draws a sample of spells and fails on any console error, and the snapshot comparison from item 57.

59. **Scheduled data refresh.** Once item 55 makes the refresh complete, add a weekly GitHub Actions job that runs `refresh-data.mjs` and `embed-data.mjs` and opens a pull request when anything changes.

## Polish

60. **Self-host the fonts.** Cinzel and EB Garamond load from Google Fonts (line 9), so offline `file://` use falls back to Georgia and every visitor makes a third-party request. Both fonts are under the SIL Open Font License. Embedding subsetted WOFF2 files as base64 keeps `index.html` a single file; separate font files are simpler but break the single-file property.

61. **Atlas in the repo.** Replace the private Sigil Symbol Atlas artifact with an `atlas.html`, or an atlas mode of `index.html`, that renders directly from `RUNES` and `GLYPHS`. It can't drift out of date, and anyone with the repo can see it.

62. **Confirm copy image across browsers.** The clipboard write has never been confirmed end to end. Test Chrome, Safari and Firefox on desktop and mobile. When `ClipboardItem` is missing or the write is rejected, say so on the button and point to Save image.

64. **Share previews.** Add `og:` and Twitter meta tags with a representative sigil image so links unfurl in chat apps. Per-spell previews would need pre-rendered images for all 1993 spells, which a static host can serve but which adds roughly 2000 files to the repo.

## Sigil design

Both ideas below change existing sigils, so they cost least before the page goes public or once item 57's snapshots can show what moved.

65. **Rank 10 breaks the rules.** Tradition spells are drawn with more precision than cantrips or focus spells, and rank 10 is the exception that breaks that rule. Two candidate treatments: a hand-drawn line quality, with a gentle radial wobble, strokes that overlap themselves where they close and runes on an uneven baseline; and offsetting the main geometry from the center so the sigil reads as slightly misaligned. Rank 10 once had a "reality-fracturing" crack effect, which was removed. The fractured polygon edge on mythic spells is a separate signal tied to the trait, not to rank. Draw any new randomness from a separate seeded stream so each sigil keeps its layout and only its line quality changes. One ring medallion anchors to a polygon vertex, so an offset has to carry through to that placement.

66. **Word spacing in medallion rune bands.** The main bands group their rune marks into words of 2 to 5, but the miniature band around each ring medallion still spaces 5 to 16 marks evenly (line 1169). The loop could take the same treatment. At those counts a band holds only two to four words, so render candidates before committing. The word lengths draw from `rng()`, and every spell has at least one ring medallion, so this changes every sigil.
