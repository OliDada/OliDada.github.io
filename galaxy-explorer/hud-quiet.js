// A quieter HUD. What only matters when it changes (where you are, the next research, the
// list of controls) is shown in full when it changes, then fades back once you have had
// time to read it. Speed and altitude, which you fly by, always stay. Moving the pointer
// over a faded part, or pressing H, brings it back.
const AWAKE = 7000; // ms a change stays in full view

export function quietHud(doc = document) {
  const parts = [
    { el: doc.querySelector('#hud .location'), keep: () => false },
    { el: doc.getElementById('guide'), keep: (el) => el.classList.contains('ready') || el.classList.contains('first') },
    { el: doc.getElementById('controlHint'), keep: () => false },
  ].filter((p) => p.el);
  const wake = (p) => {
    p.el.classList.remove('quiet');
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { if (!p.keep(p.el) && !p.hover) p.el.classList.add('quiet'); }, AWAKE);
  };
  for (const p of parts) {
    // Only a real change wakes it (the game rewrites some of these every frame with the same words).
    const look = () => p.el.textContent + '|' + p.el.hidden;
    p.seen = look();
    new MutationObserver(() => { const now = look(); if (now !== p.seen) { p.seen = now; wake(p); } }).observe(p.el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    p.el.addEventListener('pointerenter', () => { p.hover = true; wake(p); });
    p.el.addEventListener('pointerleave', () => { p.hover = false; wake(p); });
    wake(p);
  }
  return { wakeAll: () => parts.forEach(wake) };
}
