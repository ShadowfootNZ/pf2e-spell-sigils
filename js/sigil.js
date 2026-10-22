// Spell Sigils: builds and animates one spell's sigil.

/* ---------------- sigil construction ---------------- */
let idleTimer = null;
let blurGen = 0;

// Drives the whole sigil's glow for its entire life — the wide dim outer haze, the tight bright
// near-line band, and the neon drop-shadow halo — as ONE continuous loop, so there's never a hand-off
// between "fading in" and "breathing" for the eye to catch. Intro: a couple of decaying pulses settling
// into the steady blur. After that the same loop keeps running, breathing the drop-shadow halo slowly
// forever, until a new spell bumps blurGen and this one abandons itself.
//
// Two SVG blur layers do different jobs (see the filter defs): a Gaussian blur's visible portion is
// always the dim falling edge of the curve — the bright peak sits under the opaque crisp line on top —
// so a single wide blur alone reads as "blurry", not "glowing". The far layer keeps that soft wide haze
// for ambient depth; the near layer is a much tighter radius with its alpha amplified well past what
// the raw dilution would give it, so it reads as an actual bright band hugging the line — like a real
// neon tube's edge — while staying in the tradition's own color instead of a fixed tint.
// ramps 1->0 over the first 35% of a cycle, holds at true 0 through the middle 30%, ramps 0->1 over
// the last 35% — a real dwell at fully-transparent, not just a sine wave's momentary zero-crossing
function holdWave(t01){
  if (t01 < 0.35) return 1 - t01/0.35;
  if (t01 < 0.65) return 0;
  return (t01-0.65)/0.35;
}

// Bumps blurGen (abandoning any previous spell's still-running loop) and pins every glow
// layer to its floor — called immediately when a new sigil starts building, so the old
// spell's glow doesn't linger or bleed into the new draw-on. The actual ramp-up is a separate
// step (see startGlow below), fired only once the new sigil has finished drawing.
function resetGlow(){
  const myGen = ++blurGen;
  const farStdEl = document.getElementById('sigilBlurFar');
  const farColorEl = document.getElementById('sigilBlurFarColor');
  const nearStdEl = document.getElementById('sigilBlurNear');
  const nearColorEl = document.getElementById('sigilBlurNearColor');
  const root = document.getElementById('sigilRoot');
  const floor = 0.05;

  farStdEl.setAttribute('stdDeviation', floor);
  nearStdEl.setAttribute('stdDeviation', floor);
  farColorEl.setAttribute('values', `0.55 0 0 0 0  0 0.55 0 0 0  0 0 0.55 0 0  0 0 0 ${floor} 0`);
  nearColorEl.setAttribute('values', `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${floor} 0`);
  root.style.setProperty('--dropA', '0px');
  root.style.setProperty('--dropB', '0px');
  return myGen;
}

function startGlow(myGen){
  if (myGen !== blurGen) return; // abandoned before its ramp even got to start
  const farStdEl = document.getElementById('sigilBlurFar');
  const farColorEl = document.getElementById('sigilBlurFarColor');
  const nearStdEl = document.getElementById('sigilBlurNear');
  const nearColorEl = document.getElementById('sigilBlurNearColor');
  const root = document.getElementById('sigilRoot');

  const introDur = 1600;
  const farTarget = 6.0, farAlphaAmp = 1;
  const nearTarget = 2.6, nearAlphaAmp = 4; // must clear the ~1.4-2.2px stroke width or its spread never pokes out from under the crisp line on top — but stay well under farTarget, or "near" isn't actually the tight one
  const floor = 0.05, alphaFloor = 0.05;

  const setFarAlpha = a => farColorEl.setAttribute('values', `0.55 0 0 0 0  0 0.55 0 0 0  0 0 0.55 0 0  0 0 0 ${a.toFixed(2)} 0`); // darkened version of the line's own hue
  const setNearAlpha = a => nearColorEl.setAttribute('values', `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a.toFixed(2)} 0`); // the line's true hue, undarkened

  const restA = 1.2, restB = 2.8; // resting drop-shadow radii once settled, in px
  let start = null; // anchored on the first frame actually painted, not the moment this was called —
                     // on first page load, list rendering/font loading can eat the first chunk of the
                     // ramp before anything is even on screen, making it look like it starts mid-swing
  function frame(now){
    if (myGen !== blurGen) return; // a newer spell was picked — abandon this loop
    if (start === null) start = now;
    const elapsed = now - start;
    const frac = Math.min(1, elapsed/introDur);
    const rise = 1 - Math.exp(-4*frac);
    const pulse = Math.sin(frac*Math.PI*3) * Math.exp(-3*frac) * 0.4;
    const eased = Math.max(0, rise + pulse);

    farStdEl.setAttribute('stdDeviation', (floor + (farTarget-floor)*eased).toFixed(2));
    setFarAlpha(Math.min(1, (alphaFloor + (1-alphaFloor)*eased) * farAlphaAmp));
    nearStdEl.setAttribute('stdDeviation', (floor + (nearTarget-floor)*eased).toFixed(2));
    setNearAlpha(Math.min(1, (alphaFloor + (1-alphaFloor)*eased) * nearAlphaAmp));

    if (frac < 1){
      // drop-shadow halo rides in on the exact same eased curve — no separate ramp to fall out of sync
      root.style.setProperty('--dropA', (restA*eased).toFixed(2)+'px');
      root.style.setProperty('--dropB', (restB*eased).toFixed(2)+'px');
    } else {
      // TEST #3: glow activates once (the intro pulse above), then holds at zero — no repeating
      // breathing loop. Uncomment the block below (and the commented recursion at the bottom) to
      // restore breathing.
      setFarAlpha(0);
      setNearAlpha(0);
      root.style.setProperty('--dropA', '0px');
      root.style.setProperty('--dropB', '0px');
      /*
      // settled: near and far are one glow (bright core + its own soft halo, once far goes back to
      // being a darker version of the same hue) — they must breathe in exact lockstep, same period
      // and phase, or you'd see the halo lit with no core lit, or vice versa, which reads as broken
      // rather than as one pulsing light. The drop-shadow layer is a separate effect and still breathes
      // on its own independent cycle.
      const settled = elapsed - introDur;
      const w = holdWave((settled % 8400) / 8400);
      setFarAlpha(w);
      setNearAlpha(w);
      const breathe = Math.sin(settled/3200);
      root.style.setProperty('--dropA', (restA + breathe*0.7).toFixed(2)+'px');
      root.style.setProperty('--dropB', (restB + breathe*1.6).toFixed(2)+'px');
      */
    }
    if (frac < 1) requestAnimationFrame(frame); // TEST #3: stop looping once settled instead of recursing forever
  }
  requestAnimationFrame(frame);
}

// a comet riding a path: a soft trailing flare blob + a hot white core + a spawned trail of fading
// sparkle particles, ported from a canvas particle-accumulation technique into SVG/rAF terms.
// getFrac(elapsedMs) returns the comet's position as a 0..1 fraction of the path; when it returns
// null the ride is over and the comet cleans itself up.
function rideComet(pathEl, delayMs, color, getFrac, opts){
  opts = opts || {};
  const peak = opts.peak !== undefined ? opts.peak : 1;       // max opacity of the core/flare
  const withParticles = opts.particles !== true;

  const parent = pathEl.parentNode || pathEl.ownerSVGElement;
  let len = 0;
  try { len = pathEl.getTotalLength(); } catch(e){}
  if (!len) return;

  const flare = el('circle', {r:opts.flareR||8, fill:color, opacity:0});
  flare.style.filter = 'blur(3.5px)';
  parent.appendChild(flare);
  const core = el('circle', {r:opts.coreR||2.6, fill:'#fff', opacity:0});
  core.style.filter = `drop-shadow(0 0 ${opts.coreR?1.5:3}px ${color})`;
  parent.appendChild(core);

  const particles = [];
  const start = performance.now() + delayMs;
  let lastSpawn = 0;

  function decayParticles(){
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      const cx = parseFloat(p.el.getAttribute('cx'))+p.vx, cy = parseFloat(p.el.getAttribute('cy'))+p.vy;
      p.life -= 0.045;
      if (p.life <= 0){ p.el.remove(); particles.splice(i,1); continue; }
      p.el.setAttribute('cx', cx.toFixed(2)); p.el.setAttribute('cy', cy.toFixed(2));
      p.el.setAttribute('opacity', Math.max(0,p.life*0.8).toFixed(2));
    }
  }

  function frame(now){
    if (!flare.isConnected && !particles.length) return;
    if (!pathEl.isConnected){
      // the whole sigil was torn down (a new spell was picked) — stop immediately rather than
      // riding forever into detached DOM
      flare.remove(); core.remove(); particles.forEach(p=>p.el.remove());
      return;
    }
    const elapsed = now - start;
    if (elapsed < 0){ requestAnimationFrame(frame); return; }
    const frac = getFrac(elapsed);

    if (frac === null){
      // the ride is over: the comet head vanishes at once, but particles it already spawned
      // keep drifting and fading independently rather than being yanked out mid-flight
      flare.remove(); core.remove();
      decayParticles();
      if (particles.length) requestAnimationFrame(frame);
      return;
    }

    const edgeFade = (frac<0.08 ? frac/0.08 : (frac>0.82 ? Math.max(0,(1-frac)/0.18) : 1)) * peak;
    const pt = pathEl.getPointAtLength(frac*len);
    core.setAttribute('cx', pt.x.toFixed(2)); core.setAttribute('cy', pt.y.toFixed(2));
    core.setAttribute('opacity', edgeFade);
    const trailFrac = Math.min(0.02, 5/len); // a fixed ~5px trail, not a fraction of the path — stays
                                              // tight to the core on long paths instead of splitting off
    const behind = pathEl.getPointAtLength(Math.max(0,(frac-trailFrac)%1)*len);
    flare.setAttribute('cx', behind.x.toFixed(2)); flare.setAttribute('cy', behind.y.toFixed(2));
    flare.setAttribute('opacity', edgeFade*0.5);

    if (withParticles && now-lastSpawn > 45 && edgeFade > 0.3){
      lastSpawn = now;
      const px = pt.x + (Math.random()-0.5)*4, py = pt.y + (Math.random()-0.5)*4;
      const pDot = el('circle',{cx:px.toFixed(2), cy:py.toFixed(2), r:(0.6+Math.random()), fill:'#fff', opacity:0.8});
      parent.appendChild(pDot);
      particles.push({el:pDot, vx:(Math.random()-0.5)*0.05, vy:(Math.random()-0.5)*0.05, life:1});
    }
    decayParticles();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// one-shot: rides the tip of a path/circle/polygon while it draws itself in, then dissipates
function spark(pathEl, delay, dur, color){
  rideComet(pathEl, delay, color, elapsed => elapsed >= dur ? null : Math.min(1, elapsed/dur));
}

// a genuinely wider, blurred duplicate of a stroke, faded in behind it via opacity alone (no dash-offset
// draw-on). Unlike blurring the same thin line and hoping for spread, a widthMult-times-wider copy has
// real solid width before blur ever touches it — the visible margin beyond the crisp line comes from
// actual geometry, not from redistributing a thin source's intensity (which can never exceed itself).
// color is the caller's choice — a darkened version of the line's own hue, so the band reads as
// "this line, glowing" rather than an unrelated tint.
function glowDuplicate(sourceEl, delay, dur, color, widthMult, layer){
  const clone = sourceEl.cloneNode(false);
  clone.removeAttribute('id');
  const baseWidth = parseFloat(sourceEl.getAttribute('stroke-width')) || 2.5;
  clone.setAttribute('stroke-width', (baseWidth*(widthMult||2)).toFixed(2));
  clone.setAttribute('stroke', color);
  clone.style.strokeDasharray = ''; // clear any inherited dash-draw-on — pure opacity fade only
  clone.style.strokeDashoffset = '';
  clone.style.filter = 'blur(1.5px)';
  clone.style.opacity = 0;
  // appended to the shared glow layer (painted first, so behind every crisp element in the sigil)
  // rather than just before its own source — insertBefore only guaranteed it sat behind *that one*
  // element, not behind geometry added later in build order that happens to overlap it
  (layer || sourceEl.parentNode).appendChild(clone);
  const fadeIn = clone.animate([{opacity:0},{opacity:1}], {duration:dur, delay, easing:'ease-out', fill:'forwards'});
  // TEST #3: one-time activation flash, then hold at opacity 0 — no repeating breathe loop.
  // Uncomment the block below (and remove this one) to restore continuous breathing.
  fadeIn.finished.then(()=>{
    if (!clone.isConnected) return; // sigil was rebuilt for a new spell before this fade-in finished
    clone.animate([{opacity:1},{opacity:0}], {duration:900, easing:'ease-in', fill:'forwards'});
  }).catch(()=>{});
  /*
  fadeIn.finished.then(()=>{
    if (!clone.isConnected) return; // sigil was rebuilt for a new spell before this fade-in finished
    clone.animate(
      [{opacity:1, offset:0}, {opacity:0, offset:0.35}, {opacity:0, offset:0.65}, {opacity:1, offset:1}],
      {duration: 6800 + Math.random()*3600, iterations:Infinity, easing:'ease-in-out'}
    );
  }).catch(()=>{}); // the fade-in animation gets cancelled (element removed) if a new spell is picked mid-draw
  */
  return clone;
}

// forever: a faint comet that keeps circling a completed ring/polygon, like current in a closed loop.
// deliberately subtler than the draw-in spark — this is background ambience, not something to track.
function energyLoop(pathEl, color, speed){
  if (!pathEl) return;
  rideComet(pathEl, 0, color, elapsed => (elapsed % speed) / speed, {peak:0.4, coreR:1.5, flareR:2, particles:false});
}

function buildSigil(spell){
  clearTimeout(idleTimer);
  // a new spell always starts its own settle-from-scratch sequence, regardless of whatever the max-glow
  // toggle was left at for the previous one
  document.getElementById('maxGlowToggle').dataset.active = '0';
  const root = document.getElementById('sigilRoot');
  root.innerHTML = '';
  // every glowDuplicate() clone lands here, as the first child of sigilRoot, so every soft halo
  // paints behind every crisp line in the sigil regardless of when each was built
  const glowLayer = el('g',{});
  root.appendChild(glowLayer);

  const rng = rngFor(spell);
  const cx = 300, cy = 300;
  const traditions = spell.traditions.length ? spell.traditions : ['none'];
  // colorAt() cycles through one jittered shade per entry here. A single-tradition (or traditionless)
  // spell would otherwise give colorAt() only one slot to cycle through — every call landing on the same
  // jitter, since `i % 1` is always 0 — while multi-tradition spells already get real variety for free.
  // Give those spells a second slot of the same tradition (or a second `none` hue) so every spell has at
  // least two shades available to whatever draws with colorAt(0)/colorAt(1)/etc.
  const isRitual = spell.category === 'ritual';
  const isClassFocus = spell.category === 'focus' && spell.focusClass;
  const baseColorTrads = traditions.length > 1 ? traditions
    : traditions[0] === 'none' && isRitual ? ['ritual', 'ritual']
    : traditions[0] === 'none' && isClassFocus ? ['focus', 'focus']
    : [traditions[0], traditions[0]];
  // rituals additionally get one extra color slot per secondary caster (capped at 4 — beyond that, more
  // casters just means more cycling through the same slots, same as a spell with 5+ curated trait glyphs
  // doesn't get a 5th individually-guaranteed color either). Colors still start from the spell's own real
  // traditions when it has any (most rituals don't, but see Bacchanalia) — this only adds on top.
  const extraRitualSlots = isRitual ? Math.min(spell.casters || 0, 4) : 0;
  const colorSlotTrads = baseColorTrads.concat(Array(extraRitualSlots).fill('ritual'));
  // each slot gets its own deterministic jitter within its tradition's hue range — generated by the exact
  // same rule whether it's a real second tradition or a second roll of a single-tradition/none spell's own
  // tradition — so two spells sharing a tradition (or even identical traditions+traits) still land on
  // different shades. Plain traditionless slots get their own random base hue (see pickNoneHue), ritual
  // slots their own full-spectrum hue (see pickRitualHue) — but a class focus spell's 'focus' slot gets a
  // hue tied to its *class* (see hueForClass), not randomized per spell, so every spell from the same
  // class reads as the same color family instead of each landing somewhere unrelated.
  const tradJitters = colorSlotTrads.map(t=>{
    const j = {hue:(rng()-0.5)*2, sat:(rng()-0.5)*2, light:(rng()-0.5)*2};
    if (t === 'none') j.baseHue = pickNoneHue(rng);
    if (t === 'ritual') j.baseHue = pickRitualHue(rng);
    if (t === 'focus') j.baseHue = hueForClass(spell.focusClass);
    return j;
  });
  const colorAt = i => tradColor(colorSlotTrads[i % colorSlotTrads.length], tradJitters[i % colorSlotTrads.length]);

  root.style.setProperty('--glowcolor', colorAt(0));
  const glowGen = resetGlow(); // glow stays pinned at floor until the sigil finishes drawing (see totalEnd below)

  // focus spells are personal magic rather than drilled tradition magic, so they're drawn less formally:
  // each band keeps its writing but loses its ruled lines, the writing is double-spaced, and even a focus
  // cantrip gets a ring of writing (see bandCount and the band loop below)
  const isFocusSpell = spell.category === 'focus';
  // traditionless band lines draw as open arcs. Focus spells draw no band lines at all, so in practice this
  // now only opens the traditionless rituals' circles, whose look is still to be revisited (plan item 42)
  const isTraditionless = spell.traditions.length === 0;
  const rank = spell.rank;
  const rankForScale = Math.min(rank, 10);
  const jitter1 = () => Math.floor(rng()*3)-1; // -1, 0, or 1 — a small per-spell nudge within a rank's range,
                                                // so spells sharing a rank aren't the literal same skeleton
  const sides = Math.min(12, Math.max(3, rankForScale+3 + jitter1()));
  const hasChords = rankForScale >= 3;
  const chordSkip = Math.max(2, 2 + Math.floor(rankForScale/4) + jitter1());
  const baseRot = Math.floor(rng()*360);

  // a curated per-spell subset of runes, not the full library — every rune placement (border bands,
  // satellite marks) draws only from this, so a sigil reads as "written in" a consistent handful of
  // runes rather than sampling all of RUNES independently at every slot. Higher-rank spells draw from a
  // larger vocabulary. The vocab is tradition-aware: the rank-scaled budget is split evenly across the
  // spell's own traditions (so occult's larger pool doesn't out-represent arcane's smaller one), each
  // share drawn from that tradition's own RUNES list via the same shuffle-and-slice pattern used
  // for curated trait glyphs below. Traditionless spells fall back to all four traditions evenly, at half
  // budget — sparse, not a full-width sample of the whole library. Focus spells get a floor of 4 shapes so
  // their double-spaced writing still reads as writing rather than a repeating two-symbol border; every
  // pool is shuffled in full before slicing, so the floor changes which runes are available but not the
  // rng() stream.
  const runeTraditions = spell.traditions.length ? [...new Set(spell.traditions)] : ALL_TRADITIONS;
  const runeVocabTarget = spell.traditions.length
    ? Math.min(RUNE_COUNT, 4 + Math.floor(rankForScale*1.2))
    : Math.max(isFocusSpell ? 4 : 2, Math.round((4 + Math.floor(rankForScale*1.2)) * 0.5));
  const runeShareBase = Math.floor(runeVocabTarget / runeTraditions.length);
  const runeShareRemainder = runeVocabTarget - runeShareBase*runeTraditions.length;
  const runeVocab = [];
  runeTraditions.forEach((trad, i) => {
    const share = runeShareBase + (i < runeShareRemainder ? 1 : 0);
    const pool = RUNES[trad].slice();
    for(let j=pool.length-1;j>0;j--){ const k=Math.floor(rng()*(j+1)); [pool[j],pool[k]]=[pool[k],pool[j]]; }
    runeVocab.push(...pool.slice(0, Math.min(share, pool.length)));
  });
  const pickRune = () => runeVocab[Math.floor(rng()*runeVocab.length)];

  const timeline = []; // {el, delay, dur, kind}
  const pulseables = []; // elements eligible to loop a slow glow-pulse once the sigil finishes drawing
  let t = 0;
  // set right after the outer (or only) band draws — holds the delay basis the satellite section (drawn
  // much later, see ringPlan.forEach) should actually use, so its *timing* slots in right after the last
  // band while its DOM elements stay appended last (so they still paint on top of everything above them)
  let satelliteSectionStart = null;
  // called once, right after the outer/only band finishes, from both the cantrip (no-band) branch and the
  // band loop below. Reserves a conservative slot in the main `t` cursor for the satellite section — each
  // slot's own 350ms stagger plus a single medallion's own draw span (see medallion()'s withRuneBand
  // timing, which tops out a little above 600ms after its own delay) — so whatever draws next (the middle
  // band, or the polygon when there's no second band) waits until satellites would have fully finished.
  // Deliberately approximate rather than an exact replica of medallion()'s internal timing math, to avoid
  // duplicating and needing to keep two copies of that formula in sync; the real block (much later in
  // source) reconciles into `t` with Math.max once it actually runs.
  function reserveSatelliteSlot(){
    satelliteSectionStart = t;
    if (ringPlan.length) t += (ringPlan.length-1)*350 + 700;
  }
  // named sections (border / polygon / chords / medallions+spokes / satellites / center ring) are fully
  // sequential — a section's delay is the exact sum of every prior section's real duration, computed from
  // its actual scheduled end rather than a hand-tuned guess, so nothing starts until the previous section
  // has completely finished. Inside a section with several small sub-items (border rune marks, chords,
  // per-vertex spoke+medallion, per-satellite circle+rune) those sub-items keep their original fast,
  // overlapping "wave" stagger — serializing all of those individually would push high-rank spells (up to
  // 64 border marks) out past 20+ seconds of draw time for no visual benefit.
  function push(elx, dur, kind, delay){
    timeline.push({el:elx, delay, dur, kind});
    return delay + dur;
  }

  // ring-band count scales with rank: cantrips get a single plain, rune-less boundary circle; ranks 1-3 get
  // one runic band; 4-6 get two, nested inward; 7-10 get three — each additional band sits at a smaller
  // fixed fraction of outerR (2/3, then 1/2) rather than stacking further outward, so bands read as clearly
  // separate rings instead of touching hairlines. A focus cantrip gets one band instead of the plain circle,
  // since a focus band is drawn as writing only and a bare circle would leave its medallions floating free.
  const bandCount = rank===0 ? (isFocusSpell ? 1 : 0) : (rankForScale<=3 ? 1 : rankForScale<=6 ? 2 : 3);
  const outerR = 258 * (0.985 + rng()*0.03);
  const bandRadii = [outerR, outerR*4/6, outerR*2/6]; // evenly spaced at 6/6, 4/6, 2/6 of outerR

  // polygon geometry is computed here (well before the polygon itself is drawn) purely so the border band
  // below can know where every ring medallion will land and leave a gap for it — the actual <polygon>
  // element and its timeline entry still happen in their usual spot, this is coordinate math only
  const polyR = outerR * 5/6; // sits at the midpoint between the 6/6 and 4/6 rune bands
  const rot = baseRot + rng()*30;
  const jitterFn = () => (rng()-0.5)*2;
  const pts = polyPoints(sides, polyR, rot, cx, cy, jitterFn);

  // curated trait glyphs ("sigils") now live on the center medallion and on ring-hugging medallions that
  // straddle the outer border, not on the polygon's vertices — vertices go back to plain spoke-tipped star
  // points. Placement count: 1 curated trait -> center only. 2 -> both on the ring, 180° apart, center
  // falls back to the generic filler icon. 3-6 -> a single seeded coin-flip (~75% true) decides "centered"
  // (1 center + rest on the ring) vs "ring-only" (all on the ring). 7+ -> always centered, no coin-flip.
  const curated = spell.traits.filter(tr => GLYPHS[tr]);
  for(let i=curated.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [curated[i],curated[j]]=[curated[j],curated[i]]; }

  let isCentered, ringSigilGlyphs;
  if (curated.length === 0){ isCentered = false; ringSigilGlyphs = []; }
  else if (curated.length === 1){ isCentered = true; ringSigilGlyphs = []; }
  else if (curated.length === 2){ isCentered = false; ringSigilGlyphs = curated.slice(0); }
  else if (curated.length <= 6){ isCentered = rng() < 0.75; ringSigilGlyphs = isCentered ? curated.slice(1) : curated.slice(0); }
  else { isCentered = true; ringSigilGlyphs = curated.slice(1); }
  ringSigilGlyphs = ringSigilGlyphs.slice(0, 8); // hard cap: 8 on the ring (9 total with the center), well
                                                  // above the current real max (7, on Cataclysm) as headroom
  const centerGlyph = isCentered ? curated[0] : null;

  // rank no longer caps how many sigils can appear, but it still sets a *floor* on total ring-circle count
  // for sigil-poor spells — a high-rank spell with only 1-2 sigils still gets extra ring circles, just
  // filled with a plain rune instead of a glyph (see the filler branch in the ring-drawing section below)
  const rankRingFloor = Math.min(3, Math.max(1, (1 + (rankForScale>=4?1:0) + (rankForScale>=8?1:0)) + jitter1()));
  const totalRingSlots = Math.max(rankRingFloor, ringSigilGlyphs.length);

  // one ring slot deliberately aligns to an actual polygon vertex (a seeded pick, not avoided the way item
  // 14/18's satellites avoided vertices — that avoidance doesn't apply here since placement is now
  // deliberate and evenly spaced rather than freely rolled); the rest are spaced evenly from that anchor
  const anchorVertexIdx = Math.floor(rng()*sides);
  const anchorAngle = Math.atan2(pts[anchorVertexIdx][1]-cy, pts[anchorVertexIdx][0]-cx) * 180/Math.PI;
  const ringBaseR = () => (outerR-polyR) * (0.75 + rng()*0.3) * 1.5; // 1.5x the original base size
  // sigils are spaced evenly *among themselves* (180° apart for 2, 120° for 3, ...) so the "opposite sides"
  // rule for 2 sigils holds regardless of whether rank also calls for extra filler slots on the ring —
  // filler angles are fit into the gaps that leaves rather than sharing one combined 360/total division
  const fillerCount = totalRingSlots - ringSigilGlyphs.length;
  const sigilAngleStep = ringSigilGlyphs.length > 0 ? 360/ringSigilGlyphs.length : 0;
  function ringSlot(angleDeg, isSigil, glyphKey){
    const rad = angleDeg*Math.PI/180;
    const dist = outerR; // centered exactly on outerR so the circle straddles the main boundary ring precisely
    const r = isSigil ? ringBaseR() : ringBaseR()*0.55; // filler stays smaller than real sigils; no more
                                                         // shrinking by sigil count — plenty of room even
                                                         // at the game's real max (Cataclysm, 6 on the ring)
    return {angleDeg, x: cx+dist*Math.cos(rad), y: cy+dist*Math.sin(rad), r, isSigil, glyphKey};
  }
  const ringPlan = ringSigilGlyphs.map((glyphKey, i) => ringSlot(anchorAngle + i*sigilAngleStep, true, glyphKey));
  for(let j=0;j<fillerCount;j++){
    // with sigils present, bisect the gaps between them; with none, space evenly around the full circle
    const angleDeg = ringSigilGlyphs.length > 0
      ? anchorAngle + sigilAngleStep/2 + j*(360/fillerCount)
      : anchorAngle + j*(360/fillerCount);
    ringPlan.push(ringSlot(angleDeg, false, null));
  }
  function angDiff(a,b){ const d = Math.abs(a-b)%360; return d>180 ? 360-d : d; }
  // a border-band rune slot whose angle falls under a ring medallion should just not be drawn, leaving a
  // visible gap — the medallion is meant to visually interrupt the band, not fight with it for the same spot
  function nearRingSlot(angleDeg){
    return ringPlan.some(slot => angDiff(angleDeg, slot.angleDeg) < Math.max(8, Math.asin(Math.min(1, slot.r/outerR))*(180/Math.PI)*1.6));
  }

  let outer = null, innerBorder = null;

  if (bandCount === 0){
    // cantrip: a single plain, rune-less boundary circle
    outer = isTraditionless
      ? el('path',{d:arcPath(cx,cy,outerR, baseRot+10, baseRot+345), fill:'none', stroke:colorAt(0), 'stroke-width':2.2, 'stroke-linecap':'round'})
      : el('circle',{cx,cy,r:outerR, fill:'none', stroke:colorAt(0), 'stroke-width':2.2});
    root.appendChild(outer);
    t = push(outer, 900, 'stroke', t);
    reserveSatelliteSlot();
  } else {
    // each band is its own double-ring (outer+inner boundary) densely inscribed with small script-like
    // marks between them; bands nest inward at fixed fractions of outerR (1, then 2/3, then 1/2) so they
    // read as clearly separate rings rather than adjacent hairlines. Rune scale is uniform across every
    // band now — no more "larger runes on the outer band" signal.
    for (let b=0; b<bandCount; b++){
      const R = bandRadii[b];
      const sectionStart = t;
      let sectionEnd = t;
      // one color per band — outer line, inner line, and every rune mark in it all share this, though a
      // different band (different b) can land on a different color. Matches how satellite medallions
      // already use one `color` for their whole ring+rune-band shell (see medallion()'s withRuneBand block).
      const bandColor = colorAt(b);
      // the band's ruled outer and inner lines; a focus band skips both and keeps only its writing
      const innerR = R - 12;
      let bandOuter = null, bandInner = null;
      if (!isFocusSpell){
        bandOuter = isTraditionless
          ? el('path',{d:arcPath(cx,cy,R, baseRot+10, baseRot+345), fill:'none', stroke:bandColor, 'stroke-width':2.2, 'stroke-linecap':'round'})
          : el('circle',{cx,cy,r:R, fill:'none', stroke:bandColor, 'stroke-width':2.2});
        root.appendChild(bandOuter);
        sectionEnd = Math.max(sectionEnd, push(bandOuter, 900, 'stroke', sectionStart));
        pulseables.push({el:bandOuter, base:1});

        bandInner = isTraditionless
          ? el('path',{d:arcPath(cx,cy,innerR, baseRot+10, baseRot+345), fill:'none', stroke:bandColor, 'stroke-width':1.2, 'stroke-linecap':'round', opacity:0.85})
          : el('circle',{cx,cy,r:innerR, fill:'none', stroke:bandColor, 'stroke-width':1.2, opacity:0.85});
        root.appendChild(bandInner);
        sectionEnd = Math.max(sectionEnd, push(bandInner, 800, 'stroke', sectionStart));
        pulseables.push({el:bandInner, base:0.85});
      }

      // marks cluster into "words" — a run of 2-5 tightly-spaced marks, then a gap — instead of tiling the
      // ring at one uniform step, so the band reads as an unintelligible written script rather than a
      // repeating decorative pattern. Letter pitch is tied directly to a rune's own footprint (RUNES draw
      // in a local ~8-unit box, see the RUNES array comment) plus a hair of stroke padding, so runes within
      // a word sit as close as a monospace font's character cells instead of at an arbitrary arc-length step.
      // Focus writing doubles the pitch, and with it the word gap, like double-spaced lettering: simpler and
      // less formal, and it keeps inner bands from tangling with the chords now that they have no lines.
      const letterCellWidth = isFocusSpell ? 19 : 9.5;
      const letterStep = (letterCellWidth / (2*Math.PI*R)) * 360;
      const wordGapMult = 0.85 + rng()*0.3; // the gap between words is ~one extra letter-width, like a monospace font's space character
      const angles = [];
      let a = baseRot + b*(letterStep/2); // half-step offset per band so marks don't line up radially
      while (a < baseRot + 360){
        const wordLen = 2 + Math.floor(rng()*4); // 2-5 marks per word
        for (let k=0; k<wordLen && a < baseRot + 360; k++){
          angles.push(a);
          a += letterStep;
        }
        a += letterStep*wordGapMult;
      }
      const markCount = angles.length;
      const runeColor = brightenHsl(bandColor, 1.35); // same brightened shade for every rune mark in this band
      const bandGroup = el('g',{});
      root.appendChild(bandGroup);
      angles.forEach((a, i) => {
        if (b===0 && nearRingSlot(((a%360)+360)%360)) return; // leave a gap where a ring medallion overlaps the outermost band
        const rad = a*Math.PI/180;
        const br = (R+innerR)/2;
        const bx = cx+br*Math.cos(rad), by = cy+br*Math.sin(rad);
        const holder = el('g',{transform:`translate(${bx.toFixed(2)},${by.toFixed(2)}) rotate(${(a+90).toFixed(1)}) scale(${(0.75+rng()*0.4).toFixed(2)})`, opacity:0, stroke:runeColor, color:runeColor, 'stroke-width':1, fill:'none', 'stroke-linecap':'round'});
        runeMark(pickRune(), holder);
        bandGroup.appendChild(holder);
        sectionEnd = Math.max(sectionEnd, push(holder, 180, 'fade', sectionStart + i*(650/markCount)));
      });
      t = sectionEnd;
      if (b === 0){
        outer = bandOuter; innerBorder = bandInner; // null for focus spells, so their idle comets ride only the polygon
        // reserve satellites' timing slot right here — between the outer band and whatever draws next,
        // whether that's the middle band (bandCount > 1) or the polygon (bandCount === 1, no middle band)
        reserveSatelliteSlot();
      }
    }
  }

  // central polygon — geometry (polyR/rot/pts) was already computed earlier so the border band could gap
  // around ring medallions; this just draws it. Uses colorAt(1), not (0): the polygon, centerRing, and the
  // first ring circle are the only elements guaranteed to draw regardless of rank/curated-trait sparsity,
  // so between them they're deliberately spread across colorAt(1)/(2)/(3) — on top of band 0's always-(0)
  // — to guarantee every one of a spell's own traditions gets used somewhere, not just whichever indices
  // rank-gated sections (chords, the second polygon, extra ring circles) happen to reach.
  // mythic gets a fractured edge (see fractureEdge) — a separate points array just for this element,
  // `pts` itself stays a clean polygon for every other section that anchors off it
  const polyPts = spell.traits.includes('mythic') ? fractureEdge(pts, Math.floor(rng()*sides), rng) : pts;
  const poly = el('polygon',{points:ptsAttr(polyPts), fill:'none', stroke:colorAt(1), 'stroke-width':1.8});
  root.appendChild(poly);
  t = push(poly, 800, 'stroke', t);
  pulseables.push({el:poly, base:1});

  // star chords
  if (hasChords && sides >= 5){
    const sectionStart = t;
    let sectionEnd = t;
    const chordGroup = el('g',{stroke:colorAt(1), 'stroke-width':0.9, opacity:0.75});
    root.appendChild(chordGroup);
    const skip = Math.min(chordSkip, Math.floor(sides/2));
    for(let i=0;i<sides;i++){
      const p1 = pts[i], p2 = pts[(i+skip)%sides];
      const chord = el('line',{x1:p1[0].toFixed(2),y1:p1[1].toFixed(2),x2:p2[0].toFixed(2),y2:p2[1].toFixed(2), opacity:0});
      chordGroup.appendChild(chord);
      sectionEnd = Math.max(sectionEnd, push(chord, 220, 'fade', sectionStart + i*40));
      pulseables.push({el:chord, base:1});
    }
    t = sectionEnd;
  }

  // counter-rotated secondary polygon (rank 5+) — layers into a hexagram-like star, like a second star traced over the first
  if (rankForScale >= 5){
    const rot2 = rot + 180/sides;
    const pts2 = polyPoints(sides, outerR*3/6, rot2, cx, cy, jitterFn); // sits at the midpoint between the 4/6 and 2/6 rune bands
    const poly2 = el('polygon',{points:ptsAttr(pts2), fill:'none', stroke:colorAt(traditions.length>1?1:0), 'stroke-width':1.2, opacity:0.8});
    root.appendChild(poly2);
    t = push(poly2, 700, 'stroke', t);
    pulseables.push({el:poly2, base:0.8});
  }

  // sigil medallions — solid-disc circles (so they visibly sit on top of the lines behind them) ringed in
  // their tradition color, shared by the center medallion and every ring medallion (see the placement plan
  // computed earlier, before the border band, as `ringPlan`/`centerGlyph`/`isCentered`)
  const centerR = Math.max(30, polyR*0.28); // the containment ring is drawn right after; this is just the radius it and the spokes anchor to

  // `withRuneBand` gives the medallion its own miniature version of the main border — a second, smaller
  // ring with a short band of rune marks between it and the outer disc — matching how both the sigil and
  // filler circles look in the reference pieces. The center medallion opts out (`false`) and keeps its
  // plainer single-ring look. `withDisc` draws the medallion's own outer stroke circle — the center opts
  // out of this too, since its separate `centerRing` already provides that boundary and a second ring right
  // on top of it was redundant. `withFallback` controls what happens when there's no glyph to show: ring
  // circles still get a small generic mark (a circle or cross, so an empty-looking gap doesn't read as a
  // mistake), while the center is left genuinely empty since `centerRing` alone is enough there.
  function medallion(x, y, r, color, glyphKey, delay, withRuneBand, withDisc, withFallback){
    let discEnd = delay;
    if (withDisc){
      const disc = el('circle',{cx:x.toFixed(2), cy:y.toFixed(2), r:r.toFixed(2), fill:'transparent', stroke:color, 'stroke-width':1.6});
      root.appendChild(disc);
      discEnd = push(disc, 420, 'stroke', delay);
      pulseables.push({el:disc, base:1});
    }

    let innerR = r;
    if (withRuneBand){
      // a fixed absolute gap rather than a proportion of r, so bigger medallions don't get a
      // proportionally wider band — the ring-to-ring spacing stays visually consistent regardless of size
      innerR = Math.max(r*0.4, r - 11);
      const innerRing = el('circle',{cx:x.toFixed(2), cy:y.toFixed(2), r:innerR.toFixed(2), fill:'none', stroke:color, 'stroke-width':1, opacity:0.75});
      root.appendChild(innerRing);
      discEnd = Math.max(discEnd, push(innerRing, 350, 'stroke', delay));
      pulseables.push({el:innerRing, base:0.75});

      const bandR = (r+innerR)/2;
      const markCount = Math.min(16, Math.max(5, Math.round(2*Math.PI*bandR/13)));
      const runeColor = brightenHsl(color, 1.3);
      for(let k=0;k<markCount;k++){
        const a = k*360/markCount;
        const rad = a*Math.PI/180;
        const mx = x + bandR*Math.cos(rad), my = y + bandR*Math.sin(rad);
        const markScale = (r-innerR) * 0.42 / 4; // maps the rune's local ~8-unit box to most of the band's width
        const mHolder = el('g',{transform:`translate(${mx.toFixed(2)},${my.toFixed(2)}) rotate(${(a+90).toFixed(1)}) scale(${markScale.toFixed(3)})`, opacity:0, stroke:runeColor, color:runeColor, 'stroke-width':(1/markScale).toFixed(3), fill:'none', 'stroke-linecap':'round'});
        runeMark(pickRune(), mHolder);
        root.appendChild(mHolder);
        discEnd = Math.max(discEnd, push(mHolder, 150, 'fade', delay + 200 + k*(300/markCount)));
      }
    }

    if (!glyphKey && !withFallback) return discEnd; // nothing to show — leave it empty rather than filling the gap

    const scale = (innerR*0.72)/12;
    const holder = el('g',{transform:`translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${scale.toFixed(3)})`, opacity:0});
    const iconColor = brightenHsl(color, 1.35);
    let inner;
    if (glyphKey){
      // GLYPHS are drawn in a 24x24 box, so recenter it on the holder's local origin
      inner = el('g',{transform:'translate(-12,-12)', stroke:iconColor, color:iconColor, 'stroke-width':(1.5/scale).toFixed(2), 'stroke-linecap':'round', 'stroke-linejoin':'round', fill:'none'});
      GLYPHS[glyphKey](inner);
    } else {
      // a glyph-less ring circle is a "runic" filler — its center mark should be a rune too, matching the
      // band around it, not an arbitrary generic shape unrelated to the rest of the tool's rune vocabulary.
      // RUNES are already drawn local-origin-centered, so no -12,-12 recenter is needed here.
      inner = el('g',{stroke:iconColor, color:iconColor, 'stroke-width':(1.5/scale).toFixed(2), 'stroke-linecap':'round', fill:'none'});
      runeMark(pickRune(), inner);
    }
    holder.appendChild(inner);
    root.appendChild(holder);
    const glyphEnd = push(holder, 320, 'pop', delay+150); // glyph pops in partway through the disc's own reveal
    return Math.max(discEnd, glyphEnd);
  }

  {
    const sectionStart = t;
    let sectionEnd = Math.max(sectionStart, medallion(cx, cy, centerR, colorAt(0), centerGlyph, sectionStart, false, false, false));

    // the containment ring appears next, establishing the boundary the spokes visually radiate from — it
    // must finish drawing before any spoke starts, not just start before one. Normally it sits a fixed 16px
    // outside the (now-invisible) center medallion radius, but at 3 bands that nearly touches the innermost
    // band — so there it expands to align with that band's own outer edge instead.
    const centerRingR = bandCount === 3 ? bandRadii[2] : centerR+16;
    // colorAt(2), not (0) — see the central-polygon comment above: this ring always draws regardless of
    // rank, so it claims its own guaranteed-coverage slot rather than repeating band 0's color
    const centerRing = el('circle',{cx,cy,r:centerRingR, fill:'none', stroke:colorAt(2), 'stroke-width':1, opacity:0.7});
    root.appendChild(centerRing);
    const ringEnd = push(centerRing, 500, 'stroke', sectionEnd);
    pulseables.push({el:centerRing, base:0.7});
    sectionEnd = Math.max(sectionEnd, ringEnd);

    // every polygon vertex is now just a plain spoke-tipped star point — sigils live on the center and
    // ring medallions instead (see below), not at the vertices
    let vt = ringEnd;
    pts.forEach((p,i)=>{
      const dx = p[0]-cx, dy = p[1]-cy, dist = Math.hypot(dx,dy), ux = dx/dist, uy = dy/dist;
      const sx = cx+ux*centerRingR, sy = cy+uy*centerRingR;
      // const spoke = el('line',{x1:sx.toFixed(2),y1:sy.toFixed(2),x2:p[0].toFixed(2),y2:p[1].toFixed(2), stroke:colorAt(i), 'stroke-width':0.8, opacity:0});
      // root.appendChild(spoke);
      // sectionEnd = Math.max(sectionEnd, push(spoke, 260, 'fade', vt));
      // pulseables.push({el:spoke, base:1});
      // vt += 90;
    });
    t = sectionEnd;
  }

  // ring circles — deliberately not concentric with the polygon, overlapping the main border like a second
  // casting laid over the first. Each slot in `ringPlan` (computed earlier, before the border band) is
  // either a sigil medallion or, when rank calls for more ring circles than there are sigils to fill them,
  // a smaller rune-only filler — both now drawn through the same `medallion(..., true)` call, so both get
  // the same double-ring rune-band treatment, differing only in size and whether a glyph fills the center.
  // Still appended here, last, so they keep painting on top of everything drawn above — but their *timing*
  // uses `satelliteSectionStart` (reserved in the band loop, right after the outer band) when there was a
  // middle band to slot in ahead of; otherwise there's no such gap to fill and this just continues from
  // wherever `t` naturally is, its original last-in-sequence position.
  {
    const sectionStart = satelliteSectionStart != null ? satelliteSectionStart : t;
    let sectionEnd = sectionStart;
    let st = sectionStart;
    // slot 0 always exists (rankRingFloor never drops below 1) and always lands on colorAt(3) — see the
    // central-polygon comment above: this is the 4th and last of the guaranteed-coverage slots. Later
    // slots just keep cycling onward from there; no more coverage guarantees ride on them specifically.
    ringPlan.forEach((slot, i) => {
      const color = colorAt(i + 3);
      sectionEnd = Math.max(sectionEnd, medallion(slot.x, slot.y, slot.r, color, slot.glyphKey, st, true, true, true));
      st += 350;
    });
    // `t` may already be ahead of sectionEnd (it reflects every section between the reserved slot and here);
    // reconcile so totalEnd still waits for satellites' real finish time even if the reservation estimate
    // above was a little short.
    t = Math.max(t, sectionEnd);
  }

  const totalEnd = t + 700;

  // run animations
  timeline.forEach(({el:e, delay, dur, kind})=>{
    if (kind === 'stroke'){
      let len = 0;
      try { len = e.getTotalLength(); } catch(err){ len = 300; }
      e.style.strokeDasharray = len;
      e.style.strokeDashoffset = len;
      e.animate(
        [{strokeDashoffset:len, opacity:0.2},{opacity:1, offset:0.08},{strokeDashoffset:0, opacity:1}],
        {duration:dur, delay, easing:'cubic-bezier(.3,.7,.3,1)', fill:'forwards'}
      );
      spark(e, delay, dur, e.getAttribute('stroke'));
      // fades in at totalEnd, not with this stroke's own draw-in — otherwise each line's glow halo
      // lights up as soon as that line is drawn, well before the sigil as a whole is finished
      glowDuplicate(e, totalEnd, 900, darkenHsl(e.getAttribute('stroke'), 0.6), 2, glowLayer);
    } else if (kind === 'fade'){
      e.animate([{opacity:0},{opacity:1}], {duration:dur, delay, easing:'ease-out', fill:'forwards'});
    } else if (kind === 'fadeHalf'){
      e.animate([{opacity:0},{opacity:0.45}], {duration:dur, delay, easing:'ease-out', fill:'forwards'});
    } else if (kind === 'pop'){
      e.animate(
        [{opacity:0, transform:e.getAttribute('transform').replace('scale(','scale(0.001,'.replace(', ',',')) },
         {opacity:1, offset:0.7},
         {opacity:1}],
        {duration:dur, delay, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'forwards'}
      );
      // simpler robust pop: fade + CSS transform scale via separate wrapper scale already set;
    }
  });

  idleTimer = setTimeout(()=>{
    startGlow(glowGen);
    // a subset of lines/gems get their own independent slow pulse, so the circle feels alive rather than static
    pulseables.forEach(({el:pe, base})=>{
      if (rng() > 0.32) return;
      const low = base * (0.35 + rng()*0.25);
      pe.animate(
        [{opacity:base},{opacity:low},{opacity:base}],
        {duration: 1400 + rng()*2400, iterations:Infinity, easing:'ease-in-out', delay: rng()*1500}
      );
    });
    // once the sigil is fully inscribed, a bead of light keeps circling its primary loops — the working stays "live"
    energyLoop(outer, colorAt(0), 5200 + rng()*2200);
    energyLoop(innerBorder, colorAt(1), 6600 + rng()*2400);
    energyLoop(poly, colorAt(2), 4200 + rng()*1800);
  }, totalEnd);

  // readout
  document.getElementById('roName').textContent = spell.name;
  document.getElementById('roName').style.setProperty('--nameglow', colorAt(0));
  document.getElementById('roRank').textContent =
    (rank===0?'Cantrip':ORDINAL[Math.min(rank,10)]+'-rank');
  const badges = document.getElementById('roBadges');
  badges.innerHTML='';
  traditions.forEach(tr=>{
    // a class focus spell's badge names its class instead of the generic "other" label — the class
    // trait already says the same thing more specifically, so showing both would be redundant. Same
    // logic for ritual: the dedicated ritual badge below already covers it, so 'other' is skipped
    // entirely here rather than shown alongside it — 'other' is only for when nothing else applies.
    if (tr === 'none' && spell.category === 'ritual') return;
    const label = tr === 'none' ? (spell.focusClass || 'other') : tr;
    const b = el2('span','badge', label);
    b.style.background = tradColorSolid(tr);
    badges.appendChild(b);
  });
  // a ritual badge is additional, not a replacement — most rituals are traditionless (so this is their
  // only badge) but a few (e.g. Bacchanalia) carry real traditions too and still get both
  if (spell.category === 'ritual'){
    const b = el2('span','badge','ritual');
    b.style.background = 'hsl(var(--ritual))';
    badges.appendChild(b);
  }
  const traitsEl = document.getElementById('roTraits');
  traitsEl.innerHTML='';
  // `cantrip`, `focus` and a focus spell's class trait are already stripped from the data by
  // refresh-data.mjs, since the rank and badges above say the same thing
  const hiddenTraits = ['concentrate', 'manipulate', 'good', 'evil', 'lawful', 'chaotic'];
  spell.traits.filter(tr => !hiddenTraits.includes(tr)).forEach(tr=>{
    const chip = el2('span', 'trait-tag'+(GLYPHS[tr]?' curated':''), tr);
    traitsEl.appendChild(chip);
  });
}
