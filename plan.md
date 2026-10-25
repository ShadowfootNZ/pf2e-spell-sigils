# Spell Sigils plan

Open and proposed work as of 2026-10-26. Item numbers stay fixed, so "item N" in a code comment always means one thing. Numbers that aren't listed here belong to completed work, and `design.md` explains the systems referred to below.

Remove completed items as the details will be in git history.

## Repository and deployment

79. **Video muxers.** The vendored mp4-muxer and webm-muxer are deprecated upstream in favour of Mediabunny. They only package video the page made, in stable formats, so they stay. Both formats pass creation and playback tests, and the dependency audit reports no vulnerabilities. Move to Mediabunny only if a browser change breaks them; it's a larger library built as ES modules, which the page's classic scripts would have to load differently.

## Polish

71. **Glyphs in the trait pills.** A curated trait's glyph appears in its medallion, but its pill in the readout shows only the name (`.trait-tag.curated`). Drawing the glyph small at the start of the pill would let a reader match each medallion to its trait. Check how it reads at the pills' size and how wide the pills become in the corner layout's 230px traits block. The current data has at most seven curated traits on one spell, while the renderer holds nine between the centre and ring, so every current curated trait has a medallion.

72. **Random mode.** A toggle that waits until `sigil-ready`, pauses for a chosen interval, then draws another spell from those the current search and filters show. Factor the filtering rules out of `renderList()` into a reusable selection function, and work through a shuffled queue so nothing repeats until the selection is used up. Pause while the document is hidden. A manual pick or filter change stops the mode, but its own call to `showSpell()` must not stop itself. Decide the interval and whether the mode is unavailable or behaves differently when the system asks for reduced motion. The URL already follows each spell drawn. `design.md` lists every use of `Math.random`; add this one.
