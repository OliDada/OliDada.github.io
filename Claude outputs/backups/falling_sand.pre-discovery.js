// Falling Sand — a little world of powders, liquids, gases and things that burn.
// Grid lives in typed arrays and is updated in place; drawn as one scaled image.

const EMPTY = 0, SAND = 1, WATER = 2, FIRE = 3, WALL = 4, WOOD = 5, PLANT = 6,
      OIL = 7, LAVA = 8, ACID = 9, STONE = 10, STEAM = 11, SMOKE = 12, EMBER = 13;

const LIQUID_DENSITY = { [OIL]: 1, [WATER]: 2, [ACID]: 2, [LAVA]: 3 };
const isLiquid = (t) => t === WATER || t === OIL || t === ACID || t === LAVA;
const isGas = (t) => t === STEAM || t === SMOKE;

let cols = 0, rows = 0, cell = 3;
let type, shade, life, stamp;
let clock = 1;
let img;
let brush = 'sand';
let brushScale = 1;
let pointerDown = false, lastCell = null, pointerCell = null;
let buttons = {};

const SAND_A = [242, 202, 121], SAND_B = [242, 161, 80];
const COLOR_CYCLE = 600;

const BRUSHES = [
  { id: 'sand',  label: 'Sand',  t: SAND,  dot: '#f2ca79', density: 0.4 },
  { id: 'water', label: 'Water', t: WATER, dot: '#2ea9e6', density: 0.5 },
  { id: 'fire',  label: 'Fire',  t: FIRE,  dot: '#ff8a2a', density: 0.7 },
  { id: 'wall',  label: 'Wall',  t: WALL,  dot: '#8a8d96', density: 1 },
  { id: 'wood',  label: 'Wood',  t: WOOD,  dot: '#8a5a32', density: 1 },
  { id: 'plant', label: 'Plant', t: PLANT, dot: '#4fb84f', density: 0.9 },
  { id: 'oil',   label: 'Oil',   t: OIL,   dot: '#6b4a22', density: 0.5 },
  { id: 'lava',  label: 'Lava',  t: LAVA,  dot: '#ff5a1a', density: 0.5 },
  { id: 'acid',  label: 'Acid',  t: ACID,  dot: '#9cf03c', density: 0.5 },
  { id: 'stone', label: 'Stone', t: STONE, dot: '#a29a90', density: 0.5 },
  { id: 'eraser', label: 'Eraser', t: EMPTY, dot: '#000', density: 1 },
];

function setup() {
  const c = createCanvas(10, 10);
  c.elt.style.touchAction = 'none';
  c.elt.style.display = 'block';
  noSmooth();
  buildToolbar();
  bindPointer(c.elt);
  resize();
}

function windowResized() { resize(); }

function resize() {
  const W = windowWidth, H = windowHeight;
  cell = Math.max(2, Math.floor(Math.min(W, H) / 260));
  const newCols = Math.floor(W / cell), newRows = Math.floor(H / cell);
  resizeCanvas(newCols * cell, newRows * cell);
  noSmooth();
  const oT = type, oS = shade, oL = life, oc = cols, or = rows;
  cols = newCols; rows = newRows;
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

// ---------- input ----------
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

function stampBrush(cx, cy) {
  const b = BRUSHES.find((b) => b.id === brush);
  const r = Math.max(1, Math.round(Math.max(3, cols / 55) * brushScale));
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = x + y * cols;
    if (b.t === EMPTY) { type[i] = EMPTY; continue; }
    if (type[i] !== EMPTY || Math.random() > b.density) continue;
    place(i, b.t);
  }
}

function place(i, t) {
  type[i] = t;
  stamp[i] = clock;
  if (t === SAND) shade[i] = ((frameCount + Math.random() * 40) % COLOR_CYCLE) / COLOR_CYCLE;
  else shade[i] = Math.random();
  if (t === FIRE) life[i] = 40 + (Math.random() * 60) | 0;
  else if (t === EMBER) life[i] = 150 + (Math.random() * 100) | 0;
  else if (t === STEAM) life[i] = 90 + (Math.random() * 120) | 0;
  else if (t === SMOKE) life[i] = 40 + (Math.random() * 70) | 0;
  else life[i] = 0;
}

// ---------- simulation ----------
function move(a, b) {
  const t = type[a]; type[a] = type[b]; type[b] = t;
  const s = shade[a]; shade[a] = shade[b]; shade[b] = s;
  const l = life[a]; life[a] = life[b]; life[b] = l;
  stamp[a] = clock; stamp[b] = clock;
}

// the 4 neighbours of cell i (x is its column)
const nb = [0, 0, 0, 0];
function neighbours(x, i) {
  let n = 0;
  if (x > 0) nb[n++] = i - 1;
  if (x < cols - 1) nb[n++] = i + 1;
  if (i >= cols) nb[n++] = i - cols;
  if (i < type.length - cols) nb[n++] = i + cols;
  return n;
}

function step() {
  clock++;
  for (let y = rows - 1; y >= 0; y--) {
    const ltr = Math.random() < 0.5;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = x + y * cols;
      const t = type[i];
      if (t === EMPTY || t === WALL || stamp[i] === clock) continue;
      switch (t) {
        case SAND: updatePowder(x, y, i, 1); break;
        case STONE: updatePowder(x, y, i, 0.25); break;
        case WATER: updateLiquid(x, y, i, 2, 4, 1); break;
        case OIL: updateLiquid(x, y, i, 1, 3, 1); break;
        case ACID: updateAcid(x, y, i); break;
        case LAVA: updateLava(x, y, i); break;
        case FIRE: updateFire(x, y, i); break;
        case EMBER: updateEmber(x, y, i); break;
        case PLANT: updatePlant(x, y, i); break;
        case STEAM: case SMOKE: updateGas(x, y, i); break;
      }
    }
  }
}

// powders fall, sink through liquids, and slide off piles (slide = how easily)
function powderCanEnter(j) {
  const t = type[j];
  return t === EMPTY || isGas(t) || (isLiquid(t) && Math.random() < 0.6);
}
function updatePowder(x, y, i, slide) {
  if (y >= rows - 1) return;
  const below = i + cols;
  if (powderCanEnter(below)) { move(i, below); return; }
  if (Math.random() > slide) return;
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dx of [d, -d]) {
    const nx = x + dx;
    if (nx < 0 || nx >= cols) continue;
    if (powderCanEnter(below + dx)) { move(i, below + dx); return; }
  }
}

// liquids fall, sink below lighter liquids, then spread sideways
function liquidCanEnter(j, dens) {
  const t = type[j];
  return t === EMPTY || isGas(t) || (isLiquid(t) && LIQUID_DENSITY[t] < dens && Math.random() < 0.5);
}
function updateLiquid(x, y, i, dens, spread, chance) {
  if (Math.random() > chance) return;
  if (y < rows - 1) {
    const below = i + cols;
    if (liquidCanEnter(below, dens)) { move(i, below); return; }
    const d = Math.random() < 0.5 ? -1 : 1;
    for (const dx of [d, -d]) {
      const nx = x + dx;
      if (nx >= 0 && nx < cols && liquidCanEnter(below + dx, dens)) { move(i, below + dx); return; }
    }
  }
  const d = Math.random() < 0.5 ? -1 : 1;
  for (const dir of [d, -d]) {
    let target = -1;
    for (let s = 1; s <= spread; s++) {
      const nx = x + dir * s;
      if (nx < 0 || nx >= cols) break;
      const t = type[i + dir * s];
      if (t !== EMPTY && !isGas(t)) break;
      target = i + dir * s;
    }
    if (target >= 0) { move(i, target); return; }
  }
}

// gases rise, bubble up through liquids, drift, and fade
function updateGas(x, y, i) {
  if (life[i] <= 1) {
    // steam sometimes condenses back into rain
    if (type[i] === STEAM && Math.random() < 0.35) place(i, WATER);
    else type[i] = EMPTY;
    return;
  }
  life[i]--;
  stamp[i] = clock;
  if (y === 0) return;
  if (Math.random() < 0.3) { // drift
    const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
    if (nx >= 0 && nx < cols && type[i + dx] === EMPTY) { move(i, i + dx); return; }
  }
  const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
  if (nx >= 0 && nx < cols) {
    const up = i - cols + dx, t = type[up];
    if (t === EMPTY || (isLiquid(t) && Math.random() < 0.5)) { move(i, up); return; }
  }
}

function updateFire(x, y, i) {
  const n = neighbours(x, i);
  for (let k = 0; k < n; k++) {
    const j = nb[k], t = type[j];
    if (t === WATER) { // put out, water boils
      place(i, STEAM);
      if (Math.random() < 0.5) place(j, STEAM);
      return;
    }
    if (t === OIL && Math.random() < 0.3) place(j, FIRE);
    else if (t === WOOD && Math.random() < 0.03) place(j, EMBER);
    else if (t === PLANT && Math.random() < 0.08) place(j, EMBER);
  }
  if (life[i] <= 1 || Math.random() < 0.012) {
    if (Math.random() < 0.3) place(i, SMOKE); else type[i] = EMPTY;
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

// burning wood/plant: stays put, throws flames, spreads, burns out
function updateEmber(x, y, i) {
  const n = neighbours(x, i);
  for (let k = 0; k < n; k++) {
    const j = nb[k], t = type[j];
    if (t === WATER) { place(i, WOOD); shade[i] *= 0.3; place(j, STEAM); return; }
    if (t === WOOD && Math.random() < 0.012) place(j, EMBER);
    else if (t === PLANT && Math.random() < 0.05) place(j, EMBER);
    else if (t === OIL && Math.random() < 0.3) place(j, FIRE);
  }
  if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.35) {
    place(i - cols, FIRE); life[i - cols] = 10 + (Math.random() * 25) | 0;
  }
  stamp[i] = clock;
  if (Math.random() < 0.5) life[i]--;
  if (life[i] <= 1) { if (Math.random() < 0.5) place(i, SMOKE); else type[i] = EMPTY; }
}

// plants slowly grow into water they touch
function updatePlant(x, y, i) {
  if (Math.random() > 0.15) return;
  const n = neighbours(x, i);
  const j = nb[(Math.random() * n) | 0];
  if (type[j] === WATER && Math.random() < 0.25) place(j, PLANT);
}

// acid eats almost anything except walls (and gets used up doing it)
function updateAcid(x, y, i) {
  const n = neighbours(x, i);
  const j = nb[(Math.random() * n) | 0], t = type[j];
  if (t !== EMPTY && t !== WALL && t !== ACID && !isGas(t) && t !== FIRE && Math.random() < 0.12) {
    if (t === WATER) { if (Math.random() < 0.1) type[i] = EMPTY; } // diluted
    else {
      if (Math.random() < 0.3) place(j, SMOKE); else type[j] = EMPTY;
      if (Math.random() < 0.35) { type[i] = EMPTY; return; }
    }
  }
  updateLiquid(x, y, i, 2, 3, 1);
}

// lava: slow, sets things alight, turns to stone in water
function updateLava(x, y, i) {
  const n = neighbours(x, i);
  for (let k = 0; k < n; k++) {
    const j = nb[k], t = type[j];
    if (t === WATER) { place(j, STEAM); if (Math.random() < 0.5) { place(i, STONE); return; } }
    else if (t === WOOD || t === PLANT) { if (Math.random() < 0.1) place(j, EMBER); }
    else if (t === OIL) { if (Math.random() < 0.4) place(j, FIRE); }
    else if (t === SAND && Math.random() < 0.002) place(j, LAVA); // melts sand, very slowly
  }
  if (y > 0 && type[i - cols] === EMPTY && Math.random() < 0.003) {
    place(i - cols, FIRE); life[i - cols] = 8 + (Math.random() * 12) | 0;
  }
  updateLiquid(x, y, i, 3, 2, 0.35);
}

// ---------- drawing ----------
function render() {
  img.loadPixels();
  const px = img.pixels;
  const wt = frameCount * 0.02;
  for (let i = 0, p = 0; i < type.length; i++, p += 4) {
    const t = type[i], s = shade[i];
    let r = 0, g = 0, b = 0;
    switch (t) {
      case SAND: {
        const m = 1 - Math.abs(2 * s - 1); // colour fixed at the moment it was placed
        r = SAND_A[0] + (SAND_B[0] - SAND_A[0]) * m;
        g = SAND_A[1] + (SAND_B[1] - SAND_A[1]) * m;
        b = SAND_A[2] + (SAND_B[2] - SAND_A[2]) * m;
        break;
      }
      case WATER: {
        const w = Math.sin(6.2832 * (wt + s)) * 10;
        r = 46 + w * 0.5; g = 169 + w; b = 230 + w * 0.6; break;
      }
      case FIRE: {
        const k = Math.min(1, life[i] / 60) * (0.75 + 0.25 * Math.random());
        r = 255; g = 60 + 190 * k; b = 20 + 120 * k * k; break;
      }
      case EMBER: {
        const f = 0.6 + 0.4 * Math.random();
        r = 230 * f; g = 70 * f; b = 20 * f; break;
      }
      case WALL: { const v = 0.9 + 0.2 * s; r = 120 * v; g = 123 * v; b = 132 * v; break; }
      case WOOD: { const v = 0.8 + 0.35 * s; r = 125 * v; g = 82 * v; b = 46 * v; break; }
      case PLANT: { const v = 0.8 + 0.35 * s; r = 64 * v; g = 175 * v; b = 70 * v; break; }
      case STONE: { const v = 0.8 + 0.3 * s; r = 150 * v; g = 143 * v; b = 135 * v; break; }
      case OIL: {
        const w = Math.sin(6.2832 * (wt * 0.6 + s)) * 8;
        r = 92 + w; g = 64 + w * 0.6; b = 30; break;
      }
      case ACID: {
        const w = Math.sin(6.2832 * (wt * 1.5 + s)) * 15;
        r = 150 + w; g = 240; b = 60 + w; break;
      }
      case LAVA: {
        const w = 0.5 + 0.5 * Math.sin(6.2832 * (wt * 0.7 + s));
        r = 255; g = 70 + 100 * w; b = 15 + 25 * w; break;
      }
      case STEAM: {
        const k = Math.min(1, life[i] / 90) * 0.7;
        r = 205 * k; g = 215 * k; b = 228 * k; break;
      }
      case SMOKE: {
        const k = Math.min(1, life[i] / 60) * 0.5;
        r = 110 * k; g = 105 * k; b = 100 * k; break;
      }
    }
    px[p] = r; px[p + 1] = g; px[p + 2] = b; px[p + 3] = 255;
  }
  img.updatePixels();
  image(img, 0, 0, width, height);
}

function draw() {
  paint();
  step();
  render();
}

// ---------- toolbar ----------
function buildToolbar() {
  const css = document.createElement('style');
  css.textContent = `
    html,body{margin:0;height:100%;background:#000;overflow:hidden}
    .fs-bar{position:fixed;top:10px;left:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:5;
      font:600 13px system-ui,-apple-system,sans-serif;pointer-events:none}
    .fs-bar>*{pointer-events:auto}
    .fs-bar button{border:0;border-radius:999px;padding:6px 12px 6px 9px;cursor:pointer;display:flex;align-items:center;gap:6px;
      background:rgba(255,255,255,.13);color:#eee;backdrop-filter:blur(6px);font:inherit}
    .fs-bar button i{width:10px;height:10px;border-radius:50%;display:block;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
    .fs-bar button.on{background:#eee;color:#111}
    .fs-bar button.plain{padding:6px 12px;background:rgba(255,255,255,.06);color:#aaa}
    .fs-size{display:flex;align-items:center;gap:6px;color:#aaa;padding:0 6px;border-radius:999px;background:rgba(255,255,255,.06)}
    .fs-size input{width:80px;accent-color:#eee}
    @media (max-width:600px){.fs-bar{font-size:12px;gap:4px}.fs-bar button{padding:5px 9px 5px 7px}}`;
  document.head.appendChild(css);
  const bar = document.createElement('div');
  bar.className = 'fs-bar';
  for (const b of BRUSHES) {
    const el = document.createElement('button');
    el.innerHTML = `<i style="background:${b.dot}"></i>${b.label}`;
    el.onclick = () => { brush = b.id; for (const k in buttons) buttons[k].classList.toggle('on', k === b.id); };
    bar.appendChild(el); buttons[b.id] = el;
  }
  const size = document.createElement('label');
  size.className = 'fs-size';
  size.innerHTML = 'Size <input type="range" min="0.4" max="3" step="0.1" value="1">';
  size.querySelector('input').oninput = (e) => { brushScale = parseFloat(e.target.value); };
  bar.appendChild(size);
  const clr = document.createElement('button');
  clr.textContent = 'Clear'; clr.className = 'plain';
  clr.onclick = () => type.fill(EMPTY);
  bar.appendChild(clr);
  document.body.appendChild(bar);
  buttons.sand.classList.add('on');
}
