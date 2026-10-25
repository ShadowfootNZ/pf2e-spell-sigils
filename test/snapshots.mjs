#!/usr/bin/env node
// Render regression snapshots. A sigil depends on the code as well as the spell's name and slug, so a
// refactor can silently redraw published images. This builds every spell's sigil in headless Chrome,
// hashes its markup and animation timeline, and compares the hashes with the baseline in
// test/sigils.snapshot. It also lets a few sigils finish drawing by themselves and checks their copied
// images in both display modes, the path that once lost whole bands without any sigil changing, and
// makes a short animation in each format the browser can handle and plays it back. In parchment it
// checks the SVG file too. Every symbol must also carry a note for the atlas, and the atlas and help pages
// must load without errors.
//
// Usage: npm test              compare with the baseline; exits 1 on any difference
//        npm run test:update   rewrite the baseline to match, after an intended change
//
// The hash is taken straight after buildSigil returns, before any frame runs, so it covers what the code
// decides (every element, its attributes and its scheduled animations) and none of the Math.random comet
// jitter that frames add later. Decimals are rounded to two places so that last-digit differences in
// path lengths between Chrome builds don't count as changes.

import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "test", "sigils.snapshot");
const UPDATE = process.argv.includes("--update");
const RELOAD_EVERY = 250; // periodic reloads keep browser memory flat
// copy checks: a rank 10 spell with seven ring medallions, a mythic ritual with caster stations, and a
// class focus spell with writing-only bands
const COPY_SPELLS = ["cataclysm", "freedom", "lay-on-hands"];
// animation check: a cantrip, the quickest to draw, in each format
const ANIMATION_SPELL = "electric-arc";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

// the page is always served over HTTP, never opened from disk, so serve the repository the same way
function serve(){
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(ROOT + path.sep) || !existsSync(file)){ res.writeHead(404).end(); return; }
    try {
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// runs in the page: builds one spell and returns a hash of the whole sigil, the <svg> and everything in
// it, defs included, as tag names, sorted attributes and each element's animations; and how many of its
// coloured parts have no parchment ink, which would leave them near-black on paper
async function sigilHash(slug){
  glowTooSlow = false; // a slow machine must not change what gets built
  buildSigil(SPELLS.find(s => s.slug === slug));
  const svg = document.getElementById("sigil");
  const animations = new Map();
  for (const a of document.getAnimations()){
    const t = a.effect.getTiming();
    const frames = a.effect.getKeyframes().map(({ computedOffset, ...k }) => k);
    const list = animations.get(a.effect.target) || [];
    list.push(JSON.stringify([t.delay, t.duration, t.iterations, t.easing, t.fill, frames]));
    animations.set(a.effect.target, list);
  }
  let text = "";
  for (const e of [svg, ...svg.querySelectorAll("*")]){
    text += e.tagName;
    // role and aria-* name the sigil for assistive technology and don't change the drawing
    for (const a of [...e.attributes].filter(a => a.name !== "role" && !a.name.startsWith("aria-")).sort((x, y) => x.name < y.name ? -1 : 1))
      text += " " + a.name + "=" + a.value;
    for (const a of animations.get(e) || []) text += " @" + a;
    text += "\n";
  }
  document.getAnimations().forEach(a => a.cancel());
  const inkless = [...svg.querySelectorAll("#sigilRoot [stroke], #sigilRoot [fill], #sigilRoot [color]")].filter(e =>
    ["stroke", "fill", "color"].some(prop => /^hsl/.test(e.getAttribute(prop) || "")) && !e.closest('[data-ink], [data-part="halos"], .comet')).length;
  text = text.replace(/-?\d+\.\d+/g, n => (Math.round(+n * 100) / 100).toString());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return { hash: [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join(""), inkless };
}

// runs in the page, once the sigil has finished drawing: checks the image copy and save would produce
async function copyProblems(){
  const problems = [];
  const { svgString, width, height } = captureSigilSvg();
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  if (Math.max(width, height) !== EXPORT_MAX) problems.push(`size ${width}x${height}`);
  if (doc.documentElement.getAttribute("width") != width) problems.push("no width on the image");
  if (doc.querySelector(".comet")) problems.push("comets in the image");
  const halos = doc.querySelector('[data-part="halos"]');
  for (const e of doc.querySelectorAll("#sigilRoot *")){
    if (halos && halos.contains(e)) continue; // the halos have faded out by now
    if (parseFloat(e.style.strokeDashoffset) !== 0 && e.style.strokeDashoffset !== "") problems.push(`undrawn ${e.tagName}`);
    if (e.style.opacity === "0") problems.push(`invisible ${e.tagName}${e.dataset.part ? " " + e.dataset.part : ""}`);
  }
  const blob = await renderSigilBlob();
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width !== width || bitmap.height !== height) problems.push(`PNG ${bitmap.width}x${bitmap.height}`);
  // an inked sigil's SVG file, for programs that ignore CSS: no stylesheet, no filters, every colour a
  // plain rgb() value, and the paper only when asked for
  if (document.querySelector(".stage").classList.contains("parchment")){
    const plain = c => c === "none" || /^rgb\(\d+, \d+, \d+\)$/.test(c); // no hsl(), oklch() or var()
    for (const ground of [false, true]){
      const svg = new DOMParser().parseFromString(await sigilSvgFile({ ground }).text(), "image/svg+xml");
      if (svg.querySelector("parsererror")) { problems.push("SVG doesn't parse"); continue; }
      if (svg.querySelector("style, filter, [filter], [style]")) problems.push("SVG relies on CSS or filters");
      const colours = new Set([...svg.querySelectorAll("#sigilRoot [stroke], #sigilRoot [fill]")].flatMap(e => [e.getAttribute("stroke"), e.getAttribute("fill")]).filter(Boolean));
      const stray = [...colours].filter(c => !plain(c));
      if (stray.length) problems.push(`SVG colours ${stray.join(", ")}`);
      if (!svg.querySelector('[data-part="glyph"] [stroke="rgb(163, 48, 31)"], [data-part="skill"] [stroke="rgb(163, 48, 31)"]')) problems.push("SVG has no red sigils");
      if (!!svg.querySelector("#paper") !== ground) problems.push(ground ? "SVG without its paper" : "SVG with paper unasked");
    }
  }
  return [...new Set(problems)];
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true });
const errors = [];
const watch = page => {
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
};
let failed = false;

try {
  // ---- snapshots
  const started = Date.now();
  const page = await browser.newPage();
  watch(page);
  const open = async () => {
    await page.goto(base, { waitUntil: "load" });
    await page.waitForFunction(() => typeof SPELLS !== "undefined" && SPELLS.length > 0);
    await page.evaluate(`window.__sigilHash = ${sigilHash}`);
  };
  await open();
  const slugs = await page.evaluate(() => SPELLS.map(s => s.slug));
  const version = await page.evaluate(() => SIGIL_VERSION);
  // ---- every symbol carries what the atlas says about it, and a drawing
  const symbolProblems = await page.evaluate(() => [
    ...Object.entries(GLYPHS).map(([k, s]) => [`glyph ${k}`, s]),
    ...Object.entries(SKILL_SIGILS).map(([k, s]) => [`skill ${k}`, s]),
    ...Object.entries(RUNES).flatMap(([t, list]) => list.map((s, i) => [`${t} rune #${i + 1}`, s])),
  ].filter(([, s]) => typeof s.note !== "string" || !s.note.trim() || typeof s.draw !== "function").map(([name]) => name));
  if (symbolProblems.length){ console.log("Symbols without a note or a drawing:", symbolProblems.join(", ")); failed = true; }
  const hashes = new Map(), inkless = [];
  for (let i = 0; i < slugs.length; i++){
    if (i && i % RELOAD_EVERY === 0) await open();
    const built = await page.evaluate(slug => window.__sigilHash(slug), slugs[i]);
    hashes.set(slugs[i], built.hash);
    if (built.inkless) inkless.push(`${slugs[i]} (${built.inkless})`);
  }
  await page.close();
  console.log(`Built ${hashes.size} sigils in ${Math.round((Date.now() - started)/1000)}s.`);
  if (inkless.length){ console.log(`Parts with no parchment ink in ${inkless.length} sigils:`, inkless.slice(0, 20).join(", ")); failed = true; }

  const old = new Map();
  let oldVersion = null;
  if (existsSync(BASELINE)){
    for (const line of (await readFile(BASELINE, "utf8")).split("\n")){
      if (!line || line.startsWith("#")) continue;
      const [key, value] = line.split("\t");
      if (key === "version") oldVersion = Number(value); else old.set(key, value);
    }
  }
  const added = [...hashes.keys()].filter(s => !old.has(s));
  const removed = [...old.keys()].filter(s => !hashes.has(s));
  const changed = [...hashes.keys()].filter(s => old.has(s) && old.get(s) !== hashes.get(s));
  const list = (label, items) => { if (items.length) console.log(`  ${label} (${items.length}): ${items.slice(0, 40).join(", ")}${items.length > 40 ? `, and ${items.length - 40} more` : ""}`); };
  list("changed", changed); list("new", added); list("gone", removed);
  if (oldVersion !== null && oldVersion !== version) console.log(`  SIGIL_VERSION is ${version}; the baseline was made at ${oldVersion}.`);
  const differs = changed.length || added.length || removed.length || oldVersion !== version;

  if (UPDATE){
    const lines = ["# Render snapshot of every sigil: slug, then a hash of its markup and animation timeline.",
      "# Written by `npm run test:update` (test/snapshots.mjs); commit it with the change that moves it.",
      `version\t${version}`, ...[...hashes].sort(([a], [b]) => a < b ? -1 : 1).map(([s, h]) => `${s}\t${h}`)];
    await writeFile(BASELINE, lines.join("\n") + "\n");
    console.log(differs ? "Baseline updated." : "Baseline already matched; rewritten unchanged.");
    if (changed.length && oldVersion === version)
      console.log(`  ${changed.length} existing sigils changed but SIGIL_VERSION is still ${version}. If a code change caused it and the ` +
        "page is public, bump SIGIL_VERSION in js/sigil.js and update again; a data refresh doesn't need a bump.");
  } else if (!existsSync(BASELINE)){
    console.log("No baseline yet: run `npm run test:update`."); failed = true;
  } else if (differs){
    console.log("Snapshot differs from the baseline. If the change is intended, run `npm run test:update` and commit the " +
      "baseline with it; if code redrew existing sigils of the public page, bump SIGIL_VERSION in js/sigil.js first.");
    failed = true;
  } else console.log(`Snapshot: all ${hashes.size} sigils match the baseline (version ${version}).`);

  // ---- copies of sigils left to finish drawing by themselves, one page at a time: on Linux, headless
  // Chrome draws no frames for a page that isn't in front, so its sigil would never draw
  const results = [];
  for (const slug of COPY_SPELLS){
    const p = await browser.newPage();
    watch(p);
    await p.setViewport({ width: 1440, height: 900 });
    await p.evaluateOnNewDocument(() => { window.__ready = new Promise(r => document.addEventListener("sigil-ready", r, { once: true })); });
    await p.goto(base + "#" + encodeURIComponent(slug), { waitUntil: "load" });
    await p.evaluate(() => window.__ready);
    await p.evaluate(`window.__copyProblems = ${copyProblems}`);
    const dark = await p.evaluate(() => window.__copyProblems());
    await p.click("#bgToggle");
    const parchment = await p.evaluate(() => window.__copyProblems());
    await p.close();
    results.push([slug, dark, parchment]);
  }
  const copyFailures = results.flatMap(([slug, dark, parchment]) =>
    [["dark", dark], ["parchment", parchment]].filter(([, p]) => p.length).map(([mode, p]) => `${slug} (${mode}): ${p.join("; ")}`));
  if (copyFailures.length){ console.log("Copy check failed:"); copyFailures.forEach(f => console.log("  " + f)); failed = true; }
  else console.log(`Copy check: ${COPY_SPELLS.join(", ")}, dark and parchment, all complete.`);

  // ---- the atlas and help pages: they load their own stylesheets and scripts and the fonts, and the
  // atlas draws a card for every symbol and the empty station
  const pageProblems = [];
  for (const file of ["atlas.html", "help.html"]){
    const p = await browser.newPage();
    watch(p);
    await p.goto(base + file, { waitUntil: "networkidle0" });
    const { cards, fonts } = await p.evaluate(async () => { await document.fonts.ready;
      return { cards: document.querySelectorAll(".card").length, fonts: [...document.fonts].filter(f => f.status === "loaded").length }; });
    if (file === "atlas.html"){
      const expected = await p.evaluate(() => Object.keys(GLYPHS).length + Object.keys(SKILL_SIGILS).length + RUNE_COUNT + 1);
      if (cards !== expected) pageProblems.push(`atlas has ${cards} cards, not ${expected}`);
    }
    if (!fonts) pageProblems.push(`${file} loaded no fonts`);
    await p.close();
  }
  if (pageProblems.length){ console.log("Pages check failed:", pageProblems.join("; ")); failed = true; }
  else console.log("Pages check: the atlas and help load, with their fonts.");

  // ---- animations: each format made, then played back to its full length and size
  const p = await browser.newPage();
  watch(p);
  await p.goto(base + "#" + ANIMATION_SPELL, { waitUntil: "load" });
  await p.waitForFunction(() => typeof SPELLS !== "undefined" && SPELLS.length > 0);
  const clips = await p.evaluate(async () => {
    const results = [];
    for (const format of Object.keys(FORMATS)){
      // a Chrome built without H.264, as some Linux builds are, can neither make nor play an MP4. That's
      // the browser rather than the page, so the format is skipped, and the summary says so
      const f = FORMATS[format];
      const config = { codec: f.codec, width: ANIMATION.size, height: ANIMATION.size, bitrate: ANIMATION.bitrate, framerate: ANIMATION.fps };
      if (!(await VideoEncoder.isConfigSupported(config)).supported || !document.createElement("video").canPlayType(`${f.mime}; codecs="${f.codec}"`)){
        results.push({ format, skipped: true });
        continue;
      }
      const blob = await makeAnimation(format);
      const video = Object.assign(document.createElement("video"), { src: URL.createObjectURL(blob), muted: true });
      const problem = await new Promise(resolve => { video.onloadedmetadata = () => resolve(null); video.onerror = () => resolve("doesn't play"); });
      results.push({ format, mb: (blob.size / 1e6).toFixed(1), seconds: video.duration, width: video.videoWidth, height: video.videoHeight, problem,
        settled: !sigilClock.stepped && !document.querySelector(".stage").classList.contains("exporting") });
    }
    return results;
  });
  await p.close();
  const made = clips.filter(c => !c.skipped), skipped = clips.filter(c => c.skipped).map(c => c.format);
  const clipFailures = made.filter(c => c.problem || !(c.seconds > 3) || c.width !== 720 || c.height !== 720 || !c.settled);
  if (clipFailures.length || !made.length){ console.log("Animation check failed:", JSON.stringify(clipFailures.length ? clipFailures : clips)); failed = true; }
  else console.log(`Animation check: ${made.map(c => `${c.format} ${c.seconds.toFixed(1)}s ${c.mb} MB`).join(", ")}, played back` +
    (skipped.length ? `; ${skipped.join(", ")} skipped, as this browser can't encode or play it.` : "."));

  if (errors.length){ console.log("Page errors:"); [...new Set(errors)].forEach(e => console.log("  " + e)); failed = true; }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
