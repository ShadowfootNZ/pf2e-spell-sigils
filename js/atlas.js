// Spell Sigils: the symbol atlas (atlas.html). Draws every rune, trait glyph and skill sigil from
// js/symbols.js at a fixed scale, each with its note.
const NEUTRAL = '#c9cde0'; // soft silver, so the tradition colors stand apart
const accent = trad => brightenHsl(tradColorSolid(trad), 1.15);

function symbolSvg(draw, viewBox, color, strokeWidth){
  const svg = el('svg', {viewBox, class:'big'});
  svg.style.setProperty('--glow', color);
  const g = el('g', {stroke:color, color, fill:'none', 'stroke-width':strokeWidth, 'stroke-linecap':'round', 'stroke-linejoin':'round'});
  draw(g);
  svg.appendChild(g);
  return svg;
}
// a caster station: double line for a required check, dotted for one of a choice; empty when draw is null
function stationSvg(draw, style, color){
  const svg = el('svg', {viewBox:'-16 -16 32 32'});
  const frame = el('g', {stroke:color, fill:'none'});
  if (style === 'dotted') frame.appendChild(el('rect', {x:-14, y:-14, width:28, height:28, 'stroke-width':1.2, 'stroke-dasharray':'1.4,2.2'}));
  else {
    frame.appendChild(el('rect', {x:-14, y:-14, width:28, height:28, 'stroke-width':1.2}));
    frame.appendChild(el('rect', {x:-11.6, y:-11.6, width:23.2, height:23.2, 'stroke-width':1}));
  }
  svg.appendChild(frame);
  if (draw){
    const g = el('g', {transform:'translate(-8.4,-8.4) scale(0.7)', stroke:color, color, fill:'none', 'stroke-width':1.6, 'stroke-linecap':'round', 'stroke-linejoin':'round'});
    draw(g);
    svg.appendChild(g);
  }
  return svg;
}
function card(svg, label, note, extra){
  const c = document.createElement('div'); c.className = 'card';
  if (svg) c.appendChild(svg);
  if (extra) c.appendChild(extra);
  const l = document.createElement('div'); l.className = 'label'; l.textContent = label; c.appendChild(l);
  if (note){ const n = document.createElement('div'); n.className = 'note'; n.textContent = note; c.appendChild(n); }
  return c;
}

function render(){
  const runesEl = document.getElementById('runes');
  for (const trad of ALL_TRADITIONS){
    const color = accent(trad);
    const block = document.createElement('div'); block.className = 'trad-block';
    const head = document.createElement('div'); head.className = 'trad-head';
    head.style.setProperty('--trad', color); head.style.setProperty('--trad-ink', TRAD_INK[trad]); // the ink on a light page (css/atlas.css)
    head.innerHTML = `${trad} <span class="trad-count">${RUNES[trad].length} runes</span>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    RUNES[trad].forEach((rune, i) => grid.appendChild(card(symbolSvg(rune.draw, '-6 -6 12 12', color, 0.65), `#${i + 1}`, rune.note)));
    block.appendChild(head); block.appendChild(grid); runesEl.appendChild(block);
  }
  document.getElementById('runesCount').textContent = `${RUNE_COUNT} runes`;

  const glyphsEl = document.getElementById('glyphs');
  for (const key of Object.keys(GLYPHS).sort()) glyphsEl.appendChild(card(symbolSvg(GLYPHS[key].draw, '0 0 24 24', NEUTRAL, 1.3), key, GLYPHS[key].note));
  document.getElementById('glyphsCount').textContent = `${Object.keys(GLYPHS).length} traits`;

  const skillsEl = document.getElementById('skills');
  const skillCard = (name, draw, note) => {
    const color = SKILL_TRADITION[name] ? accent(SKILL_TRADITION[name]) : NEUTRAL;
    const stations = document.createElement('div'); stations.className = 'stations';
    stations.appendChild(stationSvg(draw, 'double', color)); stations.appendChild(stationSvg(draw, 'dotted', color));
    return card(draw ? symbolSvg(draw, '0 0 24 24', color, 1.3) : null, name, note, stations);
  };
  for (const name of Object.keys(SKILL_SIGILS).sort()) skillsEl.appendChild(skillCard(name, SKILL_SIGILS[name].draw, SKILL_SIGILS[name].note));
  skillsEl.appendChild(skillCard('any', skillSigil('any'), 'A check that accepts any skill leaves its station empty'));
  document.getElementById('skillsCount').textContent = `${Object.keys(SKILL_SIGILS).length} skills`;
}

render();
