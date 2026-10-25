// Spell Sigils: the trait glyphs, skill sigils and runes a sigil is drawn from.

/* ---------------- glyph library (24x24 local box, drawn into a <g>) ---------------- */
function gline(g,x1,y1,x2,y2){ g.appendChild(el('line',{x1,y1,x2,y2})); }
function gcircle(g,cx,cy,r,fill){ g.appendChild(el('circle',{cx,cy,r,fill:fill||'none'})); }
function gpath(g,d){ g.appendChild(el('path',{d,fill:'none'})); }
function grays(g,n,rIn,rOut,rot){
  for(let i=0;i<n;i++){
    const a=(rot+i*360/n)*Math.PI/180;
    gline(g, 12+rIn*Math.cos(a),12+rIn*Math.sin(a), 12+rOut*Math.cos(a),12+rOut*Math.sin(a));
  }
}
function gpoly(g,n,r,rot,fill){
  const pts=[];
  for(let i=0;i<n;i++){ const a=(rot+i*360/n)*Math.PI/180; pts.push((12+r*Math.cos(a)).toFixed(2)+','+(12+r*Math.sin(a)).toFixed(2)); }
  g.appendChild(el('polygon',{points:pts.join(' '), fill:fill||'none'}));
}

// Each trait glyph, skill sigil and rune is {note, draw}: `draw(g)` draws it into a <g>, and `note` is
// what the symbol atlas says it depicts, written for the atlas's readers. npm test checks every entry
// has both
const GLYPHS = {
  // Excluded are any traits that are a class.
  acid:      {note:"A drop with two spatters flying off it", draw:g=>{gpath(g,'M12,4 C8,10 7,13 9,16.5 C10.2,18.7 13.8,18.7 15,16.5 C17,13 16,10 12,4 Z'); gcircle(g,16,8,1,'currentColor'); gcircle(g,18,12,0.8,'currentColor');}},
  air:       {note:"Three gusts of wind", draw:g=>{gpath(g,'M4,9 Q9,6 13,9 T20,8'); gpath(g,'M4,13 Q9,10 13,13 T20,12'); gpath(g,'M4,17 Q8,15 11,17');}},
  auditory:  {note:"An ear with sound reaching it, where sonic's waves have no listener", draw:g=>{gpath(g,'M13,6 Q8,7 8,12 Q8,18 14,18 Q18,18 18,14 Q18,11 15,11 Q13,11 13,13'); gpath(g,arcPath(2,12,2.2,-45,45)); gpath(g,arcPath(2,12,4.4,-52,52));}},
  aura:      {note:"A dashed ring, the edge of an emanation", draw:g=>g.appendChild(el('circle',{cx:12,cy:12,r:8,fill:'none','stroke-dasharray':'2,2.4'}))},
  beast:      {note:"A paw print", draw:g=>{gcircle(g,12,16,4.2); gcircle(g,7,10,1.8); gcircle(g,10.5,6.5,1.8); gcircle(g,13.5,6.5,1.8); gcircle(g,17,10,1.8);}},
  cold:      {note:"A snowflake of six rays", draw:g=>grays(g,6,2,9,0)},
  composition: {note:"A musical note", draw:g=>{gcircle(g,9,17,2,'currentColor'); gline(g,11,17,11,6); gline(g,11,6,16,8);}},
  consecration: {note:"An altar with a blessing rising from it", draw:g=>{gline(g,5,18,19,18); g.appendChild(el('rect',{x:9,y:11,width:6,height:7,fill:'none'})); gline(g,12,11,12,6); gline(g,9.5,8.5,12,6); gline(g,14.5,8.5,12,6);}},
  contingency: {note:"A triangle holding a single point", draw:g=>{gpoly(g,3,7,-90); gcircle(g,12,12.5,1,'currentColor');}},
  curse:     {note:"An X inside a broken circle", draw:g=>{gpath(g,arcPath(12,12,8,25,335)); gline(g,9,9,15,15); gline(g,15,9,9,15);}},
  darkness:  {note:"A crescent, the mirror image of void's", draw:g=>gpath(g,'M9,4 A8,8 0 1 1 9,20 A6.5,6.5 0 1 0 9,4 Z')},
  death:     {note:"A skull", draw:g=>{gpath(g,'M12,4 C7,4 5,8 5,12 C5,15.5 6.5,17 8,18 L8,19.5 C8,20.3 8.7,21 9.5,21 L14.5,21 C15.3,21 16,20.3 16,19.5 L16,18 C17.5,17 19,15.5 19,12 C19,8 17,4 12,4 Z'); gcircle(g,9,12,1.6,'currentColor'); gcircle(g,15,12,1.6,'currentColor'); gpath(g,'M12,14.5 L11,17 L13,17 Z');}},
  detection: {note:"The mind's eye with four rays, looking every way", draw:g=>{g.appendChild(el('ellipse',{cx:12,cy:12,rx:7,ry:3.8})); gcircle(g,12,12,1.6,'currentColor'); grays(g,4,8,10,0);}},
  disease:   {note:"A pathogen: a cell ringed with spikes", draw:g=>{gcircle(g,12,12,4.5); grays(g,8,4.5,7,0);}},
  dream:     {note:"A thought cloud with a spark inside", draw:g=>{gpath(g,'M7,15 Q4,15 4,12 Q4,9 7,9.5 Q7.5,6 11,6.5 Q14,5 15.5,8 Q19,8 18.5,11.5 Q19,15 15,15 Z'); gline(g,11,10,11,13); gline(g,9.5,11.5,12.5,11.5);}},
  earth:     {note:"A triangle resting on a ground line", draw:g=>{gpoly(g,3,8,-90); gline(g,4.5,18,19.5,18);}},
  electricity: {note:"A lightning bolt", draw:g=>g.appendChild(el('polyline',{points:'13,3 9,12 13,12 8,21 16,10 12,10',fill:'none'}))},
  emotion:   {note:"A heart", draw:g=>gpath(g,'M12,19 C6,14.5 5,11 6.5,8.5 C7.7,6.5 10.5,6.5 12,9 C13.5,6.5 16.3,6.5 17.5,8.5 C19,11 18,14.5 12,19 Z')},
  extradimensional: {note:"A frame inside a frame, a space within a space", draw:g=>{g.appendChild(el('rect',{x:6,y:4,width:12,height:16,rx:1,fill:'none'})); g.appendChild(el('rect',{x:9,y:8,width:6,height:8,rx:0.5,fill:'none'}));}},
  fear:      {note:"Emotion's heart, cracked through", draw:g=>{gpath(g,'M12,19 C6,14.5 5,11 6.5,8.5 C7.7,6.5 10.5,6.5 12,9 C13.5,6.5 16.3,6.5 17.5,8.5 C19,11 18,14.5 12,19 Z'); gpath(g,'M9,7 L12,11 L9,13 L14,17');}},
  fire:      {note:"A flame", draw:g=>{gpath(g,'M13,2.5 C10.5,5.5 7.5,9 7.5,13 C7.5,17 10,20 13,20 C16,20 18,17.5 18,14.5 C18,12 16.5,10.5 16,8.5 C15.7,10.5 14.3,11.5 13.8,10 C13.3,8 14.5,6 15.5,4.5 C14,5 12.7,3.7 13,2.5 Z'); gpath(g,'M13,10.5 C11.8,12.3 11.2,14 11.2,15.5 C11.2,17.3 12.2,18.5 13.4,18.5 C14.6,18.5 15.3,17.3 15.3,16 C15.3,14.3 14.2,13.3 13.7,11.8 Z');}},
  force:     {note:"Two nested diamonds", draw:g=>{gpoly(g,4,8,45); gpoly(g,4,3.5,45);}},
  fortune:   {note:"Four clean rays from a bright centre", draw:g=>grays(g,4,3,8,45)},
  fungus:    {note:"A mushroom", draw:g=>{gpath(g,'M5,11 Q5,4 12,4 Q19,4 19,11 Z'); gline(g,12,11,12,20); gline(g,9,20,15,20);}},
  healing:   {note:"A cross in a circle", draw:g=>{gcircle(g,12,12,7.5); gline(g,12,8.5,12,15.5); gline(g,8.5,12,15.5,12);}},
  hex:        {note:"A hexagon around a single point", draw:g=>{gpoly(g,6,8,-90); gcircle(g,12,12,1.4,'currentColor');}},
  holy:      {note:"A laurel wreath", draw:g=>{gpath(g,'M12,4 Q6,8 7,14 Q7.5,18 11,20'); gpath(g,'M12,4 Q18,8 17,14 Q16.5,18 13,20'); gline(g,9,9,8,11); gline(g,10,13,9,15); gline(g,15,9,16,11); gline(g,14,13,15,15);}},
  illusion:  {note:"Three circles, one hiding a dot, as in the shell game", draw:g=>{gcircle(g,7,12,3); gcircle(g,12,12,3); gcircle(g,17,12,3); gcircle(g,7,12,1,'currentColor');}},
  incapacitation: {note:"An arrow stopped by a ceiling: the effect is weaker against creatures of higher level", draw:g=>{gline(g,12,19,12,9); gline(g,8,12,12,9); gline(g,16,12,12,9); gline(g,5,6,19,6);}},
  incarnate: {note:"A head and shoulders with a spark in its chest: a power made flesh", draw:g=>{gcircle(g,12,6,2.7); gpath(g,'M4.5,20.5 C4.5,13.5 8,11.2 12,11.2 C16,11.2 19.5,13.5 19.5,20.5'); gpath(g,'M12,13.4 L12.84,15.36 L14.8,16.2 L12.84,17.04 L12,19 L11.16,17.04 L9.2,16.2 L11.16,15.36 Z');}},
  incorporeal: {note:"A hooded figure with no face, its robe fading out below", draw:g=>{gpath(g,'M7,14 C7,9 8,5 12,3 C16,5 17,9 17,14'); g.appendChild(el('path',{d:'M7,14 C7,16.5 6,18.5 4.5,20.5',fill:'none','stroke-dasharray':'1.3,1.5'})); g.appendChild(el('path',{d:'M17,14 C17,16.5 18,18.5 19.5,20.5',fill:'none','stroke-dasharray':'1.3,1.5'})); g.appendChild(el('ellipse',{cx:12,cy:10,rx:2.4,ry:3,fill:'none'}));}},
  light:     {note:"An eight-pointed glint", draw:g=>{gline(g,12,3,12,21); gline(g,3,12,21,12); gline(g,7,7,17,17); gline(g,17,7,7,17);}},
  linguistic: {note:"A cartouche, a name written in a frame, for words that must be understood", draw:g=>{gpath(g,'M8,7 A4,4 0 0 1 16,7 L16,15 A4,4 0 0 1 8,15 Z'); gline(g,7,21,17,21); gpath(g,'M10.3,8.1 L12,5.9 L13.7,8.1'); gpath(g,'M9.8,11 Q10.9,9.9 12,11 T14.2,11'); gcircle(g,12,15,1.3);}},
  mental:    {note:"The mind's eye", draw:g=>{g.appendChild(el('ellipse',{cx:12,cy:12,rx:8,ry:4.2})); gcircle(g,12,12,1.8,'currentColor');}},
  metal:     {note:"A plain hexagon", draw:g=>gpoly(g,6,8,0)},
  misfortune: {note:"Fortune's four rays, broken and kinked", draw:g=>{gpath(g,'M12,9 L13.2,7 L12,4'); gpath(g,'M15,12 L17,10.8 L20,12'); gpath(g,'M12,15 L10.8,17 L12,20'); gpath(g,'M9,12 L7,13.2 L4,12');}},
  morph:      {note:"Two overlapping circles, a form partly changed", draw:g=>{gcircle(g,9,12,6); gcircle(g,15,12,6);}},
  nonlethal:  {note:"A circle cut by a low line", draw:g=>{gcircle(g,12,12,7); gline(g,7,16,17,16);}},
  olfactory: {note:"Scent rising from its source", draw:g=>{gcircle(g,12,19,1,'currentColor'); gpath(g,'M12,17 Q9,14 12,11 Q15,8 12,5'); gpath(g,'M8,18 Q6,15 8,12'); gpath(g,'M16,18 Q18,15 16,12');}},
  plant:     {note:"A leaf and its veins", draw:g=>{gpath(g,'M12,4 C6,7 6,15 12,20 C18,15 18,7 12,4 Z'); gline(g,12,7,12,18); gline(g,12,9,9,7); gline(g,12,9,15,7); gline(g,12,13,9,11); gline(g,12,13,15,11);}},
  poison:    {note:"A drop marked with an X", draw:g=>{gpath(g,'M12,4 C8.5,9.5 7.5,12.5 9.5,16 C10.6,18 13.4,18 14.5,16 C16.5,12.5 15.5,9.5 12,4 Z'); gline(g,10,13,14,16); gline(g,14,13,10,16);}},
  polymorph: {note:"Two winding lines, a form turning into another", draw:g=>gpath(g,'M6,8 C6,5 10,5 12,8 C14,11 18,11 18,8 M6,16 C6,13 10,13 12,16 C14,19 18,19 18,16')},
  prediction: {note:"The mind's eye with three rays, looking ahead", draw:g=>{g.appendChild(el('ellipse',{cx:12,cy:12,rx:7,ry:3.8})); gcircle(g,12,12,1.6,'currentColor'); grays(g,3,8,10,90);}},
  revelation: {note:"A point radiating six rays", draw:g=>{gcircle(g,12,12,2); grays(g,6,4.2,9,20);}},
  sanctified: {note:"Two circles, one inside the other", draw:g=>{gcircle(g,12,12,7.5); gcircle(g,12,12,4.5);}},
  scrying:   {note:"The mind's eye in a diamond frame, watching from afar", draw:g=>{gpoly(g,4,9,45); g.appendChild(el('ellipse',{cx:12,cy:12,rx:6,ry:3.4})); gcircle(g,12,12,1.5,'currentColor');}},
  shadow:    {note:"A small figure on the ground casting a long, flat shadow", draw:g=>{gline(g,4,19,20,19); gcircle(g,8,11.5,1.8); gline(g,8,13.3,8,19); gpath(g,'M8,19 L19,19 L14,17.3 Z');}},
  sleep:     {note:"Three rising Zs", draw:g=>{gpath(g,'M6,17 L11,17 L6,21 L11,21'); gpath(g,'M12,10 L16,10 L12,13.5 L16,13.5'); gpath(g,'M16,5 L19,5 L16,8 L19,8');}},
  sonic:     {note:"Sound waves spreading out", draw:g=>{gpath(g,arcPath(7,12,4,-50,50)); gpath(g,arcPath(7,12,7,-55,55)); gpath(g,arcPath(7,12,10,-60,60));}},
  spirit:    {note:"A single rising wisp", draw:g=>gpath(g,'M12,20 C9,17 9,15 12,13 C15,11 15,9 12,7 C9,5 9,4 12,3')},
  subtle:     {note:"A broken outline around a small, definite centre: barely noticed", draw:g=>{const p=el('circle',{cx:12,cy:12,r:6,fill:'none','stroke-dasharray':'1.5,2.2'}); g.appendChild(p); gcircle(g,12,12,1.2,'currentColor');}},
  summon:    {note:"A star drawn down into a circle on the ground: a creature called from elsewhere", draw:g=>{g.appendChild(el('ellipse',{cx:12,cy:18,rx:7.5,ry:2.6})); gpath(g,'M17.5,2.2 L18.34,4.16 L20.3,5 L18.34,5.84 L17.5,7.8 L16.66,5.84 L14.7,5 L16.66,4.16 Z'); g.appendChild(el('path',{d:'M15.8,7.2 Q8.5,8.5 11,17.5',fill:'none','stroke-dasharray':'1.4,1.6'}));}},
  teleportation: {note:"Two circles joined by a line: here and there", draw:g=>{gcircle(g,9,12,4); gcircle(g,17,12,2.4); gline(g,12.7,12,14.6,12);}},
  unholy:     {note:"Two three-quarter circles, one turned against the other", draw:g=>{gpath(g,arcPath(12,12,8,-45,225)); gpath(g,arcPath(12,12,4.5,135,405));}},
  visual:     {note:"An eye", draw:g=>{gpath(g,'M4,12 Q12,5 20,12 Q12,19 4,12 Z'); gcircle(g,12,12,2.2,'currentColor');}},
  vitality:  {note:"Three wisps rising together", draw:g=>{gpath(g,'M8,20 C6,17 6,15 8,13 C10,11 10,9 8,7 C6,5 6,4 8,3'); gpath(g,'M12,20 C10,17 10,15 12,13 C14,11 14,9 12,7 C10,5 10,4 12,3'); gpath(g,'M16,20 C14,17 14,15 16,13 C18,11 18,9 16,7 C14,5 14,4 16,3');}},
  void:      {note:"A crescent, a circle with a bite taken out of it", draw:g=>gpath(g,'M15,4 A8,8 0 1 0 15,20 A6.5,6.5 0 1 1 15,4 Z')},
  water:     {note:"A drop of water", draw:g=>gpath(g,'M12,4 C8,10 6.5,13.5 8.5,16.5 C10,18.7 14,18.7 15.5,16.5 C17.5,13.5 16,10 12,4 Z')},
  wood:      {note:"A tree, trunk and canopy", draw:g=>{gline(g,12,21,12,14); gpath(g,'M12,15 C7,15 6,11 8,8 C6,7 7,4 10,4 C10,2.5 14,2.5 14,4 C17,4 18,7 16,8 C18,11 17,15 12,15 Z');}},
};

// Ritual caster-station sigils, using the same 24x24 box and helpers as GLYPHS. Kept alphabetical.
const SKILL_SIGILS = {
  acrobatics:   {note:"A tumbler's leap: an arc over the ground with the figure at its peak", draw:g=>{gline(g,3,20,21,20); gpath(g,'M5,18 C5,7 19,7 19,16'); gline(g,19,16,16.6,13.8); gline(g,19,16,21.3,13.6); gcircle(g,12,4.8,1.5,'currentColor');}},
  arcana:       {note:"A wand tipped with a four-pointed spark", draw:g=>{gline(g,4.5,19.5,13.5,10.5); gline(g,6,21,3,18); gpath(g,'M17,3 L18,6 L21,7 L18,8 L17,11 L16,8 L13,7 L16,6 Z');}},
  athletics:    {note:"A barbell", draw:g=>{gline(g,3,12,21,12); gline(g,6,7,6,17); gline(g,8.5,9,8.5,15); gline(g,18,7,18,17); gline(g,15.5,9,15.5,15);}},
  crafting:     {note:"A hammer", draw:g=>{gline(g,5,19.5,13.5,11); gpath(g,'M11,8 L14,5 L20,11 L17,14 Z');}},
  deception:    {note:"A half mask with a tie", draw:g=>{gpath(g,'M4,9 Q12,5 20,9 Q20,15 15,16 Q12,14 9,16 Q4,15 4,9 Z'); g.appendChild(el('ellipse',{cx:8.6,cy:10.6,rx:1.9,ry:1.1})); g.appendChild(el('ellipse',{cx:15.4,cy:10.6,rx:1.9,ry:1.1})); gpath(g,'M4,9 Q2,11 3,14');}},
  diplomacy:    {note:"Balanced scales", draw:g=>{gline(g,12,5,12,19); gline(g,8,19,16,19); gline(g,5,8,19,8); gline(g,5,8,3,13); gline(g,5,8,7,13); gpath(g,'M2.5,13 Q5,16.5 7.5,13 Z'); gline(g,19,8,17,13); gline(g,19,8,21,13); gpath(g,'M16.5,13 Q19,16.5 21.5,13 Z'); gcircle(g,12,4.3,1,'currentColor');}},
  fortitude:    {note:"A shield holding a heart, for endurance", draw:g=>{gpath(g,'M12,3 L19.5,6 Q19.5,15 12,21 Q4.5,15 4.5,6 Z'); gpath(g,'M12,15.5 C8.6,13 8.6,9.3 10.6,9.3 C11.4,9.3 12,10 12,10.9 C12,10 12.6,9.3 13.4,9.3 C15.4,9.3 15.4,13 12,15.5 Z');}},
  intimidation: {note:"Three sweeping claw slashes", draw:g=>{gpath(g,'M13.5,2.5 Q8,8 3.5,15.5'); gpath(g,'M17.5,3.5 Q11.5,11 6.5,19.5'); gpath(g,'M21,6.5 Q15,14 10.5,21.5');}},
  lore:         {note:"A scroll rolled at both ends, used for every kind of Lore", draw:g=>{gline(g,7,7,7,17); gline(g,17,7,17,17); gpath(g,'M5.5,5.5 Q5.5,3.5 7.5,3.5 L16.5,3.5 Q18.5,3.5 18.5,5.5 Q18.5,7.5 16.5,7.5 L7.5,7.5 Q5.5,7.5 5.5,5.5 Z'); gpath(g,'M5.5,18.5 Q5.5,16.5 7.5,16.5 L16.5,16.5 Q18.5,16.5 18.5,18.5 Q18.5,20.5 16.5,20.5 L7.5,20.5 Q5.5,20.5 5.5,18.5 Z'); gline(g,9.5,11,14.5,11); gline(g,9.5,13.5,14.5,13.5);}},
  medicine:     {note:"A mortar and pestle", draw:g=>{gpath(g,'M4.5,12 L19.5,12 Q19.5,19.5 12,19.5 Q4.5,19.5 4.5,12 Z'); gline(g,9,19.5,15,19.5); gline(g,12.5,11.5,17.5,4.5); gcircle(g,18,3.8,1.2);}},
  nature:       {note:"Two peaks and a rising sun", draw:g=>{gpath(g,'M2.5,19.5 L9,10 L12.5,15 L16,10.5 L21.5,19.5 Z'); gcircle(g,16.5,5.5,2.2);}},
  occultism:    {note:"A planchette with its viewing window", draw:g=>{gpath(g,'M12,3.5 C15,6.5 19.5,10 19.5,14.2 C19.5,18.2 16,20.5 12,18.6 C8,20.5 4.5,18.2 4.5,14.2 C4.5,10 9,6.5 12,3.5 Z'); gcircle(g,12,10.2,2.2);}},
  perception:   {note:"A magnifying glass", draw:g=>{gcircle(g,10,10,5.5); gline(g,14,14,20.5,20.5); gpath(g,'M7,8.5 Q8,6.5 10,6');}},
  performance:  {note:"A lyre", draw:g=>{gpath(g,'M7,4.5 Q3.5,12.5 9,18.5 L15,18.5 Q20.5,12.5 17,4.5'); gline(g,6.2,7.5,17.8,7.5); gline(g,10,7.5,10,18.5); gline(g,12,7.5,12,18.5); gline(g,14,7.5,14,18.5);}},
  religion:     {note:"An open book radiating light", draw:g=>{gpath(g,'M3.5,18 Q8,16 12,18 Q16,16 20.5,18 L20.5,11 Q16,9 12,11 Q8,9 3.5,11 Z'); gline(g,12,11,12,18); gline(g,12,3,12,7.5); gline(g,7.5,4.5,9.3,7.8); gline(g,16.5,4.5,14.7,7.8);}},
  society:      {note:"A colonnade under a pediment", draw:g=>{gpath(g,'M3.5,8.5 L12,3.5 L20.5,8.5 Z'); gline(g,4,10.5,20,10.5); gline(g,6.5,10.5,6.5,18); gline(g,10.2,10.5,10.2,18); gline(g,13.8,10.5,13.8,18); gline(g,17.5,10.5,17.5,18); gline(g,3.5,18.5,20.5,18.5); gline(g,2.5,20.5,21.5,20.5);}},
  stealth:      {note:"A closed eye", draw:g=>{gpath(g,'M3.5,10.5 Q12,18 20.5,10.5'); gline(g,7,13.3,5.6,16); gline(g,12,14.3,12,17.3); gline(g,17,13.3,18.4,16);}},
  survival:     {note:"A tent pitched on the ground", draw:g=>{gpath(g,'M3.5,19.5 L12,5 L20.5,19.5 Z'); gpath(g,'M9.5,19.5 L12,13 L14.5,19.5'); gline(g,12,5,12,3); gline(g,2,19.5,22,19.5);}},
  thievery:     {note:"A keyhole", draw:g=>{gcircle(g,12,9,3.4); gpath(g,'M10.4,11.8 L9.2,19 L14.8,19 L13.6,11.8');}},
  will:         {note:"A shield holding the mind's eye, for resolve", draw:g=>{gpath(g,'M12,3 L19.5,6 Q19.5,15 12,21 Q4.5,15 4.5,6 Z'); g.appendChild(el('ellipse',{cx:12,cy:11.2,rx:4.6,ry:2.5})); gcircle(g,12,11.2,1.1,'currentColor');}},
};
// the sigil for a skill as the ritual data names it: every named Lore ("cooking lore") uses `lore`, and
// "any" skill gets none, which leaves its station empty
function skillSigil(skill){
  const sigil = SKILL_SIGILS[skill] || (/ lore$/.test(skill) ? SKILL_SIGILS.lore : null);
  return sigil ? sigil.draw : null;
}
// the tradition each magical skill belongs to, for coloring a ritual by the skills it calls for
const SKILL_TRADITION = {arcana:'arcane', nature:'primal', occultism:'occult', religion:'divine'};

// small curvy "rune stroke" marks for the runic border bands — local coords, origin at the mark's base point,
// local +x is drawn along the ring's tangent direction so the marks read like flowing script following the curve.
// Grouped by the tradition whose style each best fits; a spell writes with runes from its own traditions
// (see runeVocab in js/sigil.js). Within a tradition order matters: each list is shuffled as it stands to
// pick a spell's vocabulary, so append new runes and never reorder or insert, or every spell drawing from
// that tradition changes. Order across traditions doesn't matter.
const RUNES = {
  arcane: [
    // arcane leans mathematical and Greek: tallies, deltas, spirals, brackets
    {note:"A cross with serifed ends, a tally mark", draw:g=>gpath(g,'M0,-4 L0,4 M-2,0 L2,0 M-0.9,-3.6 L0,-4 L0.9,-3.6 M-0.9,3.6 L0,4 L0.9,3.6')},
    {note:"A chevron pointing at a dot", draw:g=>{gline(g,-3,-4,0,0); gline(g,0,0,-3,4); gcircle(g,3,0,0.9,'currentColor');}},
    {note:"An upright triangle, the Greek delta", draw:g=>gpath(g,'M0,-4 L3.5,4 L-3.5,4 Z')},
    {note:"A tight spiral turning inward", draw:g=>gpath(g,'M0,0 Q3,0 3,-2 Q3,-4 0,-4 Q-4,-4 -4,0 Q-4,4 0,4')},
    {note:"A caret with small feet", draw:g=>gpath(g,'M-3,1 L0,-4 L3,1 M-3,1 L-3.6,2.5 M3,1 L3.6,2.5')},
    {note:"A diamond", draw:g=>gpath(g,'M0,-4 L3,0 L0,4 L-3,0 Z')},
    {note:"A right-angled bracket with serifs", draw:g=>gpath(g,'M-3,-4 L-3,4 L3,4 M-3,-4 L-3.8,-3.6 M3,4 L3.8,4.4')},
    {note:"Three crossed lines, a six-pointed star", draw:g=>{gline(g,0,-4,0,4); gline(g,-3.5,-2,3.5,2); gline(g,-3.5,2,3.5,-2);}},
  ],
  divine: [
    // divine is radiant, celestial geometry (halos, sunbursts, nested arcs), deliberately abstract rather
    // than pictorial so nothing reads as any one real-world faith's symbol
    {note:"A crescent moon with a star beside it", draw:g=>{gpath(g,'M0,-4 Q4,-4 4,0 Q4,4 0,4'); gcircle(g,-2.2,0,0.5,'currentColor');}},
    {note:"A halo with one ray escaping it", draw:g=>{gpath(g,'M0,-4 A4,4 0 1,1 -0.2,-4'); gline(g,-0.1,-4,-0.1,-5.4);}},
    {note:"A sunburst of eight rays around a point", draw:g=>{gcircle(g,0,0,0.7,'currentColor'); gline(g,0,-1.3,0,-4); gline(g,0.9,-0.9,2.8,-2.8); gline(g,1.3,0,4,0); gline(g,0.9,0.9,2.8,2.8); gline(g,0,1.3,0,4); gline(g,-0.9,0.9,-2.8,2.8); gline(g,-1.3,0,-4,0); gline(g,-0.9,-0.9,-2.8,-2.8);}},
    {note:"A ring ticked like a sundial", draw:g=>{gcircle(g,0,0,2.4); gline(g,0,-4,0,-3.3); gline(g,2.83,-2.83,3.4,-3.4); gline(g,4,0,3.3,0); gline(g,2.83,2.83,3.4,3.4); gline(g,0,4,0,3.3); gline(g,-2.83,2.83,-3.4,3.4); gline(g,-4,0,-3.3,0); gline(g,-2.83,-2.83,-3.4,-3.4);}},
    {note:"Two nested halos", draw:g=>{gpath(g,'M0,-3 A3,3 0 1,1 -0.15,-3'); gpath(g,'M0,-1.4 A1.4,1.4 0 1,1 -0.07,-1.4');}},
    {note:"A pointed lens, the vesica", draw:g=>gpath(g,'M0,-3.5 A4,4 0 0,1 0,3.5 A4,4 0 0,1 0,-3.5 Z')},
    {note:"Six short rays around an empty centre", draw:g=>{gline(g,0,-4,0,-2); gline(g,3.46,-2,1.73,-1); gline(g,3.46,2,1.73,1); gline(g,0,4,0,2); gline(g,-3.46,2,-1.73,1); gline(g,-3.46,-2,-1.73,-1);}},
    {note:"A shrine roof over a lit interior", draw:g=>{gpath(g,'M-3,4 L-3,0.5 L0,-3.5 L3,0.5 L3,4'); gcircle(g,0,2,0.7,'currentColor');}},
  ],
  occult: [
    // occult starts with alchemical marks
    {note:"A downward triangle, alchemy's sign for water", draw:g=>gpath(g,'M-3.5,-3 L3.5,-3 L0,4 Z')},
    {note:"A circle split by a line, alchemy's sign for salt", draw:g=>{gcircle(g,0,0,3.2); gline(g,-3.2,0,3.2,0);}},
    {note:"Horns over a circle over a cross, alchemy's sign for mercury", draw:g=>{gpath(g,'M-1.8,-4 A1.8,1.8 0 1 0 1.8,-4'); gcircle(g,0,-1,1.6); gline(g,0,0.6,0,3.2); gline(g,-1.4,1.9,1.4,1.9);}},
    // simplified from the actual Golarion "Cosmic Caravan" constellation and planet glyphs, traced with
    // cleaner, simpler strokes rather than the source art's full linework: the 13 constellations and the
    // Diaspora (asteroid belt) first, then the Sun and the 11 planets
    {note:"The Bridge, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M-3,2 Q-1,-3 2,-2 Q4,-1 2,3')},
    {note:"The Daughter, a constellation of the Cosmic Caravan", draw:g=>{gpath(g,'M-2.5,-4 Q-2,-1 0,-1 Q2,-1 2.5,-4'); gline(g,0,-1,0,1); gpath(g,'M-1,1 L1,1 L0,3.5 Z');}},
    {note:"The Follower, a constellation of the Cosmic Caravan", draw:g=>{gpath(g,'M2.5,-2.5 Q-3,-3 -3,0 Q-3,3 2,3'); gcircle(g,1.5,0,0.6,'currentColor');}},
    {note:"The Lantern Bearer, a constellation of the Cosmic Caravan", draw:g=>{gline(g,-2,3,3,-3); gpath(g,'M3,-3 L4.5,-2.5 L3,-1 Z');}},
    {note:"The Mother, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M1,-4 Q-3,-4 -3,-1.3 Q-3,1 0.5,1 Q3,1 3,3 Q3,4.3 -0.5,4')},
    {note:"The Newlyweds, a constellation of the Cosmic Caravan", draw:g=>{gcircle(g,-1.3,0,2.1); gcircle(g,1.3,0,2.1);}},
    {note:"The Pack, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M-3,4 L-3,-4 L3,4 L3,-4')},
    {note:"The Patriarch, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M2,-4 Q-3,-4 -3,-1.3 Q-3,1 -0.3,1 L-0.3,4')},
    {note:"The Rider, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M-3,3 Q-3,-3 -1,-1 Q0,0 1,-1 Q3,-3 3,3')},
    {note:"The Stargazer, a constellation of the Cosmic Caravan", draw:g=>{gline(g,-1,-4,-1,4); gpath(g,'M-1,-4 Q2,-4 2,-2 Q2,0 -1,0');}},
    {note:"The Stranger, a constellation of the Cosmic Caravan", draw:g=>{gpath(g,'M-2.3,-2 Q-1.2,-4 0,-2.3 Q1.2,-4 2.3,-2'); gpath(g,'M-1.3,0 Q0,-1 1.3,0 Q0,2.8 -1.3,0 Z');}},
    {note:"The Thrush, a constellation of the Cosmic Caravan", draw:g=>gpath(g,'M-3,-2 L0,-4 L3,-2 M0,-4 L0,1 L2,3')},
    {note:"The Wagon, a constellation of the Cosmic Caravan", draw:g=>{gcircle(g,0,-1.3,2); gline(g,-1.4,0.5,-2.3,4); gline(g,1.4,0.5,2.3,4); gline(g,0,0.7,0,4);}},
    {note:"The Diaspora, the asteroid belt", draw:g=>{gpath(g,'M-3.2,-4 L-3.2,4 M-3.2,-4 Q-0.5,-4 -0.5,0 Q-0.5,4 -3.2,4'); gpath(g,'M0.2,-4 L0.2,4 M0.2,-4 Q2.9,-4 2.9,0 Q2.9,4 0.2,4');}},
    {note:"The Sun", draw:g=>{gcircle(g,0,0,2.6); gcircle(g,0,0,0.6,'currentColor'); gpath(g,'M3.4,-1.8 Q4.4,0 3.4,1.8');}},
    {note:"The planet Golarion", draw:g=>{gline(g,-2,-4,-2,2.5); gline(g,0,-4,0,3); gline(g,2,-4,2,2.5); gline(g,-2.6,-1,2.6,-1);}},
    {note:"The planet Aballon", draw:g=>{gcircle(g,0,-2.3,1.5); gpath(g,'M-1.5,-0.3 Q-1.5,2 0,2 Q1.5,2 1.5,4');}},
    {note:"The planet Akiton", draw:g=>{gcircle(g,0,0,1.7); gpath(g,'M-1.7,-1.5 Q0,-4.2 1.7,-1.5'); gpath(g,'M-1.7,1.5 Q0,4.2 1.7,1.5');}},
    {note:"The planet Apostae", draw:g=>{gcircle(g,0,0,1.8); gline(g,-2.8,-2.8,2.8,2.8); gline(g,-3.6,-2,-2.8,-2.8); gline(g,-2,-3.6,-2.8,-2.8);}},
    {note:"The planet Aucturn", draw:g=>{gline(g,-2.5,-1,2.5,-1); gline(g,-1,-3,-1,2.6); gline(g,1,-3,1,2.6); gcircle(g,-1,3.4,0.6); gcircle(g,1,3.4,0.6);}},
    {note:"The planet Bretheda", draw:g=>{gcircle(g,0,-1.7,1.5); gcircle(g,0,1.9,2.1);}},
    {note:"The planet Castrovel", draw:g=>{gcircle(g,-1.8,0,1.7); gcircle(g,0,0,1.7); gcircle(g,1.8,0,1.7);}},
    {note:"The planet Eox", draw:g=>{gcircle(g,0,0.3,1.8); gline(g,-1.3,-0.9,1.3,1.5); gline(g,-1.3,1.5,1.3,-0.9); gline(g,0,-3.8,0,-1.6); gline(g,-1,-3.4,-0.4,-1.6); gline(g,1,-3.4,0.4,-1.6);}},
    {note:"The planet Liavara", draw:g=>{gcircle(g,0,0,1.6); gpath(g,'M-1.6,-1.4 Q-0.8,-3 0,-1.4 Q0.8,-3 1.6,-1.4'); gline(g,-1,1.4,-1,2.8); gline(g,0,1.6,0,3); gline(g,1,1.4,1,2.8);}},
    {note:"The planet Triaxus", draw:g=>{gline(g,-3,4,-3,-2.5); gline(g,3,4,3,-2.5); gpath(g,'M-3.6,-2.5 Q0,-4.6 3.6,-2.5');}},
    {note:"The planet Verces", draw:g=>{gcircle(g,0,-0.4,1.9); gpath(g,'M1.7,1.1 Q2.6,2.6 1,3.2 Q0,3.6 1,4.2');}},
  ],
  primal: [
    // primal leans Elder Futhark: branches, forks, zigzags, curling growth
    {note:"A loose curl, a tendril", draw:g=>gpath(g,'M-3,-3 Q0,-6 3,-3 Q6,0 3,3 Q0,6 -3,3')},
    {note:"A stem with two branches falling from it, after the rune ansuz", draw:g=>{gline(g,-2,-4,-2,4); gline(g,-2,-4,3,-1); gline(g,-2,0,3,3);}},
    {note:"A flowing S-curve", draw:g=>gpath(g,'M-3,-4 Q3,-2 -3,0 Q3,2 -3,4')},
    {note:"A stem forking upward, after the rune algiz", draw:g=>{gline(g,0,-4,0,4); gline(g,0,-1,-3,-4); gline(g,0,-1,3,-4);}},
    {note:"A lightning zigzag, after the rune sowilo", draw:g=>gpath(g,'M-3,-4 L1,-1 L-2,1 L3,4')},
    {note:"A slanting branch with two hooked leaves", draw:g=>gpath(g,'M-2.5,4 L2.5,-4 M-1,1.3 Q-3,0.8 -3,-1 M1,-1.3 Q3,-0.8 3,1')},
    {note:"An upward spear with fletching, after the rune tiwaz", draw:g=>gpath(g,'M0,4 L0,-4 M0,-4 L-2.5,-1 M0,-4 L2.5,-1 M0,2 L-1,3.2 M0,2 L1,3.2')},
    {note:"A concave hourglass with a bar at its waist, after the runes ingwaz and dagaz", draw:g=>gpath(g,'M-3.5,-3.5 Q-1,0 -3.5,3.5 M3.5,-3.5 Q1,0 3.5,3.5 M-1,0 L1,0')},
    {note:"A curved stem with two offshoots", draw:g=>{gpath(g,'M0,-4 Q1,0 0,4'); gline(g,0,-1,2.5,-3); gline(g,0,1,-2.5,3);}},
  ],
};
const RUNE_COUNT = Object.values(RUNES).reduce((n, list) => n + list.length, 0);
function runeMark(rune, g){ rune.draw(g); }

const ALL_TRADITIONS = ['arcane','divine','occult','primal'];

const ORDINAL = ['Cantrip','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'];
