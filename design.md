# Spell Sigils design

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. It is a static web app, always served over HTTP: an HTML page, a stylesheet, four plain scripts and a JSON data file. Every visual choice is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a given spell always produces the same sigil.

`plan.md` tracks open and proposed work.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page markup. Loads the stylesheet and the four scripts. |
| `styles.css` | All styling. |
| `js/core.js` | Seeded random numbers, colors and SVG helpers. |
| `js/symbols.js` | `GLYPHS`, `SKILL_SIGILS` and `RUNES`, each entry a drawing and the note the atlas shows for it. |
| `js/sigil.js` | `buildSigil`, the sigil's clock, glow and comets. |
| `js/ui.js` | Filters, list, readout, the parchment and max glow toggles, loading the data and startup. |
| `js/export.js` | The Export panel: the sigil as a PNG or as an MP4 or WebM animation, copied, saved or shared. |
| `js/vendor/` | `mp4-muxer` 5.2.2 and `webm-muxer` 5.1.4 by Vanilagy, MIT, vendored unchanged with their licences. They pack encoded video into a file, and load only when an animation is made. Both are deprecated in favour of the much larger, MPL-licensed Mediabunny; the file formats they write don't change. |
| `data/spells.json` | The spell data, one record per line, fetched at startup. |
| `data/classes.json` | The hue for each class's focus spells, in the order classes were first seen. Fetched at startup; the refresh appends new classes. |
| `atlas.html` | Symbol atlas: every rune, trait glyph and skill sigil drawn live from `js/symbols.js`, labelled with each symbol's note. |
| `help.html` | How to read a sigil and use the page, kept short so the rest is found by exploring, with example links that open the main page on a spell; then Paizo's notice and the credits. A static page with its own styles, like the atlas. |
| `favicon*` | The site icon, a pair of footprints, as `favicon.ico` (16 and 32px) and PNGs at 16, 32, 192 and 512px. Both pages link the ICO, the 32 and the 192, which is also the iPhone home-screen icon; the 512 waits for a web app manifest. |
| `refresh-data.mjs` | Updates the sparse clone of `foundryvtt/pf2e` in `.cache/pf2e-pack` and rebuilds `data/spells.json` from it. |
| `test/snapshots.mjs` | Render regression check, run with `npm test`; see Snapshots below. |
| `test/sigils.snapshot` | The baseline: `SIGIL_VERSION`, then one line per spell, its slug and a hash of its sigil. |
| `package.json` | Development tooling only, Puppeteer for the snapshot check; the site has no dependencies or build step. Not deployed. |
| `plan.md` | Open and proposed work, as numbered items. |
| `README.md` | Public overview, usage, the Paizo notice and credits. |
| `LICENSE` | MIT License for the original code. |
| `catalogue.json` | The app's entry in the apps catalogue at apps.shadowfoot.com, read by the apps-site repository. Not deployed. |
| `docs/` | Catalogue images named in `catalogue.json`. Not deployed. |
| `.github/workflows/deploy-ssh.yml` | On every push to `main`, runs `npm test` and, if it passes, deploys the pages, stylesheet, scripts, data, icons and `.htaccess` over SSH. Each deploy is unpacked into a fresh folder beside the live one, which then takes its place, so the server holds exactly the listed files and no visitor gets half of one deploy. |
| `.htaccess` | Sends `Cache-Control: no-cache`, so browsers check every file for a newer copy before using a cached one, and a new page is never paired with old scripts. Apache sent no caching header before, which let browsers reuse files for hours after a deploy. |
| `.cache/` | Gitignored, disposable sparse clone of `packs/pf2e/spells` and `packs/pf2e/classes`. |

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

Every field comes from the spell's compendium file, through `refresh-data.mjs`, matched to the existing record by name. Cantrips are stored as rank 0; upstream stores them as level 1 with a `cantrip` trait. The `cantrip` and `focus` traits aren't stored, because rank 0 and the focus category already say the same thing, and upstream leaves `focus` off some focus spells anyway. Two things are carried over from the existing record instead of being rederived, because a sigil depends on them:

- the slug (see below);
- the order of traits and traditions, whenever the set itself is unchanged. Glyph placement shuffles the curated traits in stored order, and colors cycle through traditions in stored order, so a reordering alone would redraw the sigil.

### Category from the compendium folder

`category` is `spell`, `focus`, `ritual` or `impossible`, taken from the folder a spell's file sits in under `packs/pf2e/spells`: `spells/`, `focus/`, `rituals/` or `impossible-spells/`. Traits are not a reliable signal, because the `focus` trait is missing from some focus spells even in the raw pf2e source.

The data from the 2026-10-22 refresh has 2018 records: 1294 spells, 551 focus spells, 168 rituals and 5 impossible spells. The interface depends on these facts about it, and `refresh-data.mjs` warns if either of the first two stops holding:

- Every traditionless spell is either a focus spell (551) or a ritual (165). There is no third "innate" or "other" group, which is why the filter has no "other" chip.
- No focus spell has a tradition. Three rituals do: Aspirational State, Bacchanalia and Mother's Blessing.
- All five impossible spells have traditions, so the tradition filters reach them.
- `focusClass` is set when exactly one of a focus spell's traits matches a class in `packs/pf2e/classes`, or failing that when the spell sits in a class subfolder of `focus/` (magus, necromancer, summoner and wizard have one). That class trait is then removed from `traits`, since the class badge names it. 15 of the 29 classes own at least one focus spell. The 74 focus spells without a single owning class display as "other". Upstream misses some: Archives of Nethys lists Wildfire as a druid spell, and the eight *Rage of Elements* order spells it belongs to look like druid spells too, but the pf2e data gives them no class trait. Class-less focus spells stay under "other"; if upstream adds a class trait, the next refresh picks it up.
- `casters` is the ritual's secondary-caster count. Four rituals have no count upstream and are stored as 0.

### Ritual checks

Upstream writes a ritual's checks as free text, such as "Arcana or Occultism (expert)" for the primary check and "Arcana or Occultism, Crafting" for the secondary checks. `refresh-data.mjs` turns them into:

- `primaryCheck`: the options open to the primary caster, each `{skill, proficiency}`. Proficiency is `trained`, `expert`, `master`, `legendary` or `mythic`, or `null` when the text names none. A proficiency in brackets covers every option before it that has none of its own.
- `secondaryChecks`: one entry per check, each the list of skills that can satisfy it. A list of one is a required skill, and a longer list is a choice. "Arcana or Occultism, Crafting" is two checks, the first a choice; "A, B, or C" is one choice of three; semicolons separate checks whose options contain commas. The proficiencies three rituals name for secondary checks aren't kept.

A skill is a lowercase skill name, `perception`, a Lore's full name such as `cooking lore` (or `lore` when unnamed), `any`, or a save (`fortitude`, `will`). General rules handle the regular wording. A readings table in the script holds an explicit interpretation of every string they can't, 29 of them, each keyed by its exact upstream text; a few are defined relative to the primary check, such as "whichever is used for the primary check". The refresh warns about any string neither handles and stores `null` for it, and lists readings no ritual uses any more. Synchronize Ley Line gets empty checks, because its skills depend on which ley line is synchronized.

From the 2026-10-22 data: every one of the 16 skills appears, along with Perception, `any`, Fortitude, Will and 26 named Lores. Rituals have 0 to 4 primary options and 0 to 7 secondary skills. 15 rituals list secondary checks but have no casters, and Owb Pact and Synchronize Ley Line have casters but no checks.

### Slugs and the render seed

A slug identifies a spell in URLs and is part of the render seed, so existing slugs are preserved across refreshes. 125 of them keep punctuation that the compendium file names drop: 120 apostrophes, such as `achaekek's-clutch` against `achaekeks-clutch`, and commas or parentheses in five more, such as `hop,-skip,-jump`. A new spell takes its compendium file name as its slug. When a spell disappears upstream its slug goes with it, so anything that looks a slug up has to handle one that no longer exists.

Any other upstream change may change a sigil; the data isn't kept backward compatible. Traits and traditions are stored in alphabetical order, so upstream reordering a list never redraws a sigil on its own.

### Loading

`js/ui.js` fetches `data/spells.json` and `data/classes.json` at startup, then builds the class filter, the list and a random first sigil; until then the count line reads "Loading spells…". A preload hint in `index.html` starts the download with the page rather than after the scripts run. The page is always served over HTTP; opened from `file://`, the fetch fails and the count line says so. The file is 360 KB, or 43 KB gzipped.

### Refreshing from upstream

```sh
node refresh-data.mjs
```

`refresh-data.mjs` sparse-clones `foundryvtt/pf2e` on its first run. Later runs fetch and hard-reset to the remote tip instead of pulling. Upstream force-pushes its default branch, `v14-dev`, and after that `git pull` on a shallow clone fails with "refusing to merge unrelated histories". This was reproduced against the old cache on 2026-10-22.

Each run prints every addition, removal and field change. Spells gone upstream are dropped. The 2026-10-22 refresh added 26 spells, including two rituals, dropped Divine Vessel, and changed three: Corpse Bloom's rank, and one trait each on Ash Form and Consecrate Flesh.

## Rendering

### Formality by category

Tradition spells are drawn with the most precision: ruled bands, tightly set writing and closed circles. Cantrips and focus spells need less perfection and are drawn more simply; focus spells are personal magic rather than drilled tradition magic. Rituals take more time, effort and planning than ordinary spells, so they are the most formal of all: closed circles plus a ring of caster stations. Rank 10 is drawn like any other rank: a hand-drawn line quality was tried for it, and for mythic spells, and rejected on 2026-10-23.

### Determinism

`rngFor(spell)` seeds mulberry32 with an FNV-1a hash of `name + '::' + slug`. Geometry, rune choice, placement and color all draw from that one stream in a fixed order. As a result:

- The same code with the same name and slug always gives the same sigil.
- Changing the number or order of `rng()` calls changes the sigil of every spell whose stream passes that point.
- Adding or removing a rune changes the sigils of spells that draw from that rune's tradition, because that tradition's pool is shuffled at a different size. Reordering runes within a tradition does too. Order across traditions doesn't matter, since each tradition's pool keeps its own runes in array order.
- Adding or removing a glyph changes only the sigils of spells with that trait. The order of `GLYPHS` doesn't matter, because it is only ever looked up by trait name; it is kept alphabetical.
- `Math.random()` is used only for comet particle jitter and for choosing the spell shown when the URL names none.
- Class hues are stored in `data/classes.json`, and the refresh only ever appends to it, so an existing class's hue never changes.

Once images are shared publicly, treat any of these as a visible change to existing sigils.

### Snapshots

`npm test` (`test/snapshots.mjs`) serves the folder, builds every spell's sigil in headless Chrome and compares each with `test/sigils.snapshot`. It takes about 35 seconds.

- **What's hashed.** The whole `<svg>`, defs included: every element's tag and sorted attributes, plus each element's scheduled animations (delay, duration, iterations, easing, fill and keyframes). The hash is taken as soon as `buildSigil` returns, before any frame runs, so it covers what the code decides and none of the `Math.random` comet jitter that frames add. Decimals are rounded to two places so that last-digit differences in path lengths between Chrome builds don't count. It doesn't depend on the spells built before: the per-spell filter ids restart with each spell.
- **The animation check.** Electric Arc is made as an MP4 and a WebM, and each is played back in a `<video>`: it must load, run longer than 3 seconds at 720 by 720, and leave the page's clock and sigil back to normal. A format the browser can't encode or play, such as H.264 in a Linux Chrome built without it, is skipped and named in the summary, but at least one must be made.
- **The copy check.** Cataclysm, Freedom and Lay on Hands are each left to finish drawing by themselves, one page at a time, since headless Chrome on Linux draws no frames for a page that isn't in front, then the image copy would produce is checked in dark and parchment modes: full size, no comets, nothing undrawn or invisible, and a PNG that decodes at that size. This is the path that lost whole bands while every sigil was unchanged.
- **Changing sigils on purpose.** `npm run test:update` rewrites the baseline; commit it with the change, so the diff names every spell that moved. Once the page is public, if code redrew existing sigils, bump `SIGIL_VERSION` in `js/sigil.js` first, which the page shows in its footer so a saved image can be matched to the rules that drew it. Until then no one holds a saved image, so changes before launch keep version 1, the rules the page launches with. A data refresh that changes some spells' sigils doesn't need a bump. The update warns when existing sigils changed and the version didn't.

### Structure

A sigil is drawn in a 600 by 600 viewBox centred on (300, 300) with an outer radius of about 258.

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

- `GLYPHS` has 57 entries mapping a trait to a drawing in a 24 by 24 box. A trait with an entry is "curated": it can take a medallion and is highlighted in the trait list. Class traits get no entry, because the class badge already names the class; `psychic` had one until 2026-10-22. 1463 of the 2018 spells have at least one curated trait.
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
- Class hues come from `data/classes.json`, spaced by the golden angle (137.50776°) in the order classes were first seen. A plain name hash had put necromancer and sorcerer on the same hue.
- Runes and glyphs use `brightenHsl` of their element's color, and glow halos use `darkenHsl`.

### Animation and glow

- `buildSigil` builds the DOM along with a timeline of `{el, delay, dur, kind}` entries, then plays it with the Web Animations API. Sections run in sequence: bands, polygon, chords, second polygon, center, ring medallions, and for rituals the caster stations. Items within a section overlap in a fast stagger, because a fully serial draw would push high-rank sigils, with up to 64 border marks, past 20 seconds.
- Ring medallions are appended last so they paint on top, but `reserveSatelliteSlot` reserves their timing slot right after the outer band.
- Strokes draw on with a dash-offset animation while a `spark` comet rides the tip.
- Everything else that moves asks `sigilClock` for the time, for frames and for delays rather than asking the page: comets, the glow flash, the idle timer and the ready signal. Normally it's the page's clock plus an offset; making an animation steps it a frame at a time (see the Export panel).
- Glow stays at its floor while the sigil draws, flashes once at `totalEnd` and then goes out, leaving crisp lines. The flash has two parts:
  - the `#sigilGlow` SVG filter on the whole sigil: a wide blur in a darkened version of each line's color, then two chained `feDropShadow` halos in the spell's main color;
  - `glowDuplicate` clones, which are wider blurred copies of each stroke in a shared layer behind everything else.
- `setGlow` sets every part of the filter at once, between `GLOW_FLOOR` and `GLOW_PEAK`, and gives `#sigilRoot` the filter attribute only while the glow shows. `startGlow` raises it over 1.6 seconds, then switches it off in one frame. The clones fade in over 0.9 seconds and straight back out. Continuous breathing and a tight bright near-line blur were tried and dropped on 2026-10-23.
- **Resting tint.** At rest the outer `<svg>` carries two 0px CSS drop-shadows in the spell's main color: sharp copies of the drawing laid underneath, which lighten semi-transparent lines and anti-aliased edges toward that color. That is the look every design was approved in, in Chrome. Safari skips a 0px drop-shadow and shows crisp lines. Copied images get the same tint from `#sigilGlow`'s 0px halos, since `captureSigilSvg` always gives the clone the filter.
- **Safari.** Safari ignores CSS filter functions such as `blur()` and `drop-shadow()` on SVG elements, and drops a whole filter list that contains one, so every blur on an SVG element is an SVG filter referenced by attribute. Comets and halos get small ones from `svgBlur` and `svgShadow`, made on first use and cleared with each new spell; their numbers are the old CSS ones, which Chrome applied in the sigil's own units. Safari also draws blurs in software: measured in WebKit at iPad Retina density, a filter over the whole sigil runs at 2 to 4 frames a second against 60 to 100 without, and the flash's per-line halos alone at about 19. So the sigil carries `#sigilGlow` only while the glow shows, and `startGlow` watches its own frame times: after two frames in a row slower than 50ms it ends the flash and sets `glowTooSlow`, after which there is no flash and no per-line halos for the rest of the visit, and max glow holds the sigil still with `setIdleStill`, hiding the comets and pausing the pulses, so the glow is drawn once. On an iPad that costs one hitch of about half a second at the end of the first drawing.
- The generation counter `blurGen` abandons the flash of the previously selected spell.
- After the sigil settles, about a third of its lines pulse in opacity. Faint comets from `energyLoop` circle the outer band, the inner border and the polygon; focus spells have no band lines, so only the polygon comet.

## Interface

- **Layout.**
  - From 700 px wide and 560 px tall, the sidebar sits beside the stage. The footer is a grid item of its own under the sidebar column, not part of the sidebar.
  - The stage is a CSS size container, so the readout follows the stage's own shape rather than the window's width. In a landscape stage the circle fills the stage's height and the readout splits into the corners the circle leaves empty, as described under Readout. In a portrait stage, such as an iPad held upright, the circle is capped at 72% of the height and the stage's width and the readout sits under it.
  - Heights use `svh`, the viewport with the browser's toolbars showing. Safari's `vh` is the height with them hidden, which pushed the bottom of this non-scrolling page off an iPad's screen.
  - Below either size, a phone upright or on its side, the page scrolls instead: a sticky top bar with a Spells button, the sigil at full width, the readout, the toolbar in a row, then the footer, which stays on the page. The sidebar becomes a drawer that slides over the page while `body.drawer-open` is set. Picking a spell, the close button, the backdrop or Escape closes it, and picking a spell also scrolls back to the sigil. In parchment mode the whole page above the Paizo notice, top bar included, becomes paper.
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
  - Shows the name, rank, badges and traits. In a landscape stage the toolbar keeps the top-left corner, the name and rank take the top-right, the tradition badges the bottom-left and the traits the bottom-right, each at most 230 px wide. There the name is 1.2rem, and the 43 names over 24 characters 1rem, so that a long name wrapping onto a second line stays clear of the drawing in a nearly square stage such as an iPad's in landscape. In a portrait stage, and on phones, the readout sits centred under the circle.
  - Traditionless spells show their class name, or "other", in place of a tradition badge.
  - Rituals get an extra ritual badge.
  - The trait list hides concentrate, manipulate and the four alignment traits. The `cantrip` and `focus` traits, and a class focus spell's class trait, aren't stored at all.
- **Toolbar.** A row of 34 px icon buttons at the stage's top-left, drawn in the glyphs' line style, each named by its `aria-label` and tooltip. The two display modes come first as toggle buttons that stay lit while on, with `aria-pressed`: parchment, a hanging scroll, and max glow, a sun. After a gap comes Export, an arrow up out of a box, which opens the Export panel and stays lit while it's open.
- **Parchment mode.** Ink on paper, by CSS alone, so toggling is instant and nothing is redrawn; the JS color system is untouched.
  - The whole stage becomes paper: a faint grain, two soft stains and a cream ground darkening toward the edges. The sidebar and the footer stay dark. The readout, toolbar and phone top bar take ink colours; the tradition badges keep theirs.
  - The sigil is drawn in a warm near-black ink, with trait glyphs and ritual skill sigils in red, as rubrication in a manuscript. Rune-only filler medallions stay in ink. `inkRules` in `js/ui.js` holds these rules, defined once for the page and for copied images. They find the red parts by `data-part="glyph"` and `data-part="skill"`, which `buildSigil` sets, and override the colours the sigil is drawn with as attributes, which any CSS rule outranks.
  - An inked sigil doesn't glow: the glow filter, the resting tint, the per-line halos and the comets' light all go, and max glow is switched off and disabled. A draw-on spark keeps only its core, as an ink dot riding the tip of each line like a pen nib. Once drawn, the sigil sits still: `setIdleStill('parchment', true)` hides the idle comets, stops their frame loops and rests every pulse at its full opacity.
- **Holding still.** `setIdleStill(reason, still)` keeps a set of reasons, `'parchment'`, `'max glow'` and `'reduced motion'`, and the sigil is held still while any remains. Held still, idle comets (tagged `data-idle`) hide and stop asking for frames, and the line pulses pause at their resting opacity; draw-on sparks carry on.
- **Reduced motion.** When the system asks for reduced motion, each sigil appears whole: `buildSigil` finishes every draw-on animation as soon as it's made, so each element sits as its drawing leaves it, and fades the whole sigil in over 400 ms instead. There are no draw-on sparks, no flash and no per-line halos, and `setIdleStill('reduced motion', true)` holds the sigil still, so the comets hide and the pulses rest. `sigil-ready` fires once the fade is over. The page follows a change to the setting mid-visit. Max glow still works, as a still glow. The system setting is the only control; the page has no toggle of its own.
- **Max glow.** Holds the glow at `GLOW_PEAK`, the top of the flash, or puts it back to `GLOW_FLOOR`. On a device too slow for the glow it also holds the sigil still while on. A new spell turns it off.
- **Export panel** (`js/export.js`). First what to export, an image (PNG) or an animation (MP4 or WebM), then what to do with it: Copy, Save or Share. The status line under the buttons says what happened. Escape, a click outside or the Export button closes it.
  - **Copy** is an image only: no browser can put a video on the clipboard. It hands `ClipboardItem` a pending promise so the write still counts as part of the click. The clipboard API exists only in a secure context, a page on https or `localhost`; reached over plain http by a network address, as an iPad reaches a dev server on the same network, there is none, and Copy says so and points to Save. Copy has been confirmed on https in Safari, Chrome and Firefox on macOS and in Safari on iPhone and iPad; Android is unchecked, left until an Android user reports a problem.
  - **Share** opens the system share sheet, and shows only where `navigator.canShare` accepts the file type. The sheet must open from a tap, so the PNG is made ahead while the panel is open, and an animation, which takes seconds to make, is made on the first tap and shared on a second; the button lights up while one is waiting.
  - **An image** waits for the drawing to finish: `buildSigil` fires `sigil-drawing` when it starts and `sigil-ready` 2 seconds after the drawing ends, once the flash and the per-line halos are over, or straight after the fade with reduced motion, and the image actions follow. The flash and the ready signal count from the first frame after `buildSigil`, when the animations take their start times; counted from the build itself, a background tab, which draws no frames, signalled ready over an undrawn sigil. An animation draws the spell afresh, so it can start any time. The last animation made is kept, for its spell, mode and format, so saving and sharing the same one doesn't make it twice.
- **The image.** `captureSigilSvg` (`sigilSvgClone`):
  - clones the SVG and gives every element in the clone the computed opacity and stroke dash values of the element on screen. The draw-on animations hold elements at their finished state without writing it back, and inline the elements still say "undrawn". `commitStyles()` was used until 2026-10-24 but can't be trusted: once an idle pulse takes over an element's opacity, Chrome drops the finished draw-on animation, so a sigil left to finish drawing by itself copied without its outer band, many runes and the centre glyph;
  - leaves out the comets, which are light passing over the drawing, not part of it;
  - widens the viewBox to the real bounding box plus padding, since medallions overflow the 600 box;
  - gives the clone explicit `width` and `height`, the PNG's size, at most `EXPORT_MAX` (1200 px) on the long side. With only a viewBox an SVG image comes out 150 px tall, and Safari draws its filters at that size before scaling up, which left iPad copies soft, with blurred, doubled-looking lines;
  - gives the clone `#sigilGlow`, so the image carries the resting tint and, with max glow on, the glow;
  - in parchment mode, bakes in the paper as a radial gradient, embeds `inkRules` as a `<style>`, and drops the glow filter.
- **The animation.** `makeAnimation` draws the current spell afresh, in the current mode, and records a 720 px square video at 30 frames a second: the drawing from blank, the glow flash, then 2 seconds on the finished sigil with its comets circling, from about 8 seconds for a cantrip to 13 for a rank 10. It's H.264 in MP4, which posts and plays almost everywhere, or VP9 in WebM, which plays in browsers and Discord but not reliably in iMessage, and which X won't take. Neither has a transparent background: no browser but Firefox offers alpha in WebCodecs, and Firefox claims it even for H.264, which can't carry it.
  - Recording live in real time would stutter, since a frame takes 20 to 120 ms to draw. So `sigilClock` steps exactly one frame at a time, firing the timers that fall due and the waiting frame callbacks, and each frame sets every Web Animation in the sigil to its time on the stepped clock, from when it was first seen. A pulse resting paused keeps its place. Each frame is the live sigil's clone, comets kept, in a fixed square around the whole drawing, on an opaque ground, drawn to a canvas and encoded with WebCodecs' `VideoEncoder`; the muxer packs the chunks into the file.
  - The live sigil is hidden while recording, and the panel shows the frames instead: Safari repainting it, filters and all, at every step made a clip take five times as long. The frames leave out the resting tint for the same reason; Safari doesn't show it live either. Made in headless Chrome a 13-second clip takes about 6 seconds, and in WebKit on a Mac about 22. The flash is recorded even on a device too slow to show it live, and the drawing even when the system asks for reduced motion, since it's what was asked for.
  - Safari leaves each encoded chunk's duration empty, which `mp4-muxer` refuses, so MP4 chunks go in with their data and the frame's duration given outright; an error inside the encoder's output callback is kept and rethrown, or it would vanish.
  - A new spell drawn meanwhile, or Cancel, stops it. Every change it makes to the page is inside one `try`, so a failure at any point, even while creating the muxer or the encoder, leaves the page as it was. Afterwards the clock goes back to the page's own, offset so that time carries on from the stepped time, and the waiting frames and timers are handed over, so the sigil is left settled and live.
- **Startup.** The spell the URL names is drawn on load, or a random one; see Permalinks.
- **Footer.** Links to the help page, which carries Paizo's notice, the credits and the contact link, and to the symbol atlas, then the sigil version, at the foot of the sidebar column or under the sigil on a phone. The atlas links to the help page for the notice too.

## Licensing

Paizo material is used under Paizo's Community Use Policy, which covers free, non-commercial use of Paizo's trademarks and copyrights. That material includes spell names, traits and other game terms, deity and Golarion names, and the runes based on the Cosmic Caravan art. The ORC License and OGL are not used: they cover rules content only, exclude proper nouns such as deity names, and would need attribution for each of the roughly 100 source books. The policy requires:

- the notice, "in a legible/accessible form in each project, product, or on each website that uses any Paizo Material": once on the site, not on every page, so it sits on the help page, which every page links to, and in the README;
- the tool staying free, with no paywall, sign-up or email gate (donations and ads are allowed);
- no Paizo logos or trade dress, and nothing implying Paizo's endorsement, though descriptive references such as "for Pathfinder Second Edition" are fine;
- up-to-date contact information in a visible place;
- new artwork that is an interpretation of Paizo's art and doesn't look substantially similar to it.

The original code is MIT-licensed. `LICENSE` keeps the standard MIT text so GitHub detects it, and the README states that the licence doesn't extend to Paizo material. The pf2e system's own Apache license covers only its code; crediting it as the data source is a courtesy.

## Working conventions

- **Render before and after visual changes.**
  - For a new shape, render the candidates at large scale in a scratch HTML page and screenshot them with Puppeteer before touching the scripts. Hand-derived curves have rendered as something else entirely; one "vesica lens" came out as a plain diamond.
  - After editing, check with Puppeteer: no console or page errors, expected counts such as `RUNES.length`, and a screenshot of the change in context inside a real band or medallion.
  - Run `npm test` before committing. It names every spell whose sigil moved, which should be exactly the ones the change meant to move.
  - For timing changes, monkey-patch `Element.prototype.animate` to log the real delays and durations.
  - When a fix answers a specific critique, confirm the stated problem is gone, not only that the shape changed.
  - Delete scratch files afterwards.
- **Plan numbering.** Remove an item from `plan.md` once it's done; the commit that completes it records what changed and how it was verified. Don't renumber on completion or reuse a removed item's number, since code comments cite item numbers. Renumber only for a deliberate reprioritization.
- **Data comes from `refresh-data.mjs`.** A hand edit to `data/spells.json` is overwritten by the next refresh.
- **Changes to sigil output are deliberate.** See the determinism section. Append a new rune to its tradition's list; never reorder or insert within one. Give every new symbol a note. Keep `GLYPHS` alphabetical. Leave `data/classes.json` to the refresh, which only appends.

## Related resources

- **Symbol atlas.** `atlas.html` draws every rune, trait glyph and skill sigil from `js/symbols.js` at a fixed scale, runes grouped by tradition in their colors, skill sigils also shown in solid and dotted station squares. Each card shows the symbol's `note`. Until 2026-10-25 the notes were the trailing comments in `js/symbols.js`, which the atlas fetched and read with a regex; a key written without a space before `g=>` silently lost its note. It replaced a private claude.ai artifact, the Sigil Symbol Atlas, which is no longer maintained.
- **Cosmic Caravan reference art.** One `.webp` per constellation and planet plus the full chart, used for tracing the occult runes. It was never committed.
