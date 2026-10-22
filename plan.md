# Spell Sigils plan

Open and proposed work as of 2026-10-22. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line references are to the files as they were on 2026-10-22.

Remove completed items as the details will be in git history.

## Before the page goes public

48. **Make the layout work on phones.** The sidebar is a fixed 320 px column and `body` has `overflow:hidden` (`styles.css` lines 9 to 13). At 390 px wide the page lays out 602 px wide, can't scroll, and the sigil sits mostly off-screen. Below a breakpoint, stack the stage above the spell list or move the list into a drawer, size `.circle-wrap` from the viewport width, and keep the toolbar clear of the sigil. The Paizo notice at the foot of the sidebar must stay visible without opening the drawer. The readout sits in the stage's top-right corner from 1400 px wide and under the circle below that (`styles.css`, `.readout`); a phone needs its own place for it. Verify with Puppeteer screenshots at 390×844, 768×1024 and a desktop size.

49. **Permalinks.** The page draws a random spell on load (`js/ui.js` line 293) and never updates the URL. Write `#<slug>` on selection, read it on load and on `hashchange`, and only fall back to a random spell when the hash is empty or unknown. A slug disappears when upstream drops its spell, as Divine Vessel's did on 2026-10-22, so an unknown hash should show a short note that the spell is no longer in the data before drawing a random one. Encode the hash with `encodeURIComponent`, since 125 slugs contain apostrophes, commas or parentheses. Rendering is deterministic, so a link reproduces the same sigil as long as the code and that spell's data haven't changed. Scroll the selected spell into view in the list.

51. **Keyboard access.** The filter chips (`js/ui.js` lines 32, 57, 90), the max-glow toggle and the list items are `div` or `li` elements with click handlers only. Make chips and toggles `<button>` elements with `aria-pressed`, let the list take focus with arrow-key navigation and Enter to draw, and give the SVG `role="img"` with an `aria-label` naming the spell.

52. **Settle the glow experiments and remove dead code.** TEST #1 (`index.html` line 46) disables the near-glow merge node. TEST #3 (`js/sigil.js` lines 88, 110, 221) replaced continuous breathing with a one-off flash and left the breathing code commented out. Choose the final behavior and delete the alternative, then remove whatever that leaves unused: `holdWave` (line 21), the `pts.forEach` whose body is entirely commented-out spoke code (line 668), and the `fadeHalf` timeline branch that nothing schedules.

## Bugs

53. **`particles:false` turns particles on.** `rideComet` sets `withParticles = opts.particles !== true` (`js/sigil.js` line 122). `energyLoop` passes `{particles:false}` (line 243) and still spawns particles. If the settled loops are meant to be particle-free, change the test to `!== false`. This changes the ambient look of every settled sigil, so compare screenshots before and after.

54. **The glyph "pop" is only a fade.** The `pop` keyframe (`js/sigil.js` line 811) turns the SVG `transform` attribute into a CSS transform such as `translate(300,300) scale(0.001,2)`. CSS requires units on `translate`, so Chrome rejects the keyframe (`CSS.supports` returns false) and only the opacity animates. Even if it parsed, it would squash horizontally only, and `'scale(0.001,'.replace(', ',',')` is a no-op. Either animate a wrapper `<g>` with a valid CSS transform and `transform-box: fill-box`, or remove the transform and treat it as a fade.

## Stability

57. **Render regression snapshots.** A sigil depends on the code as well as the spell's name and slug, so a refactor can silently change published images. Add a Puppeteer script that builds a fixed sample of spells and hashes the SVG structure `buildSigil` produces before animations start, which excludes the `Math.random` particle jitter. Compare against a checked-in baseline. The sample should cover every rank, single and multi-tradition spells, traditionless rituals, rituals with traditions, class and classless focus spells, mythic spells, and spells with 7 or more curated traits. Intentional changes update the baseline in the same commit, so the diff shows exactly which spells changed. Also show a small version stamp on the page.

## Repository and CI

58. **CI on pull requests:** `node --check` on the scripts, a Puppeteer smoke test that serves the folder, draws a sample of spells and fails on any console error, and the snapshot comparison from item 57.

59. **Scheduled data refresh.** Add a weekly GitHub Actions job that runs `refresh-data.mjs` and opens a pull request when `data/spells.json` changes, with the script's list of additions, removals and changes as the description.

## Polish

60. **Self-host the fonts.** Cinzel and EB Garamond load from Google Fonts (`index.html` line 9), so every visitor makes a third-party request. Both fonts are under the SIL Open Font License, so subsetted WOFF2 files can be served from a `fonts/` folder with their licence texts.

62. **Confirm copy image across browsers.** The clipboard write has never been confirmed end to end. Test Chrome, Safari and Firefox on desktop and mobile. When `ClipboardItem` is missing or the write is rejected, say so on the button and point to Save image.

64. **Share previews.** Add `og:` and Twitter meta tags with a representative sigil image so links unfurl in chat apps. Per-spell previews would need pre-rendered images for all 2018 spells, which a static host can serve but which adds roughly 2000 files to the repo.

## Sigil design

Both ideas below change existing sigils, so they cost least before the page goes public or once item 57's snapshots can show what moved.

65. **Rank 10 breaks the rules.** Tradition spells are drawn with more precision than cantrips or focus spells, and rank 10 is the exception that breaks that rule. Two candidate treatments: a hand-drawn line quality, with a gentle radial wobble, strokes that overlap themselves where they close and runes on an uneven baseline; and offsetting the main geometry from the center so the sigil reads as slightly misaligned. Rank 10 once had a "reality-fracturing" crack effect, which was removed. The fractured polygon edge on mythic spells is a separate signal tied to the trait, not to rank. Draw any new randomness from a separate seeded stream so each sigil keeps its layout and only its line quality changes. One ring medallion anchors to a polygon vertex, so an offset has to carry through to that placement.

66. **Word spacing in medallion rune bands.** The main bands group their rune marks into words of 2 to 5, but the miniature band around each ring medallion still spaces 5 to 16 marks evenly (`js/sigil.js` line 611). The loop could take the same treatment. At those counts a band holds only two to four words, so render candidates before committing. The word lengths draw from `rng()`, and every spell has at least one ring medallion, so this changes every sigil.
