# Spell Sigils design

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. The whole tool is one self-contained HTML page that works when opened straight from disk or served as a static file. Every visual choice is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a given spell always produces the same sigil.

`plan.md` tracks open and proposed work.

## Files

| File | Role |
| --- | --- |
| `index.html` | The whole app: CSS, markup, rendering code and an embedded copy of the spell data in `const SPELLS = [...]`, a single 362 KB line. |
| `spells-data.json` | Canonical spell data. `index.html` carries a byte-identical copy. |
| `refresh-data.mjs` | Updates the sparse clone of `foundryvtt/pf2e` in `.cache/pf2e-pack` and refreshes the folder-derived fields in `spells-data.json`. |
| `embed-data.mjs` | Writes `spells-data.json` into the `SPELLS` constant in `index.html`. |
| `plan.md` | Open and proposed work, as numbered items. |
| `.cache/` | Gitignored, disposable sparse clone of `packs/pf2e/spells` and `packs/pf2e/classes`. |

## Spell data

### Record shape

```json
{"name":"Fireball","slug":"fireball","rank":3,"traditions":["arcane","primal"],"traits":["concentrate","fire","manipulate"],"rarity":"common","category":"spell"}
{"name":"Bacchanalia","slug":"bacchanalia","rank":6,"traditions":["divine","occult"],"traits":["emotion","mental"],"rarity":"uncommon","category":"ritual","casters":8}
{"name":"Lay on Hands","slug":"lay-on-hands","rank":1,"traditions":[],"traits":["champion","focus","healing","manipulate","vitality"],"rarity":"uncommon","category":"focus","focusClass":"champion"}
```

`casters` appears only on rituals. `focusClass` appears only on focus spells with a single owning class.

### Field sources

- `name`, `slug`, `rank`, `traditions`, `traits` and `rarity` come from a one-off export made on 2026-08-27, before any script existed. Nothing in the repo regenerates them, so spells added upstream since then are missing. Cantrips are stored as rank 0; upstream stores them as level 1 with a `cantrip` trait.
- `category`, `casters` and `focusClass` come from `refresh-data.mjs`, joined to existing records by spell name.

### Category from the compendium folder

`category` is `spell`, `focus`, `ritual` or `impossible`, taken from the folder a spell's file sits in under `packs/pf2e/spells`: `spells/`, `focus/`, `rituals/` or `impossible-spells/`. Traits are not a reliable signal, because the `focus` trait is missing from some focus spells even in the raw pf2e source.

The current data has 1277 spells, 545 focus spells, 166 rituals and 5 impossible spells. The interface depends on these facts about it:

- Every traditionless spell is either a focus spell (545) or a ritual (163). There is no third "innate" or "other" group, which is why the filter has no "other" chip.
- No focus spell has a tradition. Three rituals do: Aspirational State, Bacchanalia and Mother's Blessing.
- All five impossible spells have traditions, so the tradition filters reach them.
- `focusClass` is set when exactly one of a focus spell's traits matches a class in `packs/pf2e/classes`. 15 of the 29 classes own at least one focus spell. The 74 focus spells without a single owning class display as "other".
- `casters` is the ritual's secondary-caster count.

### Slugs and the render seed

127 stored slugs keep apostrophes, such as `achaekek's-clutch`, while the compendium file names drop them (`achaekeks-clutch`). The render seed includes the slug, so regenerating slugs would change those 127 sigils. Existing slugs must be preserved; only new spells need a derived slug.

### Embedding

Most browsers block a page opened from `file://` from fetching a sibling JSON file, so the data is baked into `index.html`. Edit `spells-data.json`, then run `embed-data.mjs`. Any hand edit to the embedded `SPELLS` is overwritten by the next embed.

### Refreshing from upstream

```sh
node refresh-data.mjs
node embed-data.mjs
```

`refresh-data.mjs` sparse-clones `foundryvtt/pf2e` on its first run. Later runs fetch and hard-reset to the remote tip instead of pulling. Upstream force-pushes its default branch, `v14-dev`, and after that `git pull` on a shallow clone fails with "refusing to merge unrelated histories". This was reproduced against the old cache on 2026-10-22.

After that refresh, upstream has 2018 spells. 26 of them are not in `spells-data.json`, and one local spell, Divine Vessel, no longer exists upstream.

## Rendering

### Determinism

`rngFor(spell)` seeds mulberry32 with an FNV-1a hash of `name + '::' + slug`. Geometry, rune choice, placement and color all draw from that one stream in a fixed order. As a result:

- The same code with the same name and slug always gives the same sigil.
- Changing the number or order of `rng()` calls changes the sigil of every spell whose stream passes that point.
- Adding a rune or glyph changes the sigils of spells that draw from the affected pool, because the shuffles see a different pool size. Reordering `RUNES` or `GLYPHS` changes far more.
- `Math.random()` is used only for comet particle jitter and for choosing the spell shown on load.
- `FOCUS_CLASS_ORDER` is frozen and append-only, because each class's hue comes from its index.

Once images are shared publicly, treat any of these as a visible change to existing sigils.

### Structure

A sigil is drawn in a 600 by 600 viewBox centred on (300, 300) with an outer radius of about 258.

- **Rune bands.** A cantrip gets one plain circle. Ranks 1 to 3 get one runic band, ranks 4 to 6 get two and ranks 7 to 10 get three, at 6/6, 4/6 and 2/6 of the outer radius. Each band is an outer and an inner circle 12 units apart with rune marks between them. The marks are grouped into "words" of 2 to 5 at a fixed letter pitch so the band reads as script.
- **Central polygon.** It has `rank + 3` sides, nudged by up to one per spell and clamped to 3 to 12, at 5/6 of the outer radius. From rank 3, star chords join non-adjacent vertices when there are at least 5 sides. From rank 5, a counter-rotated second polygon sits at 3/6.
- **Center.** A medallion holds one trait glyph when the spell is "centered". A containment ring surrounds it, aligned to the innermost band when there are three bands.
- **Ring medallions.** Trait glyphs sit in medallions that straddle the outer band, each with its own miniature rune band. Placement depends on the number of curated traits. One goes to the center. Two go on the ring, 180° apart. With 3 to 6, the spell is centered with 75% probability, and otherwise all of them go on the ring. With 7 or more, the spell is always centered. The ring holds at most 8. Rank also sets a floor of 1 to 3 ring slots, and slots without a glyph get smaller rune-only fillers. One slot is anchored to a polygon vertex and the rest are spaced evenly from it. The outer band leaves a gap under each medallion.
- **Traditionless spells** draw their band circles as open arcs, because the circle cannot close. The flag is `traditions.length === 0`, so this currently applies to rituals as well as focus spells (open item 42).
- **Mythic spells**, 33 of them, get one fractured polygon edge. `fractureEdge` returns a new point list, so medallion anchoring still uses the clean polygon.

### Symbol vocabularies

- `GLYPHS` has 58 entries mapping a trait to a drawing in a 24 by 24 box. A trait with an entry is "curated": it can take a medallion and is highlighted in the trait list. 1447 of the 1993 spells have at least one curated trait.
- `RUNES` has 54 small marks in a box of roughly 8 units centred on the origin. `RUNE_TRADITION` is a parallel array that tags each one: 8 arcane, 8 divine, 9 primal and 29 occult. The two arrays must stay in the same order. The occult set includes 26 marks simplified from Paizo's Cosmic Caravan art: 13 constellations, the Diaspora, the Sun and 11 planets. The divine runes are deliberately abstract so that none reads as a real-world religious symbol.
- Each spell draws from its own rune vocabulary. A rank-scaled budget is split evenly across its traditions, so occult's larger pool doesn't dominate. Traditionless spells sample all four traditions at half the budget.

### Color

- `TRAD_HSL` gives each tradition a range of hue, saturation and lightness. Each color slot gets its own jitter within its range.
- `colorSlotTrads` lists a spell's color slots:
  - Multi-tradition spells use their own traditions.
  - Single-tradition spells repeat their tradition, so there are always at least two shades.
  - Traditionless rituals get two `ritual` slots with full-spectrum hues.
  - Class focus spells get two `focus` slots on the class hue.
  - Classless focus spells get two `none` slots from the 312° to 370° gap that clears all four tradition ranges.
  - Rituals add one `ritual` slot per secondary caster, up to four.
- Four elements always draw, and each takes a different slot so every one of a spell's traditions appears somewhere. Band 0 uses `colorAt(0)`, the polygon `colorAt(1)`, the center ring `colorAt(2)` and the first ring medallion `colorAt(3)`.
- Class hues use golden-angle spacing over `FOCUS_CLASS_ORDER`. A plain name hash had put necromancer and sorcerer on the same hue. Open item 47 replaces this with an explicit manifest.
- Runes and glyphs use `brightenHsl` of their element's color, and glow halos use `darkenHsl`.

### Animation and glow

- `buildSigil` builds the DOM along with a timeline of `{el, delay, dur, kind}` entries, then plays it with the Web Animations API. Sections run in sequence: bands, polygon, chords, second polygon, center, ring medallions. Items within a section overlap in a fast stagger, because a fully serial draw would push high-rank sigils, with up to 64 border marks, past 20 seconds.
- Ring medallions are appended last so they paint on top, but `reserveSatelliteSlot` reserves their timing slot right after the outer band.
- Strokes draw on with a dash-offset animation while a `spark` comet rides the tip.
- Glow stays at its floor while the sigil draws and starts at `totalEnd`. It has three parts:
  - the `#sigilGlow` SVG filter, a wide darkened blur plus a tight bright blur;
  - CSS drop-shadows updated every frame;
  - `glowDuplicate` clones, which are wider blurred copies of each stroke in a shared layer behind everything else.
- The generation counter `blurGen` abandons the glow loop of the previously selected spell.
- After the sigil settles, about a third of its lines pulse in opacity. Faint comets from `energyLoop` circle the outer band, the inner border and the polygon.
- Two experiments are still switched on. TEST #1 removes the tight near glow from the filter. TEST #3 turns the glow into a one-off flash instead of a continuous breathe, and the breathing code sits commented out beside it. Plan item 52 settles the final behavior.

## Interface

- **Filters.**
  - Name search.
  - Tradition chips: multi-select, matching any selected tradition.
  - Ritual and Focus chips, exclusive with each other and with the tradition chips.
  - A class row while Focus is active: single select, listing only classes that own a focus spell plus "other".
  - Rank chips.
  - An empty selection means no filter.
- **Readout.**
  - Shows the name, rank, badges and traits.
  - Traditionless spells show their class name, or "other", in place of a tradition badge.
  - Rituals get an extra ritual badge.
  - The trait list hides concentrate, manipulate, the four alignment traits and cantrip. For class focus spells it also hides `focus` and the class trait.
- **Parchment toggle.** A CSS-only display mode: a parchment texture behind the circle and a `saturate/brightness/contrast/sepia` filter over the SVG that makes the bright palette look inked. It leaves the JS color system untouched.
- **Max glow.** Forces the glow filter to the ceiling that `startGlow` reaches, or back to the floor. Its constants are duplicated from `startGlow`.
- **Copy image and Save image.** `captureSigilSvg`:
  - commits every animation's end state with `commitStyles()`;
  - clones the SVG and widens the viewBox to the real bounding box plus padding, since medallions overflow the 600 box;
  - bakes in the parchment background and filter when that mode is on.

  The PNG is rasterized at up to 1200 px on its long side. Copy hands `ClipboardItem` a pending promise so the write still counts as part of the click. The PNG output has been checked pixel for pixel. The clipboard write itself could not be confirmed in headless Chrome and still needs a manual check in desktop browsers.
- **Startup.** A random spell is drawn on load.

## Working conventions

- **Render before and after visual changes.**
  - For a new shape, render the candidates at large scale in a scratch HTML page and screenshot them with Puppeteer before touching `index.html`. Hand-derived curves have rendered as something else entirely; one "vesica lens" came out as a plain diamond.
  - After editing, check with Puppeteer: no console or page errors, expected counts such as `RUNES.length`, and a screenshot of the change in context inside a real band or medallion.
  - For timing changes, monkey-patch `Element.prototype.animate` to log the real delays and durations.
  - When a fix answers a specific critique, confirm the stated problem is gone, not only that the shape changed.
  - Delete scratch files afterwards.
- **Plan numbering.** Remove an item from `plan.md` once it's done; the commit that completes it records what changed and how it was verified. Don't renumber on completion or reuse a removed item's number, since code comments cite item numbers. Renumber only for a deliberate reprioritization.
- **Data edits go through `spells-data.json`,** followed by `embed-data.mjs`.
- **Changes to sigil output are deliberate.** See the determinism section. Append to `FOCUS_CLASS_ORDER`, `RUNES` and `RUNE_TRADITION`; never reorder them.

## Related resources

- **Sigil Symbol Atlas.** A private claude.ai artifact at <https://claude.ai/code/artifact/4187d54b-be83-4a57-817a-f083145beee2>, used for viewing and planning the symbols. It renders every `RUNES` and `GLYPHS` entry at large scale, with the runes grouped by tradition in `TRAD_HSL` colors. It is a static snapshot that matched `index.html` on 2026-10-22 and is not currently maintained. No local source exists, so read the published page back with the Artifact tool to update it. Plan item 61 proposes an atlas inside the repo instead.
- **Cosmic Caravan reference art.** One `.webp` per constellation and planet plus the full chart, used for tracing the occult runes. It was never committed.
