// Test mode: install or remove any upgrade, and travel to worlds where each effect can be tried.
// Switch it on with ?dev in the URL (it stays on across jumps and reloads); ?dev=0 switches it off.
// A DEV button appears at the left edge; the ° key also opens the panel.
// Your real save is copied aside the first time test mode changes it, and "Restore my save" puts it back.
// game.js calls setupDev({ codex, system, star, body, onChange, toast }) once everything else exists.
import { MAIN, SIDE, CHAPTERS } from './upgrades.mjs';
import { generateSystem } from './system.mjs';
import { starsNear } from './galaxy.mjs';
import { terrainFor } from './terrain.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { civilizationOf } from './civilizations.mjs';
import { worldEntries } from './objectives.mjs';
import { STORE } from './codex.mjs';

const FLAG = 'elsewhere-dev', BACKUP = `${STORE}-before-dev`;
export function devEnabled() {
  const p = new URLSearchParams(location.search.replace(/(?!^)\?/g, '&')).get('dev'); // ?dev, &dev, or a stray second ?dev
  try {
    if (p === '0') localStorage.removeItem(FLAG);
    else if (p !== null) localStorage.setItem(FLAG, '1');
    return localStorage.getItem(FLAG) === '1';
  } catch { return p !== null && p !== '0'; }
}
// Read once, when this module is first imported: game.js rewrites the URL (?star=…) soon after.
const ON = devEnabled();

// Places to try each effect: the nearest world that has it, searched outward from here.
const hasSea = (b, kind) => { const t = terrainFor(b); return t.liquid === kind && (kind !== 'water' || (t.solvent ?? 'water') === 'water'); };
const PLACES = [
  { label: 'Life: plants and animals', tries: 'Field glasses, Life sonar, Night filter, Behaviour logger', test: (b) => floraFor(b).species.length > 2 && faunaFor(b).species.length > 1 },
  { label: 'Stalkers', tries: 'Suit plating', test: (b) => faunaFor(b).species.some((s) => s.ecology?.stalksYou) },
  { label: 'Colder than −80 °C', tries: 'Thermal lining', test: (b) => b.physics.temperature < 193 },
  { label: 'Hotter than 80 °C', tries: 'Thermal lining', test: (b) => b.physics.temperature > 353 },
  { label: 'Lava seas', tries: 'Heat plating (land off the pad, near lava)', test: (b) => hasSea(b, 'lava') },
  { label: 'Water seas', tries: 'Petrel (land on the water)', test: (b) => hasSea(b, 'water') },
  { label: 'A settlement', tries: 'Xenolinguistics and Contact, later', test: (b) => !!civilizationOf(b) },
];

export function setupDev({ codex, system, star, body, onChange, toast }) {
  if (!ON) return;
  const css = document.createElement('style');
  css.textContent = `
#devBtn{position:fixed;left:0;top:46%;z-index:20;padding:8px 6px;border-radius:0 6px 6px 0;font:600 9px ui-monospace,monospace;letter-spacing:2px;writing-mode:vertical-rl;background:#3a1d4ccc;border-color:#d39bff66;color:#efd9ff}
#devPanel{position:fixed;left:0;top:0;bottom:0;width:min(330px,92vw);z-index:21;overflow:auto;padding:16px 16px 40px;background:#120d1c;border-right:1px solid #d39bff44;font:12px 'DM Sans',sans-serif;color:#eee}
#devPanel[hidden]{display:none}
#devPanel h3{font-size:10px;letter-spacing:2px;color:#d39bff;margin:18px 0 6px}
#devPanel label{display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer}
#devPanel label small{margin-left:auto;font-size:9px;color:#9a8fae}
#devPanel .row{display:flex;gap:6px;flex-wrap:wrap}
#devPanel button{padding:6px 9px;border-radius:4px;font-size:11px}
#devPanel .place{display:block;width:100%;text-align:left;margin:4px 0;padding:7px 9px}
#devPanel .place small{display:block;color:#9a8fae;font-size:10px;margin-top:2px}
#devPanel p{color:#9a8fae;font-size:10px;line-height:1.5;margin:6px 0}`;
  document.head.append(css);
  const btn = Object.assign(document.createElement('button'), { id: 'devBtn', textContent: 'DEV' });
  const panel = Object.assign(document.createElement('aside'), { id: 'devPanel', hidden: true });
  document.body.append(btn, panel);
  // Clicks and keys inside the panel stay in the panel.
  for (const ev of ['pointerdown', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());

  const backup = () => { try { if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, localStorage.getItem(STORE) || 'null'); } catch {} };
  const changed = (note) => { onChange(); render(); if (note) toast(note, 3); };
  const STATUS = { live: '', partial: 'partly built', planned: 'not built yet' };

  let places = null; // found lazily, a few systems at a time
  function findPlaces() {
    places = PLACES.map((p) => ({ ...p, found: null }));
    const near = starsNear(star, 60).sort((a, b) => a.distance - b.distance).slice(0, 60);
    let i = 0;
    (function step() {
      for (const end = Math.min(i + 4, near.length); i < end; i++) {
        const st = near[i].star, sys = st.id === star.id ? system : generateSystem(st.seed);
        for (const pl of places) if (!pl.found) {
          const b = sys.bodies.find((x) => !x.giant && x.physics && pl.test(x));
          if (b) pl.found = { star: st, body: b, distance: near[i].distance };
        }
      }
      if (!panel.hidden) render();
      if (i < near.length && places.some((p) => !p.found)) setTimeout(step, 0);
      else for (const p of places) p.done = true;
    })();
  }

  function render() {
    const installed = codex.unlocked;
    panel.replaceChildren();
    const h = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; panel.append(e); return e; };
    const top = h('div', null, 'row');
    top.innerHTML = '<strong style="flex:1;font:600 11px ui-monospace,monospace;letter-spacing:2px;color:#d39bff">TEST MODE</strong>';
    const close = Object.assign(document.createElement('button'), { textContent: '×' });
    close.onclick = () => (panel.hidden = true);
    top.append(close);
    h('p', 'Installed upgrades take effect at once. Your own save is kept aside; "Restore my save" brings it back. ?dev=0 in the URL turns test mode off.');
    const actions = h('div', null, 'row');
    const action = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; actions.append(b); };
    action('Install all', () => { backup(); codex.setUnlocked([...MAIN, ...SIDE].map((u) => u.id)); changed('All upgrades installed.'); });
    action('Remove all', () => { backup(); codex.setUnlocked([]); changed('All upgrades removed.'); });
    action('Document this world', () => {
      backup();
      const b = body(), list = worldEntries(system, b);
      let n = 0;
      for (const e of list) if (e.kind !== 'settlement' && codex.add(e)) n++;
      changed(`${b.name}: ${n} new codex entries. It now counts as fully documented (Return beacons, tasks).`);
    });
    action('Restore my save', () => {
      try {
        const saved = localStorage.getItem(BACKUP);
        if (saved === null) return toast('Test mode has not changed your save.', 3);
        if (saved === 'null') localStorage.removeItem(STORE); else localStorage.setItem(STORE, saved);
        localStorage.removeItem(BACKUP);
        location.reload();
      } catch {}
    });
    const group = (title, list) => {
      h('h3', title);
      for (const u of list) {
        const l = h('label');
        const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: installed.has(u.id) });
        box.onchange = () => {
          backup();
          if (box.checked) codex.unlock(u.id); else codex.lock(u.id);
          changed(`${u.name} ${box.checked ? 'installed' : 'removed'}.`);
        };
        const name = document.createElement('span');
        name.textContent = u.line === 'side' ? `${u.name} (after ${[...MAIN, ...SIDE].find((x) => x.id === u.opensAt)?.name ?? '?'})` : `${u.order}. ${u.name}`;
        const note = document.createElement('small');
        note.textContent = STATUS[u.status];
        l.append(box, name, note);
        l.title = u.effect;
      }
    };
    for (const c of CHAPTERS) group(`MAIN LINE · ${c.name.toUpperCase()}`, MAIN.filter((u) => u.chapter === c.id));
    group('SIDE UPGRADES', SIDE);
    h('h3', 'WORLDS TO TRY THEM ON');
    h('p', 'The nearest world for each. Travelling reloads the game there; press Begin, then fly down.');
    if (!places) findPlaces();
    for (const p of places) {
      const b = h('button', null, 'place');
      const f = p.found, here = f && f.star.id === star.id && f.body.id === body().id;
      b.innerHTML = `${p.label}<small></small>`;
      b.lastChild.textContent = f ? `${f.body.name}${f.star.id === star.id ? ' (this system)' : ` · ${f.distance.toFixed(0)} ly`} · tries ${p.tries}${here ? ' · you are here' : ''}` : p.done ? 'none within 60 ly' : 'searching…';
      b.disabled = !f || here;
      if (f) b.onclick = () => { location.href = `?star=${encodeURIComponent(f.star.id)}&world=${encodeURIComponent(f.body.id)}`; };
    }
  }

  const toggle = () => { panel.hidden = !panel.hidden; if (!panel.hidden) { document.exitPointerLock?.(); render(); } };
  btn.onclick = toggle;
  // Matched by the character typed (e.key), so it is whichever key gives ° on your keyboard layout.
  window.addEventListener('keydown', (e) => { if (e.key === '°' && !e.repeat) toggle(); });
}
