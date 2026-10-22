#!/usr/bin/env node
// Rebuilds data/spells.json from the real foundryvtt/pf2e compendium (packs/pf2e/spells +
// packs/pf2e/classes), read from a disposable sparse clone in .cache/pf2e-pack.
//
// Every record is rebuilt from its spell file: name, rank, traditions, traits and rarity, the
// folder-derived category, plus casters for rituals and focusClass for focus spells. Spells gone upstream
// are dropped, new ones are added, and every addition, removal and field change is printed.
//
// It also keeps data/classes.json, the hue for each class's focus spells: a class seen for the first
// time is appended with the next golden-angle hue, so no existing class's color ever changes.
//
// Records are matched to the existing file by *name*, and the slug is carried over rather than rederived:
// it identifies the spell in URLs and seeds the render, and 125 existing slugs keep punctuation that the
// compendium's file names drop (achaekek's-clutch vs achaekeks-clutch, hop,-skip,-jump vs
// hop-skip-jump). A new spell takes its file name as its slug. Any other upstream change is free to
// change a sigil.
//
// Traits and traditions are stored in alphabetical order. Glyph placement shuffles the curated traits in
// stored order and colors cycle through traditions in stored order, so a fixed order means upstream
// reordering a list never redraws a sigil on its own.
//
// Usage: node refresh-data.mjs

import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache", "pf2e-pack");
const DATA_PATH = path.join(__dirname, "data", "spells.json");
const CLASSES_PATH = path.join(__dirname, "data", "classes.json");
const GOLDEN_ANGLE = 137.50776;
const REPO_URL = "https://github.com/foundryvtt/pf2e.git";
const SPARSE_PATHS = ["packs/pf2e/spells", "packs/pf2e/classes"];

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))));
  });
}

async function refreshCache() {
  await mkdir(path.dirname(CACHE_DIR), { recursive: true });
  if (existsSync(path.join(CACHE_DIR, ".git"))) {
    console.log(`Updating existing cache at ${CACHE_DIR} ...`);
    // fetch + hard reset, not `git pull`: this cache is
    // disposable and read-only, and `pull` fails outright once upstream force-pushes its branch (seen
    // 2026-09-10 when foundryvtt/pf2e force-updated v14-dev: "refusing to merge unrelated histories",
    // since the shallow local history no longer shares an ancestor with the new tip). Resetting to
    // FETCH_HEAD mirrors whatever the remote tip is now, and `clean -xdf` drops files a rewrite removed.
    await run("git", ["fetch", "--depth", "1", "origin"], CACHE_DIR);
    await run("git", ["reset", "--hard", "FETCH_HEAD"], CACHE_DIR);
    await run("git", ["clean", "-xdf"], CACHE_DIR);
  } else {
    console.log(`Cloning ${REPO_URL} (sparse) into ${CACHE_DIR} ...`);
    await run("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO_URL, CACHE_DIR]);
    await run("git", ["sparse-checkout", "set", "--no-cone", ...SPARSE_PATHS], CACHE_DIR);
  }
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.name.endsWith(".json") && entry.name !== "_folders.json") out.push(full);
  }
  return out;
}

async function loadClassNames() {
  const dir = path.join(CACHE_DIR, "packs", "pf2e", "classes");
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

// appends any class not yet in data/classes.json with the next golden-angle hue; existing entries, and so
// existing colors, never move. A class that disappears upstream keeps its entry.
async function updateClassHues(classNames) {
  const classes = existsSync(CLASSES_PATH) ? JSON.parse(await readFile(CLASSES_PATH, "utf8")) : [];
  const known = new Set(classes.map((c) => c.name));
  const added = classNames.filter((n) => !known.has(n)).sort();
  for (const name of added) classes.push({ name, hue: (classes.length * GOLDEN_ANGLE) % 360 });
  await writeFile(CLASSES_PATH, "[\n" + classes.map((c) => JSON.stringify(c)).join(",\n") + "\n]\n");
  return added.map((name) => classes.find((c) => c.name === name));
}

// category is purely a function of which compendium folder a spell's file lives under — confirmed for
// both rituals and focus spells (the `focus` trait itself is not reliably present even in the raw
// source data)
function categoryFor(rel) {
  if (rel.startsWith("rituals/")) return "ritual";
  if (rel.startsWith("focus/")) return "focus";
  if (rel.startsWith("impossible-spells/")) return "impossible";
  return "spell";
}

function buildRecord(raw, rel, classNames) {
  const sys = raw.system || {};
  const rawTraits = [...((sys.traits && sys.traits.value) || [])].sort();
  // `cantrip` and `focus` aren't stored: rank 0 and the focus category already say the same thing, and
  // upstream leaves the `focus` trait off some focus spells anyway
  const traits = rawTraits.filter((t) => t !== "cantrip" && t !== "focus");
  const record = {
    name: raw.name,
    slug: path.basename(rel, ".json"),
    // upstream stores a cantrip as level 1 with a `cantrip` trait; this tool treats cantrips as rank 0
    rank: rawTraits.includes("cantrip") ? 0 : sys.level.value,
    traditions: [...((sys.traits && sys.traits.traditions) || [])].sort(),
    traits,
    rarity: sys.traits.rarity,
    category: categoryFor(rel),
  };
  if (record.category === "ritual") record.casters = (sys.ritual && sys.ritual.secondary && sys.ritual.secondary.casters) || 0;
  if (record.category === "focus") {
    // the class comes from the spell's single class trait, or failing that from a class subfolder of
    // focus/ (magus, necromancer, summoner and wizard have one). The class trait is then dropped, since
    // the readout's class badge already names the class.
    const cls = traits.filter((t) => classNames.includes(t));
    const parts = rel.split("/");
    const folderClass = parts.length > 2 && classNames.includes(parts[1]) ? parts[1] : null;
    const focusClass = cls.length === 1 ? cls[0] : folderClass;
    if (focusClass) {
      record.focusClass = focusClass;
      record.traits = traits.filter((t) => t !== focusClass);
    }
  }
  return record;
}

async function main() {
  await refreshCache();
  const classNames = await loadClassNames();
  const newClasses = await updateClassHues(classNames);

  const spellsDir = path.join(CACHE_DIR, "packs", "pf2e", "spells");
  const upstream = [];
  for (const f of await walk(spellsDir)) {
    const rel = path.relative(spellsDir, f).split(path.sep).join("/");
    upstream.push(buildRecord(JSON.parse(await readFile(f, "utf8")), rel, classNames));
  }
  const dupes = upstream.map((r) => r.name).filter((n, i, all) => all.indexOf(n) !== i);
  if (dupes.length) throw new Error(`Duplicate spell names upstream, so the name join is ambiguous: ${dupes.join(", ")}`);

  const existing = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const existingByName = new Map(existing.map((s) => [s.name, s]));
  const upstreamNames = new Set(upstream.map((r) => r.name));

  const added = [], changed = [];
  const records = upstream.map((r) => {
    const old = existingByName.get(r.name);
    if (!old) { added.push(r); return r; }
    r.slug = old.slug;
    const diffs = [];
    for (const key of new Set([...Object.keys(old), ...Object.keys(r)])) {
      if (JSON.stringify(old[key]) !== JSON.stringify(r[key])) diffs.push(`${key}: ${JSON.stringify(old[key])} -> ${JSON.stringify(r[key])}`);
    }
    if (diffs.length) changed.push(`${r.name}: ${diffs.join("; ")}`);
    return r;
  });
  const removed = existing.filter((s) => !upstreamNames.has(s.name));

  // plain code-unit order, as the spell list displays records in file order
  records.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const slugs = records.map((r) => r.slug).filter((s, i, all) => all.indexOf(s) !== i);
  if (slugs.length) throw new Error(`Duplicate slugs after the merge: ${slugs.join(", ")}`);

  console.log(`\nAdded ${added.length}:`);
  added.forEach((r) => console.log(`  + ${r.name} [${r.category}, rank ${r.rank}]`));
  console.log(`Removed ${removed.length}:`);
  removed.forEach((s) => console.log(`  - ${s.name} [${s.category}]`));
  console.log(`Changed ${changed.length}:`);
  changed.forEach((c) => console.log(`  ~ ${c}`));
  console.log(`New classes ${newClasses.length}:`);
  newClasses.forEach((c) => console.log(`  + ${c.name}, hue ${c.hue.toFixed(1)}`));

  // facts the interface depends on (see design.md, "Category from the compendium folder")
  const strayTraditionless = records.filter((r) => r.traditions.length === 0 && r.category !== "focus" && r.category !== "ritual");
  if (strayTraditionless.length) console.warn(`\nWARNING: traditionless spells that are neither focus nor ritual (the filters have no chip for them): ${strayTraditionless.map((r) => r.name).join(", ")}`);
  const traditionFocus = records.filter((r) => r.category === "focus" && r.traditions.length);
  if (traditionFocus.length) console.warn(`\nWARNING: focus spells with a tradition: ${traditionFocus.map((r) => r.name).join(", ")}`);

  const byCategory = {};
  for (const r of records) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  // one record per line, so a refresh reads as a clean diff
  await writeFile(DATA_PATH, "[\n" + records.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n");
  console.log(`\nWrote ${records.length} spells to ${DATA_PATH}: ${JSON.stringify(byCategory)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
