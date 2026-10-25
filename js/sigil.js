// Spell Sigils: builds and animates one spell's sigil.

// Bumped whenever a code change redraws existing sigils, and shown in the page's footer, so a saved image
// can be matched to the drawing rules that made it. test/snapshots.mjs checks it against the baseline
const SIGIL_VERSION = 1;

/* ---------------- the sigil's clock ---------------- */
// Comets, the glow flash and the idle timers ask this clock for the time, for frames and for delays,
// rather than asking the page, so that making an animation (js/export.js) can step it exactly a frame at
// a time however slowly each frame renders. Normally it's the page's clock plus an offset, which lets
// time carry on smoothly from wherever a stepped run left it. The Web Animations the sigil draws with run
// on the page's timeline; js/export.js sets their times as it steps.
const sigilClock = {
  offset: 0,
  stepped: null, // while stepping: {now, frames: [callbacks waiting for the next frame], timers: [...]}
  now(){ return this.stepped ? this.stepped.now : performance.now() + this.offset; },
  frame(cb){
    if (this.stepped) this.stepped.frames.push(cb);
    else requestAnimationFrame(t => cb(t + this.offset));
  },
  later(cb, ms){
    if (!this.stepped) return setTimeout(cb, ms);
    const timer = {due: this.stepped.now + ms, cb};
    this.stepped.timers.push(timer);
    return timer;
  },
  cancel(timer){
    if (timer && typeof timer === 'object') timer.cancelled = true; else clearTimeout(timer);
  },
  // switches to stepping, from the current time
  startStepping(){ this.stepped = {now: this.now(), frames: [], timers: []}; },
  // moves on by ms: fires the timers that fall due, in order, then runs one round of frame callbacks
  step(ms){
    const s = this.stepped;
    s.now += ms;
    const due = s.timers.filter(t => !t.cancelled && t.due <= s.now).sort((a, b) => a.due - b.due);
    due.forEach(t => { t.cancelled = true; t.cb(); });
    s.timers = s.timers.filter(t => !t.cancelled);
    const frames = s.frames;
    s.frames = [];
    frames.forEach(cb => cb(s.now));
  },
  // back to the page's clock, carrying on from the stepped time; waiting frames and timers are handed over,
  // and a timer handed over can still be cancelled through the object `later` returned for it
  stopStepping(){
    const s = this.stepped;
    this.stepped = null;
    this.offset = s.now - performance.now();
    s.frames.forEach(cb => this.frame(cb));
    s.timers.filter(t => !t.cancelled).forEach(t => setTimeout(() => { if (!t.cancelled) t.cb(); }, Math.max(0, t.due - s.now)));
  },
};

/* ---------------- sigil construction ---------------- */
let idleTimer = null;
// buildSigil fires 'sigil-drawing' on the document when it starts and 'sigil-ready' once the drawing and
// its flash are over, so the page can hold back copy and save until there's a finished sigil to take
let readyTimer = null;
let blurGen = 0;

// The sigil's glow flashes once when it finishes drawing and then goes out, leaving crisp lines; the
// comets and the slow line pulses keep a settled sigil alive. The flash has two parts, both in the
// #sigilGlow filter and driven by the same eased curve so they rise together: a wide haze, in a darkened
// version of each line's own color, and two neon halos in the spell's main color. glowDuplicate's
// per-line halos flash and fade on their own timing.

// Safari draws SVG and CSS blurs in software, so a filter over the whole sigil runs at a few frames a
// second on an iPad or iPhone, where Chrome keeps 60. So the sigil carries #sigilGlow only while the
// glow shows (see setGlow), and the flash watches its own frame times: if they're slow, it ends at once,
// and for the rest of the visit there's no flash and no per-line halos, and max glow holds the sigil
// still while it's on (see setIdleStill)
let glowTooSlow = false;

// the glow's floor, and its peak, which the flash rises to and max glow holds (js/ui.js)
const GLOW_FLOOR = {farStd:0.05, farAlpha:0.05, haloA:0, haloB:0};
const GLOW_PEAK = {farStd:6.0, farAlpha:1, haloA:1.2, haloB:2.8};
// sets every part of the glow at once. The halos are given as drop-shadow blur radii: a drop-shadow's
// radius is twice the standard deviation of its Gaussian blur. At the floor the sigil drops the filter,
// and the outer <svg>'s two 0px CSS drop-shadows lay the same faint resting tint instead (css/app.css)
function setGlow({farStd, farAlpha, haloA, haloB}){
  document.getElementById('sigilBlurFar').setAttribute('stdDeviation', farStd.toFixed(2));
  document.getElementById('sigilBlurFarColor').setAttribute('values', `0.55 0 0 0 0  0 0.55 0 0 0  0 0 0.55 0 0  0 0 0 ${farAlpha.toFixed(2)} 0`);
  document.getElementById('sigilHaloA').setAttribute('stdDeviation', (haloA/2).toFixed(2));
  document.getElementById('sigilHaloB').setAttribute('stdDeviation', (haloB/2).toFixed(2));
  const lit = farAlpha > GLOW_FLOOR.farAlpha || haloA > 0 || haloB > 0;
  const root = document.getElementById('sigilRoot');
  if (lit) root.setAttribute('filter', 'url(#sigilGlow)'); else root.removeAttribute('filter');
  document.getElementById('sigil').classList.toggle('lit', lit);
}

// holds a settled sigil still: the idle comets hide and stop asking for frames, and the line pulses
// pause at their resting, full opacity. Three things ask for it, each by name: max glow on a device too slow for the glow ('max glow'), so
// the glow is drawn once rather than every frame, parchment mode ('parchment'), where the inked
// drawing sits still once drawn, and a system set to reduce motion ('reduced motion', see motionReduced).
// The draw-on sparks carry on regardless
const stillReasons = new Set();
let idleStill = false;
const stillLoops = new Set(); // idle comet loops waiting to carry on
function setIdleStill(reason, still){
  if (still) stillReasons.add(reason); else stillReasons.delete(reason);
  idleStill = stillReasons.size > 0;
  document.getElementById('sigil').classList.toggle('still', idleStill);
  document.getAnimations().forEach(a => { if (a.effect && a.effect.getTiming().iterations === Infinity) idleStill ? restPulse(a) : a.play(); });
  if (!idleStill){ stillLoops.forEach(f => sigilClock.frame(f)); stillLoops.clear(); }
}
// a pulse's first keyframe is its resting opacity, at the end of its start delay
function restPulse(a){ a.pause(); a.currentTime = a.effect.getTiming().delay; }

// A visitor whose system asks for reduced motion gets each sigil whole: it fades in at once, with no
// draw-on, sparks or flash, and is held still. A change to the setting mid-visit is followed, and the
// sigil on show is let go or held at once. An exported animation still draws (js/export.js), since the
// drawing is what was asked for
const REDUCED_FADE = 400;
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let motionReduced = reducedMotionQuery.matches;
setIdleStill('reduced motion', motionReduced);
reducedMotionQuery.addEventListener('change', e => {
  motionReduced = e.matches;
  setIdleStill('reduced motion', motionReduced);
});

// Bumps blurGen (abandoning any previous spell's still-running flash) and pins the glow at its floor —
// called immediately when a new sigil starts building, so the old spell's glow doesn't linger or bleed
// into the new draw-on. The flash itself is a separate step (see startGlow below), fired only once the
// new sigil has finished drawing.
function resetGlow(){
  const myGen = ++blurGen;
  setGlow(GLOW_FLOOR);
  return myGen;
}

function startGlow(myGen, glowLayer){
  if (myGen !== blurGen || glowTooSlow) return; // abandoned before its ramp even got to start
  const introDur = 1600;
  const lerp = (key, t) => GLOW_FLOOR[key] + (GLOW_PEAK[key] - GLOW_FLOOR[key])*t;
  let start = null; // anchored on the first frame actually painted, not the moment this was called —
                     // on first page load, list rendering/font loading can eat the first chunk of the
                     // ramp before anything is even on screen, making it look like it starts mid-swing
  let last = null, slowFrames = 0;
  function frame(now){
    if (myGen !== blurGen) return; // a newer spell was picked — abandon this flash
    // two frames in a row slower than 50ms: this device draws the blur in software (see glowTooSlow)
    slowFrames = last !== null && now - last > 50 ? slowFrames + 1 : 0;
    last = now;
    if (slowFrames >= 2){
      glowTooSlow = true;
      setGlow({...GLOW_FLOOR, farAlpha:0});
      glowLayer.replaceChildren();
      return;
    }
    if (start === null) start = now;
    const elapsed = now - start;
    const frac = Math.min(1, elapsed/introDur);
    const rise = 1 - Math.exp(-4*frac);
    const pulse = Math.sin(frac*Math.PI*3) * Math.exp(-3*frac) * 0.4;
    const eased = Math.max(0, rise + pulse);

    if (frac < 1){
      // the haze and the halos ride in on the exact same eased curve — no separate ramps to fall out of sync
      setGlow({farStd:lerp('farStd', eased), farAlpha:Math.min(1, lerp('farAlpha', eased)),
        haloA:lerp('haloA', eased), haloB:lerp('haloB', eased)});
      sigilClock.frame(frame);
    } else {
      // settled: the glow goes out, and the blur drops back to its floor so it costs nothing while the
      // comets keep repainting the sigil
      setGlow({...GLOW_FLOOR, farAlpha:0});
    }
  }
  sigilClock.frame(frame);
}

// Safari ignores CSS filter functions such as blur() and drop-shadow() on SVG elements, so the comets and
// the per-line halos use SVG filters instead, made on first use and kept in the sigil's <defs> until the
// next spell is drawn. Chrome drew the CSS ones in the sigil's own units too, so the numbers carry over.
// pad is the filter region's margin round the element, as a percentage of its size: enough for the blur
// to fade out before the region's edge clips it
let svgFilterCount = 0;
const svgFilters = new Map();
function svgFilter(key, pad, primitive){
  if (!svgFilters.has(key)){
    const f = el('filter', {id:`fx${++svgFilterCount}`, x:`-${pad}%`, y:`-${pad}%`, width:`${100 + 2*pad}%`, height:`${100 + 2*pad}%`,
      'color-interpolation-filters':'sRGB', 'data-per-spell':''});
    f.appendChild(primitive);
    document.querySelector('#sigil defs').appendChild(f);
    svgFilters.set(key, `url(#${f.id})`);
  }
  return svgFilters.get(key);
}
// as CSS blur(sd px)
const svgBlur = (sd, pad) => svgFilter(`blur ${sd} ${pad}`, pad, el('feGaussianBlur', {stdDeviation:sd}));
// as CSS drop-shadow(0 0 radius color): a drop-shadow's radius is twice its blur's standard deviation
const svgShadow = (radius, color) => svgFilter(`shadow ${radius} ${color}`, 150, el('feDropShadow', {dx:0, dy:0, stdDeviation:radius/2, 'flood-color':color}));
function clearSvgFilters(){
  document.querySelectorAll('#sigil defs [data-per-spell]').forEach(f => f.remove());
  svgFilters.clear();
  svgFilterCount = 0; // so a spell's filter ids don't depend on the spells drawn before it
}

// a comet riding a path: a soft trailing flare blob + a hot white core + a spawned trail of fading
// sparkle particles, ported from a canvas particle-accumulation technique into SVG/rAF terms.
// getFrac(elapsedMs) returns the comet's position as a 0..1 fraction of the path; when it returns
// null the ride is over and the comet cleans itself up.
function rideComet(pathEl, delayMs, color, getFrac, opts){
  opts = opts || {};
  const peak = opts.peak !== undefined ? opts.peak : 1;       // max opacity of the core/flare
  const withParticles = opts.particles !== false; // a trail of sparkles unless asked for none

  const parent = pathEl.parentNode || pathEl.ownerSVGElement;
  let len = 0;
  try { len = pathEl.getTotalLength(); } catch(e){}
  if (!len) return;
  // a path placed by its own transform (a ritual station's square) reports points in its own coordinates,
  // centred on the origin, while the comet is drawn in its parent's: carry each point through the transform
  const own = pathEl.transform && pathEl.transform.baseVal.consolidate();
  const pointAt = own ? l => pathEl.getPointAtLength(l).matrixTransform(own.matrix) : l => pathEl.getPointAtLength(l);

  // tagged so the stylesheet can find them: an idle comet hides while the sigil is held still (see
  // setIdleStill), and in parchment mode a spark keeps only its core, as an ink dot in the ink of the line
  // it rides (see inkRules in js/ui.js)
  const inkOwner = pathEl.closest('[data-ink]');
  const tags = part => Object.assign({class:'comet', 'data-part':part}, opts.idle ? {'data-idle':''} : {},
    inkOwner ? {'data-ink':inkOwner.getAttribute('data-ink')} : {});
  const flare = el('circle', {r:opts.flareR||8, fill:color, opacity:0, filter:svgBlur(3.5, 100), ...tags('flare')});
  parent.appendChild(flare);
  const core = el('circle', {r:opts.coreR||2.6, fill:'#fff', opacity:0, filter:svgShadow(opts.coreR?1.5:3, color), ...tags('core')});
  parent.appendChild(core);

  const particles = [];
  const start = sigilClock.now() + delayMs;
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
    if (idleStill && opts.idle){ stillLoops.add(frame); return; } // carries on when the sigil is let go
    const elapsed = now - start;
    if (elapsed < 0){ sigilClock.frame(frame); return; }
    const frac = getFrac(elapsed);

    if (frac === null){
      // the ride is over: the comet head vanishes at once, but particles it already spawned
      // keep drifting and fading independently rather than being yanked out mid-flight
      flare.remove(); core.remove();
      decayParticles();
      if (particles.length) sigilClock.frame(frame);
      return;
    }

    const edgeFade = (frac<0.08 ? frac/0.08 : (frac>0.82 ? Math.max(0,(1-frac)/0.18) : 1)) * peak;
    const pt = pointAt(frac*len);
    core.setAttribute('cx', pt.x.toFixed(2)); core.setAttribute('cy', pt.y.toFixed(2));
    core.setAttribute('opacity', edgeFade);
    const trailFrac = Math.min(0.02, 5/len); // a fixed ~5px trail, not a fraction of the path — stays
                                              // tight to the core on long paths instead of splitting off
    const behind = pointAt(Math.max(0,(frac-trailFrac)%1)*len);
    flare.setAttribute('cx', behind.x.toFixed(2)); flare.setAttribute('cy', behind.y.toFixed(2));
    flare.setAttribute('opacity', edgeFade*0.5);

    if (withParticles && now-lastSpawn > 45 && edgeFade > 0.3){
      lastSpawn = now;
      const px = pt.x + (Math.random()-0.5)*4, py = pt.y + (Math.random()-0.5)*4;
      const pDot = el('circle',{cx:px.toFixed(2), cy:py.toFixed(2), r:(0.6+Math.random()), fill:'#fff', opacity:0.8, ...tags('particle')});
      parent.appendChild(pDot);
      particles.push({el:pDot, vx:(Math.random()-0.5)*0.05, vy:(Math.random()-0.5)*0.05, life:1});
    }
    decayParticles();
    sigilClock.frame(frame);
  }
  sigilClock.frame(frame);
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
  clone.setAttribute('filter', svgBlur(1.5, 50));
  clone.style.opacity = 0;
  // appended to the shared glow layer (painted first, so behind every crisp element in the sigil)
  // rather than just before its own source — insertBefore only guaranteed it sat behind *that one*
  // element, not behind geometry added later in build order that happens to overlap it
  (layer || sourceEl.parentNode).appendChild(clone);
  const fadeIn = clone.animate([{opacity:0},{opacity:1}], {duration:dur, delay, easing:'ease-out', fill:'forwards'});
  // a one-time flash: once lit, the halo fades straight back out
  fadeIn.finished.then(()=>{
    if (!clone.isConnected) return; // sigil was rebuilt for a new spell before this fade-in finished
    clone.animate([{opacity:1},{opacity:0}], {duration:900, easing:'ease-in', fill:'forwards'});
  }).catch(()=>{}); // the fade-in animation gets cancelled (element removed) if a new spell is picked mid-draw
  return clone;
}

// forever: a faint comet that keeps circling a completed ring/polygon, like current in a closed loop.
// deliberately subtler than the draw-in spark — this is background ambience, not something to track —
// though it leaves the same trail of sparkles.
function energyLoop(pathEl, color, speed){
  if (!pathEl) return;
  rideComet(pathEl, 0, color, elapsed => (elapsed % speed) / speed, {peak:0.4, coreR:1.5, flareR:2, idle:true});
}

// a ritual's caster stations ring sits outside the ring medallions, so a ritual is drawn at this scale
const RITUAL_SCALE = 0.78;
// the traditions a ritual is colored and written by: its own when it has any, otherwise those of the
// magical skills its checks offer (SKILL_TRADITION), primary check first, in order of first appearance
function ritualTraditions(spell){
  if (spell.traditions.length) return spell.traditions;
  const skills = (spell.primaryCheck || []).map(o => o.skill).concat(...(spell.secondaryChecks || []));
  return [...new Set(skills.map(s => SKILL_TRADITION[s]).filter(Boolean))];
}

function buildSigil(spell){
  sigilClock.cancel(idleTimer);
  sigilClock.cancel(readyTimer);
  document.dispatchEvent(new Event('sigil-drawing'));
  // A new spell starts with max glow off.
  document.getElementById('maxGlowToggle').setAttribute('aria-pressed', 'false');
  setIdleStill('max glow', false);
  const sigilRoot = document.getElementById('sigilRoot');
  sigilRoot.innerHTML = '';
  clearSvgFilters(); // the previous spell's comets and halos went with it
  // a ritual's caster stations sit on a ring outside everything else, so its whole drawing is scaled down
  // about the center to stay roughly the size of any other sigil
  const isRitual = spell.category === 'ritual';
  const root = isRitual
    ? sigilRoot.appendChild(el('g', {transform:`translate(300 300) scale(${RITUAL_SCALE}) translate(-300 -300)`}))
    : sigilRoot;
  // every glowDuplicate() clone lands here, as the first child of sigilRoot, so every soft halo
  // paints behind every crisp line in the sigil regardless of when each was built
  const glowLayer = el('g',{'data-part':'halos'});
  root.appendChild(glowLayer);

  const rng = rngFor(spell);
  const cx = 300, cy = 300;
  const traditions = spell.traditions.length ? spell.traditions : ['none'];
  // A ritual uses its traditions or those of its magical skills. Single-slot spells get a second shade;
  // class focus spells share a class hue, while other traditionless slots get per-spell hues.
  const ritualTrads = isRitual ? ritualTraditions(spell) : [];
  const colorTraditions = !isRitual ? traditions : ritualTrads.length ? ritualTrads : ['ritual'];
  const isClassFocus = spell.category === 'focus' && spell.focusClass;
  const colorSlotTrads = colorTraditions.length > 1 ? colorTraditions
    : colorTraditions[0] === 'ritual' ? ['ritual', 'ritual']
    : traditions[0] === 'none' && isClassFocus ? ['focus', 'focus']
    : [colorTraditions[0], colorTraditions[0]];
  // Each slot gets deterministic jitter within its hue range.
  const tradJitters = colorSlotTrads.map(t=>{
    const j = {hue:(rng()-0.5)*2, sat:(rng()-0.5)*2, light:(rng()-0.5)*2};
    if (t === 'none') j.baseHue = pickNoneHue(rng);
    if (t === 'ritual') j.baseHue = pickRitualHue(rng);
    if (t === 'focus') j.baseHue = hueForClass(spell.focusClass);
    return j;
  });
  const colorAt = i => tradColor(colorSlotTrads[i % colorSlotTrads.length], tradJitters[i % colorSlotTrads.length]);

  ['sigilHaloA', 'sigilHaloB'].forEach(id => document.getElementById(id).setAttribute('flood-color', colorAt(0)));
  document.getElementById('sigil').style.setProperty('--glowcolor', colorAt(0)); // the resting tint (css/app.css)
  const glowGen = resetGlow(); // glow stays pinned at floor until the sigil finishes drawing (see totalEnd below)

  // Focus bands keep their writing but omit ruled lines and double the letter spacing.
  const isFocusSpell = spell.category === 'focus';
  const rank = spell.rank;
  const rankForScale = Math.min(rank, 10);
  const jitter1 = () => Math.floor(rng()*3)-1; // -1, 0, or 1 — a small per-spell nudge within a rank's range,
                                                // so spells sharing a rank aren't the literal same skeleton
  const sides = Math.min(12, Math.max(3, rankForScale+3 + jitter1()));
  const hasChords = rankForScale >= 3;
  const chordSkip = Math.max(2, 2 + Math.floor(rankForScale/4) + jitter1());
  const baseRot = Math.floor(rng()*360);

  // Build a small per-spell rune vocabulary, split evenly across its writing traditions. Traditionless
  // spells use half the normal budget across all four; focus spells keep at least four shapes. Shuffle each
  // complete pool before slicing so a budget change does not change the number of RNG calls.
  const writingTraditions = isRitual ? ritualTrads : spell.traditions;
  const runeTraditions = writingTraditions.length ? [...new Set(writingTraditions)] : ALL_TRADITIONS;
  const runeVocabTarget = writingTraditions.length
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
  // Satellites are appended late to paint on top, but timed immediately after the outer band.
  let satelliteSectionStart = null;
  // Reserve a conservative slot without duplicating medallion()'s timing formula; the drawing block later
  // reconciles the actual end into `t`.
  function reserveSatelliteSlot(){
    satelliteSectionStart = t;
    if (ringPlan.length) t += (ringPlan.length-1)*350 + 700;
  }
  // Sections are sequential; small elements within one section retain an overlapping stagger.
  function push(elx, dur, kind, delay){
    timeline.push({el:elx, delay, dur, kind});
    return delay + dur;
  }

  // Cantrips use a plain boundary, except focus cantrips, which need a writing band for their medallions.
  const bandCount = rank===0 ? (isFocusSpell ? 1 : 0) : (rankForScale<=3 ? 1 : rankForScale<=6 ? 2 : 3);
  const outerR = 258 * (0.985 + rng()*0.03);
  const bandRadii = [outerR, outerR*4/6, outerR*2/6]; // evenly spaced at 6/6, 4/6, 2/6 of outerR

  // Compute polygon geometry early so the border can leave gaps under ring medallions.
  const polyR = outerR * 5/6; // sits at the midpoint between the 6/6 and 4/6 rune bands
  const rot = baseRot + rng()*30;
  const jitterFn = () => (rng()-0.5)*2;
  const pts = polyPoints(sides, polyR, rot, cx, cy, jitterFn);

  // Curated traits occupy the centre and ring according to a seeded placement choice.
  const curated = spell.traits.filter(tr => GLYPHS[tr]);
  for(let i=curated.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [curated[i],curated[j]]=[curated[j],curated[i]]; }

  let isCentered, ringSigilGlyphs;
  if (curated.length === 0){ isCentered = false; ringSigilGlyphs = []; }
  else if (curated.length === 1){ isCentered = true; ringSigilGlyphs = []; }
  else if (curated.length === 2){ isCentered = false; ringSigilGlyphs = curated.slice(0); }
  else if (curated.length <= 6){ isCentered = rng() < 0.75; ringSigilGlyphs = isCentered ? curated.slice(1) : curated.slice(0); }
  else { isCentered = true; ringSigilGlyphs = curated.slice(1); }
  ringSigilGlyphs = ringSigilGlyphs.slice(0, 8); // 8 on the ring, 9 total with the centre
  const centerGlyph = isCentered ? curated[0] : null;

  // Rank sets a floor on ring circles; unused slots become rune fillers.
  const rankRingFloor = Math.min(3, Math.max(1, (1 + (rankForScale>=4?1:0) + (rankForScale>=8?1:0)) + jitter1()));
  const totalRingSlots = Math.max(rankRingFloor, ringSigilGlyphs.length);

  // Anchor one ring slot to a seeded polygon vertex and space the rest from it.
  const anchorVertexIdx = Math.floor(rng()*sides);
  const anchorAngle = Math.atan2(pts[anchorVertexIdx][1]-cy, pts[anchorVertexIdx][0]-cx) * 180/Math.PI;
  const ringBaseR = () => (outerR-polyR) * (0.75 + rng()*0.3) * 1.5;
  // sigils are spaced evenly *among themselves* (180° apart for 2, 120° for 3, ...) so the "opposite sides"
  // rule for 2 sigils holds regardless of whether rank also calls for extra filler slots on the ring —
  // filler angles are fit into the gaps that leaves rather than sharing one combined 360/total division
  const fillerCount = totalRingSlots - ringSigilGlyphs.length;
  const sigilAngleStep = ringSigilGlyphs.length > 0 ? 360/ringSigilGlyphs.length : 0;
  function ringSlot(angleDeg, isSigil, glyphKey){
    const rad = angleDeg*Math.PI/180;
    const dist = outerR; // centered exactly on outerR so the circle straddles the main boundary ring precisely
    const r = isSigil ? ringBaseR() : ringBaseR()*0.55; // fillers stay smaller than glyph medallions
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
    outer = el('circle',{cx,cy,r:outerR, fill:'none', stroke:colorAt(0), 'stroke-width':2.2});
    root.appendChild(outer);
    t = push(outer, 900, 'stroke', t);
    reserveSatelliteSlot();
  } else {
    // Each band is a double ring with script-like marks between its boundaries.
    for (let b=0; b<bandCount; b++){
      const R = bandRadii[b];
      const sectionStart = t;
      let sectionEnd = t;
      // One colour covers both boundaries and every mark in this band.
      const bandColor = colorAt(b);
      // the band's ruled outer and inner lines; a focus band skips both and keeps only its writing
      const innerR = R - 12;
      let bandOuter = null, bandInner = null;
      if (!isFocusSpell){
        bandOuter = el('circle',{cx,cy,r:R, fill:'none', stroke:bandColor, 'stroke-width':2.2});
        root.appendChild(bandOuter);
        sectionEnd = Math.max(sectionEnd, push(bandOuter, 900, 'stroke', sectionStart));
        pulseables.push({el:bandOuter, base:1});

        bandInner = el('circle',{cx,cy,r:innerR, fill:'none', stroke:bandColor, 'stroke-width':1.2, opacity:0.85});
        root.appendChild(bandInner);
        sectionEnd = Math.max(sectionEnd, push(bandInner, 800, 'stroke', sectionStart));
        pulseables.push({el:bandInner, base:0.85});
      }

      // Cluster marks into short words at a pitch based on their footprint; focus writing doubles it.
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
  const poly = el('polygon',{points:ptsAttr(pts), fill:'none', stroke:colorAt(1), 'stroke-width':1.8});
  root.appendChild(poly);
  const polyStart = t;
  t = push(poly, 800, 'stroke', polyStart);
  pulseables.push({el:poly, base:1});
  // mythic rules the polygon twice, like a rune band but at half its 12-unit spacing: a thinner line 6 units
  // outside it, drawn alongside it. Outside rather than inside, so the star chords still end cleanly at the
  // polygon's own corners.
  if (spell.traits.includes('mythic')){
    const rule = el('polygon',{points:ptsAttr(offsetPolygon(pts, 6, cx, cy)), fill:'none', stroke:colorAt(1), 'stroke-width':1.2, opacity:0.85});
    root.appendChild(rule);
    t = Math.max(t, push(rule, 800, 'stroke', polyStart));
    pulseables.push({el:rule, base:0.85});
  }

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
    const poly2 = el('polygon',{points:ptsAttr(pts2), fill:'none', stroke:colorAt(colorTraditions.length>1?1:0), 'stroke-width':1.2, opacity:0.8});
    root.appendChild(poly2);
    t = push(poly2, 700, 'stroke', t);
    pulseables.push({el:poly2, base:0.8});
  }

  // sigil medallions — solid-disc circles (so they visibly sit on top of the lines behind them) ringed in
  // their tradition color, shared by the center medallion and every ring medallion (see the placement plan
  // computed earlier, before the border band, as `ringPlan`/`centerGlyph`/`isCentered`)
  const centerR = Math.max(30, polyR*0.28); // the containment ring is drawn right after; this is just the radius it anchors to

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
      inner = el('g',{transform:'translate(-12,-12)', stroke:iconColor, color:iconColor, 'stroke-width':(1.5/scale).toFixed(2), 'stroke-linecap':'round', 'stroke-linejoin':'round', fill:'none', 'data-part':'glyph'});
      GLYPHS[glyphKey].draw(inner);
    } else {
      // a glyph-less ring circle is a "runic" filler — its center mark should be a rune too, matching the
      // band around it, not an arbitrary generic shape unrelated to the rest of the tool's rune vocabulary.
      // RUNES are already drawn local-origin-centered, so no -12,-12 recenter is needed here.
      inner = el('g',{stroke:iconColor, color:iconColor, 'stroke-width':(1.5/scale).toFixed(2), 'stroke-linecap':'round', fill:'none'});
      runeMark(pickRune(), inner);
    }
    holder.appendChild(inner);
    root.appendChild(holder);
    const glyphEnd = push(holder, 320, 'appear', delay+150); // glyph appears partway through the disc's own reveal
    return Math.max(discEnd, glyphEnd);
  }

  {
    const sectionStart = t;
    let sectionEnd = Math.max(sectionStart, medallion(cx, cy, centerR, colorAt(0), centerGlyph, sectionStart, false, false, false));

    // the containment ring appears next. Normally it sits a fixed 16px outside the (now-invisible) center
    // medallion radius, but at 3 bands that nearly touches the innermost band — so there it expands to
    // align with that band's own outer edge instead.
    const centerRingR = bandCount === 3 ? bandRadii[2] : centerR+16;
    // colorAt(2), not (0) — see the central-polygon comment above: this ring always draws regardless of
    // rank, so it claims its own guaranteed-coverage slot rather than repeating band 0's color
    const centerRing = el('circle',{cx,cy,r:centerRingR, fill:'none', stroke:colorAt(2), 'stroke-width':1, opacity:0.7});
    root.appendChild(centerRing);
    const ringEnd = push(centerRing, 500, 'stroke', sectionEnd);
    pulseables.push({el:centerRing, base:0.7});
    sectionEnd = Math.max(sectionEnd, ringEnd);
    t = sectionEnd;
  }

  // Append ring medallions last to paint on top, while using the timing slot reserved after the outer band.
  {
    const sectionStart = satelliteSectionStart != null ? satelliteSectionStart : t;
    let sectionEnd = sectionStart;
    let st = sectionStart;
    // Slot 0 is the fourth guaranteed colour-coverage slot; later slots continue cycling.
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

  // Ritual caster stations form a ring of squares outside the medallions. The primary
  // caster stands at the bottom, where they'd read the circle like instructions: one square per skill
  // option, side by side, so several read as "choose one", each square's line showing that option's
  // proficiency. Secondary casters' squares are spaced evenly round the rest of the ring, one per caster
  // or per skill, whichever is more (at most 8): skills repeat across extra casters, a skill offered as
  // one of a choice gets a dotted square, and with no caster count upstream the skills stand in for it.
  // Each skill sigil faces the center, as a caster standing at that station would read it.
  if (isRitual){
    const stationR = outerR + 92;
    const PRIMARY_SIZE = 40, SECONDARY_SIZE = 34, PRIMARY_GAP = 6;
    // nested square outlines for each line style, as [inset, stroke width]
    const FRAMES = {
      single: [[0, 1.4]], expert: [[0, 1.4], [3.5, 1.1]], master: [[0, 2.8], [4.2, 1.1]],
      legendary: [[0, 2.8], [4.8, 2.2]], mythic: [[0, 1.3], [3, 1.1], [6, 1.1]], dotted: [[0, 1.4]],
    };
    const PROFICIENCY_FRAME = {trained:'single', expert:'expert', master:'master', legendary:'legendary', mythic:'mythic'};
    const stationColor = skill => SKILL_TRADITION[skill]
      ? brightenHsl(tradColorSolid(SKILL_TRADITION[skill]), 1.15)
      : brightenHsl(colorAt(0), 1.2);
    const halfAngle = halfWidth => Math.asin(Math.min(1, halfWidth/stationR)) * 180/Math.PI;

    const plans = [];
    const options = spell.primaryCheck && spell.primaryCheck.length ? spell.primaryCheck : [{skill:null, proficiency:null}];
    const rowWidth = options.length*PRIMARY_SIZE + (options.length-1)*PRIMARY_GAP;
    options.forEach((o, i) => plans.push({
      x: cx - rowWidth/2 + PRIMARY_SIZE/2 + i*(PRIMARY_SIZE+PRIMARY_GAP), y: cy + stationR, rotation: 0,
      size: PRIMARY_SIZE, frame: PROFICIENCY_FRAME[o.proficiency] || 'single', skill: o.skill,
    }));
    const spans = [[90, halfAngle(rowWidth/2 + 6)]];
    const slots = (spell.secondaryChecks || []).flatMap(check => check.map(skill => ({skill, choice: check.length > 1})));
    const count = Math.min(8, Math.max(spell.casters || 0, slots.length));
    for (let i = 0; i < count; i++){
      const slot = slots.length ? slots[i % slots.length] : {skill:null, choice:false};
      const angle = 90 + (i+1)*360/(count+1);
      const rad = angle*Math.PI/180;
      plans.push({x: cx + stationR*Math.cos(rad), y: cy + stationR*Math.sin(rad), rotation: angle - 90,
        size: SECONDARY_SIZE, frame: slot.choice ? 'dotted' : 'single', skill: slot.skill});
      spans.push([angle, halfAngle(SECONDARY_SIZE/2 + 6)]);
    }

    const sectionStart = t;
    let sectionEnd = t;
    // the station ring, broken around each station so it never runs through a sigil
    spans.sort((a, b) => a[0] - b[0]);
    let ringPath = '';
    spans.forEach(([center, half], i) => {
      const [nextCenter, nextHalf] = spans[(i+1) % spans.length];
      const start = center + half, end = (i+1 < spans.length ? nextCenter : nextCenter + 360) - nextHalf;
      if (end - start > 1) ringPath += arcPath(cx, cy, stationR, start, end) + ' ';
    });
    const stationRing = el('path', {d:ringPath.trim(), fill:'none', stroke:colorAt(0), 'stroke-width':1.1, opacity:0.8, 'data-part':'station-ring'});
    root.appendChild(stationRing);
    sectionEnd = Math.max(sectionEnd, push(stationRing, 900, 'stroke', sectionStart));

    plans.forEach((p, i) => {
      const color = stationColor(p.skill);
      const place = `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${p.rotation.toFixed(1)})`;
      const delay = sectionStart + 300 + i*140;
      FRAMES[p.frame].forEach(([inset, width]) => {
        const h = p.size/2 - inset;
        // each square carries its own placement and stroke rather than inheriting them from a group: the
        // glow halo (glowDuplicate) clones just this element into the shared glow layer, and would
        // otherwise land unplaced at the origin as a black square
        const square = el('path', {d:`M${-h},${-h} H${h} V${h} H${-h} Z`, transform:place, fill:'none', stroke:color, 'stroke-width':width, 'data-part':'station'});
        // a dotted square fades in: the stroke draw-on would take over its stroke-dasharray
        if (p.frame === 'dotted'){ square.setAttribute('stroke-dasharray', '2.2,3'); square.setAttribute('opacity', 0); }
        root.appendChild(square);
        sectionEnd = Math.max(sectionEnd, push(square, 420, p.frame === 'dotted' ? 'fade' : 'stroke', delay));
      });
      const draw = p.skill && skillSigil(p.skill);
      if (draw){
        const k = p.size*0.6/24;
        const s = el('g', {transform:`${place} scale(${k.toFixed(3)}) translate(-12,-12)`, fill:'none', stroke:color, color, 'stroke-width':(1.3/k).toFixed(2), 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:0, 'data-part':'skill'});
        draw(s);
        root.appendChild(s);
        sectionEnd = Math.max(sectionEnd, push(s, 300, 'fade', delay + 300));
      }
    });
    t = sectionEnd;
  }

  // Each coloured part is marked with the ink parchment writes it in (inkRules in js/ui.js): a
  // tradition's colour with the tradition's name, any other colour slot (a class's focus spells,
  // traditionless spells, rituals with no tradition) with its slot, whose ink, made from the slot's hue,
  // goes in a <style> inside the sigil, which goes with the sigil and travels with a copied image. An
  // inline style on #sigilRoot would outlive the spell: Chrome leaves an empty style attribute behind once
  // one is removed. A colour is matched by its hue, which brightenHsl and darkenHsl keep exactly. A
  // ritual's station for a magical skill takes that skill's tradition colour, so those count too
  const hueOf = c => (/^hsl\(\s*([-\d.]+)/.exec(c || '') || [])[1];
  const inkOfHue = new Map(ALL_TRADITIONS.map(trad => [hueOf(tradColorSolid(trad)), trad]));
  const slotInks = [];
  colorSlotTrads.forEach((trad, i) => {
    if (TRAD_INK[trad]){ inkOfHue.set(hueOf(colorAt(i)), trad); return; }
    inkOfHue.set(hueOf(colorAt(i)), `s${i}`);
    slotInks.push(`--ink-s${i}:${inkForHue(tradJitters[i].baseHue)};`);
  });
  if (slotInks.length) sigilRoot.insertBefore(el('style', {}), sigilRoot.firstChild).textContent = `#sigilRoot{${slotInks.join('')}}`;
  root.querySelectorAll('[stroke], [fill], [color]').forEach(e => {
    const hue = ['stroke', 'fill', 'color'].map(prop => hueOf(e.getAttribute(prop))).find(h => h !== undefined);
    if (inkOfHue.has(hue)) e.setAttribute('data-ink', inkOfHue.get(hue));
  });

  const totalEnd = t + 700;
  // with reduced motion, every element's animation is finished as soon as it's made, so each sits as
  // its drawing leaves it, and the whole sigil fades in instead (see motionReduced)
  const instant = motionReduced;
  const drawnAt = instant ? REDUCED_FADE : totalEnd;

  // run animations
  timeline.forEach(({el:e, delay, dur, kind})=>{
    let a = null;
    if (kind === 'stroke'){
      let len = 0;
      try { len = e.getTotalLength(); } catch(err){ len = 300; }
      e.style.strokeDasharray = len;
      e.style.strokeDashoffset = len;
      a = e.animate(
        [{strokeDashoffset:len, opacity:0.2},{opacity:1, offset:0.08},{strokeDashoffset:0, opacity:1}],
        {duration:dur, delay, easing:'cubic-bezier(.3,.7,.3,1)', fill:'forwards'}
      );
      if (!instant) spark(e, delay, dur, e.getAttribute('stroke'));
      // fades in at totalEnd, not with this stroke's own draw-in — otherwise each line's glow halo
      // lights up as soon as that line is drawn, well before the sigil as a whole is finished. None on a
      // device too slow for the flash
      if (!glowTooSlow && !instant) glowDuplicate(e, totalEnd, 900, darkenHsl(e.getAttribute('stroke'), 0.6), 2, glowLayer);
    } else if (kind === 'fade'){
      a = e.animate([{opacity:0},{opacity:1}], {duration:dur, delay, easing:'ease-out', fill:'forwards'});
    } else if (kind === 'appear'){
      // A medallion glyph fades quickly into place.
      a = e.animate(
        [{opacity:0}, {opacity:1, offset:0.7}, {opacity:1}],
        {duration:dur, delay, easing:'cubic-bezier(.2,1.4,.4,1)', fill:'forwards'}
      );
    }
    if (instant && a) a.finish();
  });
  if (instant) sigilRoot.animate([{opacity:0}, {opacity:1}], {duration:REDUCED_FADE, easing:'ease-out'});

  // The animations above take their start time from the first frame drawn after this, which on a slow
  // first load comes a second or more later, and in a background tab not until it's shown, so the
  // flash and the ready signal count from that frame too. A stepped clock (js/export.js) starts them at
  // once, as it sets every animation's time itself
  const startTimers = () => {
    idleTimer = sigilClock.later(()=>{
      if (!instant) startGlow(glowGen, glowLayer);
      // a subset of lines/gems get their own independent slow pulse, so the circle feels alive rather than static
      pulseables.forEach(({el:pe, base})=>{
        if (rng() > 0.32) return;
        const low = base * (0.35 + rng()*0.25);
        const pulse = pe.animate(
          [{opacity:base},{opacity:low},{opacity:base}],
          {duration: 1400 + rng()*2400, iterations:Infinity, easing:'ease-in-out', delay: rng()*1500}
        );
        if (idleStill) restPulse(pulse); // a sigil held still starts still (see setIdleStill)
      });
      // once the sigil is fully inscribed, a bead of light keeps circling its primary loops — the working stays "live"
      energyLoop(outer, colorAt(0), 5200 + rng()*2200);
      energyLoop(innerBorder, colorAt(1), 6600 + rng()*2400);
      energyLoop(poly, colorAt(2), 4200 + rng()*1800);
    }, drawnAt);
    // the per-line halos take 900ms to light and 900ms to fade, which outlasts startGlow's 1600ms flash; the
    // fade starts a moment after the light finishes, so 200ms more keeps an image from catching its tail.
    // Without the flash, the sigil is ready once its fade is over, with a margin, as a timer can fire a
    // frame before the fade's last
    readyTimer = sigilClock.later(() => document.dispatchEvent(new Event('sigil-ready')), instant ? drawnAt + 100 : totalEnd + 2000);
  };
  if (sigilClock.stepped) startTimers();
  else sigilClock.frame(() => { if (glowGen === blurGen) startTimers(); }); // unless a newer sigil came first

  // readout
  document.getElementById('roName').textContent = spell.name;
  document.getElementById('roName').style.setProperty('--nameglow', colorAt(0));
  // a long name is set smaller when the readout sits in the stage's corners (see css/app.css)
  document.getElementById('roName').classList.toggle('long', spell.name.length > 24);
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
