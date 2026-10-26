# Spell Sigils

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. Every sigil is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a spell always produces the same sigil.

[Use Spell Sigils](https://apps.shadowfoot.com/pf2e-sigils/).

This is unofficial fan content. See [Licence and credits](#licence-and-credits).

## Using it

Serve this folder from any static web server and open it in a browser. The page fetches its spell data, so it doesn't work opened straight from disk. For a quick local copy:

```sh
python3 -m http.server   # then open http://localhost:8000
```

Search or filter the spell list and pick a spell. Export can copy, save or share a PNG with or without its background, save or share an SVG in parchment mode, or make an MP4 or WebM animation of the sigil being drawn.

## Updating the spell data

The spell data lives in `data/spells.json`, separate from the code. `refresh-data.mjs` rebuilds it from the pf2e compendium and prints every spell it adds, removes or changes. It needs Node.js and git.

```sh
node refresh-data.mjs
```

## Checking changes

`npm test` builds every spell's sigil in headless Chrome and compares it with the snapshot in `test/sigils.snapshot`, so a code change can't redraw existing sigils unnoticed. It needs Node.js 22.12 or later; run `npm install` once first. After an intended change, `npm run test:update` rewrites the snapshot to commit with it.

```sh
npm install
npm test
```

[design.md](design.md) explains how the tool works, [plan.md](plan.md) lists open work, and [atlas.html](atlas.html) shows every rune, trait glyph and skill sigil used in the drawings.

## Privacy

Every sigil is drawn in the browser. Analytics record page views, and a short fixed list of features used, each at most once per device per day: arriving by a link to a spell, picking a spell from the list, search, each kind of filter, parchment, max glow, opening Export, and each copy, save or share, by its file format. They never record which spell is shown or exported, what was searched for or which filter was chosen. Nothing is sent at all where the browser asks not to be tracked, by Global Privacy Control or Do Not Track. [design.md](design.md#analytics) lists every event.

## Licence and credits

Spell Sigils uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. Spell Sigils is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

- **Code.** The original code in this repository is released under the MIT License; see [LICENSE](LICENSE). The licence does not cover material owned by Paizo Inc.: spell names, traits and other game terms, Golarion names, and the runes based on Paizo's Cosmic Caravan artwork. That material is used here under the Community Use Policy, and anyone reusing it must follow that policy themselves.
- **Spell data.** Extracted from the [Pathfinder Second Edition system for Foundry VTT](https://github.com/foundryvtt/pf2e), created and maintained by the PF2E for Foundry VTT volunteer development team.
- **Fonts.** Cinzel and EB Garamond, plus JetBrains Mono in the atlas, under the SIL Open Font License, served from `fonts/` with their licences.
- **Video.** [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) and [webm-muxer](https://github.com/Vanilagy/webm-muxer) by Vanilagy, under the MIT License, in `js/vendor/`.

Questions and problems: [open an issue](https://github.com/ShadowfootNZ/pf2e-spell-sigils/issues).
