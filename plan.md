# Spell Sigils plan

Open and proposed work as of 2026-10-25. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line references are to the files as they were on 2026-10-22.

Remove completed items as the details will be in git history.

## Repository and deployment

78. **Catalogue entry.** The origin is written. `features` still predates export: "Copy and save" doesn't mention animations, sharing, the background choice, SVG or the help page. The images in `docs/` were made on 2026-10-25, the parchment one remade on 2026-10-26; remake them after any visible change to the sigils or the page.

79. **Video muxers.** The vendored mp4-muxer and webm-muxer are deprecated upstream in favour of Mediabunny. They only package video the page made, in stable formats, so they stay. Move to Mediabunny only if a browser change breaks them; it's a larger library built as ES modules, which the page's classic scripts would have to load differently.

## Polish

64. **Share preview.** One card for the whole site, so a link pasted into Discord, Slack, iMessage or Bluesky shows a title, a one-line description and a sigil, where now it shows a bare link: `og:` and Twitter meta tags in `index.html`, with an image at an absolute address on the deployed site. Every link gets the same card, since a spell link names the spell after a `#`, which is never sent to the server; per-spell cards would need a page and an image for each spell, about 4,000 files, which aren't wanted. The image is one sigil with all four traditions' colours, at least three trait medallions and at least two rune bands.

80. **Light sidebar and pages, following the system.** The sidebar, where a spell is chosen, follows the system's light or dark setting. The stage, where the sigil is drawn, doesn't: it stays dark unless Parchment is chosen. The help page and the atlas follow the system too, but the atlas's cards stay dark, so each symbol shows as it does in a glowing sigil. Light values for the colour variables would go in `css/base.css` under `prefers-color-scheme: light`, scoped so the stage keeps the dark ones. Check the phone drawer, the footer, the filter chips' tradition colours and the focus rings in both.

71. **Glyphs in the trait pills.** A curated trait's glyph appears in its medallion, but its pill in the readout shows only the name (`.trait-tag.curated`). Drawing the glyph small at the start of the pill would let a reader match each medallion to its trait. Check how it reads at the pills' size, how wide the pills become in the corner layout's 230px traits block, and whether a curated trait can lack a medallion on spells with more curated traits than the ring holds.

72. **Random mode.** A toggle that, a few seconds after a sigil finishes drawing, draws another spell at random from those the current search and filters show, and carries on until switched off. Decide the pause, whether to work through a shuffled queue so nothing repeats until the selection is used up, and that a manual pick or a filter change stops it. The URL already follows each spell drawn. `design.md` lists every use of `Math.random`; add this one.
