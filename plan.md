# Spell Sigils plan

Open and proposed work as of 2026-10-22. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line numbers refer to `index.html` as it was on 2026-10-22.

Remove completed items as the details will be in git history.

## Before the page goes public

48. **Make the layout work on phones.** The sidebar is a fixed 320 px column and `body` has `overflow:hidden` (lines 21 to 23). At 390 px wide the page lays out 602 px wide, can't scroll, and the sigil sits mostly off-screen. Below a breakpoint, stack the stage above the spell list or move the list into a drawer, size `.circle-wrap` from the viewport width, and keep the toolbar clear of the sigil. Verify with Puppeteer screenshots at 390×844, 768×1024 and a desktop size.

49. **Permalinks.** The page draws a random spell on load (line 1597) and never updates the URL. Write `#<slug>` on selection, read it on load and on `hashchange`, and only fall back to a random spell when the hash is empty or unknown. Encode the hash with `encodeURIComponent`, since 127 slugs contain apostrophes. Rendering is deterministic, so a link reproduces the exact sigil. Scroll the selected spell into view in the list.

50. **Paizo notice and data attribution.** Spell names and traits come from `foundryvtt/pf2e`, and the occult runes were traced from Paizo's Cosmic Caravan art. Add the Paizo Community Use Policy notice to the page and the README, credit the pf2e system project as the data source, and check the policy's terms on trademark use before putting "Pathfinder" in any title.

51. **Keyboard access.** The filter chips (lines 1349, 1374, 1406), the max-glow toggle and the list items are `div` or `li` elements with click handlers only. Make chips and toggles `<button>` elements with `aria-pressed`, let the list take focus with arrow-key navigation and Enter to draw, and give the SVG `role="img"` with an `aria-label` naming the spell.

52. **Settle the glow experiments and remove dead code.** TEST #1 (line 208) disables the near-glow merge node. TEST #3 (lines 641, 663, 774) replaced continuous breathing with a one-off flash and left the breathing code commented out. Choose the final behavior and delete the alternative, then remove whatever that leaves unused: `holdWave` (line 574), the `pts.forEach` whose body is entirely commented-out spoke code (line 1199), and the `fadeHalf` timeline branch that nothing schedules.

## Bugs

53. **`particles:false` turns particles on.** `rideComet` sets `withParticles = opts.particles !== true` (line 675). `energyLoop` passes `{particles:false}` (line 796) and still spawns particles. If the settled loops are meant to be particle-free, change the test to `!== false`. This changes the ambient look of every settled sigil, so compare screenshots before and after.

54. **The glyph "pop" is only a fade.** The `pop` keyframe (line 1261) turns the SVG `transform` attribute into a CSS transform such as `translate(300,300) scale(0.001,2)`. CSS requires units on `translate`, so Chrome rejects the keyframe (`CSS.supports` returns false) and only the opacity animates. Even if it parsed, it would squash horizontally only, and `'scale(0.001,'.replace(', ',',')` is a no-op. Either animate a wrapper `<g>` with a valid CSS transform and `transform-box: fill-box`, or remove the transform and treat it as a fade.

42. **Close the circle for rituals.** `isFocus` (line 850) makes every band draw as an open `arcPath` instead of a closed circle, because focus spells can't be scribed to a scroll or wand and so "the circle can't close". The flag is `spell.traditions.length === 0`, which means "traditionless", so 163 of 166 rituals draw open arcs too. Rituals already have their own visual language in caster-scaled extra colors and a ritual badge, and don't need to look structurally incomplete. Narrow the flag to `spell.category === 'focus'` and rename it to match. This changes those 163 ritual sigils.

## Data pipeline

55. **Rebuild full records from the compendium.** `refresh-data.mjs` only refreshes `category`, `casters` and `focusClass`; the other fields came from a one-off export on 2026-08-27. Upstream now has 26 spells missing locally, including Choking Fog, Turnip Lantern and Shadow Form, and no longer has Divine Vessel. Extend the script to build `name`, `rank`, `traditions`, `traits` and `rarity` from each spell file, with these constraints:
    - Preserve every existing slug. 127 keep apostrophes and differ from the compendium file names, and changing them changes those sigils.
    - Give new spells a slug in one documented format, most simply the file name.
    - Map cantrips to rank 0. Upstream stores them as level 1 with a `cantrip` trait.
    - Report additions, removals and field changes, and decide whether a spell removed upstream is dropped or kept. A rename upstream looks like one removal plus one addition and gives the spell a new sigil.
    - Re-run the counts listed in `design.md` afterwards, since the UI depends on them: every traditionless spell is focus or ritual, and no focus spell has a tradition.

47. **Class color manifest.** Each class's hue comes from its position in `FOCUS_CLASS_ORDER` (line 309), so appending a class gives it a golden-angle color without anyone choosing one. Replace this with a hand-edited, checked-in `focus-class-colors.json` that maps each class name to its color. `hueForClass()` reads from it, and `embed-data.mjs` or a small new step bakes it into `index.html` the same way as the spell data. After pulling the class roster from `packs/pf2e/classes`, `refresh-data.mjs` should diff it against the manifest's keys and exit non-zero with a clear error when a class has no color, so a new class can't slip through a script or CI run unnoticed. Seed the manifest with today's golden-angle values so no existing color changes.

45. **Drop the `psychic` glyph.** `GLYPHS.psychic` (line 430, a spiral) makes `psychic` a curated trait, so it can take its own medallion like `fire` or `curse`. All 18 spells with the trait have `focusClass === 'psychic'`. Other class traits such as `witch` or `cleric` also turn up on some of the 74 classless focus spells, but `psychic` has no exceptions, so its medallion only repeats the class badge. The trait list already hides the class trait for the same reason. Remove the entry or exclude `psychic` from the curated pool; either way, those 18 sigils change.

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

65. **Off-center geometry for high ranks.** Rank 10 once had a "reality-fracturing" crack effect, which was removed. A possible replacement is to offset the main geometry from the center so high-rank sigils read as slightly misaligned. The fractured polygon edge on mythic spells is a separate signal tied to the trait, not to rank. Decide whether the offset applies at rank 10 only or scales with rank, and gate any new `rng()` draws on that rank so lower-rank sigils keep their current stream. One ring medallion anchors to a polygon vertex, so the offset has to carry through to that placement.

66. **Word spacing in medallion rune bands.** The main bands group their rune marks into words of 2 to 5, but the miniature band around each ring medallion still spaces 5 to 16 marks evenly (line 1142). The loop could take the same treatment. At those counts a band holds only two to four words, so render candidates before committing. The word lengths draw from `rng()`, and every spell has at least one ring medallion, so this changes every sigil.
