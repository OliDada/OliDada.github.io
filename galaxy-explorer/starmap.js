// One full-screen map from the whole galaxy down to a single system's moons.
// Canvas 2D, redrawn only on interaction. Detail is generated for the current
// zoom: haze -> procedural light tiles -> real stars -> orbits, planets, moons.
import { starsInBox, jumpTargets, starPhysics, starDistance, visualTile, glowLevel, VISUAL_EXTENT, starById } from './galaxy.mjs';
import { candidates, scan, HEARD, SCAN_RADIUS } from './signals.mjs';
import { generateSystem, starName } from './system.mjs';
import { bodyPosition, orbitClock } from './orbits.mjs';
import { lifeLabel } from './biomes.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { civilizationFor, LEVEL_NAMES } from './structures.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fmtLy = (ly) => ly >= 1000 ? `${(ly / 1000).toFixed(ly >= 10000 ? 0 : 1)}k ly` : ly >= 10 ? `${Math.round(ly)} ly` : ly >= .1 ? `${ly.toFixed(1)} ly` : `${Math.round(ly * 63241)} AU`;
const LIFE_RANK = { none: 0, microbial: 1, simple: 2, complex: 3 };
// Long-range scan: the ship can sense biosignatures (atmospheric gases life
// produces) at stars within jump range, before you visit. Strength hints at
// the most advanced life in the system without naming the world.
const SCAN = [
  { tag: '', text: 'No biosignatures detected.', color: null },
  { tag: 'FAINT LIFE', text: 'Faint biosignatures: microbial life possible.', color: 'rgba(170,205,160,.75)' },
  { tag: 'LIFE', text: 'Clear biosignatures: plant life likely.', color: 'rgba(150,235,140,.9)' },
  { tag: 'RICH LIFE', text: 'Strong biosignatures: complex life likely, with animals.', color: 'rgba(120,255,150,1)' },
];
function biosignature(sys) { return Math.max(0, ...sys.bodies.map(b => LIFE_RANK[b.physics?.life] || 0)); }
// Biosignatures that do not match water-based chemistry: the scan can tell, but not much more.
function exoticLife(sys) { return sys.bodies.some(b => b.physics?.life && b.physics.life !== 'none' && b.physics.biochemistry && b.physics.biochemistry !== 'carbon'); }
const EXOTIC_RING = 'rgba(205,160,255,.95)';
// Planet-shapers and spacefarers broadcast: their radio signals reach the long-range scan.
const SIGNAL_RING = 'rgba(255,210,120,.95)';
const civCache = new Map();
function civOf(b) {
  const key = `${b.seed}-${b.id}`;
  if (!civCache.has(key)) civCache.set(key, b.physics?.life === 'complex' ? civilizationFor(b, faunaFor(b).species) : null);
  return civCache.get(key);
}
const radioWorld = (b) => civOf(b)?.level >= 4;
const signals = (sys) => sys.bodies.some(radioWorld);
// How rare each level of life is galaxy-wide: one world in N (from
// `node galaxy-explorer/inspect.mjs --stats`; starmap.test.mjs checks they still hold).
export const LIFE_RARITY = {
  carbon: { microbial: 20, simple: 64, complex: 76 },
  exotic: { microbial: 37, simple: 110, complex: 350 },
};
const isExotic = (b) => !!b.physics?.life && b.physics.life !== 'none' && !!b.physics.biochemistry && b.physics.biochemistry !== 'carbon';
const rarityWord = (n) => n >= 200 ? 'exceptionally rare' : n >= 50 ? 'very rare' : n >= 25 ? 'rare' : 'uncommon';
// "Complex life (methane-based): very rare, about 1 world in 350." or '' for lifeless worlds.
export function rarityText(b) {
  const life = b.physics?.life;
  if (!LIFE_RANK[life]) return '';
  const n = LIFE_RARITY[isExotic(b) ? 'exotic' : 'carbon'][life], what = { microbial: 'Microbial life', simple: 'Plant life', complex: 'Complex life with animals' }[life];
  return `${what}${isExotic(b) ? ` on ${b.physics.biochemistry}` : ''}: ${rarityWord(n)}, about 1 world in ${n}.`;
}

// Zoom thresholds in pixels per light year.
const LOCAL_SCALE = 7;          // neighbourhood view
const REAL_FROM = 4, REAL_TO = 6.5; // procedural light hands over to real stars
const SYSTEM_FROM = 30, SYSTEM_TO = 90; // orbits fade in
const MAX_SCALE = 9000;
const SYSTEM_RADIUS = .3;       // light years the outermost orbit occupies on the chart (systems are compressed)

const names = new Map();
const nameOf = (star) => { let n = names.get(star.id); if (!n) { n = starName(star.seed); names.set(star.id, n); } return n; };
const systems = new Map();
function systemOf(star) {
  let s = systems.get(star.id);
  if (!s) {
    s = generateSystem(star.seed);
    if (systems.size > 400) systems.clear();
    systems.set(star.id, s);
  }
  if (!s.chartScale) s.chartScale = SYSTEM_RADIUS / (Math.max(...s.bodies.map(b => Math.hypot(b.position[0], b.position[2]))) + 300);
  return s;
}
// Worlds are drawn where they are now on their orbits (orbits.mjs).
const bodyXY = (star, sys, body) => { const p = bodyPosition(sys, body, orbitClock()); return [star.x + p[0] * sys.chartScale, star.y - p[2] * sys.chartScale]; };
function readSurvey(seed) { try { const s = JSON.parse(localStorage.getItem(`elsewhere-system-${seed}`) || '{}'); return { records: new Set(s.records || []), visited: new Set(s.visited || []), flora: s.flora || {}, fauna: s.fauna || {}, traces: s.traces || {} }; } catch { return { records: new Set(), visited: new Set(), flora: {}, fauna: {}, traces: {} }; } }

export function createStarMap(o) {
  let { here } = o;
  const { state } = o;
  const offChart = () => o.offChart();
  const $ = (id) => document.getElementById(id);
  const dialog = $('starMap'), canvas = $('starCanvas'), ctx = canvas.getContext('2d');
  systems.set(here.id, o.system); // the system you are actually flying in
  let { range, targets } = jumpTargets(here);
  let inRange = new Set(targets.map(t => t.star.id));

  // --- Radio signals heard from here (signals.mjs) ---------------------------
  // Scanned once per star in a background thread (or in small slices if workers are
  // unavailable) and cached, so the map shows broadcasting civilizations far beyond jump range.
  let radio = [], radioFor = null, radioDone = false;
  function scanRadio() {
    const at = here;
    if (radioFor === at.id) return;
    radioFor = at.id; radio = []; radioDone = false;
    const key = `elsewhere-signals-v1-${at.id}`, center = { x: at.x, y: at.y, z: at.z };
    const done = (list) => {
      if (radioFor !== at.id) return;
      radio = list.map(e => ({ ...e, star: starById(e.id) })).filter(e => e.star); radioDone = true;
      try { localStorage.setItem(key, JSON.stringify(list.map(({ id, level, distance }) => ({ id, level, distance })))); } catch {}
      if (dialog.open) { updatePanel(); requestDraw(); }
    };
    try { const cached = JSON.parse(localStorage.getItem(key) || 'null'); if (cached) return void done(cached); } catch {}
    const sliced = () => {
      const list = candidates(center), found = []; let i = 0;
      (function step() { if (radioFor !== at.id) return; found.push(...scan(list, i, i + 200)); i += 200; if (i < list.length) setTimeout(step, 0); else done(found); })();
    };
    try {
      const worker = new Worker(new URL('./signals-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { worker.terminate(); done(e.data.sources); };
      worker.onerror = () => { worker.terminate(); sliced(); };
      worker.postMessage({ id: at.id, center });
    } catch { sliced(); }
  }
  const heardFrom = (star) => radio.find(e => e.star.id === star.id);
  const view = { x: here.x, y: here.y, scale: LOCAL_SCALE };
  let w = 0, h = 0, dpr = 1, pending = false, drawn = [], haze = null, anim = null;
  let selected = { star: targets[0]?.star || here, body: null };
  const isVisited = (star) => star.id === here.id || state.visited.has(star.id);
  // Height of a star above (+) or below (-) you, in light years: the one dimension the map cannot show.
  const heightOf = (star) => star.z - (o.deep() ? o.deep().position[2] : here.z);
  const heightWords = (dz) => Math.abs(dz) < 1.5 ? '' : `${Math.round(Math.abs(dz))} ly ${dz > 0 ? 'above' : 'below'}`;
  const minScale = () => Math.min(w, h) / (VISUAL_EXTENT * .95);
  // The panel covers part of the screen; focus targets in the visible part.
  const panelOpen = () => !document.body.classList.contains('map-panel-collapsed');
  const focusOffset = () => w > 760 ? [panelOpen() ? 172 : 0, 0] : [0, panelOpen() ? Math.min(h * .46, 420) / 2 : 0];
  const systemScale = () => Math.min(w - (w > 760 && panelOpen() ? 360 : 0), h - (w <= 760 && panelOpen() ? Math.min(h * .46, 420) : 0)) * .42 / SYSTEM_RADIUS;
  function focusView(x, y, scale) { const [ox, oy] = focusOffset(); return { x: x + ox / scale, y: y - oy / scale, scale }; }

  const toScreen = (x, y) => [w / 2 + (x - view.x) * view.scale, h / 2 - (y - view.y) * view.scale];
  const toWorld = (sx, sy) => [view.x + (sx - w / 2) / view.scale, view.y - (sy - h / 2) / view.scale];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const requestDraw = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; draw(); }); } };

  // Soft background glow of the whole galaxy; blur suits haze, and sharp detail comes from the points.
  function buildHaze() {
    const n = 320, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i / n - .5) * VISUAL_EXTENT, y = (.5 - j / n) * VISUAL_EXTENT, v = glowLevel(x, y) ** .9;
      const core = Math.exp(-(x * x + y * y) / (VISUAL_EXTENT * .06) ** 2), k = (j * n + i) * 4;
      img.data[k] = 110 + 140 * core; img.data[k + 1] = 120 + 95 * core; img.data[k + 2] = 190 - 40 * core; img.data[k + 3] = v * 120;
    }
    g.putImageData(img, 0, 0); return c;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = '#040911'; ctx.fillRect(0, 0, w, h);
    const s = view.scale, ls = Math.log(s);
    const [x0, y1] = toWorld(0, 0), [x1, y0] = toWorld(w, h);
    // 1. Haze.
    const hazeA = 1 - smooth(Math.log(.08), Math.log(2), ls);
    if (hazeA > 0) {
      haze ||= buildHaze();
      const [hx, hy] = toScreen(-VISUAL_EXTENT / 2, VISUAL_EXTENT / 2);
      ctx.globalAlpha = hazeA; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(haze, hx, hy, VISUAL_EXTENT * s, VISUAL_EXTENT * s);
    }
    // 2. Procedural light, one quadtree level finer every time the view halves.
    const fakeA = 1 - smooth(Math.log(REAL_FROM), Math.log(REAL_TO), ls);
    if (fakeA > 0) {
      const lv = Math.log2(VISUAL_EXTENT * s / 340), finest = Math.floor(lv), frac = lv - finest;
      for (let L = 0; L <= Math.min(finest + 1, 14); L++) {
        const a = fakeA * (L <= finest ? 1 : frac); if (a <= .01) continue;
        const T = VISUAL_EXTENT / 2 ** L, n = 2 ** L;
        const tx0 = clamp(Math.floor((x0 + VISUAL_EXTENT / 2) / T), 0, n - 1), tx1 = clamp(Math.floor((x1 + VISUAL_EXTENT / 2) / T), 0, n - 1);
        const ty0 = clamp(Math.floor((y0 + VISUAL_EXTENT / 2) / T), 0, n - 1), ty1 = clamp(Math.floor((y1 + VISUAL_EXTENT / 2) / T), 0, n - 1);
        const size = 1.1 + Math.max(0, 1.1 - (finest - L) * .25);
        for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
          for (const b of visualTile(L, tx, ty).buckets) {
            ctx.globalAlpha = a * b.alpha; ctx.fillStyle = b.color;
            for (let i = 0; i < b.xs.length; i++) {
              const sx = w / 2 + (b.xs[i] - view.x) * s, sy = h / 2 - (b.ys[i] - view.y) * s;
              if (sx > -2 && sx < w + 2 && sy > -2 && sy < h + 2) ctx.fillRect(sx, sy, size, size);
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1; drawn = [];
    // 3. Real stars (a slab of the disc around your height; distances stay 3D).
    const realA = smooth(Math.log(REAL_FROM), Math.log(REAL_TO), ls);
    const sysA = smooth(Math.log(SYSTEM_FROM), Math.log(SYSTEM_TO), ls);
    let stars = [];
    if (realA > 0) {
      stars = starsInBox([x0 - 1, y0 - 1, here.z - 40], [x1 + 1, y1 + 1, here.z + 40]);
      if (s > 2.5 && s < SYSTEM_TO && !o.deep()) {
        ctx.globalAlpha = realA * (1 - sysA) * .9; ctx.strokeStyle = 'rgba(201,244,204,.16)'; ctx.lineWidth = 1;
        const [hx, hy] = toScreen(here.x, here.y);
        for (const t of targets) { const [tx, ty] = toScreen(t.star.x, t.star.y); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke(); }
      }
      const base = clamp(s / 7, .45, 1.7);
      for (const st of stars) {
        const p = starPhysics(st), [sx, sy] = toScreen(st.x, st.y);
        let r = Math.max(clamp(.8 + p.radius * 1.2, .8, 3.2) * base, Math.min(22, Math.sqrt(p.radius) * .012 * s));
        // The map is seen from above, but the galaxy is 3D: stars far above or
        // below you are drawn smaller and fainter, so the ones you can reach stand out.
        const depth = s < SYSTEM_FROM && st.id !== here.id && (o.deep() || !inRange.has(st.id)) ? clamp(Math.abs(heightOf(st)) / 30, 0, 1) : 0;
        r *= 1 - .45 * depth;
        ctx.globalAlpha = realA * (1 - .72 * depth);
        if (r > 4) {
          const g = ctx.createRadialGradient(sx, sy, r * .6, sx, sy, r * 3.2);
          g.addColorStop(0, p.color + '55'); g.addColorStop(1, p.color + '00');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = p.color;
        if (r < 1.3) ctx.fillRect(sx - r / 2, sy - r / 2, r, r); else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); }
        if (isVisited(st) && st.id !== here.id && s < SYSTEM_FROM) { ctx.strokeStyle = 'rgba(201,244,204,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, r + 3, 0, Math.PI * 2); ctx.stroke(); }
        if (inRange.has(st.id) && s < SYSTEM_FROM) {
          const level = biosignature(systemOf(st));
          if (level) { ctx.strokeStyle = exoticLife(systemOf(st)) ? EXOTIC_RING : SCAN[level].color; ctx.lineWidth = level === 3 ? 2 : 1.2; ctx.setLineDash(level === 1 ? [2, 3] : []); ctx.beginPath(); ctx.arc(sx, sy, r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
          if (signals(systemOf(st))) { ctx.strokeStyle = SIGNAL_RING; ctx.lineWidth = 1.2; ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.arc(sx, sy, r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        }
        drawn.push({ star: st, sx, sy, r: Math.max(r, 6) });
      }
    }
    // 4. Systems.
    if (sysA > 0) for (const st of stars) drawSystem(st, sysA);
    ctx.globalAlpha = 1;
    // Radio sources: drawn at every zoom out to the whole galaxy, so you can see
    // where broadcasting civilizations are long before you can reach them.
    if (radio.length && s < SYSTEM_FROM) {
      ctx.font = '600 9px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const e of radio) {
        const [sx, sy] = toScreen(e.star.x, e.star.y);
        if (sx < -30 || sy < -30 || sx > w + 30 || sy > h + 30) continue;
        ctx.strokeStyle = SIGNAL_RING; ctx.lineWidth = 1.3;
        for (const k of [6, 10, 14]) { ctx.globalAlpha = 1.1 - k / 16; for (const a of [0, Math.PI]) { ctx.beginPath(); ctx.arc(sx, sy, k, a - .8, a + .8); ctx.stroke(); } }
        ctx.globalAlpha = 1; ctx.fillStyle = SIGNAL_RING; ctx.beginPath(); ctx.arc(sx, sy, e.level >= 5 ? 2.8 : 2.2, 0, Math.PI * 2); ctx.fill();
        if (s > .6) ctx.fillText(s >= LOCAL_SCALE * .4 ? `${nameOf(e.star)} · ${e.level >= 5 ? 'SPACEFARERS' : 'SIGNALS'}` : '', sx + 17, sy);
        if (!drawn.some(d => !d.body && d.star.id === e.star.id)) drawn.push({ star: e.star, sx, sy, r: 12 });
      }
      ctx.globalAlpha = 1;
    }
    // Jump range.
    if (s > .8 && s < SYSTEM_TO * 2 && !o.deep()) {
      const [hx, hy] = toScreen(here.x, here.y);
      ctx.globalAlpha = 1 - smooth(Math.log(SYSTEM_FROM), Math.log(SYSTEM_TO * 2), ls);
      ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(201,244,204,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx, hy, range * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    drawLabels(stars, sysA);
    updateChrome();
  }

  function drawSystem(st, alpha) {
    const sys = systemOf(st), known = isVisited(st), s = view.scale, k = sys.chartScale;
    const [cx, cy] = toScreen(st.x, st.y);
    if (cx < -SYSTEM_RADIUS * s * 1.2 || cx > w + SYSTEM_RADIUS * s * 1.2 || cy < -SYSTEM_RADIUS * s * 1.2 || cy > h + SYSTEM_RADIUS * s * 1.2) return;
    const survey = st.id === here.id ? o.survey() : null;
    ctx.lineWidth = 1;
    for (const b of sys.bodies) {
      const parent = b.parent && sys.bodies.find(p => p.id === b.parent);
      const [bx, by] = bodyXY(st, sys, b), [sx, sy] = toScreen(bx, by);
      if (parent) {
        const [px, py] = toScreen(...bodyXY(st, sys, parent)), orbitPx = Math.hypot(sx - px, sy - py);
        if (orbitPx > 6) { ctx.globalAlpha = alpha * .35 * smooth(6, 20, orbitPx); ctx.strokeStyle = '#9fb7c4'; ctx.beginPath(); ctx.arc(px, py, orbitPx, 0, Math.PI * 2); ctx.stroke(); }
      } else {
        ctx.globalAlpha = alpha * (known ? .32 : .18); ctx.strokeStyle = known ? '#9fb7c4' : '#6f7f88';
        if (!known) ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.arc(cx, cy, Math.hypot(b.position[0], b.position[2]) * k * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      const r = clamp(b.radius / 190 * (2.4 + s / 500), 2, 11) * (parent ? .7 : 1);
      ctx.globalAlpha = alpha;
      if (b.ringed && known) { ctx.strokeStyle = b.atmosphere; ctx.beginPath(); ctx.ellipse(sx, sy, r * 2, r * .7, -.35, 0, Math.PI * 2); ctx.stroke(); }
      // Life, marked as on the galaxy chart: dashed for microbes, bolder for animals, violet if exotic.
      const level = known ? LIFE_RANK[b.physics?.life] || 0 : 0;
      if (level) { ctx.strokeStyle = isExotic(b) ? EXOTIC_RING : SCAN[level].color; ctx.lineWidth = level === 3 ? 2 : 1.2; ctx.setLineDash(level === 1 ? [2, 3] : []); ctx.beginPath(); ctx.arc(sx, sy, r + 3.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
      ctx.fillStyle = known ? b.palette[2] : '#7d8a90';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      if (known) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(sx + r * .35, sy + r * .25, r * .85, -.6, 2.2); ctx.fill(); }
      if (survey && b.id === survey.activeId) { ctx.fillStyle = '#c9f4cc'; diamond(sx, sy - r - 9, 5); }
      if (selected.body && selected.body.id === b.id && selected.star.id === st.id) { ctx.strokeStyle = '#c9f4cc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      drawn.push({ star: st, body: b, sx, sy, r: Math.max(r + 4, 10) });
    }
    ctx.globalAlpha = 1;
  }
  function diamond(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * .85, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * .85, y); ctx.closePath(); ctx.fill(); }

  function drawLabels(stars, sysA) {
    const s = view.scale;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    // Star names.
    if (s >= LOCAL_SCALE * .8) {
      ctx.font = `500 ${s > SYSTEM_FROM ? 12 : 10}px system-ui, sans-serif`;
      let count = 0;
      for (const d of drawn) {
        if (d.body || d.star.id === here.id || (selected.star.id === d.star.id && !selected.body)) continue;
        const important = inRange.has(d.star.id) || isVisited(d.star) || s > 20;
        if (!important || ++count > 90) continue;
        const height = s < SYSTEM_FROM ? heightWords(heightOf(d.star)) : '';
        ctx.fillStyle = 'rgba(200,215,210,.75)'; ctx.fillText(nameOf(d.star), d.sx + d.r * .6 + 6, d.sy);
        if (height) { const w = ctx.measureText(nameOf(d.star)).width; ctx.fillStyle = 'rgba(160,180,175,.55)'; ctx.fillText(` · ${height}`, d.sx + d.r * .6 + 6 + w, d.sy); }
      }
    }
    // Planet names in known systems.
    if (sysA > .5 && s > 180) {
      ctx.font = '500 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const d of drawn) if (d.body && isVisited(d.star) && (!d.body.parent || s > 1400)) {
        ctx.fillStyle = selected.body?.id === d.body.id && selected.star.id === d.star.id ? '#edf5ee' : 'rgba(200,215,210,.8)';
        ctx.fillText(d.body.name, d.sx, d.sy + d.r + 2);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    }
    // Selected star.
    if (!selected.body && selected.star.id !== here.id && s > REAL_FROM) {
      const [sx, sy] = toScreen(selected.star.x, selected.star.y), d = drawn.find(e => !e.body && e.star.id === selected.star.id), r = (d?.r || 6) + 4;
      ctx.strokeStyle = '#c9f4cc'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#edf5ee'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(nameOf(selected.star), sx + r + 6, sy);
    }
    // In deep space: the ship between the stars, and its course.
    const deep = o.deep();
    if (deep) {
      const [px, py] = toScreen(deep.position[0], deep.position[1]);
      if (deep.course) {
        const [cx, cy] = toScreen(deep.course.x, deep.course.y);
        ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(201,244,204,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = '#c9f4cc'; diamond(px, py, 7);
      ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('YOU · DEEP SPACE', px, py + 10);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    }
    // You are here.
    else if (s < SYSTEM_TO) {
      const [hx, hy] = toScreen(here.x, here.y);
      ctx.globalAlpha = 1 - smooth(Math.log(SYSTEM_FROM), Math.log(SYSTEM_TO), Math.log(s));
      ctx.fillStyle = '#c9f4cc'; diamond(hx, hy, 7);
      ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(s >= LOCAL_SCALE * .8 ? `${nameOf(here)} · YOU` : 'YOU ARE HERE', hx, hy + 10);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.globalAlpha = 1;
    } else {
      const d = drawn.find(e => !e.body && e.star.id === here.id);
      if (d) { ctx.fillStyle = 'rgba(237,245,238,.85)'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(`${nameOf(here)} · YOU ARE HERE`, d.sx + d.r + 8, d.sy - d.r - 4); }
    }
  }

  function centreStar() {
    let best = null, bd = Infinity;
    for (const d of drawn) if (!d.body) { const dd = Math.hypot(d.sx - w / 2, d.sy - h / 2); if (dd < bd) { bd = dd; best = d.star; } }
    return best;
  }
  function updateChrome() {
    const s = view.scale;
    let title = 'THE GALAXY', sub = `${Math.max(1, state.visited.size)} star${state.visited.size > 1 ? 's' : ''} visited · ${state.jumps} jump${state.jumps === 1 ? '' : 's'}`;
    if (s >= SYSTEM_FROM) { const c = centreStar(); if (c) { title = `${nameOf(c).toUpperCase()} SYSTEM`; sub = isVisited(c) ? `${systemOf(c).bodies.length} worlds · ${starPhysics(c).spectralClass} star` : `Unsurveyed · ${systemOf(c).bodies.length} worlds detected`; } }
    else if (s >= REAL_FROM) { const alive = targets.filter(t => biosignature(systemOf(t.star))).length; title = 'STELLAR NEIGHBOURHOOD'; sub = `${targets.length} stars within jump range (${range.toFixed(1)} ly; faint stars lie far above or below you) · ${alive ? `signs of life at ${alive} (green rings; violet where the chemistry is not water-based)` : 'no signs of life in range'}${radio.length ? ` · radio signals from ${radio.length} civilization${radio.length > 1 ? 's' : ''} (gold)` : ''}`; }
    $('mapTitle').textContent = title; $('mapSubtitle').textContent = sub;
    $('mapScale').textContent = `${fmtLy(w / s)} across · drag to pan · scroll or pinch to zoom · double-tap a star to open its system`;
  }

  // --- Navigation ---
  function zoomAt(sx, sy, factor) {
    anim = null;
    const [wx, wy] = toWorld(sx, sy);
    view.scale = clamp(view.scale * factor, minScale(), MAX_SCALE);
    view.x = wx - (sx - w / 2) / view.scale; view.y = wy + (sy - h / 2) / view.scale;
    requestDraw();
  }
  // Fly so the target's on-screen offset shrinks smoothly while zoom changes in log space.
  function flyTo(x, y, scale, ms = 900) {
    scale = clamp(scale, minScale(), MAX_SCALE);
    ({ x, y } = focusView(x, y, scale));
    const from = { ...view }, t0 = performance.now(), off = [(x - from.x) * from.scale, (y - from.y) * from.scale];
    const token = anim = {};
    (function step(now) {
      if (anim !== token) return;
      const t = Math.min(1, (now - t0) / ms), e = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      view.scale = Math.exp(Math.log(from.scale) + (Math.log(scale) - Math.log(from.scale)) * e);
      view.x = x - off[0] * (1 - e) / view.scale; view.y = y - off[1] * (1 - e) / view.scale;
      draw();
      if (t < 1) requestAnimationFrame(step); else anim = null;
    })(t0);
  }
  const flyToStar = (star) => flyTo(star.x, star.y, systemScale());
  function flyToBody(star, body) { const sys = systemOf(star), [x, y] = bodyXY(star, sys, body); flyTo(x, y, Math.max(view.scale, body.parent ? systemScale() * 6 : systemScale() * 1.6)); }

  function select(star, body = null) {
    selected = { star, body };
    if (body && star.id === here.id) o.onSelectBody(body);
    updatePanel(); requestDraw();
    document.body.classList.remove('map-panel-collapsed');
  }
  function hit(sx, sy) {
    let best = null, bd = Infinity;
    for (const d of drawn) { const dd = Math.hypot(d.sx - sx, d.sy - sy) - (d.body ? 4 : 0); if (dd < d.r + 8 && dd < bd) { bd = dd; best = d; } }
    return best;
  }
  function tap(sx, sy, double) {
    const d = hit(sx, sy);
    if (d) { select(d.star, d.body || null); if (double) d.body ? flyToBody(d.star, d.body) : flyToStar(d.star); }
    else if (view.scale < REAL_FROM) { const [x, y] = toWorld(sx, sy); flyTo(x, y, view.scale * 4, 600); }
    else if (double) zoomAt(sx, sy, 2.5);
  }

  const pointers = new Map(); let moved = 0, pinch = null, lastTap = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); moved = 0; anim = null;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale }; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId); if (!prev) return;
    const cur = { x: e.offsetX, y: e.offsetY }; pointers.set(e.pointerId, cur);
    if (pointers.size === 1) { const dx = cur.x - prev.x, dy = cur.y - prev.y; moved += Math.abs(dx) + Math.abs(dy); view.x -= dx / view.scale; view.y += dy / view.scale; requestDraw(); }
    else if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()]; moved += 10; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist / view.scale); }
  });
  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    if (pointers.size === 1 && moved < 6 && e.type === 'pointerup') { const now = performance.now(); tap(e.offsetX, e.offsetY, now - lastTap < 320); lastTap = now; }
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
  };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018))); }, { passive: false });
  $('mapZoomIn').onclick = () => zoomAt(w / 2, h / 2, 2);
  $('mapZoomOut').onclick = () => zoomAt(w / 2, h / 2, .5);
  $('mapViewGalaxy').onclick = () => flyTo(0, 0, minScale(), 1100);
  $('mapViewLocal').onclick = () => flyTo(here.x, here.y, LOCAL_SCALE);
  $('mapViewSystem').onclick = () => { select(here, null); flyToStar(here); };
  $('closeStarMap').onclick = () => dialog.close();
  $('mapPanelToggle').onclick = () => document.body.classList.toggle('map-panel-collapsed');

  // --- Side panel ---
  function updatePanel() {
    const { star, body } = selected, sys = systemOf(star), known = isVisited(star), isHere = star.id === here.id, p = starPhysics(star);
    const btn = $('mapAction'); let note = '';
    if (body) {
      const parent = body.parent && sys.bodies.find(b => b.id === body.parent);
      if (known) {
        const survey = isHere ? o.survey() : readSurvey(sys.seed), status = body.giant ? (survey.visited?.has(body.id) ? 'visited' : 'not yet visited') : survey.records.has(body.id) ? 'signal recorded' : survey.visited?.has(body.id) ? 'visited' : 'unidentified surface signal';
        $('mapKicker').textContent = `${body.type.toUpperCase()}${parent ? ` · MOON OF ${parent.name.toUpperCase()}` : ''}`;
        const civ = civOf(body), seenCiv = civ && survey.traces?.[body.id];
        const intelligence = seenCiv ? `Intelligence: ${civ.description}` : radioWorld(body) ? 'Artificial radio signals come from this world.' : '';
        $('mapName').textContent = body.name; $('mapDescription').textContent = [body.description, rarityText(body), intelligence].filter(Boolean).join(' '); $('mapFacts').textContent = `${body.facts} · ${status}`;
        // Plant life: how many species, and the ones you have catalogued on foot.
        const plants = floraFor(body).species, seen = new Set(survey.flora?.[body.id] || []);
        if (plants.length) {
          const names = plants.filter(sp => seen.has(sp.id)).map(sp => sp.name);
          $('mapFacts').textContent += ` · ${seen.size} of ${plants.length} plant species catalogued`;
          if (names.length) $('mapDescription').textContent += ` Catalogued: ${names.join(', ')}.`;
        }
        const animals = faunaFor(body).species, observed = new Set(survey.fauna?.[body.id] || []);
        if (animals.length) {
          const names = animals.filter(sp => observed.has(sp.id)).map(sp => `${sp.name} (${sp.mind})`);
          $('mapFacts').textContent += ` · ${observed.size} of ${animals.length} animal species observed`;
          if (names.length) $('mapDescription').textContent += ` Observed: ${names.join(', ')}.`;
        }
      } else {
        $('mapKicker').textContent = `UNKNOWN ${parent ? 'MOON' : 'WORLD'} · ${nameOf(star).toUpperCase()}`;
        $('mapName').textContent = 'Unsurveyed world'; $('mapDescription').textContent = 'Long-range sensors only show its orbit. Jump to this system to learn what it is.'; $('mapFacts').textContent = '';
      }
      if (isHere) {
        const c = o.cruise(body); btn.disabled = !c.enabled; btn.textContent = c.label; note = c.note || '';
        btn.onclick = () => { if (!btn.disabled) o.onCruise(body); };
      } else { btn.disabled = true; btn.textContent = 'Jump to this system first'; btn.onclick = null; note = inRange.has(star.id) ? 'It is within jump range: select the star to jump.' : ''; }
    } else {
      $('mapKicker').textContent = `${p.spectralClass} STAR · ${isHere ? (o.deep() ? 'LAST SYSTEM' : 'YOU ARE HERE') : known ? 'VISITED' : 'UNVISITED'}`;
      $('mapName').textContent = nameOf(star);
      if (known) {
        const best = sys.bodies.slice().sort((a, b) => LIFE_RANK[b.physics.life] - LIFE_RANK[a.physics.life] || b.physics.habitability - a.physics.habitability)[0];
        const living = sys.bodies.filter(b => LIFE_RANK[b.physics?.life]).length;
        $('mapDescription').textContent = `${sys.bodies.length} worlds${living ? `, ${living} with life` : ''}. Most promising: ${best.name}, ${best.type.toLowerCase()} · ${lifeLabel(best.physics).toLowerCase()}.${rarityText(best) ? ` ${rarityText(best)}` : ''}`;
      } else if (inRange.has(star.id)) $('mapDescription').textContent = `Long-range scan: ${sys.bodies.length} worlds. ${SCAN[biosignature(sys)].text}${exoticLife(sys) ? ' Some of it is chemistry that does not run on water (violet ring).' : ''}${signals(sys) ? ' Artificial radio signals detected (gold ring): a civilization lives here.' : ''}`;
      else $('mapDescription').textContent = heardFrom(star) ? `${sys.bodies.length} worlds. Beyond scanner range, but someone here is broadcasting.` : `${sys.bodies.length} worlds. Beyond scanner range: jump closer to look for signs of life.`;
      const heard = heardFrom(star);
      if (heard) $('mapDescription').textContent += ` Radio signals: ${LEVEL_NAMES[heard.level]} live here, ${heard.distance.toFixed(0)} light years from ${nameOf(here)}.${inRange.has(star.id) || isHere ? '' : ' Too far for one jump: set a course and fly, or jump closer star by star.'}`;
      const lum = p.luminosity < .01 ? p.luminosity.toFixed(4) : p.luminosity.toFixed(2);
      $('mapFacts').textContent = `${p.temperature} K · ${p.mass.toFixed(2)} M☉ · ${lum} L☉ · ${p.age.toFixed(1)} billion years${isHere ? '' : ` · ${starDistance(star, here).toFixed(1)} ly away${heightWords(heightOf(star)) ? `, ${heightWords(heightOf(star))} you` : ''}`}`;
      const reachable = inRange.has(star.id), ready = o.canJump();
      btn.disabled = isHere || !reachable || !ready;
      btn.textContent = isHere ? 'You are here' : !reachable ? `Beyond jump range (${range.toFixed(1)} ly)` : ready ? `Jump to ${nameOf(star)} ↗` : 'Jump drive not ready';
      btn.onclick = () => { if (!btn.disabled) o.onJump(star, nameOf(star)); };
      // Any star can also be flown to: set a course and leave the system.
      const courseBtn = $('mapCourse'), deep = o.deep(), coursed = deep?.course?.id === star.id || o.course?.()?.id === star.id;
      courseBtn.hidden = isHere && !deep && !offChart();
      courseBtn.disabled = false;
      courseBtn.textContent = coursed ? 'Clear course ×' : `${deep ? 'Fly' : 'Set course'} to ${nameOf(star)} ↗`;
      courseBtn.onclick = () => { if (coursed) { o.clearCourse(); updatePanel(); } else o.onCourse(star); };
      if (deep) {
        btn.hidden = true;
        const ly = Math.hypot(star.x - deep.position[0], star.y - deep.position[1], star.z - deep.position[2]);
        note = `${ly.toFixed(1)} ly from your position. The star drive slows as you near a star, so arrivals are gentle.`;
      } else btn.hidden = false;
      if (!deep) note = isHere ? (offChart() ? 'Off-chart test system, placed at your last charted star. Jump, or set a course and fly out.' : 'Double-tap a star, or a world in the list, to zoom in.') : !reachable ? 'Out of range. Jump to a nearer star first and work your way toward it.' : ready ? '' : o.blockedReason();
    }
    if (body) { $('mapCourse').hidden = true; btn.hidden = false; }
    $('mapNote').textContent = note;
    // Worlds of the selected system.
    const list = $('mapWorlds'); list.replaceChildren();
    $('mapWorldsHeading').textContent = `WORLDS OF ${nameOf(star).toUpperCase()}`;
    if (!known) { const empty = document.createElement('p'); empty.className = 'map-note'; empty.textContent = `${sys.bodies.length} worlds detected. Visit to survey them.`; list.append(empty); }
    else {
      const survey = isHere ? o.survey() : readSurvey(sys.seed);
      const ordered = sys.bodies.filter(b => !b.parent).flatMap(pl => [pl, ...sys.bodies.filter(m => m.parent === pl.id)]);
      for (const b of ordered) {
        const row = document.createElement('button'); row.className = 'world-row' + (body?.id === b.id ? ' selected' : '') + (b.parent ? ' moon' : '');
        const tag = [survey.records.has(b.id) ? 'RECORDED' : isHere && b.id === survey.activeId ? 'HERE' : survey.visited?.has(b.id) ? 'VISITED' : '',
          SCAN[LIFE_RANK[b.physics?.life] || 0].tag, isExotic(b) ? 'EXOTIC' : '',
          survey.traces?.[b.id] && civOf(b) ? LEVEL_NAMES[civOf(b).level].toUpperCase() : radioWorld(b) ? 'SIGNALS' : ''].filter(Boolean).join(' · ');
        row.innerHTML = `<i style="background:${b.palette[2]}"></i><span><strong></strong><small></small></span><em>${tag}</em>`;
        row.querySelector('strong').textContent = b.name; row.querySelector('small').textContent = `${b.type} · ${lifeLabel(b.physics).toLowerCase()}`;
        row.onclick = () => { select(star, b); flyToBody(star, b); };
        list.append(row);
      }
    }
    // Jump targets.
    const jl = $('mapJumps'); jl.replaceChildren();
    for (const t of targets) {
      const tp = starPhysics(t.star), row = document.createElement('button');
      row.className = 'world-row' + (!body && star.id === t.star.id ? ' selected' : '');
      row.innerHTML = `<i style="background:${tp.color}"></i><span><strong></strong><small>${tp.spectralClass} star · ${t.distance.toFixed(1)} ly${heightWords(heightOf(t.star)) ? ` · ${heightWords(heightOf(t.star))}` : ''}</small></span><em>${[state.visited.has(t.star.id) ? 'VISITED' : '', SCAN[biosignature(systemOf(t.star))].tag, exoticLife(systemOf(t.star)) ? 'EXOTIC' : '', signals(systemOf(t.star)) ? 'SIGNALS' : ''].filter(Boolean).join(' · ')}</em>`;
      row.querySelector('strong').textContent = nameOf(t.star);
      row.onclick = () => { select(t.star); flyTo(t.star.x, t.star.y, Math.max(LOCAL_SCALE, Math.min(view.scale, SYSTEM_FROM * .6))); };
      jl.append(row);
    }
    // Radio sources heard from here, nearest first.
    const rl = $('mapRadio'); rl.replaceChildren();
    $('mapRadioHeading').textContent = !radioDone ? 'RADIO SIGNALS · LISTENING…' : `RADIO SIGNALS · ${radio.length} HEARD WITHIN ${SCAN_RADIUS} LY`;
    if (radioDone && !radio.length) { const p = document.createElement('p'); p.className = 'map-note'; p.textContent = `No artificial signals. Planet-shapers are heard out to ${HEARD[4]} ly, spacefarers out to ${HEARD[5]} ly.`; rl.append(p); }
    for (const e of radio) {
      const tp = starPhysics(e.star), row = document.createElement('button');
      row.className = 'world-row' + (!body && star.id === e.star.id ? ' selected' : '');
      row.innerHTML = `<i style="background:${tp.color}"></i><span><strong></strong><small>${LEVEL_NAMES[e.level]} · ${e.distance.toFixed(0)} ly</small></span><em>${[state.visited.has(e.id) ? 'VISITED' : '', inRange.has(e.id) ? 'IN RANGE' : ''].filter(Boolean).join(' · ')}</em>`;
      row.querySelector('strong').textContent = nameOf(e.star);
      row.onclick = () => { select(e.star); flyTo(e.star.x, e.star.y, Math.max(LOCAL_SCALE * .5, Math.min(view.scale, SYSTEM_FROM * .6))); };
      rl.append(row);
    }
  }

  // Start listening shortly after the game loads, so the map is ready when you open it.
  setTimeout(scanRadio, 1500);

  return {
    open(mode = 'local') {
      scanRadio();
      if (!dialog.open) dialog.showModal();
      resize();
      if (mode === 'system') {
        const b = o.selectedBody();
        selected = { star: here, body: b || null };
        Object.assign(view, focusView(here.x, here.y, systemScale()));
      } else if (o.deep()) {
        const p = o.deep().position;
        if (!selected.star || selected.body) selected = { star: o.deep().course || targets[0]?.star || here, body: null };
        Object.assign(view, focusView(p[0], p[1], LOCAL_SCALE));
      } else {
        if (selected.star.id === here.id && !selected.body && targets[0]) selected = { star: targets[0].star, body: null };
        Object.assign(view, focusView(here.x, here.y, LOCAL_SCALE));
      }
      updatePanel(); draw();
    },
    close() { dialog.close(); },
    get isOpen() { return dialog.open; },
    resize() { if (dialog.open) { resize(); requestDraw(); } },
    refresh() { if (dialog.open) { updatePanel(); requestDraw(); } },
    // After flying into another system: it becomes "here" for jumps and the panel.
    setHere(star, sys) {
      here = star;
      systems.set(star.id, sys);
      ({ range, targets } = jumpTargets(here));
      inRange = new Set(targets.map(t => t.star.id));
      selected = { star: targets[0]?.star || here, body: null };
      scanRadio();
    },
  };
}
