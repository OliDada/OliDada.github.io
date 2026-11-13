// Flood — a daily game. Pick colours to flood the board from the top-left corner. Fill it in as few moves as you can.
// Par is the best our solver finds (a good player can sometimes beat it). No backend: the date picks the board.
(() => {
const $ = id => document.getElementById(id), INK = '#1E1B24';
const N = 12, LAUNCH = [2026, 10, 13];             // Flood #1 = 13 Nov 2026 (month is 0-based)
const COLORS = ['#F06449', '#FFC93C', '#2FA05A', '#3D6BFF', '#8B5CF6', '#FF7AA8'];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- board ---------- */
// cells joined to the corner through the corner's colour, with their distance from it (for the ripple)
function region(g) { const c = g[0], seen = new Map([[0, 0]]), q = [0]; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = i / N | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * N + nx; if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(j) || g[j] !== c) continue; seen.set(j, seen.get(i) + 1); q.push(j); } } return seen; }
function apply(g, c) { const h = g.slice(); for (const i of region(g).keys()) h[i] = c; return h; }
// par: look three moves ahead, play the best first move, repeat
function solve(g) {
  let n = 0;
  const score = (g, depth) => { const s = region(g).size; if (s === N * N || !depth) return s; let b = s; for (let c = 0; c < COLORS.length; c++) if (c !== g[0]) b = Math.max(b, score(apply(g, c), depth - 1)); return b - .001; };
  while (region(g).size < N * N && n < 80) {
    let best = -1, bc = 0;
    for (let c = 0; c < COLORS.length; c++) if (c !== g[0]) { const s = score(apply(g, c), 2); if (s > best) { best = s; bc = c; } }
    g = apply(g, bc); n++;
  }
  return n;
}
const r = mulberry(DAY * 7331 + 29);
const START = Array.from({ length: N * N }, () => Math.floor(r() * COLORS.length));
const PAR = solve(START.slice());

/* ---------- saved progress ---------- */
const KEY = 'flood:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { picks: [], moves: 0, par: PAR, res: [], done: false });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('flood:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('flood:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- play ---------- */
let grid = START.slice(); for (const c of today.picks) grid = apply(grid, c);
let owned = region(grid), anim = [];
$('dayNo').textContent = '#' + DAY; $('par').textContent = PAR; $('moves').textContent = today.moves;
function renderPal() { $('pal').innerHTML = COLORS.map((c, k) => `<button style="background:${c}" class="${k === grid[0] ? 'cur' : ''}" data-k="${k}" aria-label="Colour ${k + 1}"></button>`).join(''); $('pal').querySelectorAll('button').forEach(b => b.onclick = () => pick(+b.dataset.k)); }
function pick(k) {
  audio(); if (today.done || k === grid[0]) return;
  const from = grid.slice(); grid = apply(grid, k); today.picks.push(k); today.moves++;
  const reg = region(grid), t0 = performance.now(), gained = reg.size - owned.size;
  for (const [i, d] of reg) if (from[i] !== k) anim[i] = { from: from[i], t: t0 + d * 16 };
  owned = reg; $('moves').textContent = today.moves; renderPal();
  blip(260 + Math.min(800, gained * 14), .12, .06); buzz(6);
  if (reg.size === N * N) { today.done = true; today.res = [{ c: today.moves <= PAR + 1 ? 'g' : today.moves <= PAR + 4 ? 'y' : 'o' }]; setTimeout(() => finish(true), 900); }
  save();
}
function frame(now) {
  requestAnimationFrame(frame);
  const cv = $('cv'); if (!cv) return; const cx = cv.getContext('2d'), W = cv.getBoundingClientRect().width, D = Math.min(3, devicePixelRatio || 1);
  if (!W) return; if (cv.width !== Math.round(W * D)) cv.width = cv.height = Math.round(W * D);
  cx.setTransform(D, 0, 0, D, 0, 0); const s = W / N;
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = i / N | 0, a = anim[i]; let col = COLORS[grid[i]], sc = 1;
    if (a) { const p = (now - a.t) / 170; if (p < 0) col = COLORS[a.from]; else if (p < 1) sc = .7 + .3 * p + Math.sin(p * Math.PI) * .14; else anim[i] = null; }
    cx.fillStyle = col; const m = s * (1 - sc) / 2; cx.fillRect(x * s + m - .5, y * s + m - .5, s * sc + 1, s * sc + 1);
  }
  if (owned.size < N * N) {   // outline of the flooded area
    cx.strokeStyle = INK; cx.lineWidth = 2.5; cx.lineCap = 'round'; cx.beginPath();
    for (const i of owned.keys()) { const x = i % N, y = i / N | 0;
      if (y > 0 && !owned.has(i - N)) { cx.moveTo(x * s, y * s); cx.lineTo(x * s + s, y * s); }
      if (y < N - 1 && !owned.has(i + N)) { cx.moveTo(x * s, y * s + s); cx.lineTo(x * s + s, y * s + s); }
      if (x > 0 && !owned.has(i - 1)) { cx.moveTo(x * s, y * s); cx.lineTo(x * s, y * s + s); }
      if (x < N - 1 && !owned.has(i + 1)) { cx.moveTo(x * s + s, y * s); cx.lineTo(x * s + s, y * s + s); } }
    cx.stroke();
  }
}

/* ---------- end ---------- */
const verdict = m => m < PAR ? 'Under par!' : m === PAR ? 'On par!' : `Par: ${PAR}`;
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.done) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { const m = today.moves; return `Flood #${DAY} · ${m} moves (${m < PAR ? `${PAR - m} under par!` : m === PAR ? 'on par' : `par ${PAR}`})\nolid.is/flood`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${today.moves}<small>moves</small>`; $('verdict').textContent = verdict(today.moves);
  const done = Object.values(store.days).filter(d => d.done), par = done.filter(d => d.moves <= d.par).length;
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${par}</b><span>on par</span></div>`;
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

window.FLOOD_DEBUG = { PAR, START, solve };
if (today.done) finish(false); else { renderPal(); requestAnimationFrame(frame); }
})();
