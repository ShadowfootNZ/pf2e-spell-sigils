# Spell Sigils

Spell Sigils draws an animated magic circle for each Pathfinder Second Edition spell. Every sigil is derived from the spell's rank, traditions, traits and category, using a random stream seeded on the spell's identity, so a spell always produces the same sigil.

This is unofficial fan content. See [Licence and credits](#licence-and-credits).

## Using it

Serve this folder from any static web server and open it in a browser. The page fetches its spell data, so it doesn't work opened straight from disk. For a quick local copy:

```sh
python3 -m http.server   # then open http://localhost:8000
```

Search or filter the spell list, pick a spell, and use Copy image or Save image to export the sigil as a PNG.

## Updating the spell data

The spell data lives in `data/spells.json`, separate from the code. `refresh-data.mjs` rebuilds it from the pf2e compendium and prints every spell it adds, removes or changes. It needs Node.js and git.

```sh
node refresh-data.mjs
```

`design.md` explains how the tool works, `plan.md` lists open work, and `atlas.html` shows every rune, trait glyph and skill sigil the sigils are drawn from.

## Deployment

Pushes to `main` deploy the static app over SSH using `.github/workflows/deploy-ssh.yml`. The workflow expects `SSH_PRIVATE_KEY`, `SSH_USER`, `SSH_HOST` and `REMOTE_PATH` as GitHub Actions secrets. The app is served under `/pf2e-spell-sigils/`, so paths in the pages must stay relative.

`catalogue.json` describes the app for the [apps catalogue](https://apps.shadowfoot.com/), and `docs/` holds its catalogue images. Neither is deployed with the app.

## Licence and credits

Spell Sigils uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ([paizo.com/licenses/communityuse](https://paizo.com/licenses/communityuse)). We are expressly prohibited from charging you to use or access this content. Spell Sigils is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit [paizo.com](https://paizo.com).

- **Code.** The original code in this repository is released under the MIT License; see [LICENSE](LICENSE). The licence does not cover material owned by Paizo Inc.: spell names, traits and other game terms, Golarion names, and the runes based on Paizo's Cosmic Caravan artwork. That material is used here under the Community Use Policy, and anyone reusing it must follow that policy themselves.
- **Spell data.** Extracted from the [Pathfinder Second Edition system for Foundry VTT](https://github.com/foundryvtt/pf2e), created and maintained by the PF2E for Foundry VTT volunteer development team.
- **Fonts.** Cinzel and EB Garamond, plus JetBrains Mono in the atlas, loaded from Google Fonts under the SIL Open Font License.

Questions and problems: [open an issue](https://github.com/ShadowfootNZ/pf2e-spell-sigils/issues).
