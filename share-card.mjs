#!/usr/bin/env node
// Makes share-card.jpg, the image a link to the site shows in Discord, Slack, iMessage and the like (the
// og:image in index.html): Compel True Name's sigil as it rests after drawing, beside the site's name and
// tagline, at the 1200 by 630 that link cards use. Compel True Name is the one spell with all four
// traditions' colours, at least three trait medallions and at least two rune bands. Run it again after a
// change that redraws that sigil; npm test names it when one does.
//
// Usage: node share-card.mjs

import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SPELL = "compel-true-name";
const OUT = path.join(ROOT, "share-card.jpg");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(ROOT + path.sep) || !existsSync(file)){ res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(await readFile(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const { tagline } = JSON.parse(await readFile(path.join(ROOT, "catalogue.json"), "utf8"));

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.evaluateOnNewDocument(() => { window.__ready = new Promise(r => document.addEventListener("sigil-ready", r, { once: true })); });
  await page.goto(base + "#" + SPELL, { waitUntil: "load" });
  await page.evaluate(() => window.__ready);
  // the sigil as the Export panel's PNG draws it, transparent, framed square on its centre
  const sigil = await page.evaluate(async () => {
    const b = document.getElementById("sigilRoot").getBBox();
    const side = 2 * Math.max(300 - b.x, b.x + b.width - 300, 300 - b.y, b.y + b.height - 300) + 30, size = 1200;
    const { svgString } = sigilSvgClone({ box: { x: 300 - side / 2, y: 300 - side / 2, w: side, h: side }, size });
    const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
    await rasterize(svgString, canvas.getContext("2d"), size, size);
    return canvas.toDataURL("image/png");
  });

  // the card: the page's dark ground, the sigil to the left and the name and tagline to the right
  const card = await browser.newPage();
  await card.setViewport({ width: 1200, height: 630 });
  await card.goto(base + "help.html", { waitUntil: "load" }); // for the site's fonts and stylesheet
  await card.evaluate((sigil, tagline) => {
    document.documentElement.className = "";
    document.head.insertAdjacentHTML("beforeend", `<style>
      html, body{margin:0; width:1200px; height:630px; overflow:hidden;}
      body{background:radial-gradient(ellipse at 30% 50%, #0b0d16, #05060a 75%); display:flex; align-items:center; color:#d8dae8;}
      img{width:590px; height:590px; margin-left:30px; flex:none;}
      .text{padding:0 60px 0 24px;}
      h1{font-family:'Cinzel', serif; font-weight:700; font-size:64px; letter-spacing:.06em; margin:0 0 18px; line-height:1.1;
        text-shadow:0 0 28px rgba(143,208,255,.25);}
      p{font-family:'EB Garamond', serif; font-style:italic; font-size:32px; line-height:1.3; color:#a9adc8; margin:0;}
    </style>`);
    const make = (tag, props) => Object.assign(document.createElement(tag), props);
    const text = make("div", { className: "text" });
    text.append(make("h1", { textContent: "Spell Sigils" }), make("p", { textContent: tagline }));
    document.body.replaceChildren(make("img", { src: sigil, alt: "" }), text);
  }, sigil, tagline);
  await card.evaluate(async () => { await document.fonts.ready; await document.querySelector("img").decode(); });
  await writeFile(OUT, await card.screenshot({ type: "jpeg", quality: 88 }));
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}.`);
} finally {
  await browser.close();
  server.close();
}
