// The codex overview (K, or the CODEX button): everything you have recorded, as a
// gallery of pictures (thumbs.js) with names, where each was found and how rare it is
// (rarity.mjs). Filter by kind or rarity, sort by newest, rarest or name, and tap any
// record for its picture, description and facts. Each record is rebuilt from its seed
// (the galaxy is fixed), so nothing but the codex entries themselves is saved.
//
//   const ui = createCodexUI({ codex, THREE, onOpen() });   ui.open() · ui.close() · ui.toggle() · ui.isOpen
import { generateSystem } from './system.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { geologyFor } from './geology.mjs';
import { civilizationOf, colonistOf } from './civilizations.mjs';
import { BEHAVIOURS } from './ecology.mjs';
import { PHENOMENA } from './phenomena.mjs';
import { RARITIES, RARITY_COLOURS, rarityOf, rarityAtLeast } from './rarity.mjs';
import { createThumbs } from './thumbs.js';
import { buildCrew, suitUp } from './fauna-mesh.js';
import { buildGeometry as plantGeometry } from './flora-mesh.js';
import { formationModel } from './geology-mesh.js';
import { shipDesign, buildShip } from './ships.js';
import { rng } from './rng.mjs';
import { plural } from './structures.mjs';

const CSS = `
#codex{width:min(1100px,96vw);max-width:none;height:min(860px,92vh);padding:24px 26px 18px;display:none;flex-direction:column}
#codex[open]{display:flex}
#codex .close{position:absolute;top:14px;right:18px;z-index:2}
#codex h2{margin:6px 0 2px}
.cx-summary{margin:0 0 10px;font-size:11px}
.cx-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
.cx-bar button{font-size:10px;padding:6px 10px;border-radius:14px;letter-spacing:.5px}
.cx-bar button.on{background:#c9f4cc22;border-color:#c9f4cc88;color:var(--mint)}
.cx-bar .cx-sep{flex:1}
.cx-bar select{background:#0d1b24;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:5px 8px;font:10px 'DM Sans',sans-serif}
.cx-rar button{border-color:var(--rc)!important;color:var(--rc)}
.cx-rar button.on{background:color-mix(in srgb,var(--rc) 18%,transparent)}
.cx-body{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;min-height:0;flex:1}
.cx-grid{overflow-y:auto;display:grid;grid-auto-rows:max-content;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;align-content:start;padding:2px 4px 10px 2px}
.cx-card{display:flex;flex-direction:column;text-align:left;padding:0;border-radius:8px;overflow:hidden;border:1px solid var(--line);background:#0b1820;position:relative}
.cx-card.sel{outline:2px solid var(--mint);outline-offset:1px}
.cx-card .cx-pic{flex:none;aspect-ratio:1;width:100%;background:radial-gradient(circle at 50% 60%,#1c3036,#0a141b 70%);display:block;object-fit:contain}
.cx-card .cx-pic.wait{animation:cxpulse 1.4s infinite}
@keyframes cxpulse{50%{opacity:.6}}
.cx-card strong{font-size:11px;font-weight:500;padding:7px 9px 0;line-height:1.3;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-card small{font-size:9px;color:var(--muted);padding:2px 9px 8px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-card i{position:absolute;top:6px;left:6px;font-style:normal;font-size:8px;letter-spacing:1px;text-transform:uppercase;padding:3px 6px;border-radius:8px;background:#071017cc;border:1px solid var(--rc);color:var(--rc)}
.cx-card.legendary{border-color:#ffd36b88;box-shadow:0 0 14px #ffd36b33}
.cx-detail{overflow-y:auto;background:#0a171ecc;border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.cx-detail img{width:100%;max-height:220px;aspect-ratio:1;object-fit:contain;background:radial-gradient(circle at 50% 60%,#1c3036,#0a141b 70%);border-radius:8px}
.cx-detail h3{font:400 22px 'Space Grotesk',sans-serif;color:var(--ink);margin:10px 0 4px}
.cx-detail .cx-r{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--rc)}
.cx-detail p{font-size:12px;line-height:1.7}
.cx-detail dl{grid-template-columns:96px 1fr;gap:6px 10px;font-size:11px}
.cx-detail dt{color:var(--muted)}
.cx-empty{grid-column:1/-1;color:var(--muted);font-size:12px;padding:30px 0;text-align:center}
.cx-back{display:none}
@media(max-width:760px){#codex{width:100vw;height:92vh;margin:auto 0 0;border-radius:14px 14px 0 0;padding:18px 14px 12px}
 .cx-body{grid-template-columns:1fr}.cx-detail{display:none}.cx-body.show .cx-grid{display:none}.cx-body.show .cx-detail{display:block}
 .cx-back{display:inline-block;margin-bottom:8px;font-size:10px;padding:6px 10px;border-radius:12px}
 .cx-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}}
`;
const KINDS = [
  ['all', 'All'], ['fauna', 'Animals'], ['flora', 'Plants'], ['geology', 'Rocks & landforms'], ['behaviour', 'Behaviour'],
  ['sky', 'Sky'], ['civ', 'Civilizations'], ['world', 'Worlds'], ['signal', 'Signals'],
];
const GROUP = { fauna: 'fauna', flora: 'flora', formation: 'geology', core: 'geology', behaviour: 'behaviour', phenomenon: 'sky', settlement: 'civ', station: 'civ', contact: 'civ', world: 'world', signal: 'signal', 'field-note': 'signal' };
const KIND_WORD = { fauna: 'Animal', flora: 'Plant', formation: 'Formation', core: 'Core sample', behaviour: 'Behaviour', phenomenon: 'Sky event', settlement: 'Settlement', station: 'Station', contact: 'Contact', world: 'World', signal: 'Radio source', 'field-note': 'Surface signal' };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const key = (e) => `${e.kind}|${e.seed}|${e.bodyId}|${e.id}`;

// --- Rebuilding a record from its seed --------------------------------------------
const systems = new Map();
const systemOf = (seed) => { if (!systems.has(seed)) { if (systems.size > 60) systems.clear(); systems.set(seed, generateSystem(Number(seed))); } return systems.get(seed); };
function speciesOn(sys, body, id) {
  if (!body) return null;
  const sp = faunaFor(body).species.find((s) => s.id === id);
  if (sp) return sp;
  if (id?.endsWith('-colonist')) { const col = colonistOf(sys, body); if (col) return suitUp(col.species); }
  return null;
}
const civOfId = (id) => { const [seed, bodyId] = String(id).split(':'); try { const sys = systemOf(seed), b = sys.bodies.find((x) => x.id === bodyId); return b ? civilizationOf(b) : null; } catch { return null; } };
export function resolve(e) {
  const out = { e, kind: e.kind, rarity: rarityOf(e), name: e.traits?.name || e.world?.name || e.id, where: e.world?.name || '', facts: [], text: '' };
  let sys = null, body = null;
  try { if (e.seed && e.bodyId) { sys = systemOf(e.seed); body = sys.bodies.find((b) => b.id === e.bodyId); } } catch {}
  out.system = sys?.name; out.body = body;
  if (body) out.facts.push(['Found on', `${body.name}${sys ? `, ${sys.name} system` : ''}`]);
  const w = e.world || {};
  if (w.biochemistry && !['water', 'carbon'].includes(w.biochemistry)) out.facts.push(['Chemistry', `${cap(w.biochemistry)}-based`]);
  switch (e.kind) {
    case 'fauna': {
      const sp = speciesOn(sys, body, e.id); out.species = sp;
      out.text = sp?.description || '';
      out.facts.unshift(['Body', cap(e.traits.plan)], ['Diet', cap(e.traits.diet)], ['Active', cap(e.traits.activity)]);
      if (sp?.size) out.facts.push(['Size', `About ${sp.size < 1 ? sp.size.toFixed(1) : Math.round(sp.size)} m`]);
      if (e.traits.mind) out.facts.push(['Mind', cap(e.traits.mind)]);
      break;
    }
    case 'flora': { const sp = body && floraFor(body).species.find((s) => s.id === e.id); out.plant = sp; out.text = sp?.description || ''; out.facts.unshift(['Form', cap(e.traits.form)]); if (sp?.height) out.facts.push(['Height', `${sp.height < 2 ? sp.height.toFixed(1) : Math.round(sp.height)} m`]); break; }
    case 'formation': case 'core': { const f = body && geologyFor(body).formations.find((x) => x.id === e.id); out.formation = f; out.text = (e.kind === 'core' ? `A deep core drilled from ${f?.name?.toLowerCase() ?? 'the rock'}. ` : '') + (f?.description || ''); out.facts.unshift(['Type', f?.type === 'rock' ? 'Rock' : 'Landform']); if (e.kind === 'core') out.name = `${f?.name ?? 'Rock'}: deep core`; break; }
    case 'behaviour': { const [sid, b] = e.id.split(/:(?=[a-z]+$)/); const sp = speciesOn(sys, body, sid); out.species = sp; out.name = `${sp?.name ?? 'An animal'}: ${BEHAVIOURS[b]?.name?.toLowerCase() ?? b}`; out.text = `You watched a ${sp?.name ?? 'creature'} ${BEHAVIOURS[b]?.verb ?? b}.`; out.facts.unshift(['Behaviour', BEHAVIOURS[b]?.name ?? b]); break; }
    case 'phenomenon': { const t = e.traits.type; out.name = `${e.traits.total ? 'Total ' : ''}${PHENOMENA[t]?.name ?? t}${body ? ` over ${body.name}` : ''}`; out.text = { eclipse: e.traits.total ? 'The star went out entirely behind a moon: day turned to dusk and the animals bedded down.' : 'A moon slid across the star and the light dimmed.', aurora: 'Curtains of light rippled across the night sky.', meteors: 'Streaks of fire crossed the night sky, one after another.' }[t] || ''; break; }
    case 'settlement': { const civ = body && (civilizationOf(body) || colonistOf(sys, body)); out.civ = civ; out.name = civ?.species ? `${plural(civ.species.name)}` : 'A settlement'; out.text = civ?.description || ''; out.facts.unshift(['Builders', cap(e.traits.tier)]); if (civ?.path) out.facts.push(['Path', cap(civ.path)]); break; }
    case 'station': { const civ = civOfId(e.id); out.civ = civ; out.name = `${e.traits?.name ?? 'Their'} station`; out.text = `A station of the ${civ?.species ? plural(civ.species.name) : 'builders'}, with a landing deck you walked on.${civ?.ark ? ` They also live aboard ${civ.arkName}.` : ''}`; out.facts.unshift(['Builders', cap(e.traits.tier)]); if (e.traits.stance) out.facts.push(['Toward you', cap(e.traits.stance)]); break; }
    case 'contact': { const civ = civOfId(e.id.replace(/:[a-z]+$/, '')); out.civ = civ; out.name = `The ${civ?.species ? plural(civ.species.name) : 'strangers'}`; out.text = `Your relationship with them: ${e.traits.step}.`; out.facts.unshift(['Step', cap(e.traits.step)], ['Builders', cap(e.traits.tier)]); break; }
    case 'world': out.text = body?.description || ''; out.facts.unshift(['Type', body?.type ?? (w.giant ? 'Giant' : 'World')], ['Life', cap(w.life || 'none')]); break;
    case 'signal': out.name = `Radio voice (${e.traits?.tier ?? 'unknown'})`; out.text = 'An artificial signal heard across the light years: someone out there is talking.'; out.facts.unshift(['From', cap(e.traits?.tier) || 'Unknown']); break;
    case 'field-note': out.name = `Surface signal on ${body?.name ?? 'a world'}`; out.text = body?.message || 'A signal you followed to the surface and investigated.'; break;
  }
  return out;
}

// --- Pictures ------------------------------------------------------------------------
function picture(THREE, thumbs, r) {
  const e = r.e, k = key(e);
  return thumbs.get(k, ({ model, paint }) => {
    const sp = r.species || r.civ?.species;
    if ((e.kind === 'fauna' || e.kind === 'behaviour' || e.kind === 'settlement' || e.kind === 'contact') && sp) {
      const crew = buildCrew(THREE, sp, 1, 'thumb'), m = new THREE.Matrix4();
      if (e.kind === 'behaviour' && /:(sleep)$/.test(e.id)) m.makeTranslation(0, -sp.size * .1, 0);
      crew.set(0, m, e.kind === 'behaviour' && /:(hunt|kill|defend)$/.test(e.id) ? 1.2 : .6, e.kind === 'behaviour' && /:hunt$/.test(e.id) ? 1 : 0); crew.commit();
      return model(crew.group);
    }
    if (e.kind === 'station' && r.civ) {
      const g = new THREE.Group();
      buildShip(THREE, shipDesign(r.civ), (geo, m, colour, bright) => { const mesh = new THREE.Mesh(geo, bright ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshStandardMaterial({ color: colour, flatShading: true, roughness: .5, metalness: .2 })); mesh.applyMatrix4(m); g.add(mesh); }, new THREE.Matrix4(), 1);
      return model(g);
    }
    if (e.kind === 'flora' && r.plant && r.body) {
      const geo = plantGeometry(THREE, r.plant, rng(r.body.seed, 'plants', r.plant.id), { bloom: !!r.plant.bloom && !['none', 'seeds'].includes(r.plant.bloom) });
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8 });
      if (r.plant.glow > 0) { mat.emissive = new THREE.Color(r.plant.colors.accent).lerp(new THREE.Color(r.plant.colors.leaf), .4); mat.emissiveIntensity = r.plant.glow * .35; }
      return model(new THREE.Mesh(geo, mat));
    }
    if ((e.kind === 'formation' || e.kind === 'core') && r.formation && r.body) {
      const f = formationModel(THREE, r.body, r.formation), g = new THREE.Group();
      g.add(new THREE.Mesh(f.lit, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: r.formation.glassy ? .3 : .9, metalness: r.formation.shape === 'meteorite' ? .6 : 0 })));
      if (f.glow) g.add(new THREE.Mesh(f.glow, new THREE.MeshBasicMaterial({ vertexColors: true })));
      return model(g);
    }
    return paint((ctx, S) => paintRecord(ctx, S, r));
  });
}
// Worlds, sky events and signals, painted.
function paintRecord(ctx, S, r) {
  const e = r.e, b = r.body, c = S / 2;
  const bg = ctx.createRadialGradient(c, c * 1.1, 4, c, c, S * .7); bg.addColorStop(0, '#1c3036'); bg.addColorStop(1, '#0a141b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  const stars = rng(key(e), 'stars'); ctx.fillStyle = '#ffffffaa'; for (let i = 0; i < 40; i++) ctx.fillRect(stars() * S, stars() * S, 1, 1);
  if (e.kind === 'world' && b) {
    const R = S * (b.giant ? .38 : .32), pal = b.palette || ['#555', '#777', '#999', '#bbb'];
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
    if (b.giant) { for (let i = 0; i < 14; i++) { ctx.fillStyle = pal[i % pal.length]; ctx.fillRect(c - R, c - R + i * R * 2 / 14, R * 2, R * 2 / 14 + 1); } }
    else { ctx.fillStyle = pal[1]; ctx.fillRect(c - R, c - R, R * 2, R * 2); const g = rng(b.seed, 'thumb'); for (let i = 0; i < 26; i++) { ctx.fillStyle = pal[Math.floor(g() * pal.length)]; ctx.beginPath(); ctx.ellipse(c - R + g() * R * 2, c - R + g() * R * 2, R * (.15 + g() * .35), R * (.08 + g() * .2), g() * 3, 0, Math.PI * 2); ctx.fill(); } }
    const shade = ctx.createLinearGradient(c - R, c - R, c + R, c + R); shade.addColorStop(0, '#ffffff22'); shade.addColorStop(.55, '#00000000'); shade.addColorStop(1, '#000000cc'); ctx.fillStyle = shade; ctx.fillRect(c - R, c - R, R * 2, R * 2);
    ctx.restore();
    if (b.physics?.pressure > .03) { ctx.strokeStyle = (b.atmosphere || '#8cf') + '99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, R + 2, 0, Math.PI * 2); ctx.stroke(); }
    if (b.ringed) { ctx.strokeStyle = '#e8dcc0aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c, c, R * 1.7, R * .35, -.35, 0, Math.PI * 2); ctx.stroke(); }
    return;
  }
  if (e.kind === 'phenomenon') {
    const t = e.traits.type;
    if (t === 'eclipse') {
      const glow = ctx.createRadialGradient(c, c, S * .1, c, c, S * .4); glow.addColorStop(0, '#fff6d8'); glow.addColorStop(.35, e.traits.total ? '#ffe7a8cc' : '#ffd98a'); glow.addColorStop(1, '#ffd98a00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#05080c'; ctx.beginPath(); ctx.arc(c + (e.traits.total ? 0 : S * .06), c, S * .17, 0, Math.PI * 2); ctx.fill();
    } else if (t === 'aurora') {
      ctx.fillStyle = '#05101a'; ctx.fillRect(0, S * .75, S, S * .25);
      for (let k = 0; k < 3; k++) { const g = ctx.createLinearGradient(0, S * .2, 0, S * .75); g.addColorStop(0, '#7dffb000'); g.addColorStop(.6, ['#7dffb0aa', '#9f8bffaa', '#6fe3ffaa'][k]); g.addColorStop(1, '#7dffb000'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, S * .75); for (let x = 0; x <= S; x += 8) ctx.lineTo(x, S * (.25 + k * .07) + Math.sin(x * .05 + k * 2) * S * .06); ctx.lineTo(S, S * .75); ctx.fill(); }
    } else {
      ctx.fillStyle = '#05101a'; ctx.fillRect(0, S * .8, S, S * .2);
      const g = rng(key(e), 'm'); ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x = g() * S, y = g() * S * .5, l = S * (.12 + g() * .2), grad = ctx.createLinearGradient(x, y, x + l, y + l * .6); grad.addColorStop(0, '#ffffff00'); grad.addColorStop(1, '#fff3cf'); ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + l * .6); ctx.stroke(); }
    }
    return;
  }
  // Signals: waves from a beacon.
  ctx.strokeStyle = e.kind === 'signal' ? '#ffd98a' : '#c9f4cc'; ctx.lineWidth = 3;
  for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 1 - i * .2; ctx.beginPath(); ctx.arc(c, c * 1.25, i * S * .1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(c, c * 1.25, 6, 0, Math.PI * 2); ctx.fill();
}

// --- The screen ----------------------------------------------------------------------
export function createCodexUI({ codex, THREE, onOpen = () => {} }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const h = (tag, attrs = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c)); return el; };
  const thumbs = createThumbs(THREE);
  const button = h('button', { id: 'codexBtn', class: 'map-open', title: 'Codex (K)', 'aria-label': 'Open the codex', onclick: () => toggle() }, '◈', h('span', {}, 'CODEX'), h('kbd', {}, 'K'));
  (document.getElementById('upgradesBtn') || document.getElementById('helpBtn'))?.before(button);
  const summary = h('p', { class: 'cx-summary' }), kinds = h('div', { class: 'cx-bar' }), rar = h('div', { class: 'cx-bar cx-rar' }), grid = h('div', { class: 'cx-grid' }), detail = h('div', { class: 'cx-detail' }), body = h('div', { class: 'cx-body' }, grid, detail);
  const sort = h('select', { 'aria-label': 'Sort', onchange: () => render() }, h('option', { value: 'new' }, 'Newest first'), h('option', { value: 'rare' }, 'Rarest first'), h('option', { value: 'name' }, 'By name'));
  const dialog = h('dialog', { id: 'codex', 'aria-label': 'Codex' },
    h('button', { class: 'close', 'aria-label': 'Close the codex', onclick: () => dialog.close() }, '×'),
    h('div', { class: 'eyebrow' }, 'CODEX'), h('h2', {}, 'Everything you have recorded'), summary, kinds, rar, body);
  document.body.append(dialog);
  dialog.addEventListener('close', () => thumbs.clearQueue());
  let kind = 'all', minRarity = 'common', selected = null;

  const records = () => {
    // One card per thing; contact steps fold into the highest reached with each civilization.
    const best = new Map();
    const list = [];
    codex.entries.forEach((e, i) => {
      if (e.kind === 'contact') { const civ = e.id.replace(/:[a-z]+$/, ''), prev = best.get(civ); const order = ['contact', 'trust', 'friendship']; if (!prev || order.indexOf(e.traits.step) > order.indexOf(prev.e.traits.step)) best.set(civ, { e, i }); return; }
      list.push({ e, i });
    });
    return [...list, ...best.values()];
  };
  const observer = new IntersectionObserver((items) => {
    for (const it of items) if (it.isIntersecting) { observer.unobserve(it.target); it.target._load?.(); }
  }, { root: grid, rootMargin: '200px' });

  function render() {
    const all = records().map((x) => ({ ...x, r: resolveCached(x.e) }));
    const counts = Object.fromEntries(RARITIES.map((g) => [g, all.filter((x) => x.r.rarity === g).length]));
    summary.textContent = `${all.length} records · ${counts.rare + counts.exceptional + counts.legendary} rare finds${counts.legendary ? ` · ${counts.legendary} legendary` : ''}. Rarer things are worth more to other civilizations, and the upgrade line asks for some.`;
    kinds.replaceChildren(...KINDS.map(([id, label]) => { const n = id === 'all' ? all.length : all.filter((x) => GROUP[x.e.kind] === id).length; return n || id === 'all' ? h('button', { class: kind === id ? 'on' : '', onclick: () => { kind = id; render(); } }, `${label} ${n}`) : null; }), h('span', { class: 'cx-sep' }), sort);
    rar.replaceChildren(...RARITIES.map((g) => h('button', { class: minRarity === g ? 'on' : '', style: `--rc:${RARITY_COLOURS[g]}`, onclick: () => { minRarity = minRarity === g ? 'common' : g; render(); } }, `${g === 'common' ? 'All' : `${cap(g)}${g === 'legendary' ? '' : '+'}`} ${g === 'common' ? '' : RARITIES.slice(RARITIES.indexOf(g)).reduce((a, x) => a + counts[x], 0)}`)));
    let shown = all.filter((x) => (kind === 'all' || GROUP[x.e.kind] === kind) && rarityAtLeast(x.r.rarity, minRarity));
    if (sort.value === 'new') shown.sort((a, b) => b.i - a.i);
    else if (sort.value === 'rare') shown.sort((a, b) => RARITIES.indexOf(b.r.rarity) - RARITIES.indexOf(a.r.rarity) || b.i - a.i);
    else shown.sort((a, b) => a.r.name.localeCompare(b.r.name));
    grid.replaceChildren();
    if (!shown.length) grid.append(h('div', { class: 'cx-empty' }, codex.entries.length ? 'Nothing recorded of this kind yet.' : 'Nothing recorded yet. Land, step outside and scan what you find (hold E).'));
    for (const x of shown) {
      const r = x.r, img = h('img', { class: 'cx-pic wait', alt: '' });
      const card = h('button', { class: `cx-card ${r.rarity}${selected === key(x.e) ? ' sel' : ''}`, style: `--rc:${RARITY_COLOURS[r.rarity]}`, onclick: () => { selected = key(x.e); for (const c of grid.querySelectorAll('.sel')) c.classList.remove('sel'); card.classList.add('sel'); show(r); } },
        img, h('i', {}, r.rarity), h('strong', {}, r.name), h('small', {}, `${KIND_WORD[x.e.kind] || x.e.kind}${r.where ? ` · ${r.where}` : ''}`));
      img._load = () => picture(THREE, thumbs, r).then((url) => { if (url) { img.src = url; img.classList.remove('wait'); } });
      grid.append(card); observer.observe(img);
    }
    const sel = shown.find((x) => key(x.e) === selected) || shown[0];
    if (sel) { selected = key(sel.e); grid.querySelector('.cx-card')?.classList.toggle('sel', key(shown[0].e) === selected); show(sel.r, false); } else detail.replaceChildren();
  }
  const resolved = new Map();
  const resolveCached = (e) => { const k = key(e); if (!resolved.has(k)) resolved.set(k, resolve(e)); return resolved.get(k); };
  function show(r, open = true) {
    const img = h('img', { alt: r.name });
    picture(THREE, thumbs, r).then((url) => { if (url) img.src = url; });
    detail.replaceChildren(
      h('button', { class: 'cx-back', onclick: () => body.classList.remove('show') }, '← All records'),
      img, h('div', { class: 'cx-r', style: `--rc:${RARITY_COLOURS[r.rarity]}` }, `${r.rarity} · ${KIND_WORD[r.kind] || r.kind}`),
      h('h3', {}, r.name), r.text ? h('p', {}, r.text) : null,
      r.facts.length ? h('dl', {}, r.facts.flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)])) : null);
    if (open) body.classList.add('show');
  }
  function open() { if (dialog.open) return; onOpen(); selected = null; render(); body.classList.remove('show'); dialog.showModal(); }
  const close = () => dialog.close();
  const toggle = () => (dialog.open ? close() : open());
  return { open, close, toggle, get isOpen() { return dialog.open; } };
}
