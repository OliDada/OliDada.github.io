// How the inside of a home looks (interior.js): surfaces painted on small canvases, by
// what the house is made of (boards, stone blocks, smooth plaster, weave, wax cells,
// packed earth, shell), rugs and hangings in the household's own colours with patterns of
// their own (rings, dots, spirals, chevrons, scales), soft lamplight glows, and the
// cluttered things of daily life (pots, bowls, stacked tablets, potted plants, crystals).
// Canvases only exist in a browser: under node every texture is null and plain colours stand in.
import { rng } from './rng.mjs';

const S = 256;
const canvasOk = () => typeof document !== 'undefined';
const hex = (c) => '#' + c.getHexString();

// What a culture builds its walls (and floors) of.
export function surfaceOf(civ) {
  const c = civ.culture, f = civ.family;
  const wall = { timber: 'planks', stilts: 'planks', tracks: 'planks', terraced: 'plaster', tents: 'woven', silk: 'woven', trapdoor: 'earth', kelpweave: 'woven', hive: 'cells', mounds: 'earth', burrows: 'earth', earthworks: 'earth', shells: 'shell', conch: 'shell', coral: 'shell', polyp: 'shell', domes: 'plaster', living: 'shell', rings: 'blocks', stiltpods: 'shell', perches: 'woven', rookery: 'woven', hanging: 'woven' }[c] || (civ.level >= 3 ? 'plaster' : 'blocks');
  if (civ.level >= 5) return { wall: ['shells', 'conch', 'coral', 'living', 'hive', 'silk'].includes(c) ? 'shell' : 'panels', floor: 'tiles' }; // those who reach space live in modern rooms
  const floor = civ.level >= 3 ? 'tiles' : ['earth', 'cells'].includes(wall) || f === 'grazers' || f === 'burrowers' ? 'earth' : wall === 'planks' ? 'planks' : 'blocks';
  return { wall, floor };
}

export function createLook(THREE, { seed, colours }) {
  const r = rng(seed, 'look'), made = [];
  const C = (h, d = '#888') => new THREE.Color(h || d);
  const tex = (draw, repeat = [1, 1]) => {
    if (!canvasOk()) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    draw(cv.getContext('2d'));
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    made.push(t); return t;
  };
  const shade = (base, k) => hex(C(base).multiplyScalar(k));
  const noise = (g, base, n = 900, a = .08) => { for (let i = 0; i < n; i++) { g.fillStyle = r() < .5 ? `rgba(0,0,0,${a * r()})` : `rgba(255,255,255,${a * .7 * r()})`; const s = 1 + r() * 3; g.fillRect(r() * S, r() * S, s, s); } };

  const SURFACES = {
    planks(g, base) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        g.fillStyle = shade(base, .8 + r() * .35); g.fillRect(i * S / n, 0, S / n, S);
        g.strokeStyle = `rgba(0,0,0,.12)`; g.lineWidth = 1;
        for (let k = 0; k < 7; k++) { g.beginPath(); const x = i * S / n + 4 + r() * (S / n - 8); g.moveTo(x, 0); g.bezierCurveTo(x + 6 * (r() - .5), S * .3, x + 6 * (r() - .5), S * .7, x, S); g.stroke(); }
        if (r() < .6) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(i * S / n + S / n / 2, r() * S, 3, 5, 0, 0, 7); g.fill(); } // a knot
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(i * S / n, 0, 2, S);
      }
      noise(g, base, 400, .05);
    },
    blocks(g, base) {
      g.fillStyle = shade(base, .55); g.fillRect(0, 0, S, S);
      const rows = 6, h = S / rows;
      for (let y = 0; y < rows; y++) { const off = (y % 2) * .5; for (let x = -1; x < 4; x++) { const w = S / 3.2; g.fillStyle = shade(base, .82 + r() * .3); g.fillRect((x + off) * w + 3, y * h + 3, w - 6, h - 6); } }
      noise(g, base, 1400, .1);
    },
    plaster(g, base) {
      g.fillStyle = shade(base, 1); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${.03 + r() * .04})`; g.beginPath(); g.arc(r() * S, r() * S, 10 + r() * 40, 0, 7); g.fill(); }
      noise(g, base, 600, .05);
    },
    woven(g, base) {
      g.fillStyle = shade(base, .7); g.fillRect(0, 0, S, S);
      const n = 16, w = S / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const over = (x + y) % 2; g.fillStyle = shade(base, over ? 1.05 : .85);
        if (over) g.fillRect(x * w + 1, y * w + 3, w - 2, w - 6); else g.fillRect(x * w + 3, y * w + 1, w - 6, w - 2);
      }
      noise(g, base, 300, .05);
    },
    cells(g, base) {
      g.fillStyle = shade(base, .45); g.fillRect(0, 0, S, S);
      const rad = S / 8;
      for (let y = -1; y < 6; y++) for (let x = -1; x < 6; x++) {
        const cx = x * rad * 1.73 + (y % 2) * rad * .866, cy = y * rad * 1.5;
        const grd = g.createRadialGradient(cx, cy, 2, cx, cy, rad); grd.addColorStop(0, shade(base, 1.25)); grd.addColorStop(1, shade(base, .8));
        g.fillStyle = grd; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * rad * .9, cy + Math.sin(a) * rad * .9); } g.fill();
      }
    },
    earth(g, base) {
      g.fillStyle = shade(base, .9); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${.04 + r() * .05})`; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 30, 4 + r() * 10, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 70; i++) { g.fillStyle = shade(base, .6 + r() * .7); g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 3, 0, 7); g.fill(); } // pebbles
      noise(g, base, 1200, .08);
    },
    shell(g, base) {
      const grd = g.createLinearGradient(0, 0, 0, S);
      for (let k = 0; k <= 8; k++) grd.addColorStop(k / 8, shade(base, .85 + .25 * Math.sin(k * 1.7) * Math.sin(k * .6)));
      g.fillStyle = grd; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(255,255,255,.12)'; for (let k = 0; k < 14; k++) { g.beginPath(); const y = r() * S; g.moveTo(0, y); g.bezierCurveTo(S * .3, y + 12 * (r() - .5), S * .7, y + 12 * (r() - .5), S, y); g.stroke(); }
    },
    panels(g, base) {
      g.fillStyle = shade(base, 1.05); g.fillRect(0, 0, S, S);
      const grd = g.createLinearGradient(0, 0, 0, S); grd.addColorStop(0, 'rgba(255,255,255,.08)'); grd.addColorStop(1, 'rgba(0,0,0,.1)'); g.fillStyle = grd; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(0,0,0,.28)'; for (let x = 0; x <= S; x += S / 2) g.fillRect(x - 1, 0, 2, S); g.fillRect(0, S * .62, S, 2);
      g.fillStyle = 'rgba(255,240,210,.55)'; g.fillRect(0, S * .64, S, 3); // a strip of light along the wall
      noise(g, base, 250, .03);
    },
    tiles(g, base) {
      const n = 4, w = S / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = shade(base, (x + y) % 2 ? .9 : 1.08); g.fillRect(x * w, y * w, w, w); }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, S); g.moveTo(0, i * w); g.lineTo(S, i * w); g.stroke(); }
      noise(g, base, 400, .04);
    },
  };
  // A wall or floor surface; vertical ones repeat round the room.
  const surface = (kind, base, repeat) => tex((g) => (SURFACES[kind] || SURFACES.plaster)(g, base), repeat);

  // A motif in the household's colours: rings, dots, spirals, chevrons or scales.
  const motif = r.int ? ['rings', 'dots', 'spiral', 'chevrons', 'scales'][r.int(0, 4)] : 'rings';
  const palette = [colours.accent, colours.accent2 || colours.trim, colours.bag || colours.trim, colours.wall2 || '#333'].map((h) => C(h));
  function pattern(g, w, h, round) {
    const [a, b, c, d] = palette.map(hex);
    g.fillStyle = d; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    if (round) for (let k = 7; k > 0; k--) { g.fillStyle = [a, c, b][k % 3]; g.beginPath(); g.arc(cx, cy, (k / 7) * w * .49, 0, 7); g.fill(); }
    switch (motif) {
      case 'dots': for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h; g.fillStyle = [a, b, c][i % 3]; g.beginPath(); g.arc(x, y, 3 + r() * 6, 0, 7); g.fill(); } break;
      case 'spiral': g.strokeStyle = b; g.lineWidth = 6; g.beginPath(); for (let t = 0; t < 40; t += .1) { const rr = t * Math.min(w, h) / 90; g.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); } g.stroke(); break;
      case 'chevrons': g.strokeStyle = a; g.lineWidth = 7; for (let y = 10; y < h; y += 28) { g.beginPath(); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + ((x / 24) % 2) * 14); g.stroke(); } break;
      case 'scales': for (let y = 0; y < h + 20; y += 18) for (let x = 0; x < w + 20; x += 22) { g.fillStyle = (x / 22 + y / 18) % 3 < 1 ? a : (x / 22 + y / 18) % 3 < 2 ? b : c; g.beginPath(); g.arc(x + (y / 18 % 2) * 11, y, 11, 0, Math.PI); g.fill(); } break;
      default: g.strokeStyle = b; g.lineWidth = 5; for (let k = 1; k < 6; k++) { g.beginPath(); g.arc(cx, cy, k * Math.min(w, h) / 12, 0, 7); g.stroke(); }
    }
    g.strokeStyle = a; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    if (round) { g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.arc(cx, cy, w * .49, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  }
  const rug = () => tex((g) => pattern(g, S, S, true));
  const banner = () => tex((g) => { pattern(g, S, S, false); g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < S; x += 16) g.fillRect(x, S - 14, 8, 14); });
  // A soft round glow (lamps, the hearth) for an additive sprite.
  const glowTex = (() => { if (!canvasOk()) return null; return tex((g) => { const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.25, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, S, S); }); })();
  return { surface, rug, banner, glowTex, motif, dispose() { for (const t of made) t.dispose(); } };
}

// Darker toward the floor and the ceiling (where light doesn't reach): vertex colours for a wall.
export function shadeWall(THREE, geo, H) {
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / H + .5, k = .55 + .45 * Math.min(1, y * 4) * Math.min(1, (1 - y) * 3 + .35); col.push(k, k, k); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// Things of daily life on a shelf or table: pots, bowls, stacked tablets, a plant, a crystal.
export function clutter(THREE, r, u, colours, level) {
  const g = new THREE.Group(), items = [];
  const pot = (h, w) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(w * (.55 + .45 * Math.sin(t * Math.PI * .95 + .2)) * (t > .9 ? .8 : 1), t * h)); } return new THREE.LatheGeometry(pts, 10); };
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const kind = r(), x = (i - (n - 1) / 2) * .26 * u;
    if (kind < .4) items.push([pot((.16 + r() * .14) * u, (.07 + r() * .05) * u), i % 2 ? colours.pot : colours.accent, x, 0, 0]);
    else if (kind < .55) items.push([new THREE.SphereGeometry(.1 * u, 10, 5, 0, 7, Math.PI / 2, Math.PI / 2).translate(0, .1 * u, 0), colours.bag || colours.trim, x, 0, 0]);
    else if (kind < .72) for (let k = 0; k < 3; k++) items.push([new THREE.BoxGeometry(.18 * u, .03 * u, .13 * u), [colours.accent, colours.trim, colours.accent2][k % 3], x, (k * .035 + .015) * u, 0, r() * .4]);
    else if (kind < .88) { items.push([pot(.1 * u, .06 * u), colours.pot, x, 0, 0]); items.push([new THREE.IcosahedronGeometry(.09 * u, 0), colours.leaf || '#4fa83a', x, .16 * u, 0]); }
    else items.push([new THREE.OctahedronGeometry(.07 * u, 0).scale(1, 1.8, 1), level >= 3 ? colours.window : colours.accent, x, .12 * u, 0, 0, true]);
  }
  return items; // [geometry, colour, x, y, z, ry?, glows?]
}
