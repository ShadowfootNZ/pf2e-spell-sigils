#!/usr/bin/env node
// Refreshes spells-data.json's `category`/`casters`/`focusClass` fields from the real foundryvtt/pf2e
// compendium (packs/pf2e/spells + packs/pf2e/classes), read from a disposable sparse clone in
// .cache/pf2e-pack.
//
// What this does NOT do: touch name/slug/rank/traditions/traits/rarity. Those already live in
// spells-data.json from an earlier export outside this script's scope; this only refreshes the
// folder-derived fields. Every spell is matched by *name* against the fresh
// compendium pull rather than by re-deriving a slug — the compendium's raw spell files don't carry an
// explicit slug field, and guessing the slugification rule risks a silent mismatch that a name-based
// join avoids entirely.
//
// Usage:
//   node refresh-data.mjs
//   node embed-data.mjs   (re-embeds the result into index.html — see that script)

import { existsSync } from "node:fs";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache", "pf2e-pack");
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

// category is purely a function of which compendium folder a spell's file lives under — confirmed for
// both rituals and focus spells (the `focus` trait itself is not reliably present even in the raw
// source data)
async function loadSpellCategories(classNames) {
  const dir = path.join(CACHE_DIR, "packs", "pf2e", "spells");
  const files = await walk(dir);
  const byName = new Map();
  for (const f of files) {
    const rel = path.relative(dir, f).split(path.sep).join("/");
    let category = "spell";
    if (rel.startsWith("rituals/")) category = "ritual";
    else if (rel.startsWith("focus/")) category = "focus";
    else if (rel.startsWith("impossible-spells/")) category = "impossible";

    const raw = JSON.parse(await readFile(f, "utf8"));
    const sys = raw.system || {};
    const entry = { category };
    if (category === "ritual") entry.casters = (sys.ritual && sys.ritual.secondary && sys.ritual.secondary.casters) || 0;
    if (category === "focus") {
      const traits = (sys.traits && sys.traits.value) || [];
      const cls = traits.filter((t) => classNames.includes(t));
      if (cls.length === 1) entry.focusClass = cls[0];
    }
    byName.set(raw.name, entry);
  }
  return byName;
}

async function main() {
  await refreshCache();
  const classNames = await loadClassNames();
  const categories = await loadSpellCategories(classNames);

  const dataPath = path.join(__dirname, "spells-data.json");
  const existing = JSON.parse(await readFile(dataPath, "utf8"));

  let matched = 0;
  const unmatched = [];
  const augmented = existing.map((s) => {
    const c = categories.get(s.name);
    if (!c) {
      unmatched.push(s.name);
      return s;
    }
    matched++;
    const out = { ...s, category: c.category };
    if (c.category === "ritual") out.casters = c.casters;
    else delete out.casters;
    if (c.category === "focus" && c.focusClass) out.focusClass = c.focusClass;
    else delete out.focusClass;
    return out;
  });

  if (unmatched.length) {
    console.warn(`${unmatched.length} spell(s) in spells-data.json had no match in the fresh compendium pull (left untouched):`);
    unmatched.forEach((n) => console.warn("  -", n));
  }
  console.log(`Matched ${matched} of ${existing.length} spells.`);

  await writeFile(dataPath, JSON.stringify(augmented));
  console.log(`Wrote ${dataPath}`);
  console.log("Run `node embed-data.mjs` next to sync index.html's embedded copy.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
