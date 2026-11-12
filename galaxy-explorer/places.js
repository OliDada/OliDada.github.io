// Places you have been: where you landed (named for the town or site it was near) and the
// arks and stations you docked at, so you can go straight back. Kept in localStorage,
// newest first, forty at most. A fast-travel destination waits in sessionStorage across
// the reload that a jump to another star needs (game.js reads it on arrival).
const KEY = 'elsewhere-places', GO = 'elsewhere-goto', MAX = 40;

export function loadPlaces() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} }

// p: { star, world, n: [x, y, z] or null, name, where, kind }
export function rememberPlace(p) {
  const list = loadPlaces();
  const same = (q) => q.star === p.star && q.world === p.world && (p.n && q.n ? Math.hypot(p.n[0] - q.n[0], p.n[1] - q.n[1], p.n[2] - q.n[2]) < .004 || q.name === p.name : q.name === p.name);
  const i = list.findIndex(same);
  if (i >= 0) list.splice(i, 1);
  list.unshift({ ...p, id: `${p.star}:${p.world}:${Date.now().toString(36)}`, when: Date.now() });
  save(list.slice(0, MAX));
}
export function forgetPlace(id) { save(loadPlaces().filter((p) => p.id !== id)); }

export function setGoto(p) { try { sessionStorage.setItem(GO, JSON.stringify(p)); } catch {} }
export function takeGoto(star, world) {
  try {
    const p = JSON.parse(sessionStorage.getItem(GO) || 'null');
    sessionStorage.removeItem(GO);
    return p && p.star === star && p.world === world ? p : null;
  } catch { return null; }
}

const ago = (t) => { const m = (Date.now() - t) / 60000; return m < 1 ? 'just now' : m < 60 ? `${Math.round(m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const ICON = { landing: '◍', town: '⌂', ark: '◆', station: '◇' };

// The list, inside the star map: click a place to go there; × to forget it.
export function placesPanel(host, onGo) {
  const panel = document.createElement('div');
  panel.id = 'mapPlaces'; panel.hidden = true;
  host.append(panel);
  const render = () => {
    const list = loadPlaces();
    panel.replaceChildren();
    const head = document.createElement('div'); head.className = 'eyebrow'; head.textContent = 'PLACES YOU HAVE BEEN';
    panel.append(head);
    if (!list.length) { const p = document.createElement('p'); p.className = 'map-note'; p.textContent = 'Land somewhere, or dock at a station or an ark, and it is kept here so you can come straight back.'; panel.append(p); return; }
    for (const p of list) {
      const row = document.createElement('div'); row.className = 'place-row';
      const go = document.createElement('button'); go.className = 'place-go';
      go.innerHTML = '<i></i><span><strong></strong><small></small></span>';
      go.querySelector('i').textContent = ICON[p.kind] || '◍';
      go.querySelector('strong').textContent = p.name;
      go.querySelector('small').textContent = `${p.where} · ${ago(p.when)}`;
      go.onclick = () => onGo(p);
      const x = document.createElement('button'); x.className = 'place-x'; x.textContent = '×'; x.title = 'Forget this place';
      x.onclick = () => { forgetPlace(p.id); render(); };
      row.append(go, x); panel.append(row);
    }
  };
  return { toggle(on = panel.hidden) { panel.hidden = !on; if (on) render(); return on; }, close() { panel.hidden = true; }, get open() { return !panel.hidden; } };
}
