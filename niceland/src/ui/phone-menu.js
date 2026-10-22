/* The ☰ menu on phones: opens and closes the control panel, and closes it again when you touch the map,
   the tool dock, a control button or a search result. */
(() => {
  const m = document.getElementById('bMenu'),
    set = o => {
      document.body.classList.toggle('menu', o);
      m.setAttribute('aria-expanded', o);
      m.textContent = o ? '✕' : '☰';
    };
  m.onclick = () => set(!document.body.classList.contains('menu'));
  document.getElementById('cv').addEventListener('pointerdown', () => set(false));
  document.getElementById('dock').addEventListener('pointerdown', () => set(false));
  document.getElementById('ctrl').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (
      t &&
      t.closest('#ctrl') &&
      innerWidth <= 760 &&
      !t.closest('[aria-label="Simulation speed"],[aria-label="Rotate view"]') &&
      !t.matches('#bRebuild')
    )
      setTimeout(() => set(false), 150);
  });
  document.getElementById('qres').addEventListener('click', () => setTimeout(() => set(false), 150));
})();
