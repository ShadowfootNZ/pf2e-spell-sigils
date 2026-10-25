#!/usr/bin/env node
// Rebuilds data/spells.json and data/classes.json from a disposable sparse clone of foundryvtt/pf2e.
// Existing slugs are preserved because they identify URLs and seed the render; traits and traditions are
// sorted so upstream reordering cannot redraw a sigil on its own. Every data change is printed.
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
    // The cache is disposable; reset instead of pulling because upstream may rewrite its branch history.
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

// ---------------- ritual checks ----------------
// Upstream writes a ritual's checks as free text, such as "Arcana or Occultism (expert)" for the primary
// check and "Arcana or Occultism, Crafting" for the secondary checks. They are stored as:
//   primaryCheck: the options open to the primary caster, each { skill, proficiency }, where proficiency
//     is trained, expert, master, legendary or mythic, or null when the text doesn't name one;
//   secondaryChecks: one entry per check, each the list of skills that can satisfy it. A list of one is a
//     required skill and a longer list is a choice. The proficiencies three rituals name for secondary
//     checks aren't kept.
// A skill is a lowercase skill name, "perception", a Lore's full name ("cooking lore", or "lore" when
// unnamed), "any", or a save ("fortitude", "will"). General rules cover the regular wording; the readings
// below cover every string they can't, and the refresh lists any string that neither handles.
const SKILLS = ["acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy", "intimidation", "medicine",
  "nature", "occultism", "performance", "religion", "society", "stealth", "survival", "thievery"];
const MAGIC_SKILLS = ["arcana", "nature", "occultism", "religion"];
const PROFICIENCY = "trained|expert|master|legendary|mythic";

const PRIMARY_READINGS = {
  // Unfettered Mark
  "Crafting (master) or any (legendary)": [{ skill: "crafting", proficiency: "master" }, { skill: "any", proficiency: "legendary" }],
  // Commune with Corazal: DC 24 for a master or DC 29 for an expert, so expert is enough to attempt it
  "DC 24 Nature (master) or DC 29 Nature (expert)": [{ skill: "nature", proficiency: "expert" }],
  // Shroud of the Provinces: upstream names no actual rank
  "Nature (proficiency)": [{ skill: "nature", proficiency: null }],
  // Synchronize Ley Line: the skills depend on which ley line is being synchronized
  "see below": [],
  // Embodied Font
  "skill corresponding to the target's casting tradition (trained)": MAGIC_SKILLS.map((skill) => ({ skill, proficiency: "trained" })),
};

// a reading can also be a function of the ritual's parsed primary check, for checks defined relative to it
const sameAsPrimary = (primary) => primary.map((o) => o.skill);
const SECONDARY_READINGS = {
  "Alcohol Lore (or related lore), Crafting, Society": [["alcohol lore"], ["crafting"], ["society"]],
  "Arcana or Occultism (whichever isn't used for the primary check), Diplomacy": [["arcana", "occultism"], ["diplomacy"]],
  "Arcana or Occultism (whichever isn't used for the primary check), Society": [["arcana", "occultism"], ["society"]],
  "Arcana or Occultism (whichever isn't used for the primary check), Survival": [["arcana", "occultism"], ["survival"]],
  // Blunt the Final Blade: the other of the primary check's two skills
  "Arcana, Crafting, Society, and the other skill not used for the primary check": (p) => [["arcana"], ["crafting"], ["society"], sameAsPrimary(p)],
  "Arcana, Nature, Occultism, Religion (cannot be the same skill as for the primary check)": [MAGIC_SKILLS],
  "Arcana, Nature, Occultism, Religion (whichever three aren't used for the primary check)": [MAGIC_SKILLS],
  "Arcana, Nature, Occultism, Religion, or Society (whichever is required to Recall Knowledge about the creature being duplicated); Crafting; Deception":
    [[...MAGIC_SKILLS, "society"], ["crafting"], ["deception"]],
  "Arcana, Nature, Occultism, or Religion (whichever is used for the primary check) and Warfare Lore": [MAGIC_SKILLS, ["warfare lore"]],
  "Crafting, Arcana or Occultism (whichever isn't used for the primary check)": [["crafting"], ["arcana", "occultism"]],
  "Crafting, Occultism or Religion (whichever isn't used for the primary check)": [["crafting"], ["occultism", "religion"]],
  "Diplomacy or Intimidation; Arcana or Occultism (whichever isn't used for the primary check)": [["diplomacy", "intimidation"], ["arcana", "occultism"]],
  "Fortitude, Society, Will": [["fortitude"], ["society"], ["will"]],
  "Lore (any), Society, Survival": [["lore"], ["society"], ["survival"]],
  "Lore (any), Survival, Thievery": [["lore"], ["survival"], ["thievery"]],
  "Lore (related to the destination plane), Survival": [["lore"], ["survival"]],
  "Nature or Religion (whichever is used for the primary check)": [["nature", "religion"]],
  "Nature, Occultism or Religion (whichever is used for the primary check)": [["nature", "occultism", "religion"]],
  "Occultism or Religion (whichever is used for the primary check); Diplomacy, Performance, Society, or a Lore corresponding to the rightful owners":
    [["occultism", "religion"], ["diplomacy", "performance", "society", "lore"]],
  "Occultism or Religion (whichever isn't used for the primary check)": [["occultism", "religion"]],
  "Performance, Religion, Society, Mammoth Lord Lore or a similar Lore skill, Survival": [["performance"], ["religion"], ["society"], ["mammoth lord lore"], ["survival"]],
  // Awaken Portal
  "Whichever is used for the primary check": (p) => [sameAsPrimary(p)],
  // Unfettered Mark
  "any": [["any"]],
  // Synchronize Ley Line: the skills depend on which ley line is being synchronized
  "see below": [],
};

const checkProblems = [];
const readingsUsed = new Set();

function skillName(raw) {
  const s = raw.trim().toLowerCase();
  if (SKILLS.includes(s) || s === "perception") return s;
  if (/^[a-z' -]+ lore$/.test(s)) return s;
  return null;
}

// "Arcana or Occultism (expert)": options separated by commas and "or"; a proficiency in brackets covers
// every option before it that names none of its own
function parsePrimaryCheck(text, spellName) {
  if (text in PRIMARY_READINGS) { readingsUsed.add("primary: " + text); return PRIMARY_READINGS[text]; }
  const s = text.trim()
    .replace(/\bDC \d+\s+/g, "")
    .replace(/\s+as determined by .*$/i, "")
    .replace(/,?\s+matching the [^()]*?(?=\s*\(|$)/i, "")
    .replace(new RegExp(`\\((${PROFICIENCY})\\b[^)]*\\)`, "gi"), (_, p) => `(${p.toLowerCase()})`);
  const options = [];
  for (const token of s.split(/,\s*(?:or\s+)?|\s+or\s+/).map((t) => t.trim()).filter(Boolean)) {
    const m = token.match(new RegExp(`^(.*?)\\s*(?:\\((${PROFICIENCY})\\))?$`));
    const skill = m && skillName(m[1]);
    if (!skill) { checkProblems.push(`${spellName}: primary check ${JSON.stringify(text)}`); return null; }
    options.push({ skill, proficiency: m[2] || null });
  }
  let carry = null;
  for (let i = options.length - 1; i >= 0; i--) {
    if (options[i].proficiency) carry = options[i].proficiency;
    else options[i].proficiency = carry;
  }
  if (new Set(options.map((o) => o.skill)).size !== options.length) {
    checkProblems.push(`${spellName}: primary check ${JSON.stringify(text)} names a skill twice`);
    return null;
  }
  return options;
}

// "Arcana or Occultism, Crafting" is two checks, the first a choice; "A, B, or C" is one choice of three;
// semicolons separate checks whose options themselves contain commas
function parseSecondaryChecks(text, primary, spellName) {
  if (text in SECONDARY_READINGS) {
    readingsUsed.add("secondary: " + text);
    const reading = SECONDARY_READINGS[text];
    return typeof reading === "function" ? reading(primary || []) : reading;
  }
  const s = text.trim()
    .replace(/\s*\(DC \d+[^)]*\)/g, "")
    .replace(/\bDC \d+\s+/g, "")
    .replace(new RegExp(`\\s*\\((${PROFICIENCY})\\)`, "gi"), "");
  if (!s) return [];
  const problem = () => { checkProblems.push(`${spellName}: secondary checks ${JSON.stringify(text)}`); return null; };
  if (/[()]|whichever|\bany\b|\band\b/i.test(s)) return problem();
  const options = (part) => part.split(/,\s*(?:or\s+)?|\s+or\s+/).map((t) => t.trim()).filter(Boolean);
  let groups;
  if (s.includes(";")) groups = s.split(";").map(options);
  else if (/,\s*or\s+/.test(s)) groups = [options(s)];
  else groups = s.split(",").map((part) => part.split(/\s+or\s+/).map((t) => t.trim()).filter(Boolean));
  const checks = groups.map((g) => g.map(skillName));
  if (checks.some((g) => !g.length || g.some((x) => !x))) return problem();
  return checks;
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
  if (record.category === "ritual") {
    const ritual = sys.ritual || {};
    record.casters = (ritual.secondary && ritual.secondary.casters) || 0;
    record.primaryCheck = parsePrimaryCheck((ritual.primary && ritual.primary.check) || "", raw.name);
    record.secondaryChecks = parseSecondaryChecks((ritual.secondary && ritual.secondary.checks) || "", record.primaryCheck, raw.name);
  }
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

  const rituals = records.filter((r) => r.category === "ritual");
  console.log(`\nRitual checks: ${rituals.length} rituals, ${readingsUsed.size} check strings read from the readings table.`);
  if (checkProblems.length) {
    console.warn(`WARNING: ${checkProblems.length} check string(s) neither the general rules nor the readings handle (stored as null):`);
    checkProblems.forEach((p) => console.warn(`  ! ${p}`));
  }
  const unused = [...Object.keys(PRIMARY_READINGS).map((k) => "primary: " + k), ...Object.keys(SECONDARY_READINGS).map((k) => "secondary: " + k)]
    .filter((k) => !readingsUsed.has(k));
  if (unused.length) {
    console.log("Readings no longer used by any ritual (safe to delete):");
    unused.forEach((k) => console.log(`  - ${k}`));
  }

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
