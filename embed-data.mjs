#!/usr/bin/env node
// Re-embeds spells-data.json into index.html's inline `const SPELLS = [...]`. index.html is a
// self-contained, double-click-to-open tool — it can't fetch spells-data.json at runtime (a file://
// page can't fetch a sibling file without special browser flags most users won't have), so the data has
// to be baked in at edit time instead. Run this after refresh-data.mjs, or after hand-editing
// spells-data.json directly; the two files must always match.
//
// Usage: node embed-data.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dataPath = path.join(__dirname, "spells-data.json");
  const htmlPath = path.join(__dirname, "index.html");
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  let html = await readFile(htmlPath, "utf8");
  const pattern = /const SPELLS = \[.*?\];/s;
  if (!pattern.test(html)) throw new Error("Could not find `const SPELLS = [...]` in index.html");
  html = html.replace(pattern, "const SPELLS = " + JSON.stringify(data) + ";");
  await writeFile(htmlPath, html);
  console.log(`Embedded ${data.length} spells into ${htmlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
