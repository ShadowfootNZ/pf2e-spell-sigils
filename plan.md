# Spell Sigils plan

Open and proposed work as of 2026-10-26. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below. Line references are to the files as they were on 2026-10-22.

Remove completed items as the details will be in git history.

## Repository and deployment

79. **Video muxers.** The vendored mp4-muxer and webm-muxer are deprecated upstream in favour of Mediabunny. They only package video the page made, in stable formats, so they stay. Move to Mediabunny only if a browser change breaks them; it's a larger library built as ES modules, which the page's classic scripts would have to load differently.

## Polish

71. **Glyphs in the trait pills.** A curated trait's glyph appears in its medallion, but its pill in the readout shows only the name (`.trait-tag.curated`). Drawing the glyph small at the start of the pill would let a reader match each medallion to its trait. Check how it reads at the pills' size, how wide the pills become in the corner layout's 230px traits block, and whether a curated trait can lack a medallion on spells with more curated traits than the ring holds.

72. **Random mode.** A toggle that, a few seconds after a sigil finishes drawing, draws another spell at random from those the current search and filters show, and carries on until switched off. Decide the pause, whether to work through a shuffled queue so nothing repeats until the selection is used up, and that a manual pick or a filter change stops it. The URL already follows each spell drawn. `design.md` lists every use of `Math.random`; add this one.
