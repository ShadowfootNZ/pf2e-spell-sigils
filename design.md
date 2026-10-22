# Spell Sigils design

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. It is a static web app, always served over HTTP: an HTML page, a stylesheet, four plain scripts and a JSON data file. Every visual choice is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a given spell always produces the same sigil.

`plan.md` tracks open and proposed work.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page markup. Loads the stylesheet and the four scripts. |
| `styles.css` | All styling. |
| `js/core.js` | Seeded random numbers, colors and SVG helpers. |
| `js/symbols.js` | `GLYPHS` and `RUNES`. |
| `js/sigil.js` | `buildSigil`, glow and comets. |
| `js/ui.js` | Filters, list, readout, image export, loading the data and startup. |
| `data/spells.json` | The spell data, one record per line, fetched at startup. |
| `data/classes.json` | The hue for each class's focus spells, in the order classes were first seen. Fetched at startup; the refresh appends new classes. |
| `refresh-data.mjs` | Updates the sparse clone of `foundryvtt/pf2e` in `.cache/pf2e-pack` and rebuilds `data/spells.json` from it. |
| `plan.md` | Open and proposed work, as numbered items. |
| `README.md` | Public overview, usage, the Paizo notice and credits. |
| `LICENSE` | MIT License for the original code. |
| `.cache/` | Gitignored, disposable sparse clone of `packs/pf2e/spells` and `packs/pf2e/classes`. |

The scripts are classic scripts that share globals, loaded in the order above; each one only calls functions from the ones before it, plus `SPELLS`, which `js/ui.js` declares and fills.

## Spell data

### Record shape

```json
{"name":"Fireball","slug":"fireball","rank":3,"traditions":["arcane","primal"],"traits":["concentrate","fire","manipulate"],"rarity":"common","category":"spell"}
{"name":"Bacchanalia","slug":"bacchanalia","rank":6,"traditions":["divine","occult"],"traits":["emotion","mental"],"rarity":"uncommon","category":"ritual","casters":8}
{"name":"Lay on Hands","slug":"lay-on-hands","rank":1,"traditions":[],"traits":["healing","manipulate","vitality"],"rarity":"uncommon","category":"focus","focusClass":"champion"}
```

`casters` appears only on rituals. `focusClass` appears only on focus spells with a single owning class.

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

Tradition spells are drawn with the most precision: ruled bands, tightly set writing and closed circles. Cantrips and focus spells need less perfection and are drawn more simply; focus spells are personal magic rather than drilled tradition magic. Rituals take more time, effort and planning than ordinary spells, and their treatment is still to be designed (plan item 42). Rank 10 breaks the rules (plan item 65).

### Determinism

`rngFor(spell)` seeds mulberry32 with an FNV-1a hash of `name + '::' + slug`. Geometry, rune choice, placement and color all draw from that one stream in a fixed order. As a result:

- The same code with the same name and slug always gives the same sigil.
- Changing the number or order of `rng()` calls changes the sigil of every spell whose stream passes that point.
- Adding or removing a rune changes the sigils of spells that draw from that rune's tradition, because that tradition's pool is shuffled at a different size. Reordering runes within a tradition does too. Order across traditions doesn't matter, since each tradition's pool keeps its own runes in array order.
- Adding or removing a glyph changes only the sigils of spells with that trait. The order of `GLYPHS` doesn't matter, because it is only ever looked up by trait name; it is kept alphabetical.
- `Math.random()` is used only for comet particle jitter and for choosing the spell shown on load.
- Class hues are stored in `data/classes.json`, and the refresh only ever appends to it, so an existing class's hue never changes.

Once images are shared publicly, treat any of these as a visible change to existing sigils.

### Structure

A sigil is drawn in a 600 by 600 viewBox centred on (300, 300) with an outer radius of about 258.

- **Rune bands.** A cantrip gets one plain circle, except a focus cantrip, which gets one band. Ranks 1 to 3 get one runic band, ranks 4 to 6 get two and ranks 7 to 10 get three, at 6/6, 4/6 and 2/6 of the outer radius. Each band is an outer and an inner circle 12 units apart with rune marks between them. The marks are grouped into "words" of 2 to 5 at a fixed letter pitch so the band reads as script.
- **Central polygon.** It has `rank + 3` sides, nudged by up to one per spell and clamped to 3 to 12, at 5/6 of the outer radius. From rank 3, star chords join non-adjacent vertices when there are at least 5 sides. From rank 5, a counter-rotated second polygon sits at 3/6.
- **Center.** A medallion holds one trait glyph when the spell is "centered". A containment ring surrounds it, aligned to the innermost band when there are three bands.
- **Ring medallions.** Trait glyphs sit in medallions that straddle the outer band, each with its own miniature rune band. Placement depends on the number of curated traits. One goes to the center. Two go on the ring, 180° apart. With 3 to 6, the spell is centered with 75% probability, and otherwise all of them go on the ring. With 7 or more, the spell is always centered. The ring holds at most 8. Rank also sets a floor of 1 to 3 ring slots, and slots without a glyph get smaller rune-only fillers. One slot is anchored to a polygon vertex and the rest are spaced evenly from it. The outer band leaves a gap under each medallion.
- **Focus spells** draw each band as writing only, with no ruled lines, and double the letter pitch so the writing is spaced like double-spaced lettering. A focus cantrip gets one such band in place of the plain circle, so its medallions still sit on a ring. Medallions keep their lines. With no band lines, the idle comets ride only the polygon.
- **Traditionless rituals** draw their band circles as open arcs (`isTraditionless`). The arcs used to mean that a focus spell's circle can't close; focus spells no longer draw band lines, so only the 165 traditionless rituals still use them, pending plan item 42.
- **Mythic spells**, 33 of them, get one fractured polygon edge. `fractureEdge` returns a new point list, so medallion anchoring still uses the clean polygon.

### Symbol vocabularies

- `GLYPHS` has 57 entries mapping a trait to a drawing in a 24 by 24 box. A trait with an entry is "curated": it can take a medallion and is highlighted in the trait list. Class traits get no entry, because the class badge already names the class; `psychic` had one until 2026-10-22. 1463 of the 2018 spells have at least one curated trait.
- `RUNES` groups 54 small marks by tradition, each in a box of roughly 8 units centred on the origin: 8 arcane, 8 divine, 29 occult and 9 primal. The occult set includes 26 marks simplified from Paizo's Cosmic Caravan art: 13 constellations, the Diaspora, the Sun and 11 planets. The divine runes are deliberately abstract so that none reads as a real-world religious symbol.
- Each spell draws from its own rune vocabulary. A rank-scaled budget is split evenly across its traditions, so occult's larger pool doesn't dominate. Traditionless spells sample all four traditions at half the budget, with a floor of 2 shapes, or 4 for focus spells so their spaced writing doesn't reduce to a two-symbol pattern.

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
- Class hues come from `data/classes.json`, spaced by the golden angle (137.50776°) in the order classes were first seen. A plain name hash had put necromancer and sorcerer on the same hue.
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
- After the sigil settles, about a third of its lines pulse in opacity. Faint comets from `energyLoop` circle the outer band, the inner border and the polygon; focus spells have no band lines, so only the polygon comet.
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
  - The trait list hides concentrate, manipulate and the four alignment traits. The `cantrip` and `focus` traits, and a class focus spell's class trait, aren't stored at all.
- **Parchment toggle.** A CSS-only display mode: a parchment texture behind the circle and a `saturate/brightness/contrast/sepia` filter over the SVG that makes the bright palette look inked. It leaves the JS color system untouched.
- **Max glow.** Forces the glow filter to the ceiling that `startGlow` reaches, or back to the floor. Its constants are duplicated from `startGlow`.
- **Copy image and Save image.** `captureSigilSvg`:
  - commits every animation's end state with `commitStyles()`;
  - clones the SVG and widens the viewBox to the real bounding box plus padding, since medallions overflow the 600 box;
  - bakes in the parchment background and filter when that mode is on.

  The PNG is rasterized at up to 1200 px on its long side. Copy hands `ClipboardItem` a pending promise so the write still counts as part of the click. The PNG output has been checked pixel for pixel. The clipboard write itself could not be confirmed in headless Chrome and still needs a manual check in desktop browsers.
- **Startup.** A random spell is drawn on load.
- **Legal footer.** The sidebar ends with Paizo's Community Use Policy notice, a credit for the pf2e data and a link to the repo for contact. It stays visible rather than sitting behind a link.

## Licensing

Paizo material is used under Paizo's Community Use Policy, which covers free, non-commercial use of Paizo's trademarks and copyrights. That material includes spell names, traits and other game terms, deity and Golarion names, and the runes based on the Cosmic Caravan art. The ORC License and OGL are not used: they cover rules content only, exclude proper nouns such as deity names, and would need attribution for each of the roughly 100 source books. The policy requires:

- the notice, in legible form, on the page and in the README;
- the tool staying free, with no paywall, sign-up or email gate (donations and ads are allowed);
- no Paizo logos or trade dress, and nothing implying Paizo's endorsement, though descriptive references such as "for Pathfinder Second Edition" are fine;
- up-to-date contact information in a visible place;
- new artwork that is an interpretation of Paizo's art and doesn't look substantially similar to it.

The original code is MIT-licensed. `LICENSE` keeps the standard MIT text so GitHub detects it, and the README states that the licence doesn't extend to Paizo material. The pf2e system's own Apache license covers only its code; crediting it as the data source is a courtesy.

## Working conventions

- **Render before and after visual changes.**
  - For a new shape, render the candidates at large scale in a scratch HTML page and screenshot them with Puppeteer before touching the scripts. Hand-derived curves have rendered as something else entirely; one "vesica lens" came out as a plain diamond.
  - After editing, check with Puppeteer: no console or page errors, expected counts such as `RUNES.length`, and a screenshot of the change in context inside a real band or medallion.
  - For timing changes, monkey-patch `Element.prototype.animate` to log the real delays and durations.
  - When a fix answers a specific critique, confirm the stated problem is gone, not only that the shape changed.
  - Delete scratch files afterwards.
- **Plan numbering.** Remove an item from `plan.md` once it's done; the commit that completes it records what changed and how it was verified. Don't renumber on completion or reuse a removed item's number, since code comments cite item numbers. Renumber only for a deliberate reprioritization.
- **Data comes from `refresh-data.mjs`.** A hand edit to `data/spells.json` is overwritten by the next refresh.
- **Changes to sigil output are deliberate.** See the determinism section. Append a new rune to its tradition's list; never reorder or insert within one. Keep `GLYPHS` alphabetical. Leave `data/classes.json` to the refresh, which only appends.

## Related resources

- **Sigil Symbol Atlas.** A private claude.ai artifact at <https://claude.ai/code/artifact/4187d54b-be83-4a57-817a-f083145beee2>, used for viewing and planning the symbols. It renders every `RUNES` and `GLYPHS` entry at large scale, with the runes grouped by tradition in `TRAD_HSL` colors. It is a static snapshot that matched `index.html` on 2026-10-22 and is not currently maintained. No local source exists, so read the published page back with the Artifact tool to update it. Plan item 61 proposes an atlas inside the repo instead.
- **Cosmic Caravan reference art.** One `.webp` per constellation and planet plus the full chart, used for tracing the occult runes. It was never committed.
