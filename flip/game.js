// Flip — a daily game. A tap flips a tile and its neighbours. Clear the board in as few taps as you can.
// Par is the true minimum (solved exactly). The board grows through the week. No backend: the date picks the board.
(() => {
const $ = id => document.getElementById(id);
const LAUNCH = [2026, 10, 13];                    // Flip #1 = 13 Nov 2026 (month is 0-based)
const SIZE_BY_WEEKDAY = [6, 4, 4, 5, 5, 5, 6];   // Sun..Sat: small on Monday, big at the weekend

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const N = SIZE_BY_WEEKDAY[new Date(Date.UTC(...LAUNCH) + (DAY - 1) * 864e5).getUTCDay()];

/* ---------- board ---------- */
const nbrs = i => { const x = i % N, y = i / N | 0; return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a); };
const press = (b, i) => { for (const j of nbrs(i)) b[j] ^= 1; };
// exact minimum taps: solve over GF(2), then try every setting of the free variables
function minTaps(board) {
  const M = N * N, rows = [];
  for (let i = 0; i < M; i++) { const row = new Array(M + 1).fill(0); for (const j of nbrs(i)) row[j] = 1; row[M] = board[i]; rows.push(row); }
  const piv = []; let r = 0;
  for (let c = 0; c < M && r < M; c++) {
    const p = rows.findIndex((row, k) => k >= r && row[c]); if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let k = 0; k < M; k++) if (k !== r && rows[k][c]) for (let j = c; j <= M; j++) rows[k][j] ^= rows[r][j];
    piv.push(c); r++;
  }
  const free = []; for (let c = 0; c < M; c++) if (!piv.includes(c)) free.push(c);
  let best = Infinity;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = new Array(M).fill(0); free.forEach((c, k) => x[c] = mask >> k & 1);
    piv.forEach((c, k) => { let v = rows[k][M]; for (const f of free) if (rows[k][f]) v ^= x[f]; x[c] = v; });
    best = Math.min(best, x.reduce((a, b) => a + b, 0));
  }
  return best;
}
// build today's board by tapping a clean one, so it's always solvable; keep it if par is in a good range
function makeBoard() {
  const rnd = mulberry(DAY * 4409 + 3), want = N === 4 ? [3, 5] : N === 5 ? [5, 7] : [7, 9];
  for (let t = 0; t < 500; t++) {
    const b = new Array(N * N).fill(0), k = want[0] + Math.floor(rnd() * (want[1] - want[0] + 3));
    for (let n = 0; n < k; n++) press(b, Math.floor(rnd() * N * N));
    const p = minTaps(b); if (p >= want[0] && p <= want[1]) return [b, p];
  }
  const b = new Array(N * N).fill(0); press(b, 0); press(b, N * N - 1); return [b, minTaps(b)];
}
const [START, PAR] = makeBoard();

/* ---------- saved progress ---------- */
const KEY = 'flip:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { taps: [], moves: 0, par: PAR, res: [], done: false });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('flip:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('flip:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- play ---------- */
let cells = START.slice(); for (const i of today.taps) press(cells, i);
$('dayNo').textContent = '#' + DAY; $('par').textContent = PAR; $('grid').style.setProperty('--n', N);
function render() {
  $('moves').textContent = today.moves;
  $('grid').innerHTML = cells.map((v, i) => `<div class="t ${v ? 'on' : ''}" data-i="${i}" role="button" aria-label="Tile ${i + 1}"><i class="a"></i><i class="b"></i></div>`).join('');
  $('grid').querySelectorAll('.t').forEach(el => el.onclick = () => tap(+el.dataset.i));
}
function tap(i) {
  audio(); if (today.done) return;
  press(cells, i); today.taps.push(i); today.moves++; $('moves').textContent = today.moves;
  const els = $('grid').children; nbrs(i).forEach((j, k) => setTimeout(() => els[j].classList.toggle('on', !!cells[j]), k ? 70 : 0));
  blip(cells[i] ? 520 : 390, .07, .05); buzz(6);
  if (cells.every(v => !v)) { today.done = true; today.res = [{ c: today.moves <= PAR ? 'g' : today.moves <= PAR + 3 ? 'y' : 'o' }]; setTimeout(() => finish(true), 800); }
  save();
}
$('reset').onclick = () => { if (today.done) return; audio(); cells = START.slice(); today.taps = []; save(); blip(300, .1, .05); render(); };   // starting over keeps your tap count

/* ---------- end ---------- */
const verdict = m => m <= PAR ? 'Perfect!' : `Par: ${PAR}`;
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.done) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { const m = today.moves; return `Flip #${DAY} · ${N}×${N} · ${m} taps (${m <= PAR ? 'perfect' : `par ${PAR}`})\nolid.is/flip`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  $('endDay').textContent = `#${DAY} · ${N}×${N}`; $('total').innerHTML = `${today.moves}<small>taps</small>`; $('verdict').textContent = verdict(today.moves);
  const done = Object.values(store.days).filter(d => d.done), perfect = done.filter(d => d.moves <= d.par).length;
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

window.FLIP_DEBUG = { N, PAR, START, minTaps };
if (today.done) finish(false); else render();
})();
