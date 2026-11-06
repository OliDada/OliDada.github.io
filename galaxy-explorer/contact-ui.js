// The contact exchange (contact.mjs): a panel for meeting another mind. It shows who
// they are, where you stand with them (the ladder and how much they trust you), what
// they are hoping to learn, and a few things from your codex to offer them. Their
// reaction, and anything they give you in return, appears as you go. Touch-friendly:
// everything is a button.
//
// It never covers the one you are talking to: it is not modal (the world goes on behind
// it), it sits at the side of the screen (a sheet along the bottom on narrow screens),
// and free() says what part of the screen is left, so the view can centre them there.
//
//   const ui = createContactUI({ onClose() });
//   ui.open({ civ, rel, steps, ask, greeted, greetText, offers: [{ entry, name, kind, from }], give(o) -> result, greet() -> result })
//   ui.isOpen · ui.close() · ui.free() -> { x, y, w, h } (the screen left uncovered, CSS pixels)
import { STEPS, PER_MEETING } from './contact.mjs';

const CSS = `
#contact{position:fixed;inset:50% 18px auto auto;transform:translateY(-50%);margin:0;width:min(400px,38vw);max-width:none;max-height:88vh;padding:22px 22px 18px;background:#0d1c23e0;z-index:5}
#contact h2{font-size:26px}
.ct-offers{grid-template-columns:1fr!important}
@media(max-width:820px),(max-aspect-ratio:1/1){#contact{inset:auto 8px 8px 8px;transform:none;width:auto;max-height:46vh;padding:16px 16px 12px}#contact h2{font-size:20px;margin:4px 0 2px}#contact .ct-sub{margin-bottom:6px}.ct-offers{grid-template-columns:1fr 1fr!important}.ct-offers button{min-height:48px}}
#contact .ct-eyebrow{font-size:9px;letter-spacing:2px;color:var(--muted)}
#contact h2{margin:8px 0 4px}
#contact .ct-sub{margin:0 0 12px;font-size:11px}
.ct-ladder{display:flex;gap:4px;margin:6px 0 4px}
.ct-ladder span{flex:1;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;padding:6px 2px;border-radius:3px;border:1px solid var(--line);color:var(--muted)}
.ct-ladder span.on{background:#c9f4cc1f;border-color:#c9f4cc66;color:var(--mint)}
.ct-trust{height:3px;background:#bed5ce25;margin:8px 0 14px;border-radius:2px;overflow:hidden}.ct-trust i{display:block;height:100%;background:var(--mint);transition:width .8s}
.ct-ask{font-size:13px!important;color:var(--ink)!important;border-left:2px solid var(--mint);padding-left:12px;margin:12px 0!important}
.ct-log p{margin:6px 0;font-size:12px}
.ct-log p.gift{color:var(--mint)}
.ct-offers{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.ct-offers button{text-align:left;padding:10px 12px;border-radius:6px;min-height:58px}
.ct-offers button strong{display:block;font-size:12px;font-weight:500}
.ct-offers button small{display:block;font-size:9px;color:var(--muted);margin-top:4px;letter-spacing:.5px}
.ct-actions{display:flex;gap:8px;margin-top:14px}
.ct-actions button{flex:1}
`;

export function createContactUI({ onClose = () => {} } = {}) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const dialog = document.createElement('dialog'); dialog.id = 'contact'; document.body.append(dialog);
  dialog.addEventListener('close', () => onClose());
  // Not modal, so Escape is ours to handle.
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && dialog.open) { e.preventDefault(); dialog.close(); } });
  const h = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
  let state = null;

  function render() {
    const s = state, rel = s.rel;
    dialog.replaceChildren();
    const close = h('button', 'close', '×'); close.setAttribute('aria-label', 'Close'); close.onclick = () => dialog.close(); dialog.append(close);
    dialog.append(h('div', 'ct-eyebrow', s.where), h('h2', null, s.title), h('p', 'ct-sub', s.sub));
    const ladder = h('div', 'ct-ladder');
    for (const st of STEPS) ladder.append(h('span', STEPS.indexOf(st) <= STEPS.indexOf(rel.step) ? 'on' : '', st));
    dialog.append(ladder);
    const bar = h('div', 'ct-trust'), fill = h('i'); fill.style.width = `${Math.min(100, rel.trust / s.friendAt * 100).toFixed(0)}%`; bar.append(fill); dialog.append(bar);
    if (s.blocked) { dialog.append(h('p', 'ct-ask', s.blocked)); actions(); return; }
    const log = h('div', 'ct-log');
    for (const line of s.log) log.append(h('p', line.gift ? 'gift' : '', line.text));
    if (!s.greeted) {
      dialog.append(h('p', 'ct-ask', `They watch you. ${s.stanceLine}`), log);
      const greet = h('button', 'primary', 'Greet them'); greet.onclick = () => { const r = s.greet(); s.log.push({ text: r.text }); if (r.ok) s.greeted = true; render(); };
      dialog.append(greet); actions(); return;
    }
    dialog.append(h('p', 'ct-ask', s.ask), log);
    const left = PER_MEETING - rel.given;
    if (left > 0 && s.offers.length) {
      dialog.append(h('div', 'ct-eyebrow', `SHOW THEM SOMETHING FROM YOUR CODEX · ${left} MORE THIS MEETING`));
      const grid = h('div', 'ct-offers');
      for (const o of s.offers) {
        const b = h('button'); b.append(h('strong', null, o.name), h('small', null, `${o.kind} · ${o.from}`));
        b.onclick = () => {
          const r = s.give(o);
          s.log.push({ text: r.text });
          for (const g of r.gifts || []) s.log.push({ text: g, gift: true });
          s.offers = s.offers.filter((x) => x !== o);
          render();
        };
        grid.append(b);
      }
      dialog.append(grid);
    } else if (!s.offers.length) dialog.append(h('p', null, 'You have nothing in your codex they have not seen. Document more, on other worlds, and come back.'));
    else dialog.append(h('p', null, 'They have taken in all they can for now. Come back another time: trust grows over more than one meeting.'));
    actions();
  }
  function actions() {
    const row = h('div', 'ct-actions'), leave = h('button', 'secondary', 'Leave'); leave.onclick = () => dialog.close(); row.append(leave); dialog.append(row);
  }
  return {
    get isOpen() { return dialog.open; },
    open(s) { state = { log: [], ...s }; render(); if (!dialog.open) dialog.show(); },
    close() { if (dialog.open) dialog.close(); },
    free() {
      const W = innerWidth, H = innerHeight;
      if (!dialog.open) return { x: 0, y: 0, w: W, h: H };
      const b = dialog.getBoundingClientRect();
      return b.top > H * .35 ? { x: 0, y: 0, w: W, h: b.top } : { x: 0, y: 0, w: b.left, h: H };
    },
  };
}
