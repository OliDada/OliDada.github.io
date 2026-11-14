// Falling Sand — discovery edition.
// Start with Sand, Water, Fire and Earth. Everything else is discovered by making it happen.
// To add a material: one def() line, an R() line or two for how it is made, and (only if it does
// something special) a case in tick(). Nothing else needs touching.
// Materials are data (MATS) + reactions (R). Add new things by adding a def() and some R() lines.

// ================= materials =================
const MATS = [{ key: 'empty', name: 'Empty', kind: 'empty' }];
const M = { empty: 0 };
function def(key, o) { o.key = key; o.id = MATS.length; MATS.push(o); M[key] = o.id; }

// kinds: powder, liquid, gas, solid, fire, cloud, bolt, spark, rocket, fish, bee, ant
// cat (toolbar tab) is worked out from the kind unless given: powder, liquid, gas, solid, energy, life
def('sand',   { name: 'Sand',  kind: 'powder', dens: 2, slide: 1, start: true, dot: '#f2ca79' });
def('water',  { name: 'Water', kind: 'liquid', dens: 1, spread: 4, color: [46, 169, 230], anim: 'water', start: true });
def('fire',   { name: 'Fire',  kind: 'fire', anim: 'fire', hot: true, life: [40, 100], start: true, dot: '#ff8a2a' });
def('earth',  { name: 'Earth', kind: 'powder', dens: 2, slide: 0.15, color: [112, 80, 52], vary: 0.3, start: true });

def('steam',  { name: 'Steam', kind: 'gas', life: [160, 255], color: [205, 215, 228], anim: 'steam', decay: ['water', 0.3], hint: 'Fire meets water' });
def('cloud',  { name: 'Cloud', kind: 'cloud', life: [20, 45], color: [222, 228, 238], vary: 0.08, hint: 'Steam that reaches the sky' });
def('mud',    { name: 'Mud', kind: 'liquid', dens: 1.6, spread: 1, visc: 0.25, color: [92, 62, 38], vary: 0.2, hint: 'Earth soaks up water' });
def('brick',  { name: 'Brick', kind: 'solid', tough: true, color: [168, 72, 52], vary: 0.25, hint: 'Bake some mud' });
def('stone',  { name: 'Stone', kind: 'powder', dens: 2.5, slide: 0.25, color: [150, 143, 135], vary: 0.25, hint: 'Heat earth for a long time' });
def('lava',   { name: 'Lava', kind: 'liquid', dens: 2.5, spread: 2, visc: 0.35, hot: true, anim: 'lava', dot: '#ff5a1a', hint: 'Melt stone in a fire' });
def('glass',  { name: 'Glass', kind: 'solid', acidproof: true, color: [175, 215, 228], vary: 0.08, anim: 'sparkle', hint: 'Sand meets lava' });
def('obsidian', { name: 'Obsidian', kind: 'solid', tough: true, color: [52, 34, 70], vary: 0.35, hint: 'Cool lava very fast with something cold' });
def('snow',   { name: 'Snow', kind: 'powder', dens: 0.9, slide: 0.3, cold: true, color: [238, 244, 255], vary: 0.06, hint: 'Throw water into a cloud' });
def('ice',    { name: 'Ice', kind: 'solid', cold: true, color: [170, 215, 240], vary: 0.15, hint: 'Water touching snow' });
def('salt',   { name: 'Salt', kind: 'powder', dens: 1.8, slide: 0.9, color: [236, 236, 236], vary: 0.08, hint: 'Water slowly wears stone away' });
def('saltwater', { name: 'Salt water', kind: 'liquid', dens: 1.1, spread: 4, color: [38, 138, 168], anim: 'water', hint: 'Salt dissolves in water' });
def('plant',  { name: 'Plant', kind: 'solid', cat: 'life', grow: [6, 16], color: [64, 175, 70], vary: 0.35, flammable: [0.08, 'fire'], hint: 'Leave some mud alone for a while' });
def('flower', { name: 'Flower', kind: 'solid', cat: 'life', anim: 'flower', flammable: [0.1, 'fire'], dot: '#f05a78', hint: 'Let a plant grow tall' });
def('wood',   { name: 'Wood', kind: 'solid', color: [125, 82, 46], vary: 0.35, flammable: [0.03, 'ember'], hint: 'Old, thick plants' });
def('ember',  { name: 'Ember', kind: 'solid', cat: 'energy', hot: true, life: [150, 250], anim: 'ember', dot: '#e0461a', hint: 'Set wood on fire' });
def('charcoal', { name: 'Charcoal', kind: 'powder', dens: 1.4, slide: 0.5, color: [44, 41, 41], vary: 0.3, flammable: [0.01, 'ember'], hint: 'Put out burning wood' });
def('ash',    { name: 'Ash', kind: 'powder', dens: 0.8, slide: 0.6, color: [150, 148, 145], vary: 0.2, hint: 'Let wood burn all the way out' });
def('smoke',  { name: 'Smoke', kind: 'gas', life: [40, 110], anim: 'smoke', dot: '#555', hint: 'Fire burning out' });
def('cement', { name: 'Cement', kind: 'powder', dens: 2, slide: 0.5, color: [178, 176, 168], vary: 0.1, hint: 'Ash + sand' });
def('concrete', { name: 'Concrete', kind: 'solid', tough: true, color: [138, 138, 136], vary: 0.15, hint: 'Wet cement' });
def('oil',    { name: 'Oil', kind: 'liquid', dens: 0.8, spread: 3, anim: 'oil', flammable: [0.3, 'fire'], dot: '#6b4a22', hint: 'Bury ash in mud' });
def('gas',    { name: 'Gas', kind: 'gas', life: [200, 255], slowFade: true, anim: 'gas', flammable: [0.9, 'fire'], dot: '#8fbf6a', hint: 'Plants rotting in mud' });
def('acid',   { name: 'Acid', kind: 'liquid', dens: 1.05, spread: 3, anim: 'acid', eats: true, acidproof: true, dot: '#9cf03c', hint: 'Ash in salt water' });
def('slime',  { name: 'Slime', kind: 'liquid', dens: 1.2, spread: 1, visc: 0.2, anim: 'slime', acidproof: true, dot: '#6fd14a', hint: 'Acid + mud' });
def('gunpowder', { name: 'Gunpowder', kind: 'powder', dens: 1.5, slide: 0.8, color: [62, 62, 68], vary: 0.4, flammable: [1, 'explode'], hint: 'Charcoal + salt' });
def('metal',  { name: 'Metal', kind: 'solid', tough: true, color: [160, 166, 176], vary: 0.1, anim: 'sheen', hint: 'Charcoal + lava' });
def('rust',   { name: 'Rust', kind: 'powder', dens: 2, slide: 0.4, color: [160, 82, 40], vary: 0.3, hint: 'Metal left in water' });
def('diamond', { name: 'Diamond', kind: 'solid', tough: true, acidproof: true, color: [200, 245, 255], anim: 'sparkle', hint: 'Charcoal + obsidian' });

// --- weather
def('stormcloud', { name: 'Storm cloud', kind: 'cloud', storm: true, life: [40, 80], color: [96, 100, 118], vary: 0.2, hint: 'Smoke drifting into a cloud' });
def('lightning', { name: 'Lightning', kind: 'bolt', hot: true, life: [3, 6], anim: 'bolt', dot: '#fff7a8', hint: 'Storm clouds get angry' });

// --- pottery, soap, chemistry
def('clay',   { name: 'Clay', kind: 'powder', dens: 2, slide: 0.05, color: [176, 122, 92], vary: 0.15, hint: 'Mud + sand' });
def('pottery', { name: 'Pottery', kind: 'solid', color: [212, 132, 88], vary: 0.12, hint: 'Bake some clay' });
def('soap',   { name: 'Soap', kind: 'powder', dens: 1.3, slide: 0.3, color: [244, 206, 226], vary: 0.1, hint: 'Ash + oil' });
def('bubble', { name: 'Bubble', kind: 'gas', life: [60, 160], anim: 'bubble', dot: '#bfe6ff', hint: 'Get soap wet' });
def('nitro',  { name: 'Nitro', kind: 'liquid', dens: 1.3, spread: 2, color: [226, 232, 150], vary: 0.12, flammable: [1, 'explode'], blast: 1.7, hint: 'Oil + acid' });
def('thermite', { name: 'Thermite', kind: 'powder', dens: 2.2, slide: 0.5, color: [150, 92, 74], vary: 0.45, flammable: [0.4, 'molten'], hint: 'Rust + gunpowder' });
def('molten', { name: 'Molten metal', kind: 'liquid', dens: 3, spread: 2, visc: 0.5, hot: true, anim: 'molten', dot: '#ffd98a', hint: 'Melt metal in lava' });
def('firework', { name: 'Firework', kind: 'powder', dens: 1.5, slide: 0.6, color: [214, 64, 100], vary: 0.5, flammable: [1, 'rocket'], hint: 'Gunpowder + a flower' });
def('rocket', { name: 'Rocket', kind: 'rocket', hot: true, life: [28, 60], anim: 'bolt', hidden: true });
def('spark',  { name: 'Spark', kind: 'spark', hot: true, life: [20, 50], anim: 'spark', brush: 0.25, dot: '#ffd24a', hint: 'Light a firework' });
def('torch',  { name: 'Torch', kind: 'solid', cat: 'energy', anim: 'torch', dot: '#c88a3c', flammable: [0.5, 'light'], hint: 'Soak wood in oil' });
def('dye',    { name: 'Dye', kind: 'liquid', dens: 1, spread: 4, anim: 'dye', dot: '#e05ad0', hint: 'Drop a flower in water' });

// --- living things
def('seed',   { name: 'Seed', kind: 'powder', cat: 'life', dens: 0.9, slide: 0.4, brush: 0.12, color: [200, 164, 96], vary: 0.3, flammable: [0.1, 'fire'], hint: 'Flowers drop them eventually' });
def('grass',  { name: 'Grass', kind: 'solid', cat: 'life', grow: [1, 4], color: [110, 200, 80], vary: 0.3, flammable: [0.15, 'fire'], hint: 'A seed on earth' });
def('cactus', { name: 'Cactus', kind: 'solid', cat: 'life', grow: [4, 12], color: [58, 138, 84], vary: 0.2, flammable: [0.01, 'fire'], hint: 'A seed on sand' });
def('seaweed', { name: 'Seaweed', kind: 'solid', cat: 'life', life: [4, 14], color: [36, 138, 104], vary: 0.3, flammable: [0.03, 'fire'], hint: 'A plant in salt water' });
def('fish',   { name: 'Fish', kind: 'fish', life: [200, 255], brush: 0.04, anim: 'fish', dot: '#ff9a3c', flammable: [0.3, 'smoke'], hint: 'Something lives in the seaweed' });
def('bee',    { name: 'Bee', kind: 'bee', life: [150, 255], brush: 0.03, anim: 'bee', dot: '#ffd21e', flammable: [0.6, 'fire'], hint: 'Flowers attract them' });
def('honey',  { name: 'Honey', kind: 'liquid', dens: 1.4, spread: 1, visc: 0.15, anim: 'honey', dot: '#e8a628', hint: 'Let bees visit flowers' });
def('ant',    { name: 'Ant', kind: 'ant', life: [150, 255], brush: 0.05, color: [214, 84, 52], vary: 0.2, flammable: [0.5, 'fire'], hint: 'Something sweet on the ground' });

// --- endgame
def('void',   { name: 'Void', kind: 'solid', tough: true, acidproof: true, anim: 'void', dot: '#3a1466', hint: 'Lightning strikes a diamond' });

const EMPTY = 0;
const N = MATS.length;
const KIND_CAT = { powder: 'powder', liquid: 'liquid', gas: 'gas', cloud: 'gas', solid: 'solid', fire: 'energy', bolt: 'energy', spark: 'energy', rocket: 'energy', fish: 'life', bee: 'life', ant: 'life' };
const CATS = [['powder', 'Powders'], ['liquid', 'Liquids'], ['gas', 'Gases'], ['solid', 'Solids'], ['energy', 'Energy'], ['life', 'Life']];
const CAP = { bee: 30, fish: 40, seed: 150 }; // so living things never take over
for (const m of MATS) {
  if (!m.color) m.color = [0, 0, 0];
  if (m.vary == null) m.vary = 0;
  if (!m.dot) m.dot = `rgb(${m.color.join(',')})`;
  if (!m.cat) m.cat = KIND_CAT[m.kind];
  m.thin = m.kind === 'gas' || m.kind === 'fire' || m.kind === 'spark' || m.kind === 'bolt'; // things can fall through it
}
const isWet = (t) => t === M.water || t === M.saltwater || t === M.dye;

// ================= reactions =================
// R(a, b, chance, aBecomes, bBecomes): when a touches b. null = unchanged, 'empty' = gone.
// b can be '#hot' (fire, lava, embers) or '#cold' (snow, ice).
const REACT = Array.from({ length: N }, () => []);
function R(a, b, chance, aInto, bInto) {
  const id = (k) => (k == null ? -1 : M[k]);
  const label = (k) => (k === '#hot' ? 'heat' : k === '#cold' ? 'cold' : MATS[M[k]].name);
  const how = `${label(a)} + ${label(b)}`;
  const tag = b[0] === '#' ? b : null;
  REACT[M[a]].push({ b: tag ? -1 : M[b], tag, chance, aInto: id(aInto), bInto: id(bInto), how });
  if (!tag) REACT[M[b]].push({ b: M[a], tag: null, chance, aInto: id(bInto), bInto: id(aInto), how });
}
R('water', 'fire', 0.5, 'steam', 'empty');
R('water', 'lava', 0.5, 'steam', 'stone');
R('water', 'ember', 0.5, 'steam', 'charcoal');
R('earth', 'water', 0.05, 'mud', 'empty');
R('mud', '#hot', 0.03, 'brick', null);
R('earth', '#hot', 0.01, 'stone', null);
R('stone', 'fire', 0.012, 'lava', null);
R('stone', 'ember', 0.004, 'lava', null);
R('sand', 'lava', 0.02, 'glass', null);
R('lava', 'snow', 0.3, 'obsidian', 'water');
R('lava', 'ice', 0.3, 'obsidian', 'water');
R('water', 'cloud', 0.2, 'snow', null);
R('water', 'snow', 0.01, 'ice', null);
R('water', 'ice', 0.002, 'ice', null);
R('snow', '#hot', 0.2, 'water', null);
R('ice', '#hot', 0.06, 'water', null);
R('ice', 'salt', 0.1, 'water', 'empty');
R('snow', 'salt', 0.1, 'water', 'empty');
R('salt', 'water', 0.1, 'empty', 'saltwater');
R('saltwater', '#hot', 0.1, 'salt', null);
R('stone', 'water', 0.0004, 'salt', null);
R('ash', 'sand', 0.05, 'cement', 'empty');
R('cement', 'water', 0.03, 'concrete', 'empty');
R('ash', 'mud', 0.01, 'oil', 'empty');
R('plant', 'mud', 0.0004, null, 'gas');
R('ash', 'saltwater', 0.02, 'empty', 'acid');
R('acid', 'mud', 0.05, 'slime', 'empty');
R('charcoal', 'salt', 0.05, 'gunpowder', 'empty');
R('charcoal', 'lava', 0.02, 'metal', null);
R('metal', 'water', 0.0008, 'rust', null);
R('charcoal', 'obsidian', 0.01, 'diamond', null);

R('cloud', 'smoke', 0.3, 'stormcloud', 'empty');
R('stormcloud', 'cloud', 0.001, null, 'stormcloud');
R('sand', 'lightning', 1, 'glass', null);
R('water', 'lightning', 0.5, 'steam', null);
R('diamond', 'lightning', 1, 'void', null);
R('mud', 'sand', 0.01, 'clay', 'empty');
R('clay', '#hot', 0.03, 'pottery', null);
R('ash', 'oil', 0.03, 'soap', 'empty');
R('soap', 'water', 0.03, 'bubble', null);
R('oil', 'acid', 0.05, 'nitro', 'empty');
R('rust', 'gunpowder', 0.05, 'thermite', 'empty');
R('metal', 'lava', 0.004, 'molten', null);
R('molten', 'water', 0.5, 'metal', 'steam');
R('sand', 'molten', 0.02, 'glass', null);
R('gunpowder', 'flower', 0.05, 'firework', 'empty');
R('wood', 'oil', 0.02, 'torch', 'empty');
R('plant', 'saltwater', 0.01, 'seaweed', null);
R('honey', 'earth', 0.004, 'ant', null);
R('earth', 'dye', 0.05, 'mud', 'empty');
R('dye', 'fire', 0.5, 'steam', 'empty');

// ================= state =================
let cols = 0, rows = 0, cell = 3;
let type, shade, life, stamp;
let clock = 1, img, paused = false;
let brush = M.sand, brushScale = 1;
let pointerDown = false, lastCell = null, pointerCell = null;
let how = '';
let census = new Uint32Array(N), censusNext = new Uint32Array(N); // how many of each thing there were last step
const STORE = 'olid-sand-discoveries-v1';
let found = {}; // key -> how it was found
let cat = 'powder', tabbed = false; // toolbar tab
const newCats = new Set(); // tabs with something new in them

const SAND_A = [242, 202, 121], SAND_B = [242, 161, 80];
const COLOR_CYCLE = 600;

function loadFound() {
  try { found = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { found = {}; }
  for (const m of MATS) if (m.start) found[m.key] = found[m.key] || 'Starting element';
}
function saveFound() { try { localStorage.setItem(STORE, JSON.stringify(found)); } catch (e) {} }
const findable = (m) => m.id && !m.hidden;
const totalFindable = () => MATS.filter(findable).length;
const foundCount = () => MATS.filter((m) => findable(m) && found[m.key]).length;

function unlock(t) {
  const m = MATS[t];
  if (!m || !findable(m) || found[m.key]) return;
  found[m.key] = how || 'Found it';
  saveFound();
  if (m.cat !== cat) newCats.add(m.cat);
  toast(m, found[m.key]);
  buildMaterialRow();
}

// ================= p5 =================
function setup() {
  loadFound();
  const c = createCanvas(10, 10);
  c.elt.style.touchAction = 'none';
  c.elt.style.display = 'block';
  noSmooth();
  buildUI();
  bindPointer(c.elt);
  resize();
}

function windowResized() { resize(); }

function resize() {
  const W = windowWidth, H = windowHeight;
  cell = Math.max(2, Math.floor(Math.min(W, H) / 260));
  const nc = Math.floor(W / cell), nr = Math.floor(H / cell);
  resizeCanvas(nc * cell, nr * cell);
  noSmooth();
  const oT = type, oS = shade, oL = life, oc = cols, or = rows;
  cols = nc; rows = nr;
  type = new Uint8Array(cols * rows);
  shade = new Float32Array(cols * rows);
  life = new Uint8Array(cols * rows);
  stamp = new Uint32Array(cols * rows);
  if (oT) {
    const dy = rows - or;
    for (let y = 0; y < or; y++) for (let x = 0; x < Math.min(oc, cols); x++) {
      const ny = y + dy; if (ny < 0 || ny >= rows) continue;
      const o = x + y * oc, n = x + ny * cols;
      type[n] = oT[o]; shade[n] = oS[o]; life[n] = oL[o];
    }
  }
  img = createImage(cols, rows);
}

function draw() {
  paint();
  if (!paused) step();
  render();
}

// ================= input =================
function bindPointer(el) {
  const toCell = (e) => {
    const r = el.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / r.width * cols), Math.floor((e.clientY - r.top) / r.height * rows)];
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerDown = true; el.setPointerCapture(e.pointerId);
    pointerCell = toCell(e); lastCell = null; e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => { if (pointerDown) pointerCell = toCell(e); });
  const up = () => { pointerDown = false; lastCell = null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function paint() {
  if (!pointerDown || !pointerCell) return;
  const [x1, y1] = pointerCell;
  const [x0, y0] = lastCell || pointerCell;
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampBrush(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
  }
  lastCell = pointerCell;
}

function brushDensity(m) {
  if (!m.id) return 1;
  if (m.brush) return m.brush;
  switch (m.kind) {
    case 'solid': return 1;
    case 'fire': return 0.7;
    case 'liquid': return 0.5;
    case 'gas': case 'cloud': return 0.5;
    default: return 0.4;
  }
}

function stampBrush(cx, cy) {
  const m = MATS[brush];
  const d = brushDensity(m);
  const r = Math.max(1, Math.round(Math.max(3, cols / 55) * brushScale));
  how = '';
  if (brush === M.lightning) { // a bolt from the pointer down
    if (Math.random() < 0.35 && cx >= 0 && cx < cols && cy >= 0 && cy < rows) strike(cx, cy);
    return;
  }
  const hue = (frameCount % COLOR_CYCLE) / COLOR_CYCLE;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = x + y * cols;
    if (brush === EMPTY) { type[i] = EMPTY; continue; }
    if (type[i] !== EMPTY && !(brush === M.fish && isWet(type[i]))) continue;
    if (Math.random() > d) continue;
    place(i, brush);
    if (m.grow) life[i] = m.grow[0] + (Math.random() * (m.grow[1] - m.grow[0])) | 0;
    if (brush === M.dye) shade[i] = hue; // slowly cycles through the rainbow as you paint
  }
}

function place(i, t) {
  type[i] = t;
  stamp[i] = clock;
  if (t === EMPTY) return;
  const m = MATS[t];
  shade[i] = t === M.sand ? ((frameCount + Math.random() * 40) % COLOR_CYCLE) / COLOR_CYCLE : Math.random();
  life[i] = m.life ? (m.life[0] + Math.random() * (m.life[1] - m.life[0])) | 0 : 0;
  if (!found[m.key]) unlock(t);
}

// ================= simulation =================
function move(a, b) {
  const t = type[a]; type[a] = type[b]; type[b] = t;
  const s = shade[a]; shade[a] = shade[b]; shade[b] = s;
  const l = life[a]; life[a] = life[b]; life[b] = l;
  stamp[a] = clock; stamp[b] = clock;
}

function randomNeighbour(x, i) {
  switch ((Math.random() * 4) | 0) {
    case 0: return x > 0 ? i - 1 : -1;
    case 1: return x < cols - 1 ? i + 1 : -1;
    case 2: return i >= cols ? i - cols : -1;
    default: return i < type.length - cols ? i + cols : -1;
  }
}
function hasNeighbour(x, i, t) {
  return (x > 0 && type[i - 1] === t) || (x < cols - 1 && type[i + 1] === t) ||
    (i >= cols && type[i - cols] === t) || (i < type.length - cols && type[i + cols] === t);
}

function step() {
  clock++;
  const sw = census; census = censusNext; censusNext = sw; censusNext.fill(0);
  for (let y = rows - 1; y >= 0; y--) {
    const ltr = Math.random() < 0.5;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = x + y * cols;
      const t = type[i];
      if (t === EMPTY) continue;
      censusNext[t]++;
      if (stamp[i] === clock) continue;
      const m = MATS[t];
      if (react(x, i, t)) continue;
      if (m.hot && ignite(x, y, i)) continue;
      if (m.eats && eat(x, i)) continue;
      if (tick(x, y, i, t)) continue;
      switch (m.kind) {
        case 'powder': updatePowder(x, y, i, m); break;
        case 'liquid': updateLiquid(x, y, i, m); break;
        case 'gas': updateGas(x, y, i, m); break;
        case 'fire': updateFire(x, y, i); break;
        case 'cloud': updateCloud(x, y, i, m); break;
        case 'bolt': stamp[i] = clock; if (--life[i] <= 0) type[i] = EMPTY; break;
        case 'spark': updateSpark(x, y, i); break;
        case 'rocket': updateRocket(x, y, i); break;
        case 'fish': updateFish(x, y, i); break;
        case 'bee': updateBee(x, y, i); break;
        case 'ant': updateAnt(x, y, i); break;
      }
    }
  }
}

// reactions with a random neighbour; returns true if this cell changed
function react(x, i, t) {
  const list = REACT[t];
  if (!list.length) return false;
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const u = type[j];
  if (u === EMPTY) return false;
  const um = MATS[u];
  for (const r of list) {
    const hit = r.tag ? (r.tag === '#hot' ? um.hot : um.cold) : r.b === u;
    if (!hit || Math.random() > r.chance) continue;
    how = r.how;
    if (r.bInto >= 0) place(j, r.bInto);
    if (r.aInto >= 0) { place(i, r.aInto); return true; }
    stamp[i] = clock;
    return false;
  }
  return false;
}

// hot things set flammable neighbours alight
function ignite(x, y, i) {
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const um = MATS[type[j]];
  if (!um.flammable || Math.random() > um.flammable[0]) return false;
  const me = type[i];
  how = `${um.name} + ${MATS[me].name}`;
  burn(j, um);
  return type[i] !== me;
}

// set a flammable cell off
function burn(j, um) {
  const into = um.flammable[1];
  if (into === 'explode') explode(j % cols, (j / cols) | 0, um.blast || 1);
  else if (into === 'light') life[j] = 1; // torches just get lit
  else place(j, M[into]);
}

// a bolt of lightning from (x, y) down to the first thing in its way
function strike(x, y) {
  let i = x + y * cols;
  while (y < rows) {
    const t = type[i];
    if (t !== EMPTY && !MATS[t].thin) { zap(i); return; }
    place(i, M.lightning);
    y++;
    const nx = x + ((Math.random() * 3) | 0) - 1;
    if (nx >= 0 && nx < cols) x = nx;
    i = x + y * cols;
  }
}
function zap(j) {
  const t = type[j], m = MATS[t];
  if (m.flammable) { how = `${m.name} + Lightning`; burn(j, m); return; }
  for (const r of REACT[t]) if (r.b === M.lightning) { how = r.how; if (r.aInto >= 0) place(j, r.aInto); return; }
}

function explode(cx, cy, scale) {
  const r = Math.round(Math.max(5, Math.round(cols / 40)) * (scale || 1));
  how = 'An explosion';
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = x + y * cols, t = type[i];
    if (t && MATS[t].tough) continue;
    if (t && d2 > 2 && MATS[t].flammable && MATS[t].flammable[1] === 'explode') { place(i, M.fire); life[i] = 3; continue; } // chain reaction
    const k = Math.random();
    if (k < 0.55) { place(i, M.fire); life[i] = 10 + (Math.random() * 30) | 0; }
    else if (k < 0.7 && d2 > r * r * 0.5) place(i, M.smoke);
    else type[i] = EMPTY;
  }
}

// acid dissolves most things
function eat(x, i) {
  const j = randomNeighbour(x, i);
  if (j < 0) return false;
  const u = type[j];
  if (!u || u === type[i]) return false;
  const um = MATS[u];
  if (um.acidproof || um.kind === 'gas' || um.kind === 'fire' || Math.random() > 0.1) return false;
  if (u === M.water || u === M.saltwater) { if (Math.random() < 0.1) { type[i] = EMPTY; return true; } return false; }
  how = 'Acid';
  if (Math.random() < 0.3) place(j, M.smoke); else type[j] = EMPTY;
  if (Math.random() < 0.35) { type[i] = EMPTY; return true; }
  return false;
}

// special per-material behaviour
function tick(x, y, i, t) {
  switch (t) {
    case M.steam:
      if ((y < rows * 0.22 || hasNeighbour(x, i, M.cloud)) && Math.random() < (y < 3 ? 0.2 : 0.02)) { how = 'Steam reaching the sky'; place(i, M.cloud); return true; }
      return false;
    case M.mud:
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.0006) {
        how = 'Mud left alone'; place(i - cols, M.plant); life[i - cols] = 8 + (Math.random() * 28) | 0;
      }
      return false;
    case M.plant: return tickPlant(x, y, i);
    case M.flower: {
      const k = Math.random();
      if (k > 0.0012) return true;
      const j = randomNeighbour(x, i);
      if (j < 0) return true;
      const u = type[j];
      if (u === EMPTY) {
        if (k < 0.0002) { if (census[M.bee] < CAP.bee) { how = 'Flowers attract bees'; place(j, M.bee); } }
        else if (k < 0.0005 && census[M.seed] < CAP.seed) { how = 'A flower going to seed'; place(j, M.seed); }
      } else if (u === M.water) {
        how = 'Flower + Water'; place(j, M.dye);
        shade[j] = FLOWER_HUE[(shade[i] * FLOWERS.length) | 0];
        if (Math.random() < 0.3) type[i] = EMPTY;
      }
      return true;
    }
    case M.seed: {
      if (y < rows - 1 && Math.random() < 0.02) {
        const b = type[i + cols];
        if (b === M.mud) { how = 'Seed + Mud'; place(i, M.plant); life[i] = 8 + (Math.random() * 28) | 0; return true; }
        if (b === M.earth) { how = 'Seed + Earth'; place(i, M.grass); life[i] = 1 + (Math.random() * 3) | 0; return true; }
        if (b === M.sand) { how = 'Seed + Sand'; place(i, M.cactus); life[i] = 5 + (Math.random() * 9) | 0; return true; }
      }
      if (Math.random() < 0.0003) { type[i] = EMPTY; return true; }
      return false;
    }
    case M.grass: {
      if (life[i] > 0) { // still growing up
        if (y > 0 && Math.random() < 0.02) {
          const left = life[i] - 1; life[i] = 0;
          if (type[i - cols] === EMPTY) { place(i - cols, M.grass); life[i - cols] = left; }
        }
      } else if (Math.random() < 0.003) { // creep sideways over bare earth
        const d = Math.random() < 0.5 ? -1 : 1, nx = x + d;
        if (nx >= 0 && nx < cols) for (const j of [i + d, i + d - cols, i + d + cols]) {
          if (j >= 0 && j < type.length - cols && type[j] === EMPTY && type[j + cols] === M.earth) {
            place(j, M.grass); life[j] = 1 + (Math.random() * 3) | 0; break;
          }
        }
      }
      return true;
    }
    case M.cactus: {
      if (life[i] > 0 && y > 0 && Math.random() < 0.012) {
        const left = life[i] - 1, j = i - cols; life[i] = 0;
        if (type[j] !== EMPTY) return true;
        if (left <= 0) { if (Math.random() < 0.35) { how = 'A cactus in bloom'; place(j, M.flower); } return true; }
        place(j, M.cactus); life[j] = left;
        if (left > 3 && Math.random() < 0.25) { // an arm
          const d = Math.random() < 0.5 ? -1 : 1;
          if (x + 2 * d >= 0 && x + 2 * d < cols && type[i + d] === EMPTY && type[i + 2 * d] === EMPTY) {
            place(i + d, M.cactus); place(i + 2 * d, M.cactus); life[i + 2 * d] = 2 + (Math.random() * 2) | 0;
          }
        }
      }
      return true;
    }
    case M.seaweed: {
      if (life[i] > 0) {
        if (y > 0 && Math.random() < 0.03) {
          const dx = Math.random() < 0.75 ? 0 : (Math.random() < 0.5 ? -1 : 1), nx = x + dx;
          const left = life[i] - 1; life[i] = 0;
          if (nx >= 0 && nx < cols && left > 0 && isWet(type[i - cols + dx])) { place(i - cols + dx, M.seaweed); life[i - cols + dx] = left; }
        }
      } else if (Math.random() < 0.00006 && census[M.fish] < CAP.fish) {
        const j = randomNeighbour(x, i);
        if (j >= 0 && isWet(type[j])) { how = 'Seaweed left in the sea'; place(j, M.fish); }
      }
      return true;
    }
    case M.molten:
      if (Math.random() < 0.003 && !hasNeighbour(x, i, M.lava) && !hasNeighbour(x, i, M.fire)) { how = 'Molten metal cooling'; place(i, M.metal); return true; }
      return false;
    case M.torch: {
      if (!life[i]) return true; // not lit
      if (hasNeighbour(x, i, M.water)) { life[i] = 0; return true; }
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.4) { how = 'Fire'; place(i - cols, M.fire); life[i - cols] = 8 + (Math.random() * 18) | 0; }
      const j = randomNeighbour(x, i);
      if (j >= 0 && type[j] === M.torch && Math.random() < 0.1) life[j] = 1;
      return true;
    }
    case M.void: {
      const j = randomNeighbour(x, i);
      if (j >= 0 && type[j] !== M.void) type[j] = EMPTY;
      return true;
    }
    case M.ember: {
      if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.35) {
        how = 'Fire'; place(i - cols, M.fire); life[i - cols] = 10 + (Math.random() * 25) | 0;
      }
      stamp[i] = clock;
      if (Math.random() < 0.5) life[i]--;
      if (life[i] <= 1) { how = 'Wood burning all the way out'; place(i, Math.random() < 0.55 ? M.ash : M.smoke); }
      return true;
    }
  }
  return false;
}

function tickPlant(x, y, i) {
  // life = how much more this tip can grow
  if (life[i] > 0 && Math.random() < 0.03 && y > 0) {
    const dx = Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -1 : 1);
    const nx = x + dx;
    if (nx >= 0 && nx < cols) {
      const j = i - cols + dx;
      if (type[j] === EMPTY) {
        const left = life[i] - 1;
        life[i] = 0;
        if (left <= 0 && Math.random() < 0.6) { how = 'A plant growing tall'; place(j, M.flower); }
        else { how = ''; place(j, M.plant); life[j] = left; }
      }
    }
    return true;
  }
  if (life[i] === 0 && Math.random() < 0.0008 && y > 0 && y < rows - 1) {
    const up = type[i - cols], dn = type[i + cols];
    if ((up === M.plant || up === M.wood || up === M.flower) && (dn === M.plant || dn === M.wood || dn === M.mud || dn === M.earth)) {
      how = 'Old, thick plants'; place(i, M.wood); return true;
    }
  }
  return true;
}

function powderCanEnter(j, dens) {
  const t = type[j];
  if (t === EMPTY) return true;
  if (MATS[t].thin) return true;
  return MATS[t].kind === 'liquid' && MATS[t].dens < dens && Math.random() < 0.6;
}
function updatePowder(x, y, i, m) {
  if (y >= rows - 1) return;
  const below = i + cols;
  if (powderCanEnter(below, m.dens)) { move(i, below); return; }
  if (Math.random() > m.slide) return;
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dx of [d, -d]) {
    const nx = x + dx;
    if (nx >= 0 && nx < cols && powderCanEnter(below + dx, m.dens)) { move(i, below + dx); return; }
  }
}

function liquidCanEnter(j, dens) {
  const t = type[j];
  if (t === EMPTY) return true;
  const k = MATS[t].kind;
  if (k === 'gas') return true;
  return k === 'liquid' && MATS[t].dens < dens && Math.random() < 0.5;
}
function updateLiquid(x, y, i, m) {
  if (m.visc && Math.random() > m.visc) return;
  if (y < rows - 1) {
    const below = i + cols;
    if (liquidCanEnter(below, m.dens)) { move(i, below); return; }
    const d = Math.random() < 0.5 ? -1 : 1;
    for (const dx of [d, -d]) {
      const nx = x + dx;
      if (nx >= 0 && nx < cols && liquidCanEnter(below + dx, m.dens)) { move(i, below + dx); return; }
    }
  }
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dir of [d, -d]) {
    let target = -1;
    for (let s = 1; s <= m.spread; s++) {
      const nx = x + dir * s;
      if (nx < 0 || nx >= cols) break;
      const t = type[i + dir * s];
      if (t !== EMPTY && MATS[t].kind !== 'gas') break;
      target = i + dir * s;
    }
    if (target >= 0) { move(i, target); return; }
  }
}

function updateGas(x, y, i, m) {
  if (!m.slowFade || Math.random() < 0.15) life[i]--;
  if (life[i] <= 1) {
    if (m.decay && Math.random() < m.decay[1]) { how = `${m.name} cooling down`; place(i, M[m.decay[0]]); }
    else type[i] = EMPTY;
    return;
  }
  stamp[i] = clock;
  if (y === 0) return;
  if (Math.random() < 0.3) {
    const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i + dx] === EMPTY) { move(i, i + dx); return; }
  }
  const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
  if (nx >= 0 && nx < cols) {
    const up = i - cols + dx, t = type[up];
    if (t === EMPTY || (MATS[t].kind === 'liquid' && Math.random() < 0.5)) move(i, up);
  }
}

function updateFire(x, y, i) {
  if (life[i] <= 1 || Math.random() < 0.012) {
    if (Math.random() < 0.3) { how = 'Fire burning out'; place(i, M.smoke); } else type[i] = EMPTY;
    return;
  }
  life[i]--;
  stamp[i] = clock;
  if (y === 0) { type[i] = EMPTY; return; }
  if (Math.random() < 0.8) {
    const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i - cols + dx] === EMPTY) { move(i, i - cols + dx); return; }
    if (type[i - cols] === EMPTY) move(i, i - cols);
  }
}

function updateCloud(x, y, i, m) {
  stamp[i] = clock;
  if (y < rows - 1 && type[i + cols] === EMPTY) {
    if (m.storm && Math.random() < 0.0004) { how = 'An angry storm cloud'; strike(x, y + 1); return; }
    if (Math.random() < (m.storm ? 0.012 : 0.004)) {
      how = ''; place(i + cols, M.water);
      if (--life[i] <= 0) { type[i] = EMPTY; return; }
    }
  }
  if (Math.random() < 0.02) {
    const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i + dx] === EMPTY) move(i, i + dx);
  }
}

// sparks drift down and fade
function updateSpark(x, y, i) {
  stamp[i] = clock;
  if (--life[i] <= 1) { type[i] = EMPTY; return; }
  if (y >= rows - 1 || Math.random() > 0.4) return;
  const nx = x + ((Math.random() * 3) | 0) - 1;
  if (nx >= 0 && nx < cols && type[nx + (y + 1) * cols] === EMPTY) move(i, nx + (y + 1) * cols);
}

// a lit firework: shoots up leaving a trail, then bursts
function updateRocket(x, y, i) {
  stamp[i] = clock;
  const hue = shade[i];
  let l = life[i] - 1;
  for (let s = 0; s < 2 && l > 1; s++) {
    if (y <= 2) { l = 0; break; }
    let dx = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    if (x + dx < 0 || x + dx >= cols) dx = 0;
    const j = i - cols + dx, t = type[j];
    if (t !== EMPTY && !MATS[t].thin) break; // stuck under something
    type[j] = M.rocket; shade[j] = hue; stamp[j] = clock;
    type[i] = M.fire; life[i] = 4 + (Math.random() * 4) | 0; stamp[i] = clock;
    i = j; x += dx; y--;
  }
  life[i] = l;
  if (l > 1) return;
  // burst
  type[i] = EMPTY;
  how = 'Lighting a firework';
  const r = Math.max(5, Math.round(cols / 45)) + ((Math.random() * 4) | 0);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const px = x + dx, py = y + dy;
    if (px < 0 || py < 0 || px >= cols || py >= rows) continue;
    const j = px + py * cols;
    if (type[j] !== EMPTY && !MATS[type[j]].thin) continue;
    if (Math.random() > 0.12 + 0.5 * d2 / (r * r)) continue;
    place(j, M.spark);
    shade[j] = (hue + (Math.random() - 0.5) * 0.08 + 1) % 1;
    life[j] = 22 + (Math.random() * 34) | 0;
  }
}

const flip = (i) => { shade[i] = shade[i] < 0.5 ? shade[i] + 0.5 : shade[i] - 0.5; }; // creatures face left below 0.5, right above

function updateFish(x, y, i) {
  stamp[i] = clock;
  const wet = (x > 0 && isWet(type[i - 1])) || (x < cols - 1 && isWet(type[i + 1])) ||
    (y > 0 && isWet(type[i - cols])) || (y < rows - 1 && isWet(type[i + cols]));
  if (!wet) { // flopping about on dry land
    if (Math.random() < 0.15 && --life[i] <= 1) { type[i] = EMPTY; return; }
    if (y < rows - 1 && (type[i + cols] === EMPTY || MATS[type[i + cols]].thin)) move(i, i + cols);
    else if (Math.random() < 0.08) {
      const d = Math.random() < 0.5 ? -1 : 1;
      if (x + d >= 0 && x + d < cols && type[i + d] === EMPTY) move(i, i + d);
    }
    return;
  }
  if (Math.random() < 0.01 && --life[i] <= 1) { type[i] = EMPTY; return; }
  if (Math.random() < 0.55) return;
  if (Math.random() < 0.03) flip(i);
  const dir = shade[i] < 0.5 ? -1 : 1;
  if (Math.random() < 0.75) {
    const nx = x + dir;
    if (nx >= 0 && nx < cols && isWet(type[i + dir])) move(i, i + dir); else flip(i);
  } else {
    const j = i + (Math.random() < 0.5 ? -cols : cols);
    if (j >= 0 && j < type.length && isWet(type[j])) move(i, j);
  }
}

function updateBee(x, y, i) {
  stamp[i] = clock;
  if (Math.random() < 0.03 && --life[i] <= 1) { type[i] = EMPTY; return; }
  let nearFlower = false;
  if (Math.random() < 0.3) {
    const j = randomNeighbour(x, i);
    if (j >= 0 && type[j] === M.flower) {
      nearFlower = true;
      const k = randomNeighbour(x, i);
      if (Math.random() < 0.1 && k >= 0 && type[k] === EMPTY) { how = 'Bees visiting flowers'; place(k, M.honey); }
    }
  }
  if (nearFlower || Math.random() < 0.3) return;
  const dx = ((Math.random() * 3) | 0) - 1;
  let dy = ((Math.random() * 3) | 0) - 1;
  if (y < rows * 0.3 && Math.random() < 0.3) dy = 1; // don't wander off into the sky
  const nx = x + dx, ny = y + dy;
  if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
  const j = nx + ny * cols;
  if (type[j] === EMPTY) move(i, j);
}

const DIGGABLE = new Set(['sand', 'earth', 'ash', 'salt', 'seed', 'snow', 'clay'].map((k) => M[k]));
function updateAnt(x, y, i) {
  stamp[i] = clock;
  if (Math.random() < 0.004 && --life[i] <= 1) { type[i] = EMPTY; return; }
  const holds = (j) => type[j] !== EMPTY && !MATS[type[j]].thin && MATS[type[j]].kind !== 'liquid';
  if (y < rows - 1 && !holds(i + cols)) {
    const cling = (x > 0 && holds(i - 1)) || (x < cols - 1 && holds(i + 1));
    const b = type[i + cols];
    if ((!cling || Math.random() < 0.04) && (b === EMPTY || MATS[b].thin)) { move(i, i + cols); return; }
  }
  if (Math.random() < 0.5) return;
  if (Math.random() < 0.01) flip(i);
  const dir = shade[i] < 0.5 ? -1 : 1, nx = x + dir;
  if (nx < 0 || nx >= cols) { flip(i); return; }
  const j = i + dir, t = type[j];
  if (t === EMPTY) { move(i, j); return; }
  if (MATS[t].kind === 'liquid' || MATS[t].hot) { flip(i); return; }
  if (y > 0 && type[i - cols] === EMPTY) { // step or climb up
    move(i, type[j - cols] === EMPTY ? j - cols : i - cols);
    return;
  }
  if (DIGGABLE.has(t) && Math.random() < 0.4) { move(i, j); return; } // burrow
  flip(i);
}

// ================= drawing =================
const FLOWERS = [[240, 90, 120], [250, 200, 60], [180, 110, 240], [255, 250, 245], [255, 140, 60]];
const FLOWER_HUE = [0.96, 0.13, 0.75, 0.52, 0.07]; // the dye each flower colour makes
const FISH = [[255, 150, 50], [255, 212, 70], [255, 196, 196], [240, 92, 60]];
let HR = 0, HG = 0, HB = 0; // setHue(h) leaves a full-brightness colour here
function setHue(h) {
  const k = (((h % 1) + 1) % 1) * 6;
  const f = (n) => { const a = (n + k) % 6; return 255 * (1 - Math.max(0, Math.min(a, 4 - a, 1))); };
  HR = f(5); HG = f(3); HB = f(1);
}

function render() {
  img.loadPixels();
  const px = img.pixels;
  const wt = frameCount * 0.02;
  for (let i = 0, p = 0; i < type.length; i++, p += 4) {
    const t = type[i];
    let r = 0, g = 0, b = 0;
    if (t !== EMPTY) {
      const m = MATS[t], s = shade[i];
      if (t === M.sand) {
        const k = 1 - Math.abs(2 * s - 1); // fixed when placed
        r = SAND_A[0] + (SAND_B[0] - SAND_A[0]) * k;
        g = SAND_A[1] + (SAND_B[1] - SAND_A[1]) * k;
        b = SAND_A[2] + (SAND_B[2] - SAND_A[2]) * k;
      } else if (!m.anim) {
        const v = 1 - m.vary / 2 + m.vary * s;
        r = m.color[0] * v; g = m.color[1] * v; b = m.color[2] * v;
      } else {
        switch (m.anim) {
          case 'water': { const w = Math.sin(6.2832 * (wt + s)) * 10; r = m.color[0] + w * 0.5; g = m.color[1] + w; b = m.color[2] + w * 0.6; break; }
          case 'fire': break;
          case 'lava': { const w = 0.5 + 0.5 * Math.sin(6.2832 * (wt * 0.7 + s)); r = 255; g = 70 + 100 * w; b = 15 + 25 * w; break; }
          case 'ember': { const f = 0.6 + 0.4 * Math.random(); r = 230 * f; g = 70 * f; b = 20 * f; break; }
          case 'steam': { const k = Math.min(1, life[i] / 90) * 0.7; r = 205 * k; g = 215 * k; b = 228 * k; break; }
          case 'smoke': { const k = Math.min(1, life[i] / 60) * 0.5; r = 110 * k; g = 105 * k; b = 100 * k; break; }
          case 'gas': { const k = 0.25 + 0.1 * Math.sin(6.2832 * (wt + s)); r = 120 * k; g = 180 * k; b = 90 * k; break; }
          case 'oil': { const w = Math.sin(6.2832 * (wt * 0.6 + s)) * 8; r = 92 + w; g = 64 + w * 0.6; b = 30; break; }
          case 'acid': { const w = Math.sin(6.2832 * (wt * 1.5 + s)) * 15; r = 150 + w; g = 240; b = 60 + w; break; }
          case 'slime': { const w = Math.sin(6.2832 * (wt * 0.5 + s)) * 12; r = 100 + w; g = 205 + w; b = 80; break; }
          case 'flower': { const c = FLOWERS[(s * FLOWERS.length) | 0]; r = c[0]; g = c[1]; b = c[2]; break; }
          case 'sparkle': {
            const tw = Math.sin(6.2832 * (wt * 0.8 + s * 7)); const k = tw > 0.97 ? 1.25 : 0.9 + 0.1 * s;
            r = m.color[0] * k; g = m.color[1] * k; b = m.color[2] * k; break;
          }
          case 'bolt': { const k = 0.8 + 0.2 * Math.random(); r = 255 * k; g = 250 * k; b = 200 * k; break; }
          case 'molten': { const w = 0.5 + 0.5 * Math.sin(6.2832 * (wt + s)); r = 255; g = 196 + 44 * w; b = 96 + 70 * w; break; }
          case 'honey': { const w = Math.sin(6.2832 * (wt * 0.4 + s)); r = 232 + w * 12; g = 166 + w * 10; b = 40; break; }
          case 'bubble': { setHue(wt * 0.4 + s); r = 150 + HR * 0.4; g = 150 + HG * 0.4; b = 160 + HB * 0.37; break; }
          case 'dye': { setHue(s); const w = 0.86 + 0.06 * Math.sin(6.2832 * (wt + i * 0.37)); r = (HR * 0.82 + 26) * w; g = (HG * 0.82 + 26) * w; b = (HB * 0.82 + 26) * w; break; }
          case 'spark': { setHue(s); const k = Math.min(1, life[i] / 22) * (0.65 + 0.35 * Math.random()); r = (HR * 0.7 + 76) * k; g = (HG * 0.7 + 76) * k; b = (HB * 0.7 + 76) * k; break; }
          case 'torch': {
            if (life[i]) { const f = 0.75 + 0.25 * Math.random(); r = 250 * f; g = 170 * f; b = 70 * f; }
            else { const v = 0.8 + 0.3 * s; r = 150 * v; g = 100 * v; b = 52 * v; }
            break;
          }
          case 'fish': { const c = FISH[((s * 2) % 1 * FISH.length) | 0]; r = c[0]; g = c[1]; b = c[2]; break; }
          case 'bee': { if (((frameCount >> 3) + i) & 1) { r = 255; g = 214; b = 40; } else { r = 150; g = 110; b = 16; } break; }
          case 'void': { const k = 0.5 + 0.5 * Math.sin(6.2832 * (wt * 1.5 + s)); r = 34 + 30 * k; g = 8; b = 66 + 60 * k; break; }
          case 'sheen': { const k = 0.85 + 0.2 * (0.5 + 0.5 * Math.sin((i % cols) * 0.15 + wt)) * s + 0.05; r = m.color[0] * k; g = m.color[1] * k; b = m.color[2] * k; break; }
        }
        if (t === M.fire) {
          const k = Math.min(1, life[i] / 60) * (0.75 + 0.25 * Math.random());
          r = 255; g = 60 + 190 * k; b = 20 + 120 * k * k;
        }
      }
    }
    px[p] = r; px[p + 1] = g; px[p + 2] = b; px[p + 3] = 255;
  }
  img.updatePixels();
  image(img, 0, 0, width, height);
}

// ================= UI =================
let ui = {};

function buildUI() {
  const css = document.createElement('style');
  css.textContent = `
    html,body{margin:0;height:100%;background:#000;overflow:hidden}
    .fs-ui{position:fixed;top:8px;left:8px;right:8px;z-index:5;font:600 13px system-ui,-apple-system,sans-serif;
      display:flex;flex-direction:column;gap:6px;pointer-events:none}
    .fs-row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;pointer-events:auto;max-width:max-content;padding-bottom:2px}
    .fs-row::-webkit-scrollbar{display:none}
    @media (min-width:700px){.fs-row{flex-wrap:wrap}}
    .fs-ui button{flex:none;border:0;border-radius:999px;padding:6px 12px 6px 9px;cursor:pointer;display:flex;align-items:center;gap:6px;
      background:rgba(255,255,255,.13);color:#eee;backdrop-filter:blur(6px);font:inherit;white-space:nowrap}
    .fs-ui button i{width:10px;height:10px;border-radius:50%;display:block;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
    .fs-ui button.on{background:#eee;color:#111}
    .fs-ui button.plain{padding:6px 12px;background:rgba(255,255,255,.07);color:#bbb}
    .fs-ui button.new{animation:fsPop .6s ease 2}
    .fs-ui button.tab{padding:5px 11px;background:rgba(255,255,255,.07);color:#bbb}
    .fs-ui button.tab.on{background:rgba(255,255,255,.3);color:#fff}
    .fs-ui button.tab small{font:inherit;font-weight:500;opacity:.55}
    .fs-ui button.tab u{width:6px;height:6px;border-radius:50%;background:#f2ca79;display:block}
    .fs-book h3{margin:14px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#888;font-weight:650}
    .fs-book h3:first-of-type{margin-top:0}
    @keyframes fsPop{50%{transform:scale(1.15);background:#f2ca79;color:#111}}
    .fs-size{flex:none;display:flex;align-items:center;gap:6px;color:#aaa;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.07)}
    .fs-size input{width:70px;accent-color:#eee}
    .fs-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);opacity:0;transition:all .35s ease;z-index:8;
      background:rgba(20,20,24,.92);color:#eee;border-radius:14px;padding:10px 16px;font:500 14px system-ui,sans-serif;
      box-shadow:0 6px 30px rgba(0,0,0,.5);text-align:center;pointer-events:none;border:1px solid rgba(255,255,255,.1)}
    .fs-toast.show{opacity:1;transform:translate(-50%,0)}
    .fs-toast b{font-size:16px;display:block;margin-bottom:2px}
    .fs-toast small{color:#999}
    .fs-book{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9;display:none;align-items:center;justify-content:center;
      font:14px system-ui,sans-serif;color:#eee}
    .fs-book.open{display:flex}
    .fs-book .panel{background:#16161a;border:1px solid rgba(255,255,255,.1);border-radius:18px;width:min(560px,92vw);max-height:84vh;
      overflow:auto;padding:18px 18px 14px}
    .fs-book h2{margin:0 0 4px;font-size:20px}
    .fs-book .sub{color:#999;margin-bottom:14px}
    .fs-book .bar{height:6px;border-radius:3px;background:#2a2a30;margin-bottom:14px;overflow:hidden}
    .fs-book .bar div{height:100%;background:#f2ca79}
    .fs-book .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .fs-book .card{background:#202026;border-radius:12px;padding:9px 10px;display:flex;gap:9px;align-items:flex-start}
    .fs-book .card i{flex:none;width:14px;height:14px;border-radius:50%;margin-top:2px}
    .fs-book .card .n{font-weight:650}
    .fs-book .card .h{color:#999;font-size:12px;margin-top:2px}
    .fs-book .card.locked .n{color:#666}
    .fs-book .card.locked i{background:#333 !important}
    .fs-book .foot{display:flex;justify-content:space-between;margin-top:14px}
    .fs-book .foot button{border:0;border-radius:999px;padding:7px 14px;cursor:pointer;font:inherit;background:#2a2a30;color:#ddd}
    .fs-book .foot button.reset{background:none;color:#777}
    @media (max-width:600px){.fs-ui{font-size:12px}.fs-ui button{padding:5px 9px 5px 7px}}`;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.className = 'fs-ui';
  ui.cats = document.createElement('div'); ui.cats.className = 'fs-row';
  ui.mats = document.createElement('div'); ui.mats.className = 'fs-row';
  ui.tools = document.createElement('div'); ui.tools.className = 'fs-row';
  root.append(ui.cats, ui.mats, ui.tools);
  document.body.appendChild(root);

  ui.book = mkBtn('', 'plain', openBook);
  const eraser = mkBtn('<i style="background:#000"></i>Eraser', '', () => selectBrush(EMPTY));
  ui.eraser = eraser;
  const size = document.createElement('label');
  size.className = 'fs-size';
  size.innerHTML = 'Size <input type="range" min="0.4" max="3" step="0.1" value="1">';
  size.querySelector('input').oninput = (e) => { brushScale = parseFloat(e.target.value); };
  ui.pause = mkBtn('Pause', 'plain', () => { paused = !paused; ui.pause.textContent = paused ? 'Play' : 'Pause'; });
  const clear = mkBtn('Clear', 'plain', () => type.fill(EMPTY));
  ui.tools.append(ui.book, eraser, size, ui.pause, clear);

  ui.toast = document.createElement('div'); ui.toast.className = 'fs-toast';
  document.body.appendChild(ui.toast);

  ui.bookEl = document.createElement('div'); ui.bookEl.className = 'fs-book';
  ui.bookEl.onclick = (e) => { if (e.target === ui.bookEl) ui.bookEl.classList.remove('open'); };
  document.body.appendChild(ui.bookEl);

  buildMaterialRow();
}

function mkBtn(html, cls, fn) {
  const b = document.createElement('button');
  b.innerHTML = html; if (cls) b.className = cls; b.onclick = fn;
  return b;
}

let lastNew = null;
function buildMaterialRow() {
  if (!ui.mats) return;
  // once there are too many for one row, materials are split into tabs
  const was = tabbed;
  tabbed = foundCount() > 8;
  if (tabbed && !was && brush !== EMPTY) cat = MATS[brush].cat;
  ui.cats.style.display = tabbed ? '' : 'none';
  ui.cats.innerHTML = '';
  if (tabbed) {
    newCats.delete(cat);
    for (const [key, label] of CATS) {
      const n = MATS.filter((m) => findable(m) && m.cat === key && found[m.key]).length;
      if (!n) continue;
      const dot = newCats.has(key) ? '<u></u>' : '';
      ui.cats.appendChild(mkBtn(`${label} <small>${n}</small>${dot}`, 'tab' + (key === cat ? ' on' : ''), () => { cat = key; buildMaterialRow(); }));
    }
  }
  ui.mats.innerHTML = '';
  ui.matBtns = {};
  for (const m of MATS) {
    if (!findable(m) || !found[m.key] || (tabbed && m.cat !== cat)) continue;
    const b = mkBtn(`<i style="background:${m.dot}"></i>${m.name}`, '', () => selectBrush(m.id));
    if (m.id === lastNew) b.classList.add('new');
    ui.mats.appendChild(b); ui.matBtns[m.id] = b;
  }
  ui.book.textContent = `Discoveries ${foundCount()}/${totalFindable()}`;
  selectBrush(brush);
}

function selectBrush(id) {
  brush = id;
  for (const k in ui.matBtns) ui.matBtns[k].classList.toggle('on', +k === id);
  ui.eraser.classList.toggle('on', id === EMPTY);
}

let toastTimer = null;
function toast(m, recipe) {
  lastNew = m.id;
  ui.toast.innerHTML = `<b><span style="color:${m.dot}">●</span> New discovery: ${m.name}</b>${recipe}<br><small>${foundCount()} of ${totalFindable()} found</small>`;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
}

function openBook() {
  const n = foundCount(), total = totalFindable();
  let cards = '';
  for (const [key, label] of CATS) {
    const list = MATS.filter((m) => findable(m) && m.cat === key);
    cards += `<h3>${label} · ${list.filter((m) => found[m.key]).length}/${list.length}</h3><div class="grid">`;
    for (const m of list) {
      const got = found[m.key];
      cards += got
        ? `<div class="card"><i style="background:${m.dot}"></i><div><div class="n">${m.name}</div><div class="h">${got}</div></div></div>`
        : `<div class="card locked"><i></i><div><div class="n">???</div><div class="h">${m.hint || ''}</div></div></div>`;
    }
    cards += '</div>';
  }
  ui.bookEl.innerHTML = `<div class="panel">
    <h2>Discoveries</h2>
    <div class="sub">${n} of ${total} found. Make things happen in the world to find more.</div>
    <div class="bar"><div style="width:${(n / total) * 100}%"></div></div>
    ${cards}
    <div class="foot"><button class="reset">Start over</button><button class="close">Close</button></div></div>`;
  ui.bookEl.querySelector('.close').onclick = () => ui.bookEl.classList.remove('open');
  ui.bookEl.querySelector('.reset').onclick = () => {
    if (!confirm('Forget all discoveries and start again with the four basics?')) return;
    found = {}; loadFound(); saveFound(); type.fill(EMPTY); brush = M.sand; cat = 'powder'; newCats.clear(); buildMaterialRow(); openBook();
  };
  ui.bookEl.classList.add('open');
}
