// Spell Sigils: the sidebar, readout, toolbar toggles, loading the spell data and startup.

function el2(tag, cls, text){ const e=document.createElement(tag); e.className=cls; e.textContent=text; return e; }
// a filter chip: a toggle button, its state in aria-pressed, which the stylesheet also keys on
function chipButton(cls, text){
  const b = el2('button', cls, text);
  b.type = 'button';
  press(b, false);
  return b;
}
function press(el, on){ el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

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
  [...classFilterEl.children].forEach(el => press(el, false));
}

const tradFilterEl = document.getElementById('tradFilters');
const categoryChipEls = [];
['arcane','divine','occult','primal'].forEach(tr=>{
  const c = chipButton('chip', tr);
  c.dataset.trad = tr;
  c.addEventListener('click', ()=>{
    if (state.trads.has(tr)) state.trads.delete(tr); else state.trads.add(tr);
    press(c, state.trads.has(tr));
    // stepping into tradition-space backs out of category mode, even on a deselecting click —
    // the two axes don't combine
    if (state.category !== null){
      state.category = null;
      categoryChipEls.forEach(el => press(el, false));
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
  const c = chipButton('chip', cat);
  c.dataset.trad = cat;
  c.addEventListener('click', ()=>{
    state.category = state.category === cat ? null : cat;
    categoryChipEls.forEach(el => press(el, state.category === el.dataset.trad));
    if (state.trads.size){
      state.trads.clear();
      [...tradFilterEl.querySelectorAll('.chip')].forEach(el=>{
        if (!categoryChipEls.includes(el)) press(el, false);
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
    const c = chipButton('chip', cls);
    c.dataset.class = cls;
    if (cls !== 'other') c.style.setProperty('--class-hue', hueForClass(cls).toFixed(1));
    c.addEventListener('click', ()=>{
      // single-select: picking a class deselects any other, same as Ritual/Focus/tradition are already
      // mutually exclusive with each other one level up
      state.focusClass = state.focusClass === cls ? null : cls;
      classChipEls.forEach(el => press(el, state.focusClass === el.dataset.class));
      renderList();
    });
    classChipEls.push(c);
    classFilterEl.appendChild(c);
  });
}

const rankFilterEl = document.getElementById('rankFilters');
for(let r=0;r<=10;r++){
  const c = chipButton('rank-chip', r===0?'C':String(r));
  c.setAttribute('aria-label', r===0 ? 'Cantrips' : `Rank ${r}`);
  c.addEventListener('click', ()=>{
    if (state.ranks.has(r)) state.ranks.delete(r); else state.ranks.add(r);
    press(c, state.ranks.has(r));
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

/* ---------------- max glow ---------------- */
// "max glow" is a direct toggle on the live sigil rather than an export-time-only state: click it to hold
// the glow at the peak of startGlow()'s flash, click again to drop back to the floor resetGlow() itself
// uses. The glow is an SVG filter on the sigil itself, so an exported image (js/export.js) snapshots
// whatever's currently on screen — no forcing or restoring inside the export, so "which glow state did I
// get" is always exactly whatever the toggle (and the page's own settle-after-draw sequence) left it at.
const maxGlowToggle = document.getElementById('maxGlowToggle');
maxGlowToggle.addEventListener('click', () => {
  const on = maxGlowToggle.getAttribute('aria-pressed') !== 'true';
  maxGlowToggle.setAttribute('aria-pressed', on);
  setGlow(on ? GLOW_PEAK : GLOW_FLOOR);
  if (glowTooSlow || !on) setIdleStill('max glow', on);
});
// the drawing rules' version, in the footer (see SIGIL_VERSION in js/sigil.js)
document.getElementById('sigilVersion').textContent = `Sigils v${SIGIL_VERSION}`;

/* ---------------- phone drawer ---------------- */
// on a phone the sidebar is a drawer over the page (see styles.css): body.drawer-open slides it in and
// stops the page behind it scrolling. On wider screens the class has no effect, so nothing here needs to
// know which layout is showing.
const drawerOpenBtn = document.getElementById('drawerOpen');
// focusInside: move keyboard focus into the drawer as it opens. Only for a keyboard press: focus inside
// would otherwise show a ring after a tap. On closing, focus that was inside goes back to the Spells button
function setDrawer(open, focusInside){
  const wasOpen = document.body.classList.contains('drawer-open');
  document.body.classList.toggle('drawer-open', open);
  drawerOpenBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && !wasOpen && focusInside) document.getElementById('drawerClose').focus();
  if (!open && wasOpen && document.getElementById('sidebar').contains(document.activeElement)) drawerOpenBtn.focus();
}
// a click from Enter or Space has no pointer position, and reports detail 0
drawerOpenBtn.addEventListener('click', e => setDrawer(true, e.detail === 0));
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
// draws a spell and makes it the current one, with the list selection, the sigil's label, the URL and
// the tab title following
function showSpell(s){
  currentSlug = s.slug;
  listEl.querySelectorAll('li').forEach(li => {
    const on = li.dataset.slug === s.slug;
    li.classList.toggle('active', on);
    li.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  setListEntry();
  buildSigil(s);
  document.getElementById('sigil').setAttribute('aria-label', `Sigil of ${s.name}`);
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
  const li = listEl.querySelector('li.active');
  if (!li) return;
  listEl.scrollTop += li.getBoundingClientRect().top - listEl.getBoundingClientRect().top - (listEl.clientHeight - li.offsetHeight)/2;
}

/* ---------------- the spell list ---------------- */
// a listbox that takes one tab stop: Tab reaches it at its "entry" item, the current spell if the filters
// show it or else the first, and from there the arrow keys, Page Up and Down, Home and End move focus
// through the spells, and Enter or Space draws the focused one. Down from the search box enters it too
const listEl = document.getElementById('list');
function setListEntry(){
  if (listEl.contains(document.activeElement)) return; // focus is in the list, and is the entry
  const entry = listEl.querySelector('li.active') || listEl.firstElementChild;
  listEl.querySelectorAll('li[tabindex="0"]').forEach(li => { li.tabIndex = -1; });
  if (entry) entry.tabIndex = 0;
}
function focusListItem(li){
  listEl.querySelectorAll('li[tabindex="0"]').forEach(x => { x.tabIndex = -1; });
  li.tabIndex = 0;
  li.focus();
}
listEl.addEventListener('keydown', e => {
  const items = [...listEl.children], i = items.indexOf(document.activeElement);
  if (i < 0) return;
  if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); items[i].click(); return; }
  const step = {ArrowDown:1, ArrowUp:-1, PageDown:10, PageUp:-10}[e.key];
  const next = step ? items[Math.max(0, Math.min(items.length - 1, i + step))]
    : e.key === 'Home' ? items[0] : e.key === 'End' ? items[items.length - 1] : null;
  if (!next) return;
  e.preventDefault();
  focusListItem(next);
});
document.getElementById('search').addEventListener('keydown', e => {
  const entry = listEl.querySelector('li[tabindex="0"]');
  if (e.key === 'ArrowDown' && entry){ e.preventDefault(); focusListItem(entry); }
});

function renderList(){
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
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', s.slug === currentSlug ? 'true' : 'false');
    li.tabIndex = -1;
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
  setListEntry();
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
