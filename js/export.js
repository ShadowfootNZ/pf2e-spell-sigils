// Spell Sigils: exporting the sigil from the toolbar's Export panel, as a PNG image or an MP4 or WebM
// animation, by copying, saving or the system share sheet.

/* ---------------- the sigil as a standalone SVG ---------------- */
const EXPORT_MAX = 1200; // a PNG's long side, in pixels
// the animation: a square video, drawn from blank through the drawing and its flash, then held for a
// moment on the finished sigil with its comets circling
const ANIMATION = {size:720, fps:30, hold:2000, bitrate:3e6};
const FORMATS = {
  mp4:  {label:'MP4', mime:'video/mp4', ext:'mp4', codec:'avc1.42001f', script:'js/vendor/mp4-muxer.js',
         muxer: target => new Mp4Muxer.Muxer({target, video:{codec:'avc', width:ANIMATION.size, height:ANIMATION.size, frameRate:ANIMATION.fps},
           fastStart:'in-memory', firstTimestampBehavior:'offset'}), target: () => new Mp4Muxer.ArrayBufferTarget()},
  webm: {label:'WebM', mime:'video/webm', ext:'webm', codec:'vp09.00.10.08', script:'js/vendor/webm-muxer.js',
         muxer: target => new WebMMuxer.Muxer({target, video:{codec:'V_VP9', width:ANIMATION.size, height:ANIMATION.size, frameRate:ANIMATION.fps},
           firstTimestampBehavior:'offset'}), target: () => new WebMMuxer.ArrayBufferTarget()},
};

// A standalone copy of the sigil as it is on screen, as SVG markup, `size` pixels on its long side.
// `box` fixes the area shown (an animation's frames all show the same square); without it the copy fits
// the drawing. Comets are left out of an image, which shows the drawing, but kept in an animation's
// frames. An animation's frames also get an opaque dark ground; an image in the dark mode keeps a
// transparent one. `tint` lays the resting tint (see below), which an animation's frames leave out: drawn
// on every frame, the glow filter made Safari take a quarter of a second per frame. Everything up to the
// returned string runs synchronously, so the state on screen is taken at one moment
function sigilSvgClone({keepComets = false, box = null, size = EXPORT_MAX, opaque = false, tint = true} = {}){
  const svgEl = document.getElementById('sigil');
  // the live viewBox is a fixed 0 0 600 600, but ring medallions routinely straddle/exceed that box —
  // #sigil's own overflow:visible is what lets them spill out on screen. A standalone exported SVG has
  // no such CSS to inherit, so it clips to its viewBox by default; getBBox() finds the *actual* rendered
  // extent (geometry only, not filter/glow spread, hence the generous padding) and the export uses that
  // instead of the nominal canvas size.
  if (!box){
    const bbox = document.getElementById('sigilRoot').getBBox(), pad = 40;
    box = {x:bbox.x - pad, y:bbox.y - pad, w:bbox.width + pad*2, h:bbox.height + pad*2};
  }
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
  // the comets are light passing over the drawing, not part of a still image of it
  if (!keepComets) clone.querySelectorAll('.comet').forEach(c => c.remove());
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('viewBox', `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}`);
  // the image's own size, keeping the box's aspect ratio. The image is given this size, not left to its
  // natural one: with only a viewBox, an SVG image comes out 150px tall, and Safari draws its filters at
  // that size before scaling up, which left iPad copies soft, with blurred doubled lines
  const scale = size / Math.max(box.w, box.h), width = Math.round(box.w*scale), height = Math.round(box.h*scale);
  clone.setAttribute('width', width); clone.setAttribute('height', height);
  const ground = (id, stops, cy) => {
    const g = el('radialGradient', {id, cx:'50%', cy, r:'70%'});
    stops.forEach(([offset, color]) => g.appendChild(el('stop', {offset, 'stop-color':color})));
    clone.querySelector('defs').appendChild(g);
    clone.insertBefore(el('rect', {x:box.x, y:box.y, width:box.w, height:box.h, fill:`url(#${id})`}), clone.firstChild);
  };
  // parchment gets the paper baked in and the ink rules embedded, since the paper is CSS on the stage and
  // the ink rules are a stylesheet, neither of which the standalone clone has
  if (document.querySelector('.stage').classList.contains('parchment')){
    ground('paper', PARCHMENT.paper.map((c, i) => [[0, 0.7, 1][i], c]), '50%');
    clone.insertBefore(Object.assign(document.createElementNS(NS, 'style'), {textContent: inkRules('')}), clone.firstChild);
    // an inked sigil doesn't glow; on screen the stylesheet takes off any glow filter the sigil carries
    clone.querySelector('#sigilRoot').removeAttribute('filter');
  } else {
    // the page's own ground, as body's background in styles.css draws it
    if (opaque) ground('ground', [[0, '#0b0d16'], [1, '#05060a']], '30%');
    // the glow filter, which on screen the sigil carries only while the glow shows: at rest its 0px halos
    // lay the faint tint that the stylesheet's drop-shadows give the live sigil, and the clone has no
    // stylesheet. Without the tint, the clone carries the filter just when the sigil does
    if (tint) clone.querySelector('#sigilRoot').setAttribute('filter', 'url(#sigilGlow)');
  }
  return { svgString: new XMLSerializer().serializeToString(clone), width, height };
}
function captureSigilSvg(){ return sigilSvgClone(); }

// draws SVG markup onto a canvas context at width x height, replacing what was there only once the new
// picture is decoded, so a canvas on show never flashes blank
async function rasterize(svgString, ctx, width, height){
  const url = URL.createObjectURL(new Blob([svgString], {type:'image/svg+xml'}));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  } finally { URL.revokeObjectURL(url); }
}

// returns a promise for the rasterized PNG blob — kept as a *pending* promise (not awaited here) so
// copying can hand it straight to ClipboardItem, which is what lets the eventual clipboard write still
// count against the click's transient user activation despite the decode/encode work taking a beat
function renderSigilBlob(){
  const { svgString, width, height } = captureSigilSvg();
  return (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    await rasterize(svgString, canvas.getContext('2d'), width, height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  })();
}

/* ---------------- the animation ---------------- */
const loadedScripts = new Map();
function loadScript(src){
  if (!loadedScripts.has(src)) loadedScripts.set(src, new Promise((resolve, reject) => {
    document.head.appendChild(Object.assign(document.createElement('script'), {src, onload: resolve, onerror: () => reject(new Error(`couldn't load ${src}`))}));
  }));
  return loadedScripts.get(src);
}

// the square every frame shows: the whole drawing, centred, with a margin. Every element exists, undrawn,
// as soon as buildSigil returns, so the drawing's extent is known before the first line appears
function animationBox(){
  const b = document.getElementById('sigilRoot').getBBox(), pad = 30;
  const side = Math.max(b.width, b.height) + pad*2;
  return {x:b.x + b.width/2 - side/2, y:b.y + b.height/2 - side/2, w:side, h:side};
}

// Draws the current spell afresh and records it, frame by frame, as an MP4 or WebM blob. The sigil's
// clock is stepped exactly one frame at a time, so the video is smooth however slowly each frame
// renders; the Web Animations the sigil draws with run on the page's timeline, so each frame sets their
// times to match. The live sigil is the one recorded, and is left settled at the end, but it's hidden
// meanwhile: Safari repainting it, filters and all, at every step made a clip take five times as long.
// Each frame is drawn on `canvas`, which can be on show as a preview instead. A new spell drawn
// meanwhile, or `signal`, cancels it.
async function makeAnimation(format, {onProgress = () => {}, signal = new AbortController().signal, canvas = document.createElement('canvas')} = {}){
  const f = FORMATS[format], {size, fps} = ANIMATION;
  await loadScript(f.script);
  const config = {codec:f.codec, width:size, height:size, bitrate:ANIMATION.bitrate, framerate:fps};
  if (typeof VideoEncoder !== 'function' || !(await VideoEncoder.isConfigSupported(config)).supported)
    throw new Error(`this browser can't make ${f.label} video`);
  const spell = SPELLS.find(s => s.slug === currentSlug);
  const stage = document.querySelector('.stage');
  const wasTooSlow = glowTooSlow, wasReduced = motionReduced;
  let endAt = Infinity;
  const onReady = () => { endAt = sigilClock.now() + ANIMATION.hold; };
  let encoder = null, failure = null;
  // every change to the page is made inside the try, so the finally puts the page back however far
  // the setup got
  try {
    stage.classList.add('exporting');
    // the flash is recorded even on a device too slow to show it live, since frames take as long as they need
    glowTooSlow = false;
    // and the drawing is recorded even when the system asks for reduced motion, since it's what was asked for
    motionReduced = false;
    sigilClock.startStepping();
    const t0 = sigilClock.now();
    document.addEventListener('sigil-ready', onReady, {once:true});
    const target = f.target(), muxer = f.muxer(target);
    // Safari leaves each chunk's duration empty, which mp4-muxer refuses, so a chunk goes in with its data
    // and the frame's duration given outright; WebM needs no duration. An error here would otherwise vanish
    // inside the encoder, so it's kept and rethrown by the frame loop
    const frameUs = Math.round(1e6 / fps);
    encoder = new VideoEncoder({output: (chunk, meta) => {
      try {
        if (format !== 'mp4') return muxer.addVideoChunk(chunk, meta);
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        muxer.addVideoChunkRaw(data, chunk.type, chunk.timestamp, chunk.duration || frameUs, meta);
      } catch (e){ failure = failure || e; }
    }, error: e => { failure = failure || e; }});
    buildSigil(spell);
    const myGen = blurGen; // buildSigil bumps it, so another spell drawn while recording shows up here
    const expected = readyTimer.due + ANIMATION.hold - t0; // readyTimer is a stepped timer while stepping
    encoder.configure(config);
    const box = animationBox();
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const starts = new Map(); // each Web Animation's start on the stepped clock, from when it's first seen
    for (let i = 0; ; i++){
      if (i) sigilClock.step(1000/fps);
      const now = sigilClock.now();
      if (now >= endAt) break;
      if (signal.aborted || blurGen !== myGen) throw new DOMException('cancelled', 'AbortError');
      if (failure) throw failure;
      for (const a of document.getElementById('sigil').getAnimations({subtree:true})){
        if (!starts.has(a)) starts.set(a, now);
        if (a.playState !== 'paused') a.currentTime = now - starts.get(a); // a paused pulse rests where it is
      }
      await rasterize(sigilSvgClone({keepComets:true, box, size, opaque:true, tint:false}).svgString, ctx, size, size);
      const frame = new VideoFrame(canvas, {timestamp: Math.round((now - t0) * 1000), duration: frameUs});
      encoder.encode(frame, {keyFrame: i % (fps*2) === 0});
      frame.close();
      while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5));
      onProgress(Math.min(1, (now - t0) / (endAt === Infinity ? expected : endAt - t0)));
    }
    await encoder.flush();
    if (failure) throw failure;
    muxer.finalize();
    return new Blob([target.buffer], {type:f.mime});
  } finally {
    document.removeEventListener('sigil-ready', onReady);
    if (encoder && encoder.state !== 'closed') encoder.close();
    glowTooSlow = wasTooSlow;
    motionReduced = wasReduced;
    if (sigilClock.stepped) sigilClock.stopStepping();
    stage.classList.remove('exporting');
  }
}

/* ---------------- the Export panel ---------------- */
// What to export, an image or an animation in either format, then what to do with it: copy (an image
// only; no browser can put a video on the clipboard), save, or share through the system share sheet
// where there is one. An image waits for the drawing and its flash to finish, so it's never taken
// mid-draw; an animation draws the spell afresh, so it can start any time. The share sheet has to open
// from a tap, and an animation takes seconds to make, so sharing one asks for a second tap once it's ready.
const exportOpen = document.getElementById('exportOpen');
const exportPanel = document.getElementById('exportPanel');
const exportFormat = document.getElementById('exportFormat');
const exportCopy = document.getElementById('exportCopy'), exportSave = document.getElementById('exportSave'), exportShare = document.getElementById('exportShare');
const exportProgress = document.getElementById('exportProgress'), exportProgressRow = document.getElementById('exportProgressRow');
const exportStatus = document.getElementById('exportStatus');
const exportPreview = document.getElementById('exportPreview'); // the frames as they're made, while the sigil is hidden
// browsers offer the clipboard for images only to a secure page, one served over https or from
// localhost; reached by a network address over plain http, as an iPad on the same network reaches a dev
// server, the API isn't there at all
const clipboardAvailable = window.isSecureContext && !!navigator.clipboard && typeof ClipboardItem === 'function';
const canShareType = type => typeof navigator.canShare === 'function' &&
  navigator.canShare({files:[new File([new Blob()], 'sigil', {type})]});

let sigilDrawing = true;   // between 'sigil-drawing' and 'sigil-ready'
let job = null;            // an animation being made: {controller, key}
let made = null;           // the last animation made: {key, blob}
let imageForShare = null;  // a PNG made ahead, so Share can open the sheet straight from the tap: {key, promise, blob}

const exportKind = () => exportPanel.querySelector('input[name="exportKind"]:checked').value;
const parchmentOn = () => document.querySelector('.stage').classList.contains('parchment');
const glowOn = () => maxGlowToggle.getAttribute('aria-pressed') === 'true';
const animationKey = () => `${currentSlug}|${parchmentOn()}|${exportFormat.value}`;
const imageKey = () => `${currentSlug}|${parchmentOn()}|${glowOn()}`;
const setStatus = text => { exportStatus.textContent = text; };
// the shown spell's name, made safe as a file name everywhere: strips the characters Windows forbids
function fileName(ext){
  const name = (document.getElementById('roName').textContent || 'sigil').replace(/[\\/:*?"<>|]+/g, '').trim() || 'sigil';
  return `${name}.${ext}`;
}
function download(blob, ext){
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href:url, download:fileName(ext)});
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function share(blob, ext){
  await navigator.share({files:[new File([blob], fileName(ext), {type:blob.type})], title:document.getElementById('roName').textContent});
}

function refreshExport(){
  const animation = exportKind() === 'animation', busy = !!job;
  exportFormat.disabled = !animation || busy;
  exportCopy.disabled = busy || animation || sigilDrawing;
  exportSave.disabled = busy || (!animation && sigilDrawing);
  exportShare.hidden = !canShareType(animation ? FORMATS[exportFormat.value].mime : 'image/png');
  exportShare.disabled = busy || (!animation && sigilDrawing);
  exportProgressRow.hidden = !busy;
  exportShare.classList.toggle('ready', animation && !busy && made && made.key === animationKey());
  if (!busy && !animation && sigilDrawing) setStatus('The image waits for the sigil to finish drawing.');
  // the PNG is made ahead whenever the panel is open on a finished sigil, so Share needs no wait
  if (!animation && !sigilDrawing && !exportPanel.hidden && !exportShare.hidden && (!imageForShare || imageForShare.key !== imageKey())){
    const entry = {key:imageKey(), promise:renderSigilBlob(), blob:null};
    entry.promise.then(b => { entry.blob = b; }).catch(() => {});
    imageForShare = entry;
  }
}

async function exportAnimation(then){
  const key = animationKey();
  if (made && made.key === key) return made.blob;
  const controller = new AbortController();
  job = {controller, key};
  exportProgress.value = 0;
  setStatus(`Drawing the ${FORMATS[exportFormat.value].label} animation…`);
  refreshExport();
  try {
    const blob = await makeAnimation(exportFormat.value, {onProgress: p => { exportProgress.value = p; }, signal: controller.signal, canvas: exportPreview});
    made = {key, blob};
    return blob;
  } finally {
    job = null;
    refreshExport();
  }
}

// what happened, in the panel's status line; a cancel or a closed share sheet isn't a failure
async function exportAction(label, action){
  try { setStatus(await action() || ''); }
  catch (err){
    if (err.name === 'AbortError') setStatus(job ? '' : 'Cancelled.');
    else { console.error(label + ' failed', err); setStatus(`${label} failed: ${err.message || err}`); }
  }
}

exportCopy.addEventListener('click', () => exportAction('Copy', async () => {
  if (!clipboardAvailable) return 'Copying an image needs the page on https. Save works anywhere.';
  await navigator.clipboard.write([new ClipboardItem({'image/png': renderSigilBlob()})]);
  return 'Image copied.';
}));
exportSave.addEventListener('click', () => exportAction('Save', async () => {
  if (exportKind() === 'image'){ download(await renderSigilBlob(), 'png'); return 'Image saved.'; }
  const format = FORMATS[exportFormat.value];
  const blob = await exportAnimation();
  download(blob, format.ext);
  return `Animation saved, ${(blob.size / 1e6).toFixed(1)} MB.`;
}));
exportShare.addEventListener('click', () => exportAction('Share', async () => {
  if (exportKind() === 'image'){
    const ready = imageForShare && imageForShare.key === imageKey() && imageForShare.blob;
    await share(ready || await renderSigilBlob(), 'png');
    return '';
  }
  const format = FORMATS[exportFormat.value];
  if (!made || made.key !== animationKey()){
    await exportAnimation();
    return 'The animation is ready. Tap Share again to send it.';
  }
  await share(made.blob, format.ext);
  return '';
}));
document.getElementById('exportCancel').addEventListener('click', () => { if (job) job.controller.abort(); });

exportPanel.addEventListener('change', () => { setStatus(exportKind() === 'animation' ? 'Browsers can\'t copy a video: save or share it.' : ''); refreshExport(); });
['sigil-drawing', 'sigil-ready'].forEach(type => document.addEventListener(type, () => {
  sigilDrawing = type === 'sigil-drawing';
  if (!sigilDrawing && exportStatus.textContent.startsWith('The image waits')) setStatus('');
  refreshExport();
}));
// the image to share is made ahead for the mode and glow it shows
[document.getElementById('bgToggle'), maxGlowToggle].forEach(b => b.addEventListener('click', refreshExport));

function setExportPanel(open, focusInside){
  exportPanel.hidden = !open;
  exportOpen.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open){ refreshExport(); if (focusInside) exportPanel.querySelector('input:checked').focus(); }
  else if (exportPanel.contains(document.activeElement)) exportOpen.focus();
}
// a click from Enter or Space has no pointer position, and reports detail 0
exportOpen.addEventListener('click', e => setExportPanel(exportPanel.hidden, e.detail === 0));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !exportPanel.hidden) setExportPanel(false); });
document.addEventListener('pointerdown', e => {
  if (!exportPanel.hidden && !exportPanel.contains(e.target) && !exportOpen.contains(e.target)) setExportPanel(false);
});
// and when keyboard focus moves on past it
exportPanel.addEventListener('focusout', e => {
  if (e.relatedTarget && !exportPanel.contains(e.relatedTarget) && e.relatedTarget !== exportOpen) setExportPanel(false);
});
