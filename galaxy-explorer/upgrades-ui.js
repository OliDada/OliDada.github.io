// The upgrade screen (U) and the HUD research panel (#guide, top right).
//
// The screen draws the upgrade line as a picture: chapters (Kestrel, Petrel,
// Albatross), the main line down the middle, side upgrades branching to the left.
// Tap any upgrade for its card: what it does, its tasks, the nearest place for each
// task (Show on map), and, when the research is done, a hold-to-install button.
// The next main upgrade is always being researched; one side upgrade may be too.
//
//   const ui = createUpgradeScreen({ codex, touch, onUnlock(id), onOpen(), places(id, done), showOnMap(place) });
//   ui.open(id?) · ui.close() · ui.toggle() · ui.refresh() · ui.setMode(mode) · ui.setPlaces(id, list) · ui.isOpen
//   places(id, done): game.js finds the nearest place per task (objectives.mjs), calls
//   ui.setPlaces(id, [{ text, mappable, starId, bodyId } | null per task]), then done()
import { UPGRADES, MAIN, SIDE, CHAPTERS, GEAR, progress, activeResearch, prerequisite, hint } from './upgrades.mjs';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
// h('p', { class: 'x' }, 'text', child) -> element. Text is always set as text.
function h(tag, attrs = {}, ...children) {
  const el = ['svg', 'path', 'circle'].includes(tag) ? document.createElementNS(SVG, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
// Small line icons for each kind of gear (24×24, drawn in the current colour).
// 'C x y r' is a circle; anything else is a path.
const ICONS = {
  ship: ['M12 3c3 2.2 5 6 5 10l-2 3H9l-2-3c0-4 2-7.8 5-10z', 'M9 16l-2 4M15 16l2 4M12 16v5', 'C 12 10 1.6'],
  suit: ['M5 14a7 7 0 0 1 14 0v4H5z', 'M8 12.5h8v3H8z', 'M9 18v2M15 18v2'],
  scanner: ['M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3', 'M7 12h10'],
  vehicle: ['M10 10.5h4v3h-4z', 'M10 10.5L7 7.5M14 10.5l3-3M10 13.5l-3 3M14 13.5l3 3', 'C 6 6.5 2', 'C 18 6.5 2', 'C 6 17.5 2', 'C 18 17.5 2'],
  knowledge: ['M5 6h14v9h-8l-4 3.5V15H5z', 'M8.5 9.5h7M8.5 12h4.5'],
};
const icon = (gear) => h('svg', { viewBox: '0 0 24 24', class: 'up-icon', 'aria-hidden': 'true' },
  ICONS[gear].map((d) => {
    if (!d.startsWith('C ')) return h('path', { d });
    const [, cx, cy, r] = d.split(' ');
    return h('circle', { cx, cy, r });
  }));
const STATUS = {
  live: null,
  partial: (u) => `Partly built: ${u.built}.`,
  planned: () => 'Its effect is not built yet: it is on the roadmap (PROGRESSION.md).',
};
const spreadText = (n) => n.spread.map((s) => `${s.have} of ${s.need} ${s.label}`).join(' · ');
const fraction = (p) => p.needs.reduce((a, n) => a + (n.done ? 1 : (n.have / n.count + n.spread.reduce((b, s) => b + s.have / s.need, 0)) / (1 + n.spread.length)), 0) / p.needs.length;
const stateOf = (p) => (p.installed ? 'installed' : p.ready ? 'ready' : p.researching ? 'researching' : p.available ? 'available' : 'locked');
const doneCount = (p) => p.needs.filter((n) => n.done).length;

// A button that has to be held until its bar fills (pointer, or Space/Enter).
// Letting go early drains the bar again. done() runs once it is full.
function holdButton(label, done, ms = 1200) {
  const b = h('button', { class: 'primary hold' }, h('span', {}, label));
  let start = null, raf = 0, p = 0;
  const set = () => b.style.setProperty('--fill', p.toFixed(3));
  const step = (now) => {
    p = Math.min(1, (now - start) / ms); set();
    if (p < 1) { raf = requestAnimationFrame(step); return; }
    start = null; b.classList.add('done'); b.firstChild.textContent = 'Installed ✓';
    setTimeout(done, 450);
  };
  const press = (e) => {
    if (start != null || b.classList.contains('done')) return;
    e?.preventDefault?.(); b.classList.add('holding');
    start = performance.now() - p * ms; raf = requestAnimationFrame(step);
  };
  const release = () => {
    if (start == null) return;
    cancelAnimationFrame(raf); start = null; b.classList.remove('holding');
    const drain = () => { if (start != null || b.classList.contains('done')) return; p = Math.max(0, p - .05); set(); if (p > 0) requestAnimationFrame(drain); };
    drain();
  };
  b.addEventListener('pointerdown', press);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, release);
  b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); });
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') release(); });
  b.addEventListener('click', (e) => e.preventDefault());
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

export function createUpgradeScreen({ codex, onUnlock, onOpen, touch = false, places, showOnMap }) {
  // --- DOM: header button, dialog, HUD guide -----------------------------------------
  const button = h('button', { id: 'upgradesBtn', class: 'map-open', title: 'Upgrades (U)', 'aria-label': 'Open upgrades' },
    '⬡', h('span', {}, 'UPGRADES'), h('kbd', {}, 'U'), h('i', { class: 'up-badge', hidden: true }));
  $('helpBtn').before(button);
  const tree = h('div', { class: 'up-tree' }), detail = h('div', { class: 'up-detail', 'aria-live': 'polite' });
  const layout = h('div', { class: 'up-layout' }, detail, tree);
  const dialog = h('dialog', { id: 'upgrades', 'aria-label': 'Upgrades' },
    h('button', { class: 'close', 'aria-label': 'Close upgrades', onclick: () => dialog.close() }, '×'),
    h('div', { class: 'eyebrow' }, 'UPGRADES'),
    h('h2', {}, 'What you document builds your gear.'),
    layout);
  document.body.append(dialog);
  const guide = $('guide');
  let state = {}, selected = null, mode = 'flight', guideKey = '', placeCache = new Map(), asked = new Set();
  button.onclick = () => toggle();
  const askPlaces = (id) => {
    if (placeCache.has(id) || asked.has(id) || !places) return;
    asked.add(id);
    places(id, () => { asked.delete(id); renderGuide(true); if (dialog.open && selected === id) renderDetail(); });
  };

  // --- The line ------------------------------------------------------------------------
  function node(p, side = false) {
    const u = p.upgrade, st = stateOf(p);
    const words = st === 'installed' ? 'installed' : st === 'ready' ? 'ready to install' : st === 'researching' ? `researching · ${doneCount(p)} of ${p.needs.length}` : st === 'available' ? 'can be researched' : 'locked';
    return h('button', {
      class: `up-node ${st}${side ? ' side' : ''}${selected === u.id ? ' selected' : ''}`, 'aria-label': `${u.name}: ${words}`,
      onclick: () => { selected = u.id; render(); if (innerWidth <= 760) detail.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
    }, h('span', { class: 'up-dot' }, icon(u.gear)),
    h('span', { class: 'up-text' }, h('strong', {}, u.name), h('small', {}, `${GEAR[u.gear].name} · ${side ? words.replace(/ · .*/, '') : words}`)));
  }
  function renderTree() {
    const rows = [];
    for (const ch of CHAPTERS) {
      const mains = MAIN.filter((u) => u.chapter === ch.id);
      const reached = mains.some((u) => state[u.id].installed || state[u.id].researching);
      rows.push(h('div', { class: `up-chapter${reached ? '' : ' far'}` }, h('span', {}, icon('ship'), ch.name), h('small', {}, ch.blurb)));
      for (const u of mains) {
        const p = state[u.id];
        rows.push(h('div', { class: `up-row${p.installed ? ' lit' : ''}` },
          h('div', { class: 'up-sides' }, SIDE.filter((s) => s.opensAt === u.id).map((s) => node(state[s.id], true))),
          node(p)));
      }
    }
    tree.replaceChildren(...rows);
  }

  // --- The card -------------------------------------------------------------------------
  function placeLine(id, i, n) {
    if (n.done) return null;
    if (n.notYet) return h('small', { class: 'up-hint' }, `Not in the game yet: arrives with ${n.notYet}.`);
    const found = placeCache.get(id), tip = hint(UPGRADES[id].needs[i]);
    if (!found) return h('small', { class: 'up-hint' }, 'Finding the nearest place…');
    const where = found[i];
    if (!where) return tip ? h('small', { class: 'up-hint' }, tip) : null;
    return h('div', { class: 'up-place' },
      h('small', {}, `Nearest: ${where.text}`),
      where.mappable ? h('button', { class: 'secondary', onclick: () => { dialog.close(); showOnMap?.(where); } }, 'Show on map') : null);
  }
  function renderDetail() {
    const p = state[selected], u = p.upgrade, st = stateOf(p), active = activeResearch(codex.unlocked, codex.research);
    const pre = prerequisite(u);
    const where = u.line === 'main' ? `${CHAPTERS.find((c) => c.id === u.chapter).name.toUpperCase()} · STEP ${u.order}` : `SIDE · OPENS AT ${UPGRADES[u.opensAt].name.toUpperCase()}`;
    const status = STATUS[u.status]?.(u);
    let action = null;
    if (st === 'ready') action = holdButton(`Hold to install ${u.name}`, () => unlock(u.id));
    else if (st === 'available' && u.line === 'side')
      action = h('button', { class: 'secondary', onclick: () => { codex.setSide(u.id); refresh(); } }, active.side ? `Research this instead of ${UPGRADES[active.side].name}` : 'Research this');
    if (p.researching) askPlaces(u.id);
    detail.replaceChildren(...[
      h('div', { class: 'up-card-head' }, h('span', { class: `up-dot big ${st}` }, icon(u.gear)),
        h('div', {}, h('div', { class: 'eyebrow' }, `${GEAR[u.gear].name.toUpperCase()} · ${where}`), h('h3', {}, u.name))),
      h('p', { class: 'up-effect' }, u.effect),
      status && h('p', { class: 'up-status' }, status),
      h('p', { class: `up-state ${st}` },
        st === 'installed' ? 'Installed.'
          : st === 'ready' ? 'Research complete. Hold the button to install it.'
            : st === 'researching' ? (u.line === 'main' ? 'Researching now: the next step on the main line.' : 'Researching now, alongside the main line.')
              : st === 'available' ? 'Optional. You can research one side upgrade alongside the main line.'
                : `Locked: install ${UPGRADES[pre].name} first.`),
      st !== 'installed' && h('ul', { class: 'up-tasks' }, p.needs.map((n, i) => h('li', { class: n.done ? 'done' : '' },
        h('span', { class: 'up-check', 'aria-hidden': 'true' }, n.done ? '✓' : ''),
        h('div', {}, h('span', { class: 'up-label' }, n.label),
          n.spread.length && !n.done ? h('small', {}, spreadText(n)) : null,
          p.researching ? placeLine(u.id, i, n) : null),
        h('b', {}, `${n.have}/${n.count}`)))),
      st === 'available' ? h('small', { class: 'up-hint' }, 'Scans you made earlier count too.') : null,
      action && h('div', { class: 'up-actions' }, action)].filter(Boolean));
    if (st === 'ready') setTimeout(() => detail.querySelector('.hold')?.focus(), 0);
  }
  function render() {
    state = progress(codex.entries, codex.unlocked, codex.research);
    if (!state[selected]) selected = activeResearch(codex.unlocked, codex.research).main || MAIN.at(-1).id;
    renderTree();
    renderDetail();
  }

  // --- HUD panel: the research in progress --------------------------------------------
  function renderGuide(force = false) {
    if (!guide) return;
    const documented = codex.entries.some((e) => !['world', 'signal'].includes(e.kind));
    const active = activeResearch(codex.unlocked, codex.research);
    const main = state[active.main], side = state[active.side];
    const firstSteps = !documented && ![...codex.unlocked].some((id) => UPGRADES[id]);
    const key = JSON.stringify([firstSteps, mode === 'walk', active, main?.needs.map((n) => [n.have, n.done]), side?.needs.map((n) => [n.have, n.done]), placeCache.has(active.main)]);
    if (key === guideKey && !force) return;
    guideKey = key;
    const hold = touch ? 'hold the Scan button' : 'hold E';
    const parts = [];
    if (firstSteps) {
      parts.push(h('div', { class: 'eyebrow' }, 'FIRST STEPS'), h('h2', {}, 'Scan what you find'),
        h('p', {}, mode === 'walk' ? `Aim the crosshair at a plant, an animal or a rock nearby. When the ring appears, ${hold} until it fills.` : 'Land and step outside. What you scan is recorded, and what you record builds your gear.'));
    } else if (!main) {
      parts.push(h('div', { class: 'eyebrow' }, 'UPGRADES'), h('h2', {}, 'The main line is complete'));
    } else {
      const u = main.upgrade, ch = CHAPTERS.find((c) => c.id === u.chapter);
      parts.push(h('div', { class: 'eyebrow' }, main.ready ? 'READY TO INSTALL' : 'RESEARCHING', h('span', {}, `${ch.name.toUpperCase()} · STEP ${u.order}`)), h('h2', {}, u.name));
      if (main.ready) parts.push(h('p', {}, u.effect), h('button', { class: 'primary guide-btn', onclick: () => open(u.id) }, 'Install', h('kbd', {}, 'U')));
      else {
        parts.push(h('ul', { class: 'guide-needs' }, main.needs.map((n) => h('li', { class: n.done ? 'done' : '' }, h('span', {}, n.label), h('b', {}, `${n.have}/${n.count}`)))));
        const i = main.needs.findIndex((n) => !n.done), where = placeCache.get(u.id)?.[i];
        const tip = where ? `Nearest: ${where.text}` : main.needs[i]?.notYet ? `Arrives with ${main.needs[i].notYet} (not in the game yet).` : hint(u.needs[i]);
        if (i >= 0 && tip) parts.push(h('small', { class: 'guide-tip' }, tip));
        parts.push(h('div', { class: 'progress' }, h('i', { style: `width:${Math.round(fraction(main) * 100)}%` })));
        askPlaces(u.id);
      }
      if (side) parts.push(h('div', { class: 'guide-side' }, side.ready ? `Side: ${side.upgrade.name} is ready to install` : `Side: ${side.upgrade.name} · ${doneCount(side)} of ${side.needs.length} tasks`));
    }
    guide.classList.toggle('ready', !!main?.ready);
    guide.classList.toggle('first', firstSteps);
    guide.replaceChildren(...parts);
  }

  function refresh() {
    placeCache = new Map(); // tasks moved on: places are worked out again when needed
    state = progress(codex.entries, codex.unlocked, codex.research);
    const ready = Object.values(state).filter((p) => p.ready).length;
    const badge = button.querySelector('.up-badge');
    badge.hidden = !ready;
    badge.textContent = ready || '';
    button.classList.toggle('has-ready', ready > 0);
    renderGuide(true);
    if (dialog.open) render();
  }
  const setPlaces = (id, list) => placeCache.set(id, list);
  function setMode(m) { if (m !== mode) { mode = m; renderGuide(); } }

  function unlock(id) {
    if (!state[id]?.ready) return;
    codex.unlock(id);
    selected = activeResearch(codex.unlocked, codex.research).main || id;
    refresh();
    onUnlock?.(id);
  }
  function open(id) {
    onOpen?.();
    state = progress(codex.entries, codex.unlocked, codex.research);
    const ready = Object.values(state).find((p) => p.ready);
    selected = (typeof id === 'string' && id) || ready?.id || activeResearch(codex.unlocked, codex.research).main || selected;
    render();
    dialog.showModal();
    layout.scrollTop = 0;
  }
  const close = () => dialog.close();
  const toggle = () => (dialog.open ? close() : open());

  refresh();
  return { open, close, toggle, refresh, setMode, setPlaces, get isOpen() { return dialog.open; } };
}
