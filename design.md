# Spell Sigils design

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. It is a static web app, always served over HTTP: HTML pages, stylesheets, five plain scripts and JSON data files. Every visual choice is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a given spell always produces the same sigil.

`plan.md` tracks open and proposed work.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page markup. Loads `css/base.css`, `css/app.css` and the five scripts. |
| `css/base.css` | What every page shares: the self-hosted fonts' `@font-face` rules, the colour variables with their light values for the system's light setting, the base type and links, and the layout the atlas and help pages share as documents, which they take by `class="doc"` on `<html>`. Loaded first. |
| `css/app.css` | The app's own layout and styling. |
| `fonts/` | Cinzel, EB Garamond (upright and italic) and JetBrains Mono as self-hosted WOFF2 files, with each family's SIL Open Font License. Cinzel is declared from weight 500, so text asking for 400 gets 500. |
| `js/core.js` | Seeded random numbers, colors and SVG helpers. |
| `js/symbols.js` | `GLYPHS`, `SKILL_SIGILS` and `RUNES`, each entry a drawing and the note the atlas shows for it. |
| `js/sigil.js` | `buildSigil`, the sigil's clock, glow and comets. |
| `js/ui.js` | Filters, list, readout, the parchment and max glow toggles, loading the data and startup. |
| `js/export.js` | The Export panel: the sigil as a PNG or as an MP4 or WebM animation, copied, saved or shared. |
| `js/vendor/` | `mp4-muxer` 5.2.2 and `webm-muxer` 5.1.4 by Vanilagy, MIT, vendored unchanged with their licences. They pack encoded video into a file, and load only when an animation is made. Both are deprecated in favour of the much larger, MPL-licensed Mediabunny; the file formats they write don't change. |
| `data/spells.json` | The spell data, one record per line, fetched at startup. |
| `data/classes.json` | The hue for each class's focus spells, in the order classes were first seen. Fetched at startup; the refresh appends new classes. |
| `atlas.html`, `css/atlas.css`, `js/atlas.js` | Symbol atlas: every rune, trait glyph and skill sigil drawn live from `js/symbols.js`, labelled with each symbol's note. No page has inline styles or scripts. |
| `help.html`, `css/help.css` | How to read a sigil and use the page, kept short so the rest is found by exploring, with example links that open the main page on a spell; then Paizo's notice and the credits. A static page, styled by `css/base.css` and `css/help.css`. |
| `share-card.jpg`, `share-card.mjs` | The 1200 by 630 card a link to the site shows in chat apps and social sites: Compel True Name's sigil at rest beside the site's name and tagline. Every spell link shows the same card because its slug follows the `#`, which is never sent to the server. The tags use the deployed image's full address, so they must change if the site moves. `npm run share-card` remakes it after a change that redraws Compel True Name. |
| `refresh-data.mjs` | Updates the sparse clone of `foundryvtt/pf2e` in `.cache/pf2e-pack` and rebuilds `data/spells.json` from it. |
| `test/snapshots.mjs` | Render regression check, run with `npm test`; see Snapshots below. |
| `test/sigils.snapshot` | The baseline: `SIGIL_VERSION`, then one line per spell, its slug and a hash of its sigil. |
| `.github/workflows/deploy-ssh.yml` | On every push to `main`, runs `npm test` and, if it passes, deploys the listed site files over SSH. It unpacks into a fresh folder, moves the live folder aside and moves the fresh one into place. This prevents a mixed set of deployed files, but the two moves leave a brief interval without the live path and a failure of the second move requires recovery. |
| `.htaccess` | Sends `Cache-Control: no-cache`, so browsers revalidate files before using cached copies and are less likely to pair a new page with old scripts. |

The scripts are classic scripts that share globals, loaded in the order above; each one only calls functions from the ones before it, plus `SPELLS`, which `js/ui.js` declares and fills.

## Spell data

### Record shape

```json
{"name":"Fireball","slug":"fireball","rank":3,"traditions":["arcane","primal"],"traits":["concentrate","fire","manipulate"],"rarity":"common","category":"spell"}
{"name":"Bacchanalia","slug":"bacchanalia","rank":6,"traditions":["divine","occult"],"traits":["emotion","mental"],"rarity":"uncommon","category":"ritual","casters":8,"primaryCheck":[{"skill":"occultism","proficiency":null},{"skill":"religion","proficiency":null}],"secondaryChecks":[["performance"]]}
{"name":"Lay on Hands","slug":"lay-on-hands","rank":1,"traditions":[],"traits":["healing","manipulate","vitality"],"rarity":"uncommon","category":"focus","focusClass":"champion"}
```

`casters`, `primaryCheck` and `secondaryChecks` appear only on rituals. `focusClass` appears only on focus spells with a single owning class. `rarity` is stored but deliberately never drawn: Paizo uses rarity to let a GM keep mystery-breaking spells out of a campaign, not to mark a difference in power.

### Field sources

Every field comes from the spell's compendium file, through `refresh-data.mjs`, matched to the existing record by name. Cantrips are stored as rank 0; upstream stores them as level 1 with a `cantrip` trait. The `cantrip` and `focus` traits aren't stored, because rank 0 and the focus category already say the same thing, and upstream leaves `focus` off some focus spells anyway. Existing slugs are carried over instead of being rederived because they identify spells in URLs and form part of the render seed. Traits and traditions are sorted before storage so upstream reordering cannot redraw a sigil on its own.

### Category from the compendium folder

`category` is `spell`, `focus`, `ritual` or `impossible`, taken from the folder a spell's file sits in under `packs/pf2e/spells`: `spells/`, `focus/`, `rituals/` or `impossible-spells/`. Traits are not a reliable signal, because the `focus` trait is missing from some focus spells even in the raw pf2e source.

The interface depends on these properties of the current data, and `refresh-data.mjs` warns if either of the first two stops holding:

- Every traditionless spell is either a focus spell or a ritual. There is no third "innate" or "other" group, which is why the filter has no "other" chip.
- No focus spell has a tradition. A ritual may have traditions.
- Impossible spells have traditions, so the tradition filters reach them.
- `focusClass` is set when exactly one of a focus spell's traits matches a class in `packs/pf2e/classes`, or failing that when the spell sits in a class subfolder of `focus/`. That class trait is then removed from `traits`, since the class badge names it. A focus spell without a single owning class displays as "other"; if upstream adds a class trait, the next refresh picks it up.
- `casters` is the ritual's secondary-caster count. A ritual with no count upstream is stored as 0.

### Ritual checks

Upstream writes a ritual's checks as free text, such as "Arcana or Occultism (expert)" for the primary check and "Arcana or Occultism, Crafting" for the secondary checks. `refresh-data.mjs` turns them into:

- `primaryCheck`: the options open to the primary caster, each `{skill, proficiency}`. Proficiency is `trained`, `expert`, `master`, `legendary` or `mythic`, or `null` when the text names none. A proficiency in brackets covers every option before it that has none of its own.
- `secondaryChecks`: one entry per check, each the list of skills that can satisfy it. A list of one is a required skill, and a longer list is a choice. "Arcana or Occultism, Crafting" is two checks, the first a choice; "A, B, or C" is one choice of three; semicolons separate checks whose options contain commas. The proficiencies three rituals name for secondary checks aren't kept.

A skill is a lowercase skill name, `perception`, a Lore's full name such as `cooking lore` (or `lore` when unnamed), `any`, or a save (`fortitude`, `will`). General rules handle the regular wording. A readings table in the script holds an explicit interpretation of every string they can't, each keyed by its exact upstream text; a few are defined relative to the primary check, such as "whichever is used for the primary check". The refresh warns about any string neither handles and stores `null` for it, and lists readings no ritual uses any more. Synchronize Ley Line gets empty checks, because its skills depend on which ley line is synchronized.

### Slugs and the render seed

A slug identifies a spell in URLs and is part of the render seed, so existing slugs are preserved across refreshes. Some keep punctuation that the compendium file names drop, such as `achaekek's-clutch` against `achaekeks-clutch`. A new spell takes its compendium file name as its slug. When a spell disappears upstream its slug goes with it, so anything that looks a slug up has to handle one that no longer exists.

Any other upstream change may change a sigil; the data isn't kept backward compatible. Traits and traditions are stored in alphabetical order, so upstream reordering a list never redraws a sigil on its own.

### Loading

`js/ui.js` fetches `data/spells.json` and `data/classes.json` at startup, then builds the class filter and list and draws the spell named by the URL, or a random spell when the URL names none. Until then the count line reads "Loading spells…". Preload hints in `index.html` start the downloads with the page rather than after the scripts run. The page is always served over HTTP; opened from `file://`, the fetch fails and the count line says so.

### Refreshing from upstream

```sh
node refresh-data.mjs
```

`refresh-data.mjs` sparse-clones `foundryvtt/pf2e` on its first run. Later runs fetch and hard-reset to the remote tip instead of pulling because upstream may force-push its default branch, which can leave a shallow clone with unrelated history.

Each run prints every addition, removal and field change. Spells gone upstream are dropped.

## Rendering

### Formality by category

Tradition spells are drawn with the most precision: ruled bands, tightly set writing and closed circles. Cantrips and focus spells need less perfection and are drawn more simply; focus spells are personal magic rather than drilled tradition magic. Rituals take more time, effort and planning than ordinary spells, so they are the most formal of all: closed circles plus a ring of caster stations. Rank 10 is drawn like any other rank.

### Determinism

`rngFor(spell)` seeds mulberry32 with an FNV-1a hash of `name + '::' + slug`. Geometry, rune choice, placement and color all draw from that one stream in a fixed order. As a result:

- The same code with the same name and slug always gives the same sigil.
- Changing the number or order of `rng()` calls changes the sigil of every spell whose stream passes that point.
- Adding or removing a rune changes the sigils of spells that draw from that rune's tradition, because that tradition's pool is shuffled at a different size. Reordering runes within a tradition does too. Order across traditions doesn't matter, since each tradition's pool keeps its own runes in array order.
- Adding or removing a glyph changes only the sigils of spells with that trait. The order of `GLYPHS` doesn't matter, because it is only ever looked up by trait name; it is kept alphabetical.
- `Math.random()` is used only for comet particle jitter and for choosing the spell shown when the URL names none.
- Class hues are stored in `data/classes.json`, and the refresh only ever appends to it, so an existing class's hue never changes.

Treat any of these as a visible change to existing sigils.

### Snapshots

`npm test` (`test/snapshots.mjs`) serves the folder, builds every spell's sigil in headless Chrome and compares each with `test/sigils.snapshot`.

- **What's hashed.** The whole `<svg>`, defs included: every element's tag and sorted attributes, plus each element's scheduled animations (delay, duration, iterations, easing, fill and keyframes). The hash is taken as soon as `buildSigil` returns, before any frame runs, so it covers what the code decides and none of the `Math.random` comet jitter that frames add. Decimals are rounded to two places so that last-digit differences in path lengths between Chrome builds don't count. It doesn't depend on the spells built before: the per-spell filter ids restart with each spell.
- **The animation check.** Electric Arc is made as an MP4 and a WebM, and each is played back in a `<video>`: it must load, run longer than 3 seconds at 720 by 720, and leave the page's clock and sigil back to normal. A format the browser can't encode or play, such as H.264 in a Linux Chrome built without it, is skipped and named in the summary, but at least one must be made.
- **The copy check.** Cataclysm, Freedom and Lay on Hands are each left to finish drawing by themselves, one page at a time, since headless Chrome on Linux draws no frames for a page that isn't in front, then the image copy would produce is checked in dark and parchment modes: full size, no comets, nothing undrawn or invisible, and a PNG that decodes at that size. This is the path that lost whole bands while every sigil was unchanged.
- **Changing sigils on purpose.** `npm run test:update` rewrites the baseline; commit it with the change, so the diff names every spell that moved. After publication, if code redraws existing sigils, bump `SIGIL_VERSION` in `js/sigil.js` first, which the page shows in its footer so a saved image can be matched to the rules that drew it. A data refresh that changes some spells' sigils doesn't need a bump. The update warns when existing sigils changed and the version didn't.

### Structure

A sigil is drawn in a 600 by 600 viewBox centred on (300, 300) with an outer radius of about 258. Ring medallions straddle the outer ring and can reach about 30 units past that box, so once the drawing is built `buildSigil` widens the page's viewBox evenly about the centre to the drawing's bounding box plus 6 units for strokes and glow. Most sigils keep the 600 box. One that reaches further is shown up to about 11% smaller, so no medallion is cut off at the stage's edge or runs into the readout under a portrait stage. Exports frame their own box.

- **Rune bands.** A cantrip gets one plain circle, except a focus cantrip, which gets one band. Ranks 1 to 3 get one runic band, ranks 4 to 6 get two and ranks 7 to 10 get three, at 6/6, 4/6 and 2/6 of the outer radius. Each band is an outer and an inner circle 12 units apart with rune marks between them. The marks are grouped into "words" of 2 to 5 at a fixed letter pitch so the band reads as script.
- **Central polygon.** It has `rank + 3` sides, nudged by up to one per spell and clamped to 3 to 12, at 5/6 of the outer radius. From rank 3, star chords join non-adjacent vertices when there are at least 5 sides. From rank 5, a counter-rotated second polygon sits at 3/6.
- **Center.** A medallion holds one trait glyph when the spell is "centered". A containment ring surrounds it, aligned to the innermost band when there are three bands.
- **Ring medallions.** Trait glyphs sit in medallions that straddle the outer band, each with its own miniature rune band. Placement depends on the number of curated traits. One goes to the center. Two go on the ring, 180° apart. With 3 to 6, the spell is centered with 75% probability, and otherwise all of them go on the ring. With 7 or more, the spell is always centered. The ring holds at most 8. Rank also sets a floor of 1 to 3 ring slots, and slots without a glyph get smaller rune-only fillers. One slot is anchored to a polygon vertex and the rest are spaced evenly from it. The outer band leaves a gap under each medallion.
- **Focus spells** draw each band as writing only, with no ruled lines, and double the letter pitch so the writing is spaced like double-spaced lettering. A focus cantrip gets one such band in place of the plain circle, so its medallions still sit on a ring. Medallions keep their lines. With no band lines, the idle comets ride only the polygon.
- **Rituals** are drawn at 78% (`RITUAL_SCALE`) inside a scaled group, so a ring of caster stations fits outside the ring medallions, 92 units beyond the outer band, while the whole sigil stays about the size of any other. The stations are squares:
  - The primary caster stands at the bottom, where they'd read the circle like instructions. Each primary option gets its own square with its skill sigil, side by side, so several read as "choose one". Each square's line shows that option's proficiency: single for trained or none stated, double for expert, double with a thick outer line for master, double with both thick for legendary, triple for mythic. With no stated skill there is one empty square.
  - Secondary stations are spaced evenly round the rest of the ring, one per caster or per secondary skill, whichever is more, at most 8. Skills repeat across extra casters; a skill offered as one of a choice gets a dotted square; with no caster count upstream, the skills stand in for it; a check that accepts any skill leaves its station empty.
  - Each sigil faces the center, as a caster standing there would read it. Magical skills take their tradition's color and other skills the ritual's main color.
  - The station ring is broken around each square so it never runs through a sigil. Stations draw last, the primary first.
  - Each square carries its own placement and stroke rather than inheriting them from a group, because `glowDuplicate` clones a single element into the shared glow layer. The spark that rides a square as it draws reads points in the square's own coordinates, so `rideComet` carries them through the square's transform.
- **Mythic spells**, 33 of them, rule the central polygon twice, like a rune band at half its spacing: a thinner line 6 units outside the polygon, drawn alongside it. `offsetPolygon` shifts each edge outward and joins neighbouring edges where they meet, so every side stays parallel. Outside keeps the star chords ending at the polygon's own corners, and the thin line reads paler than the polygon. It works at every rank, including the two mythic spells below rank 3, which have no chords.

### Symbol vocabularies

- `GLYPHS` maps curated traits to drawings in a 24 by 24 box. A curated trait can take a medallion and is highlighted in the trait list. Class traits get no entry because the class badge already names the class.
- `SKILL_SIGILS` has 20 sigils for ritual caster stations, in the same 24 by 24 box: the 16 skills, Lore, Perception and the Fortitude and Will saves. `skillSigil()` looks one up by the skill name the ritual data uses: every named Lore takes the Lore sigil, and `any` gets none, which leaves its station empty. Kept alphabetical, and only looked up by name.
- Every entry in the three is `{note, draw}`. `draw(g)` draws the symbol into a `<g>`; `note` says what it depicts and, where that isn't obvious, why it stands for its trait or skill, written for the atlas's readers rather than for whoever edits the drawing. `npm test` fails on an entry without both.
- `RUNES` groups 54 small marks by tradition, each in a box of roughly 8 units centred on the origin: 8 arcane, 8 divine, 29 occult and 9 primal. The occult set includes 26 marks simplified from Paizo's Cosmic Caravan art: 13 constellations, the Diaspora, the Sun and 11 planets. The divine runes are deliberately abstract so that none reads as a real-world religious symbol.
- Each spell draws from its own rune vocabulary. A rank-scaled budget is split evenly across its traditions, so occult's larger pool doesn't dominate. Traditionless spells sample all four traditions at half the budget, with a floor of 2 shapes, or 4 for focus spells so their spaced writing doesn't reduce to a two-symbol pattern.

### Color

- `TRAD_HSL` gives each tradition a range of hue, saturation and lightness. Each color slot gets its own jitter within its range.
- `colorSlotTrads` lists a spell's color slots:
  - Multi-tradition spells use their own traditions.
  - Single-tradition spells repeat their tradition, so there are always at least two shades.
  - Rituals use their own traditions or, failing that, the traditions of the magical skills their checks offer (Arcana arcane, Nature primal, Occultism occult, Religion divine; primary check first). A ritual with neither gets two `ritual` slots with full-spectrum hues. Runes follow the same traditions.
  - Class focus spells get two `focus` slots on the class hue.
  - Classless focus spells get two `none` slots from the 312° to 370° gap that clears all four tradition ranges.
- Four elements always draw, and each takes a different slot so every one of a spell's traditions appears somewhere. Band 0 uses `colorAt(0)`, the polygon `colorAt(1)`, the center ring `colorAt(2)` and the first ring medallion `colorAt(3)`.
- Class hues come from `data/classes.json`, spaced by the golden angle (137.50776°) in the order classes were first seen.
- Runes and glyphs use `brightenHsl` of their element's color, and glow halos use `darkenHsl`.

### Animation and glow

- `buildSigil` builds the DOM along with a timeline of `{el, delay, dur, kind}` entries, then plays it with the Web Animations API. Sections run in sequence: bands, polygon, chords, second polygon, center, ring medallions, and for rituals the caster stations. Items within a section overlap in a fast stagger, because a fully serial draw would push high-rank sigils, with up to 64 border marks, past 20 seconds.
- Ring medallions are appended last so they paint on top, but `reserveSatelliteSlot` reserves their timing slot right after the outer band.
- Strokes draw on with a dash-offset animation while a `spark` comet rides the tip.
- Everything else that moves asks `sigilClock` for the time, for frames and for delays rather than asking the page: comets, the glow flash, the idle timer and the ready signal. Normally it's the page's clock plus an offset; making an animation steps it a frame at a time (see the Export panel).
- Glow stays at its floor while the sigil draws, flashes once at `totalEnd` and then goes out, leaving crisp lines. The flash has two parts:
  - the `#sigilGlow` SVG filter on the whole sigil: a wide blur in a darkened version of each line's color, then two chained `feDropShadow` halos in the spell's main color;
  - `glowDuplicate` clones, which are wider blurred copies of each stroke in a shared layer behind everything else.
- `setGlow` sets every part of the filter at once, between `GLOW_FLOOR` and `GLOW_PEAK`, and gives `#sigilRoot` the filter attribute only while the glow shows. `startGlow` raises it over 1.6 seconds, then switches it off in one frame. The clones fade in over 0.9 seconds and straight back out.
- **Resting tint.** At rest the outer `<svg>` carries two 0px CSS drop-shadows in the spell's main color: sharp copies of the drawing laid underneath, which lighten semi-transparent lines and anti-aliased edges toward that color. That is the look every design was approved in, in Chrome. Safari skips a 0px drop-shadow and shows crisp lines. Copied images get the same tint from `#sigilGlow`'s 0px halos, since `captureSigilSvg` always gives the clone the filter.
- **Safari.** Safari ignores CSS filter functions such as `blur()` and `drop-shadow()` on SVG elements, and drops a whole filter list that contains one, so every blur on an SVG element is an SVG filter referenced by attribute. Comets and halos get small ones from `svgBlur` and `svgShadow`, made on first use and cleared with each new spell, using values in the sigil's own units. Safari also draws blurs in software: measured in WebKit at iPad Retina density, a filter over the whole sigil runs at 2 to 4 frames a second against 60 to 100 without, and the flash's per-line halos alone at about 19. So the sigil carries `#sigilGlow` only while the glow shows, and `startGlow` watches its own frame times: after two frames in a row slower than 50ms it ends the flash and sets `glowTooSlow`, after which there is no flash and no per-line halos for the rest of the visit, and max glow holds the sigil still with `setIdleStill`, hiding the comets and pausing the pulses, so the glow is drawn once. On an iPad that costs one hitch of about half a second at the end of the first drawing.
- The generation counter `blurGen` abandons the flash of the previously selected spell.
- After the sigil settles, about a third of its lines pulse in opacity. Faint comets from `energyLoop` circle the outer band, the inner border and the polygon; focus spells have no band lines, so only the polygon comet.

## Interface

- **Layout.**
  - From 700 px wide and 560 px tall, the sidebar sits beside the stage. The footer is a grid item of its own under the sidebar column, not part of the sidebar.
  - The stage is a CSS size container, so the readout follows the stage's own shape rather than the window's width. In a landscape stage the circle fills the stage's height and the readout splits into the corners the circle leaves empty, as described under Readout. In a portrait stage, such as an iPad held upright, the circle is capped at 72% of the height and the stage's width and the readout sits under it.
  - Heights use `svh`, the viewport with the browser's toolbars showing. Safari's `vh` is the height with them hidden, which pushed the bottom of this non-scrolling page off an iPad's screen.
  - Below either size, a phone upright or on its side, the page scrolls instead: a sticky top bar with a Spells button, the sigil at full width, the readout, the toolbar in a row, then the footer, which stays on the page. The sidebar becomes a drawer that slides over the page while `body.drawer-open` is set. Picking a spell, the close button, the backdrop or Escape closes it, and picking a spell also scrolls back to the sigil. In parchment mode the stage, including the top bar, becomes paper.
- **Permalinks.** The URL's hash holds the slug of the spell on show, so a link reproduces its sigil as long as the code and that spell's data haven't changed. `showSpell` replaces the hash rather than adding a history entry, so Back leaves the page, and sets the tab title to the spell's name. The slug is encoded with `encodeURIComponent` plus `!'()*`, which it leaves alone, so a pasted link stays whole in Markdown and chat apps. On load, and when the hash is edited by hand, `showFromHash` draws the named spell and centres it in the list. With no hash it draws a random spell. With a slug that isn't in the data, for example after upstream drops the spell, it draws a random spell and the readout says why.
- **Filters.**
  - Name search.
  - Tradition chips: multi-select, matching any selected tradition.
  - Ritual and Focus chips, exclusive with each other and with the tradition chips.
  - A class row while Focus is active: single select, listing only classes that own a focus spell plus "other".
  - Rank chips.
  - An empty selection means no filter.
  - Every chip is a `<button>` with its state in `aria-pressed`, which the stylesheet keys on, in a labelled group. Rank chips are named "Cantrips" and "Rank 1" to "Rank 10".
- **Keyboard and assistive technology.**
  - The spell list is a listbox and one tab stop. Tab reaches it at its entry item: the current spell if the filters show it, otherwise the first, or the spell last focused there. The arrow keys, Page Up and Down, Home and End move focus through it, and Enter or Space draws the focused spell. Down from the search box enters it.
  - On a phone, the drawer takes focus to its close button when opened by keyboard, not by a tap, which would show a focus ring; closing it returns focus inside it to the Spells button. Escape closes it.
  - Every control shows a focus ring for keyboard focus only (`:focus-visible`).
  - The sigil's `<svg>` is one image, `role="img"`, labelled "Sigil of" and the spell's name. The spell count is a polite live region, so a filter change is announced. The snapshot check ignores `role` and `aria-*`.
- **Readout.**
  - Shows the name, rank, badges and traits. In a landscape stage the toolbar keeps the top-left corner, the name and rank take the top-right, the tradition badges the bottom-left and the traits the bottom-right, each at most 230 px wide. There the name is 1.2rem, or 1rem when it exceeds 24 characters, so that a long name wrapping onto a second line stays clear of the drawing in a nearly square stage such as an iPad's in landscape. In a portrait stage, and on phones, the readout sits centred under the circle.
  - Traditionless spells show their class name, or "other", in place of a tradition badge.
  - Rituals get an extra ritual badge.
  - The trait list hides concentrate, manipulate and the four alignment traits. The `cantrip` and `focus` traits, and a class focus spell's class trait, aren't stored at all.
- **Toolbar.** A row of 34 px icon buttons at the stage's top-left, drawn in the glyphs' line style, each named by its `aria-label` and tooltip. The two display modes come first as toggle buttons that stay lit while on, with `aria-pressed`: parchment, a hanging scroll, and max glow, a sun. After a gap comes Export, an arrow up out of a box, which opens the Export panel and stays lit while it's open.
- **Light and dark.** The sidebar and footer, where a spell is chosen, follow the system's light or dark setting, and so do the help page and the atlas. The stage, where the sigil is drawn, doesn't: it stays dark unless Parchment is chosen. With the system set to light, `css/base.css` redefines the colour variables on `.sidebar`, `.legal` and `html.doc` only, in the parchment mode's paper and ink, so the stage below them keeps the dark values. Everything the sidebar draws reads its colours from those variables, including the search field, chips, hover and selected rows, the pressed rank, the scrollbar and the focus ring. The help page names the traditions in their parchment inks on paper. The atlas's cards stay dark, so each symbol shows as it does in a glowing sigil, and its tradition headings take their inks, which `js/atlas.js` sets beside their bright colours.
- **Parchment mode.** Ink on paper, by CSS alone, so toggling is instant and nothing is redrawn; the JS color system is untouched, and `buildSigil` only marks each part with its ink.
  - The whole stage becomes paper: a faint grain, two soft stains and a light ivory ground darkening a little toward the edges. The sidebar and footer do not follow this toggle; they continue to follow the system colour scheme. The readout, toolbar and phone top bar take ink colours; the tradition badges keep theirs.
  - Each tradition writes in a period ink (`TRAD_INK` in `js/core.js`): indigo for arcane, ochre for divine, violet for occult, verdigris for primal. A colour with no tradition takes an ink made from its own hue by `inkForHue`: a class's focus spells, from the class hue, so every spell of a class shares one ink; traditionless spells and rituals with no tradition, from each colour slot's random hue. `inkForHue` sets the ink in OKLCH, whose lightness looks even across hues, so every class ink is equally dark; plain HSL left blues too bright and yellows too faint. A yellow that dark turns olive, so yellow hues become a lighter gold ink instead. Bard and monk, whose hues are 12° apart, both land on gold. All inks are plain `rgb()` values, so an exported SVG keeps them.
  - Trait glyphs and ritual skill sigils are in red, as rubrication in a manuscript, and anything left unmarked is a warm near-black.
  - `buildSigil` marks each coloured part with `data-ink`: a tradition's name, or `s0` to `s3` for a colour slot with no tradition, whose ink it sets as `--ink-s0` and so on in a `<style>` inside the sigil, which is rebuilt with it and travels with a copied image. An inline style on `#sigilRoot` was tried first, but once removed Chrome leaves an empty `style` attribute behind, which made the first sigil after a reload hash differently. A part is matched to its slot by the hue of its colour, which `brightenHsl` and `darkenHsl` keep exactly; a ritual station for a magical skill matches its tradition's base colour. A draw-on spark takes the mark of the line it rides, so its pen-nib dot is in that line's ink. `npm test` fails if any coloured part of any sigil has no mark.
  - `inkRules` in `js/ui.js` holds the rules, defined once for the page and for copied images. Each mark sets `--ink`, which a part's children inherit, and the rules colour every stroke, fill and `color` with it, overriding the colours the sigil is drawn with as attributes, which any CSS rule outranks. The red parts are found by `data-part="glyph"` and `data-part="skill"`.
  - An inked sigil doesn't glow: the glow filter, the resting tint, the per-line halos and the comets' light all go, and max glow is switched off and disabled. A draw-on spark keeps only its core, as an ink dot riding the tip of each line like a pen nib. Once drawn, the sigil sits still: `setIdleStill('parchment', true)` hides the idle comets, stops their frame loops and rests every pulse at its full opacity.
- **Holding still.** `setIdleStill(reason, still)` keeps a set of reasons, `'parchment'`, `'max glow'` and `'reduced motion'`, and the sigil is held still while any remains. Held still, idle comets (tagged `data-idle`) hide and stop asking for frames, and the line pulses pause at their resting opacity; draw-on sparks carry on.
- **Reduced motion.** When the system asks for reduced motion before a sigil is built, the sigil appears whole: `buildSigil` finishes every draw-on animation as soon as it's made, so each element sits as its drawing leaves it, and fades the whole sigil in over 400 ms instead. There are no draw-on sparks, no flash and no per-line halos, and `setIdleStill('reduced motion', true)` holds the sigil still, so the comets hide and the pulses rest. `sigil-ready` fires once the fade is over. A change to the setting mid-visit affects idle motion and future sigils; finite animations already drawing continue to their end. Max glow still works, as a still glow. The system setting is the only control; the page has no toggle of its own.
- **Max glow.** Holds the glow at `GLOW_PEAK`, the top of the flash, or puts it back to `GLOW_FLOOR`. On a device too slow for the glow it also holds the sigil still while on. A new spell turns it off.
- **Export panel** (`js/export.js`). First what to export, an image (PNG, or in parchment PNG or SVG) or an animation (MP4 or WebM), and for an image whether it has a background, then what to do with it: Copy, Save or Share. The status line under the buttons says what happened. Escape, a click outside or the Export button closes it.
  - **Background.** A checkbox for images, "Dark background" or "Paper background" as the mode has it. Unticked, the image is transparent, to lay over something else: a glowing sigil over a dark page or map, an inked one onto a document. The choice is kept for each mode in `localStorage`, defaulting to transparent for dark and paper for parchment. A dark sigil on a transparent ground nearly vanishes on a white page or in a light chat theme, which the dark background fixes. A video always has its background.
  - **SVG** is offered only in parchment, for documents and print: it scales to any size, where the PNG is at most 1200 px. `sigilSvgFile` bakes the clone (see The image) so it needs no CSS. The glowing sigil isn't offered as SVG: its look is its filters, which programs other than browsers draw unreliably.
  - **Copy** is a PNG only: no browser can put a video on the clipboard, and few take an SVG. It hands `ClipboardItem` a pending promise so the write still counts as part of the click. The clipboard API exists only in a secure context, a page on https or `localhost`; reached over plain http by a network address, as an iPad reaches a dev server on the same network, there is none, and Copy says so and points to Save.
  - **Share** opens the system share sheet, and shows only where `navigator.canShare` accepts the file type. The sheet must open from a tap, so the PNG is made ahead while the panel is open, and an animation, which takes seconds to make, is made on the first tap and shared on a second; the button lights up while one is waiting.
  - **An image** waits for the drawing to finish: `buildSigil` fires `sigil-drawing` when it starts and `sigil-ready` 2 seconds after the drawing ends, once the flash and the per-line halos are over, or straight after the fade with reduced motion, and the image actions follow. The flash and the ready signal count from the first frame after `buildSigil`, when the animations take their start times; counted from the build itself, a background tab, which draws no frames, signalled ready over an undrawn sigil. An animation draws the spell afresh, so it can start any time. The last animation made is kept, for its spell, mode and format, so saving and sharing the same one doesn't make it twice.
- **The image.** `captureSigilSvg` (`sigilSvgClone`):
  - clones the SVG and gives every element in the clone the computed opacity and stroke dash values of the element on screen. The draw-on animations hold elements at their finished state without writing it back, and inline the elements still say "undrawn". `commitStyles()` can't be trusted: once an idle pulse takes over an element's opacity, Chrome drops the finished draw-on animation, so a sigil left to finish drawing by itself copied without its outer band, many runes and the centre glyph;
  - leaves out the comets, which are light passing over the drawing, not part of it;
  - widens the viewBox to the real bounding box plus padding, since medallions overflow the 600 box;
  - gives the clone explicit `width` and `height`, the PNG's size, at most `EXPORT_MAX` (1200 px) on the long side. With only a viewBox an SVG image comes out 150 px tall, and Safari draws its filters at that size before scaling up, which left iPad copies soft, with blurred, doubled-looking lines;
  - gives the clone `#sigilGlow`, so the image carries the resting tint and, with max glow on, the glow;
  - with `ground`, lays the mode's background under the drawing: the page's dark ground, as an animation's frames always have, or the paper as a radial gradient;
  - in parchment mode, embeds `inkRules` as a `<style>` and drops the glow filter;
  - with `bake`, for the SVG file, writes every colour and opacity the element shows on screen as an attribute and embeds no stylesheet, since Word and other programs ignore CSS in SVG. It drops what the ink rules hide, every filter, and the draw-on dashes, keeping only a drawing's own dashes. It never touches an element's `style` property, because Chrome then serializes an empty `style` attribute even after it's removed. The copy check in `npm test` checks the baked SVG has no CSS or filters and only the ink and red colours. librsvg renders it the same as the browser's PNG.
- **The animation.** `makeAnimation` draws the current spell afresh, in the current mode, and records a 720 px square video at 30 frames a second: the drawing from blank, the glow flash, then 2 seconds on the finished sigil with its comets circling, from about 8 seconds for a cantrip to 13 for a rank 10. It's H.264 in MP4, which posts and plays almost everywhere, or VP9 in WebM, which plays in browsers and Discord but not reliably in iMessage, and which X won't take. Neither has a transparent background: no browser but Firefox offers alpha in WebCodecs, and Firefox claims it even for H.264, which can't carry it.
  - Recording live in real time would stutter, since a frame takes 20 to 120 ms to draw. So `sigilClock` steps exactly one frame at a time, firing the timers that fall due and the waiting frame callbacks, and each frame sets every Web Animation in the sigil to its time on the stepped clock, from when it was first seen. A pulse resting paused keeps its place. Each frame is the live sigil's clone, comets kept, in a fixed square around the whole drawing, on an opaque ground, drawn to a canvas and encoded with WebCodecs' `VideoEncoder`; the muxer packs the chunks into the file.
  - The live sigil is hidden while recording, and the panel shows the frames instead: Safari repainting it, filters and all, at every step made a clip take five times as long. The frames leave out the resting tint for the same reason; Safari doesn't show it live either. Made in headless Chrome a 13-second clip takes about 6 seconds, and in WebKit on a Mac about 22. The flash is recorded even on a device too slow to show it live, and the drawing even when the system asks for reduced motion, since it's what was asked for.
  - Safari leaves each encoded chunk's duration empty, which `mp4-muxer` refuses, so MP4 chunks go in with their data and the frame's duration given outright; an error inside the encoder's output callback is kept and rethrown, or it would vanish.
  - A new spell drawn meanwhile, or Cancel, stops it. Every change it makes to the page is inside one `try`, so a failure at any point, even while creating the muxer or the encoder, leaves the page as it was. Afterwards the clock goes back to the page's own, offset so that time carries on from the stepped time, and the waiting frames and timers are handed over, so the sigil is left settled and live.
- **Footer.** Links to the help page, which carries Paizo's notice, the credits and the contact link, and to the symbol atlas, then the sigil version, at the foot of the sidebar column or under the sigil on a phone. The atlas links to the help page for the notice too.

## Licensing

Paizo material is used under Paizo's Community Use Policy. It includes spell names, traits and other game terms, deity and Golarion names, and the occult runes interpreted from Cosmic Caravan artwork. The required public notice and current credits live in `README.md` and `help.html`; every page links to the help page. The tool must remain free, unofficial and separate from Paizo's logos and trade dress.

Public release also requires a source and credit inventory for the Paizo material. It must record the source products and reproduce applicable copyright, trademark, author and artist credits. The Cosmic Caravan reference images used while drawing the runes are not part of the repository.

The original code is MIT-licensed. `LICENSE` contains the standard MIT text, and the README states that the licence does not extend to Paizo material. The pf2e system's Apache license covers its code, not the Pathfinder content extracted from it; the project relies on its own permission to use that content and credits pf2e as the data source.
