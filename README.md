# Spell Sigils

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. Every sigil is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a spell always produces the same sigil.

This is unofficial fan content. See [Licence and credits](#licence-and-credits).

## Using it

Open `index.html` in a browser. It is a single self-contained page that works straight from disk or from any static host. Search or filter the spell list, pick a spell, and use Copy image or Save image to export the sigil as a PNG.

## Updating the spell data

The spell data lives in `spells-data.json`, and `index.html` carries an embedded copy so it works without a server. Both scripts need Node.js and git.

```sh
node refresh-data.mjs   # update the pf2e compendium cache and refresh spells-data.json
node embed-data.mjs     # write spells-data.json into index.html
```

`design.md` explains how the tool works and `plan.md` lists open work.

## Licence and credits

Spell Sigils uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. Spell Sigils is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

- **Code.** The original code in this repository is released under the MIT License; see [LICENSE](LICENSE). The licence does not cover material owned by Paizo Inc.: spell names, traits and other game terms, Golarion names, and the runes based on Paizo's Cosmic Caravan artwork. That material is used here under the Community Use Policy, and anyone reusing it must follow that policy themselves.
- **Spell data.** Extracted from the [Pathfinder Second Edition system for Foundry VTT](https://github.com/foundryvtt/pf2e), created and maintained by the PF2E for Foundry VTT volunteer development team.
- **Fonts.** Cinzel and EB Garamond, loaded from Google Fonts under the SIL Open Font License.

Questions and problems: [open an issue](https://github.com/ShadowfootNZ/pf2e-spell-sigils/issues).
