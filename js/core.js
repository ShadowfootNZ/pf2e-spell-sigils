// Spell Sigils: seeded randomness, colors and SVG helpers shared by the other scripts.

/* ---------------- deterministic per-spell RNG ---------------- */
function hashString(str){
  let h = 2166136261 >>> 0;
  for (let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFor(spell){
  // seeded on the spell's name so two spells with identical rank/traditions/traits still diverge
  return mulberry32(hashString(spell.name + '::' + spell.slug));
}

/* ---------------- colors ---------------- */
// each tradition is a hue *range*, not a fixed color — spells within a tradition still vary
const TRAD_HSL = {
  arcane: {h:212, hueSpread:34, s:70, sSpread:12, l:60, lSpread:10},   // deep indigo-blue <-> electric cyan
  divine: {h:42,  hueSpread:24, s:75, sSpread:14, l:58, lSpread:12},   // amber <-> pale gold-white
  occult: {h:274, hueSpread:30, s:62, sSpread:14, l:63, lSpread:10},   // indigo-violet <-> magenta
  primal: {h:140, hueSpread:36, s:52, sSpread:14, l:50, lSpread:10},   // teal-green <-> yellow-green
  // representative swatch for traditionless spells (filter chip, list dot, readout badge) — the actual
  // sigil for each traditionless spell instead draws a fresh random hue per spell, see pickNoneHue()
  none:   {h:341, hueSpread:8,  s:60, sSpread:14, l:55, lSpread:10},
  // extra ritual color slots (see pickRitualHue) — `h` here is never actually used, since every slot
  // tagged 'ritual' always carries its own random `baseHue` override; only s/l/spread apply
  ritual: {h:0,   hueSpread:10, s:60, sSpread:16, l:52, lSpread:12},
  // class focus spells (see hueForClass) — same deal, `h` unused since every slot tagged 'focus' always
  // carries a baseHue override derived from the spell's own focusClass
  focus:  {h:0,   hueSpread:18, s:62, sSpread:14, l:56, lSpread:10},
};
// traditionless ("none") spells don't share a tradition's fixed hue range — each one gets its own random
// hue instead, drawn from the one gap in the hue wheel that clears all four tradition bands even after
// their own ±hueSpread jitter: occult tops out at 274+30=304°, divine starts at 42-24=18° (i.e. 378°), so
// this band (magenta -> red -> coral) is picked with an extra buffer equal to the jitter spread below.
const NONE_HUE_RANGE = {min:312, max:370};
function pickNoneHue(rng){
  return (NONE_HUE_RANGE.min + rng()*(NONE_HUE_RANGE.max - NONE_HUE_RANGE.min)) % 360;
}
// unlike pickNoneHue, ritual color slots deliberately aren't confined to a tradition-safe gap — a
// ritual already has its own dedicated badge/selector making the category unambiguous, so
// overlapping a tradition's hue here doesn't risk being mistaken for that tradition the way an
// undifferentiated "other" spell would be
function pickRitualHue(rng){
  return rng()*360;
}
// class focus spells get a color tied to their class rather than a per-spell random roll, so every
// spell from the same class reads as the same color family — still not deconflicted against
// tradition/ritual hues (that overlap is fine, per explicit instruction), but classes *are* deconflicted
// from each other: a plain hash of each name landed necromancer and sorcerer on the exact same hue by
// coincidence, which reads as a real bug (two different classes looking identical) rather than an
// accepted overlap. Golden-angle spacing (137.50776...°, the angle that keeps rotational increments
// maximally spread no matter how many steps you take) gives every class its own hue.
//
// The hues live in data/classes.json, one entry per class in the order classes were first seen, and
// init() in js/ui.js loads them into this table. refresh-data.mjs appends any new class from the
// compendium with the next golden-angle hue (index × 137.50776°, mod 360), so an existing class's color
// never changes. A class missing from the file still gets a stable hue from the plain hash below, just
// not a deconflicted one.
const FOCUS_CLASS_HUE = {};
function hueForClass(name){
  return FOCUS_CLASS_HUE[name] != null ? FOCUS_CLASS_HUE[name] : hashString(name) % 360;
}
function tradColor(trad, j){
  const t = TRAD_HSL[trad] || TRAD_HSL.none;
  const baseH = j.baseHue != null ? j.baseHue : t.h;
  const h = baseH + j.hue*t.hueSpread;
  const s = t.s + j.sat*t.sSpread;
  const l = t.l + j.light*t.lSpread;
  return `hsl(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}
function tradColorSolid(trad){
  const t = TRAD_HSL[trad] || TRAD_HSL.none;
  return `hsl(${t.h}, ${t.s}%, ${t.l}%)`;
}
// a darker version of an hsl(...) color string, same hue/saturation, reduced lightness — used to keep
// a wide glow band visually distinct from the crisp line it surrounds, in the line's own color family
function darkenHsl(hslStr, factor){
  const m = hslStr && hslStr.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (!m) return hslStr;
  const [, h, s, l] = m;
  return `hsl(${h}, ${s}%, ${(parseFloat(l)*factor).toFixed(1)}%)`;
}
// inverse of darkenHsl — used for inscribed glyphs/runes so they read as a lit, more luminous version of
// the tradition color rather than blending into the plain structural lines around them. Saturation gets a
// smaller fixed boost alongside lightness, since lightness alone tends to read as "paler" rather than "lit."
function brightenHsl(hslStr, factor){
  const m = hslStr && hslStr.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (!m) return hslStr;
  const [, h, s, l] = m;
  const newS = Math.min(100, parseFloat(s) * 1.15);
  const newL = Math.min(100, parseFloat(l) * factor);
  return `hsl(${h}, ${newS.toFixed(1)}%, ${newL.toFixed(1)}%)`;
}

/* ---------------- svg helpers ---------------- */
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs){
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function polyPoints(n, r, rotDeg, cx, cy, jitterFn){
  const pts = [];
  for (let i=0;i<n;i++){
    let a = rotDeg + i*360/n;
    if (jitterFn) a += jitterFn();
    const rad = a*Math.PI/180;
    pts.push([cx + r*Math.cos(rad), cy + r*Math.sin(rad)]);
  }
  return pts;
}
function ptsAttr(pts){ return pts.map(p => p[0].toFixed(2)+','+p[1].toFixed(2)).join(' '); }
// a convex polygon grown outward by `d`: every edge shifts `d` away from (cx, cy) and neighbouring edges meet
// at their intersection, so each side of the result runs parallel to its original at the same distance.
// Corners move further than `d` (by d/cos of half the turn), as a ruled line's corners do. Returns a fresh
// points array.
function offsetPolygon(pts, d, cx, cy){
  const n = pts.length;
  const edges = pts.map((p, i) => {
    const q = pts[(i+1)%n], dx = q[0]-p[0], dy = q[1]-p[1], len = Math.hypot(dx,dy);
    let nx = -dy/len, ny = dx/len; // unit perpendicular, turned to point away from the center
    if (nx*((p[0]+q[0])/2 - cx) + ny*((p[1]+q[1])/2 - cy) < 0){ nx = -nx; ny = -ny; }
    return {a:[p[0] + nx*d, p[1] + ny*d], u:[dx/len, dy/len]};
  });
  return edges.map((e, i) => {
    const f = edges[(i-1+n)%n]; // the previous edge meets this one at corner i
    const s = ((e.a[0]-f.a[0])*e.u[1] - (e.a[1]-f.a[1])*e.u[0]) / (f.u[0]*e.u[1] - f.u[1]*e.u[0]);
    return [f.a[0] + f.u[0]*s, f.a[1] + f.u[1]*s];
  });
}
function arcPath(cx,cy,r,startDeg,endDeg){
  const s = startDeg*Math.PI/180, e = endDeg*Math.PI/180;
  const x1 = cx+r*Math.cos(s), y1 = cy+r*Math.sin(s);
  const x2 = cx+r*Math.cos(e), y2 = cy+r*Math.sin(e);
  const large = (endDeg-startDeg) % 360 > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}
