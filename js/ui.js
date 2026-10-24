// Spell Sigils: the sidebar, readout and image export, plus loading the spell data and startup.

function el2(tag, cls, text){ const e=document.createElement(tag); e.className=cls; e.textContent=text; return e; }

// every spell record, fetched from data/spells.json by init() at the bottom of this file
let SPELLS = [];

/* ---------------- sidebar / filters ---------------- */
// empty trads/ranks sets mean "no filter applied" (show all) — see renderList — rather than
// "match nothing," so chips start unselected and picking one narrows down from everything.
// category ('none'/'ritual'/'focus', or null) is a separate axis from trads, and the two are mutually
// exclusive rather than combined: picking one of Other/Ritual/Focus is "the only thing I'm interested
// in" (clears any tradition selection), and picking a tradition backs back out of category mode. Both
// stay visible at all times — neither hides the other, they just can't both be active together.
// focusClass is a single nullable value, not a Set — picking one class deselects any other, the same
// radio-button behavior Ritual/Focus/tradition already have relative to each other
const state = { search:'', trads:new Set(), ranks:new Set(), category:null, focusClass:null };

const classFilterEl = document.getElementById('classFilters');
// leaves the class subselector row hidden and its own selection cleared — shared by every path that
// backs out of (or switches away from) Focus specifically: a tradition chip, Ritual, or Focus itself
// toggling off
function resetClassFilter(){
  state.focusClass = null;
  classFilterEl.hidden = true;
  [...classFilterEl.children].forEach(el => el.dataset.active = '0');
}

const tradFilterEl = document.getElementById('tradFilters');
const categoryChipEls = [];
['arcane','divine','occult','primal'].forEach(tr=>{
  const c = el2('div','chip', tr);
  c.dataset.trad = tr; c.dataset.active = '0';
  c.addEventListener('click', ()=>{
    if (state.trads.has(tr)) state.trads.delete(tr); else state.trads.add(tr);
    c.dataset.active = state.trads.has(tr) ? '1':'0';
    // stepping into tradition-space backs out of category mode, even on a deselecting click —
    // the two axes don't combine
    if (state.category !== null){
      state.category = null;
      categoryChipEls.forEach(el => el.dataset.active = '0');
      resetClassFilter();
    }
    renderList();
  });
  tradFilterEl.appendChild(c);
});

// Ritual/Focus: a spell can only ever be in exactly one of these (or neither), so they act as one
// mutually-exclusive group between themselves, and as a group they're mutually exclusive with the
// tradition chips above too — activating one clears any active tradition selection. There's no third
// "other" chip here — checked directly, every traditionless spell in the whole dataset is either a
// ritual or a focus spell, so a generic catch-all for "traditionless and neither" would always be
// empty. If that ever stops being true, a spell like that is still reachable by name via search with
// nothing else selected.
['ritual','focus'].forEach(cat=>{
  const c = el2('div','chip', cat);
  c.dataset.trad = cat; c.dataset.active = '0';
  c.addEventListener('click', ()=>{
    state.category = state.category === cat ? null : cat;
    categoryChipEls.forEach(el => el.dataset.active = state.category === el.dataset.trad ? '1' : '0');
    if (state.trads.size){
      state.trads.clear();
      [...tradFilterEl.querySelectorAll('.chip')].forEach(el=>{
        if (!categoryChipEls.includes(el)) el.dataset.active = '0';
      });
    }
    // the class subselector only makes sense while Focus is the active category — show it fresh on
    // entry, and clear/hide it on every other transition (leaving Focus, or switching to Ritual)
    if (state.category === 'focus') classFilterEl.hidden = false;
    else resetClassFilter();
    renderList();
  });
  tradFilterEl.appendChild(c);
  categoryChipEls.push(c);
});

// class subselector — only appears while Focus is active (see above). Built from whichever classes
// actually appear on a focus spell in the data (checked: 15 of the 29 real PF2E classes have at least
// one), rather than the full canonical list, so there's never a chip that can only ever show zero
// spells. 'other' covers the archetype-granted focus spells with no single owning class. Called by
// init() once the data has loaded.
function buildClassFilters(){
  const classCounts = {};
  SPELLS.forEach(s => { if (s.category === 'focus') classCounts[s.focusClass || 'other'] = (classCounts[s.focusClass || 'other']||0)+1; });
  const classes = Object.keys(classCounts).filter(c=>c!=='other').sort();
  classes.push('other');
  const classChipEls = [];
  classes.forEach(cls=>{
    const c = el2('div','chip', cls);
    c.dataset.class = cls; c.dataset.active = '0';
    if (cls !== 'other') c.style.setProperty('--class-hue', hueForClass(cls).toFixed(1));
    c.addEventListener('click', ()=>{
      // single-select: picking a class deselects any other, same as Ritual/Focus/tradition are already
      // mutually exclusive with each other one level up
      state.focusClass = state.focusClass === cls ? null : cls;
      classChipEls.forEach(el => el.dataset.active = state.focusClass === el.dataset.class ? '1' : '0');
      renderList();
    });
    classChipEls.push(c);
    classFilterEl.appendChild(c);
  });
}

const rankFilterEl = document.getElementById('rankFilters');
for(let r=0;r<=10;r++){
  const c = el2('div','rank-chip', r===0?'C':String(r));
  c.dataset.active='0';
  c.addEventListener('click', ()=>{
    if (state.ranks.has(r)) state.ranks.delete(r); else state.ranks.add(r);
    c.dataset.active = state.ranks.has(r) ? '1':'0';
    renderList();
  });
  rankFilterEl.appendChild(c);
}

document.getElementById('search').addEventListener('input', e=>{
  state.search = e.target.value.trim().toLowerCase();
  renderList();
});

/* ---------------- parchment: ink on paper ---------------- */
// Parchment mode turns the whole stage to paper and redraws the sigil in ink, by CSS alone: nothing about
// colorAt()/TRAD_HSL or the spell changes, and nothing is redrawn. Everything is a warm near-black ink, with
// the trait and skill sigils picked out in red, as rubrication in a manuscript. An inked sigil doesn't
// glow: the halos and the comets' light go, a draw-on spark keeps only its core, as an ink dot riding the
// tip like a pen nib, and once drawn the sigil sits still (setIdleStill). These colours and the sigil's
// rules are defined here, once, for the page and for copied images, whose standalone SVG has no stylesheet
const PARCHMENT = {ink:'#2b2520', red:'#a3301f', paper:['#f5edd8', '#eee2c4', '#dfcda4']};
// the sigil's ink rules, inside `scope` (the page's parchment stage, or nothing in a copied image). They
// override the colours the sigil is drawn with as attributes, which any CSS rule outranks; the sigils'
// rules come after the general ones, which they otherwise tie with
function inkRules(scope){
  const r = `${scope}#sigilRoot`, sigils = ['glyph', 'skill'].map(p => `${r} [data-part="${p}"]`);
  return `
    ${r} [stroke]:not([stroke="none"]){stroke:${PARCHMENT.ink};}
    ${r} [fill]:not([fill="none"]):not([fill="transparent"]){fill:${PARCHMENT.ink};}
    ${r} [color]{color:${PARCHMENT.ink};}
    ${sigils.map(g => `${g}[stroke], ${g} [stroke]:not([stroke="none"])`).join(', ')}{stroke:${PARCHMENT.red};}
    ${sigils.map(g => `${g} [fill]:not([fill="none"]):not([fill="transparent"])`).join(', ')}{fill:${PARCHMENT.red};}
    ${sigils.join(', ')}{color:${PARCHMENT.red};}
    ${r} [data-part="halos"], ${r} [data-part="flare"], ${r} [data-part="particle"], ${r} [data-idle]{display:none;}
    ${r} [data-part="core"]{filter:none;}`;
}
document.head.appendChild(Object.assign(document.createElement('style'), {textContent: inkRules('.stage.parchment ')}));
// the paper and the ink for the rest of the stage's parchment styling (styles.css)
[['--parchment-ink', PARCHMENT.ink], ...PARCHMENT.paper.map((c, i) => [`--paper-${i}`, c])]
  .forEach(([name, value]) => document.documentElement.style.setProperty(name, value));

document.getElementById('bgToggle').addEventListener('click', function(){
  const on = this.getAttribute('aria-pressed') !== 'true';
  this.setAttribute('aria-pressed', on);
  document.querySelector('.stage').classList.toggle('parchment', on);
  // max glow has nothing to show on paper: it goes off and waits for the ink to be put away
  if (on && maxGlowToggle.getAttribute('aria-pressed') === 'true') maxGlowToggle.click();
  maxGlowToggle.disabled = on;
  setIdleStill('parchment', on);
});

/* ---------------- copy sigil as image ---------------- */
// "max glow" is a direct toggle on the live sigil rather than a copy-time-only state: click it to hold
// the glow at the peak of startGlow()'s flash, click again to drop back to the floor resetGlow() itself
// uses. The glow is an SVG filter on the sigil itself, so copying snapshots whatever's currently on
// screen — no forcing or restoring inside the copy path itself, so "which glow state did I get" is always
// exactly whatever the toggle (and the page's own settle-after-draw sequence) left it at.
const maxGlowToggle = document.getElementById('maxGlowToggle');
maxGlowToggle.addEventListener('click', () => {
  const on = maxGlowToggle.getAttribute('aria-pressed') !== 'true';
  maxGlowToggle.setAttribute('aria-pressed', on);
  setGlow(on ? GLOW_PEAK : GLOW_FLOOR);
  if (glowTooSlow || !on) setIdleStill('max glow', on);
});
// shared by copy-to-clipboard and save-to-file — everything up to the serialized SVG string runs
// synchronously (no `await` yet), so the current visual state is frozen before either path does any
// async work
function captureSigilSvg(){
  const svgEl = document.getElementById('sigil');
  // the live viewBox is a fixed 0 0 600 600, but ring medallions routinely straddle/exceed that box —
  // #sigil's own overflow:visible is what lets them spill out on screen. A standalone exported SVG has
  // no such CSS to inherit, so it clips to its viewBox by default; getBBox() finds the *actual* rendered
  // extent (geometry only, not filter/glow spread, hence the generous padding) and the export uses that
  // instead of the nominal canvas size.
  const bbox = document.getElementById('sigilRoot').getBBox();
  const pad = 40;
  const vx = bbox.x - pad, vy = bbox.y - pad, vw = bbox.width + pad*2, vh = bbox.height + pad*2;
  const clone = svgEl.cloneNode(true);
  // the draw-on animations hold each element at its finished state without writing it back, and inline
  // they still say "undrawn": a raw clone would serialize the undrawn markup. Nor can commitStyles() be
  // trusted to write it back, since the browser drops a finished draw-on animation once an idle pulse
  // takes over the same element's opacity. So each element in the clone takes what's on screen: the
  // computed values of the three properties the animations move
  const liveEls = svgEl.querySelectorAll('*'), cloneEls = clone.querySelectorAll('*');
  liveEls.forEach((e, i) => {
    const cs = getComputedStyle(e), c = cloneEls[i].style;
    c.opacity = cs.opacity; c.strokeDasharray = cs.strokeDasharray; c.strokeDashoffset = cs.strokeDashoffset;
  });
  // the comets are light passing over the drawing, not part of it
  clone.querySelectorAll('.comet').forEach(c => c.remove());
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
  // the PNG's own size, at most EXPORT_MAX on its long side. The viewBox isn't guaranteed square (a
  // satellite can stick out further on one side than another), so it keeps the viewBox's aspect ratio.
  // The image is given this size, not left to its natural one: with only a viewBox, an SVG image comes
  // out 150px tall, and Safari draws its filters at that size before scaling up, which left iPad copies
  // soft, with blurred doubled lines
  const scale = EXPORT_MAX / Math.max(vw, vh), width = Math.round(vw*scale), height = Math.round(vh*scale);
  clone.setAttribute('width', width); clone.setAttribute('height', height);
  const isParchment = document.querySelector('.stage').classList.contains('parchment');
  // parchment gets the paper baked in and the ink rules embedded, since the paper is CSS on the stage and
  // the ink rules are a stylesheet, neither of which the standalone clone has; the dark mode gets no
  // backdrop at all, so the exported PNG keeps a transparent background instead of a solid black square
  if (isParchment){
    const paper = el('radialGradient', {id:'paper', cx:'50%', cy:'50%', r:'70%'});
    PARCHMENT.paper.forEach((c, i) => paper.appendChild(el('stop', {offset:[0, 0.7, 1][i], 'stop-color':c})));
    clone.querySelector('defs').appendChild(paper);
    clone.insertBefore(el('rect', {x:vx, y:vy, width:vw, height:vh, fill:'url(#paper)'}), clone.firstChild);
    clone.insertBefore(Object.assign(document.createElementNS(NS, 'style'), {textContent: inkRules('')}), clone.firstChild);
    // an inked sigil doesn't glow; on screen the stylesheet takes off any glow filter the sigil carries
    clone.querySelector('#sigilRoot').removeAttribute('filter');
  } else {
    // the glow filter, which on screen the sigil carries only while the glow shows: at rest its 0px halos
    // lay the faint tint that the stylesheet's drop-shadows give the live sigil, and the clone has no
    // stylesheet
    clone.querySelector('#sigilRoot').setAttribute('filter', 'url(#sigilGlow)');
  }
  return { svgString: new XMLSerializer().serializeToString(clone), width, height };
}
// returns a promise for the rasterized PNG blob — kept as a *pending* promise (not awaited here) so
// copySigilImage can hand it straight to ClipboardItem, which is what lets the eventual clipboard write
// still count against the click's transient user activation despite the decode/encode work taking a beat
const EXPORT_MAX = 1200;
function renderSigilBlob(){
  const { svgString, width, height } = captureSigilSvg();
  return (async () => {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString); });
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  })();
}
async function copySigilImage(){
  await navigator.clipboard.write([new ClipboardItem({'image/png': renderSigilBlob()})]);
}
async function saveSigilImage(){
  const blob = await renderSigilBlob();
  // reads straight off the readout rather than looking up `currentSlug` in SPELLS — guaranteed to match
  // whatever's actually on screen regardless of how it got there, since buildSigil() itself is what sets
  // this text, synchronously, every time it draws a spell
  const shownName = document.getElementById('roName').textContent;
  // strips characters invalid in a filename on Windows (\/:*?"<>|) — macOS/Linux only really care about
  // /, but stripping the whole set keeps one filename safe everywhere rather than branching on OS
  const name = (shownName || 'sigil').replace(/[\\/:*?"<>|]+/g, '').trim() || 'sigil';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// browsers offer the clipboard for images only to a secure page, one served over https or from
// localhost; reached by a network address over plain http, as an iPad on the same network reaches a dev
// server, the API isn't there at all
const clipboardAvailable = window.isSecureContext && !!navigator.clipboard && typeof ClipboardItem === 'function';
// the icon turns green or red for a moment, and its label and tooltip say what happened
[['copyImage', copySigilImage, 'Copied', 'Copy failed'], ['saveImage', saveSigilImage, 'Saved', 'Save failed']].forEach(([id, action, okText, errText]) => {
  const btn = document.getElementById(id);
  const label = btn.getAttribute('aria-label');
  const show = (state, text) => {
    if (state) btn.dataset.state = state; else delete btn.dataset.state;
    btn.setAttribute('aria-label', text);
    btn.title = text;
  };
  btn.addEventListener('click', async ()=>{
    try {
      if (id === 'copyImage' && !clipboardAvailable){
        // a tooltip never shows on a touch screen, so the reason goes in the readout
        setNote('Copying an image needs the page on https. Save works anywhere.');
        throw new Error('the clipboard API needs a secure context');
      }
      await action();
      show('ok', okText);
    } catch(err){
      console.error(id + ' failed', err);
      show('err', errText);
    }
    setTimeout(()=>show(null, label), 1400);
  });
});
// copy and save wait for the drawing and its flash to finish, so an image is never taken mid-draw
['sigil-drawing', 'sigil-ready'].forEach(type => document.addEventListener(type, () => {
  ['copyImage', 'saveImage'].forEach(id => { document.getElementById(id).disabled = type === 'sigil-drawing'; });
}));

// the drawing rules' version, in the footer (see SIGIL_VERSION in js/sigil.js)
document.getElementById('sigilVersion').textContent = `Sigils v${SIGIL_VERSION}.`;

/* ---------------- phone drawer ---------------- */
// on a phone the sidebar is a drawer over the page (see styles.css): body.drawer-open slides it in and
// stops the page behind it scrolling. On wider screens the class has no effect, so nothing here needs to
// know which layout is showing.
const drawerOpenBtn = document.getElementById('drawerOpen');
function setDrawer(open){
  document.body.classList.toggle('drawer-open', open);
  drawerOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
drawerOpenBtn.addEventListener('click', () => setDrawer(true));
document.getElementById('drawerClose').addEventListener('click', () => setDrawer(false));
document.getElementById('drawerBackdrop').addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });

/* ---------------- permalinks ---------------- */
// the URL's hash names the spell on show, so a link reproduces its sigil for as long as the code and that
// spell's data are unchanged. It's replaced rather than pushed, so Back leaves the page instead of
// stepping through every spell looked at. Slugs can hold apostrophes, commas and parentheses; encoding
// those as well keeps a pasted link whole in Markdown and chat apps.
function slugToHash(slug){
  return '#' + encodeURIComponent(slug).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function slugFromHash(){
  const raw = location.hash.slice(1);
  try { return decodeURIComponent(raw); } catch (e){ return raw; } // a malformed %-escape, typed by hand
}
function setNote(text){
  const note = document.getElementById('roNote');
  note.textContent = text;
  note.hidden = !text;
}

let currentSlug = null;
// draws a spell and makes it the current one, with the list highlight, the URL and the tab title following
function showSpell(s){
  currentSlug = s.slug;
  document.querySelectorAll('#list li').forEach(li => li.classList.toggle('active', li.dataset.slug === s.slug));
  buildSigil(s);
  history.replaceState(null, '', slugToHash(s.slug));
  document.title = `${s.name} · Spell Sigils`;
  setNote('');
}
// on load and whenever the hash is changed by hand: the spell the hash names, or a random one when it
// names none, or names one that is no longer in the data, as happens when upstream drops a spell
function showFromHash(){
  const slug = slugFromHash();
  const named = slug && SPELLS.find(s => s.slug === slug);
  if (named){
    if (named.slug !== currentSlug) showSpell(named);
  } else {
    showSpell(SPELLS[Math.floor(Math.random()*SPELLS.length)]);
    if (slug) setNote(`The linked spell "${slug}" isn't in the current spell data, so a random spell is shown instead.`);
  }
  scrollListToCurrent();
}
// centres the current spell in the list, if the filters show it. Measured from layout rather than with
// scrollIntoView, which would also scroll the page itself on a phone
function scrollListToCurrent(){
  const list = document.getElementById('list');
  const li = list.querySelector('li.active');
  if (!li) return;
  list.scrollTop += li.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - li.offsetHeight)/2;
}

function renderList(){
  const listEl = document.getElementById('list');
  listEl.innerHTML = '';
  const filtered = SPELLS.filter(s=>{
    if (state.search && !s.name.toLowerCase().includes(state.search)) return false;
    if (state.ranks.size && !state.ranks.has(s.rank)) return false;
    if (state.category === 'ritual') return s.category === 'ritual';
    if (state.category === 'focus'){
      if (s.category !== 'focus') return false;
      if (state.focusClass && (s.focusClass || 'other') !== state.focusClass) return false;
      return true;
    }
    if (state.trads.size && !s.traditions.some(t=>state.trads.has(t))) return false;
    return true;
  });
  document.getElementById('count').textContent = `${filtered.length} of ${SPELLS.length} spells`;
  filtered.forEach(s=>{
    const li = document.createElement('li');
    li.dataset.slug = s.slug;
    const primary = s.traditions[0] || 'none';
    li.style.setProperty('--dot', tradColorSolid(primary));
    if (s.slug === currentSlug) li.classList.add('active');
    const nm = document.createElement('span'); nm.textContent = s.name;
    const rk = document.createElement('span'); rk.className='r'; rk.textContent = s.rank===0?'cantrip':'rank '+s.rank;
    li.appendChild(nm); li.appendChild(rk);
    li.addEventListener('click', ()=>{
      showSpell(s);
      // on a phone, picking a spell closes the drawer and brings the sigil back into view
      setDrawer(false);
      window.scrollTo(0, 0);
    });
    listEl.appendChild(li);
  });
}

// the spell data and class hues live in their own files so they can be refreshed separately from the
// code. The page is always served over HTTP, so they're fetched; opened straight from disk, the fetch
// fails and the count line says why.
async function fetchJson(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}
async function init(){
  const [spells, classes] = await Promise.all([fetchJson('data/spells.json'), fetchJson('data/classes.json')]);
  classes.forEach(c => { FOCUS_CLASS_HUE[c.name] = c.hue; });
  SPELLS = spells;
  buildClassFilters();
  renderList();
  showFromHash();
  window.addEventListener('hashchange', showFromHash);
}
init().catch(err => {
  console.error(err);
  document.getElementById('count').textContent = 'Could not load the spell data. Serve this folder over HTTP.';
});
