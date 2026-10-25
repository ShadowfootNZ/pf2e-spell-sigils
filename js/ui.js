// Spell Sigils: the sidebar, readout, toolbar toggles, loading the spell data and startup.

function el2(tag, cls, text){ const e=document.createElement(tag); e.className=cls; e.textContent=text; return e; }
function chipButton(cls, text){
  const b = el2('button', cls, text);
  b.type = 'button';
  press(b, false);
  return b;
}
function press(el, on){ el.setAttribute('aria-pressed', on ? 'true' : 'false'); }

let SPELLS = [];

/* ---------------- sidebar / filters ---------------- */
// Empty sets mean no filter. Category and tradition filters are mutually exclusive; focusClass is a
// single selection within the Focus category.
const state = { search:'', trads:new Set(), ranks:new Set(), category:null, focusClass:null };

const classFilterEl = document.getElementById('classFilters');
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
    if (state.category !== null){
      state.category = null;
      categoryChipEls.forEach(el => press(el, false));
      resetClassFilter();
    }
    renderList();
  });
  tradFilterEl.appendChild(c);
});

// Every traditionless spell is a ritual or focus spell, so there is no third category chip.
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
    if (state.category === 'focus') classFilterEl.hidden = false;
    else resetClassFilter();
    renderList();
  });
  tradFilterEl.appendChild(c);
  categoryChipEls.push(c);
});

// Build only classes present in focus-spell data; "other" covers spells without one owning class.
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
// Shared parchment palette and rules for the page and standalone exported SVGs.
const PARCHMENT = {ink:'#2b2520', red:'#a3301f', paper:['#faf7ef', '#f4efe3', '#e8dfcc']};
// the sigil's ink rules, inside `scope` (the page's parchment stage, or nothing in a copied image). They
// override the colours the sigil is drawn with as attributes, which any CSS rule outranks; the sigils'
// rules come after the general ones, which they otherwise tie with
function inkRules(scope){
  const r = `${scope}#sigilRoot`, sigils = ['glyph', 'skill'].map(p => `${r} [data-part="${p}"]`);
  // each mark sets --ink, which a part's children inherit; a spell has at most four colour slots
  const inks = [...Object.entries(TRAD_INK).map(([trad, ink]) => `${r} [data-ink="${trad}"]{--ink:${ink};}`),
    ...[0, 1, 2, 3].map(i => `${r} [data-ink="s${i}"]{--ink:var(--ink-s${i});}`)];
  return `
    ${inks.join('\n    ')}
    ${r} [stroke]:not([stroke="none"]){stroke:var(--ink, ${PARCHMENT.ink});}
    ${r} [fill]:not([fill="none"]):not([fill="transparent"]){fill:var(--ink, ${PARCHMENT.ink});}
    ${r} [color]{color:var(--ink, ${PARCHMENT.ink});}
    ${sigils.map(g => `${g}[stroke], ${g} [stroke]:not([stroke="none"])`).join(', ')}{stroke:${PARCHMENT.red};}
    ${sigils.map(g => `${g} [fill]:not([fill="none"]):not([fill="transparent"])`).join(', ')}{fill:${PARCHMENT.red};}
    ${sigils.join(', ')}{color:${PARCHMENT.red};}
    ${r} [data-part="halos"], ${r} [data-part="flare"], ${r} [data-part="particle"], ${r} [data-idle]{display:none;}
    ${r} [data-part="core"]{filter:none;}`;
}
document.head.appendChild(Object.assign(document.createElement('style'), {textContent: inkRules('.stage.parchment ')}));
// the paper and the ink for the rest of the stage's parchment styling (css/app.css)
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
// Export snapshots the live max-glow state without changing it.
const maxGlowToggle = document.getElementById('maxGlowToggle');
maxGlowToggle.addEventListener('click', () => {
  const on = maxGlowToggle.getAttribute('aria-pressed') !== 'true';
  maxGlowToggle.setAttribute('aria-pressed', on);
  setGlow(on ? GLOW_PEAK : GLOW_FLOOR);
  if (glowTooSlow || !on) setIdleStill('max glow', on);
});
document.getElementById('sigilVersion').textContent = `Sigils v${SIGIL_VERSION}`;

/* ---------------- phone drawer ---------------- */
// body.drawer-open controls the phone drawer; wider layouts ignore it.
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
