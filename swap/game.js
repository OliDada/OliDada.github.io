// Swap — a daily word game. Four rows, four hidden groups, but some words are in the wrong row.
// Tap two words to swap them; a row locks when it holds exactly one group. Fix the board in as few swaps as you can.
// No backend: the date picks the puzzle (puzzles.js), so everyone gets the same board.
(() => {
const $ = id => document.getElementById(id);
const LAUNCH = [2026, 10, 13];                  // Swap #1 = 13 Nov 2026 (month is 0-based)
const PUZ = window.SWAP_PUZZLES, LEVEL = { y: 1, g: 2, b: 3, p: 4 };

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const P = PUZ[(DAY - 1) % PUZ.length], PAR = P.mix.length;
// the scrambled board: the solution with the mix swaps applied, rows and words shuffled (same for everyone today)
function startRows() {
  const r = mulberry(DAY * 977 + 13), rows = P.groups.map(g => g.slice(2));
  const find = w => { for (let i = 0; i < 4; i++) { const j = rows[i].indexOf(w); if (j >= 0) return [i, j]; } };
  for (const [a, b] of P.mix) { const pa = find(a), pb = find(b); rows[pa[0]][pa[1]] = b; rows[pb[0]][pb[1]] = a; }
  return shuffle(rows.map(row => shuffle(row, r)), r);
}

/* ---------- saved progress ---------- */
const KEY = 'swap:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { rows: startRows(), locked: [false, false, false, false], swaps: 0, res: [], done: false });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('swap:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0, slide) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('swap:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- board logic ---------- */
let rows = today.rows, locked = today.locked, sel = null, busy = false;
const groupOf = row => P.groups.findIndex(g => g.slice(2).every(w => row.includes(w)));
function newlySolved() { const out = []; rows.forEach((row, r) => { if (!locked[r] && groupOf(row) >= 0) out.push(r); }); return out; }
$('dayNo').textContent = '#' + DAY;

function solvedHTML(row) {
  const g = P.groups[groupOf(row)], lv = LEVEL[g[0]];
  return `<div class="solved"><b>${g[1]} <span class="lvl" title="Difficulty ${lv} of 4">${[1, 2, 3, 4].map(k => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('')}</span></b><span>${g.slice(2).join(' · ')}</span></div>`;
}
function render() {
  const order = [0, 1, 2, 3].sort((a, b) => locked[b] - locked[a]);   // fixed rows rise to the top
  $('board').innerHTML = order.map(r => locked[r] ? solvedHTML(rows[r]) :
    `<div class="srow">${rows[r].map((w, c) => `<button class="tile ${sel && sel[0] === r && sel[1] === c ? 'sel' : ''}" data-r="${r}" data-c="${c}">${w}</button>`).join('')}</div>`).join('');
  $('board').querySelectorAll('.tile').forEach(b => b.onclick = () => tap(+b.dataset.r, +b.dataset.c));
  $('swaps').textContent = today.swaps; const n = locked.filter(Boolean).length; $('fixed').textContent = `${n} / 4`;
  $('dots').innerHTML = [0, 1, 2, 3].map(k => `<div class="dot ${k < n ? 'g' : ''}"></div>`).join('');
}
const positions = () => { const m = {}; document.querySelectorAll('#board .tile').forEach(el => m[el.textContent] = el.getBoundingClientRect()); return m; };
// FLIP: slide every tile from where it was to where it is now; the two swapped tiles hop over the others
function slide(before, lifted, dur = 340) {
  document.querySelectorAll('#board .tile').forEach(el => {
    const o = before[el.textContent]; if (!o) return; const n = el.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const up = lifted.includes(el.textContent); el.style.zIndex = up ? 3 : 1;
    const a = el.animate([{ transform: `translate(${dx}px,${dy}px)` }, ...(up ? [{ transform: `translate(${dx / 2}px,${dy / 2 - 16}px) scale(1.08)`, offset: .5 }] : []), { transform: 'none' }],
      { duration: up ? dur : 260, easing: 'cubic-bezier(.3,.8,.3,1)' });
    a.onfinish = () => el.style.zIndex = '';
  });
}
function tap(r, c) {
  if (busy || today.done) return; audio();
  if (!sel || sel[0] === r) { sel = sel && sel[0] === r && sel[1] === c ? null : [r, c]; blip(sel ? 620 : 420, .05, .05); return render(); }
  const [r0, c0] = sel, a = rows[r0][c0], b = rows[r][c], before = positions();
  rows[r0][c0] = b; rows[r][c] = a; sel = null; today.swaps++;
  blip(520, .14, .05, 'sine', 0, 780); buzz(8);
  render(); slide(before, [a, b]);
  const fixed = newlySolved();
  if (fixed.length) {
    busy = true;
    setTimeout(() => {   // let the swap land, then the finished row snaps shut and the rest slide down
      const b2 = positions(); fixed.forEach(k => locked[k] = true);
      today.res = locked.filter(Boolean).map(() => ({ c: 'g' })); render(); slide(b2, []); busy = false;
      [523, 659, 784].forEach((f, k) => blip(f + 60 * fixed.length, .18, .07, 'triangle', k * .06)); buzz([15, 30, 15]);
      if (locked.every(Boolean)) finishSoon(); save();
    }, 360);
  }
  save();
}
function finishSoon() { today.done = true; today.par = PAR; save(); setTimeout(() => finish(true), 900); }

/* ---------- end + stats ---------- */
function verdict(s) { return s <= PAR ? 'Perfect!' : `Best: ${PAR}`; }
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.done) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Swap #${DAY}: ${today.swaps} swaps (best ${PAR})\nolid.is/swap`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${today.swaps}<small> ${today.swaps === 1 ? 'swap' : 'swaps'}</small>`;
  $('verdict').textContent = verdict(today.swaps);
  $('endBoard').innerHTML = P.groups.map(g => solvedHTML(g.slice(2))).join('');
  const done = Object.values(store.days).filter(d => d.done), perfect = done.filter(d => d.swaps <= (d.par || 0)).length;
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${perfect}</b><span>perfect</span></div>`;
  if (fresh) [392, 494, 587, 784].forEach((f, k) => blip(f, .25, .07, 'triangle', k * .09));
  tick();
}
function tick() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, Math.floor((mid - n) / 1000));
  $('countdown').textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
  if (DAY === todayNo && s === 0) location.reload();
}
setInterval(() => { if ($('end').classList.contains('show')) tick(); }, 1000);
$('share').onclick = async () => {
  const txt = shareStr();
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text: txt }); return; } await navigator.clipboard.writeText(txt); $('share').textContent = 'Copied!'; }
  catch (e) { $('share').textContent = 'Couldn’t copy'; }
  setTimeout(() => $('share').textContent = 'Share result', 1400);
};

window.SWAP_DEBUG = { P, PAR, today };
if (today.done) finish(false); else render();
})();
