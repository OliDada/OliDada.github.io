// Twins — a daily logic puzzle. Three shapes a day (easy, medium, hard); split each into two identical pieces.
// No backend: the date picks the day's shapes from data.js, so everyone gets the same set. Every shape has exactly one answer.
(() => {
const $ = id => document.getElementById(id);
const LEVELS = 3, NAMES = ['Easy', 'Medium', 'Hard'];
const PAR = [30, 90, 240];                 // seconds: at or under par is green, up to 2.5x par is yellow, slower is orange
const REVEAL_AFTER = 60;                   // seconds on a level before "Show answer" is offered
const LAUNCH = [2026, 10, 13];             // #1 = 13 Nov 2026 (month is 0-based)
const BANK = window.TWINS_PUZZLES;

/* ---------- day ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : Math.max(1, todayNo);
// "aa./.ab" -> cells [{x, y, a}] where a marks which piece the cell is in the answer
function parse(str) { const cells = []; str.split('/').forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push({ x, y, a: ch === 'a' }); })); return cells; }
const puzzles = BANK.map(list => parse(list[(DAY - 1) % list.length]));

/* ---------- shape maths ---------- */
// the 8 ways to turn or flip a piece, as 2x2 matrices [a, b, c, d]: (x, y) -> (ax + by, cx + dy)
const ORI = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0], [-1, 0, 0, 1], [0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0]];
const turned = (pts, M) => pts.map(([x, y]) => [M[0] * x + M[1] * y, M[2] * x + M[3] * y]);
const mins = pts => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))];
const keyOf = pts => { const [mx, my] = mins(pts); return pts.map(([x, y]) => (x - mx) + ',' + (y - my)).sort().join(';'); };
function connected(pts) {
  if (!pts.length) return false; const set = new Set(pts.map(p => p.join(','))), seen = new Set([pts[0].join(',')]), stack = [pts[0]];
  while (stack.length) { const [x, y] = stack.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); } } }
  return seen.size === pts.length;
}
// If piece B can be turned/flipped and slid exactly onto piece A, return how (matrix + shift, in cell units, using cell centres)
function matchOnto(A, B) {
  const ca = A.map(([x, y]) => [x + .5, y + .5]), cb = B.map(([x, y]) => [x + .5, y + .5]), ka = keyOf(ca);
  for (const M of ORI) { const t = turned(cb, M); if (keyOf(t) === ka) { const ma = mins(ca), mt = mins(t); return { M, shift: [ma[0] - mt[0], ma[1] - mt[1]] }; } }
  return null;
}

/* ---------- saved progress ---------- */
const KEY = 'twins:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], cur: null });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('twins:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('twins:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- board ---------- */
let L = 0, cells = [], on = [], els = [], size = 40, mode = 'cover', elapsed = 0, tickFrom = 0, timer = 0;
const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const now = () => elapsed + (mode === 'play' ? performance.now() - tickFrom : 0);
function build() {
  const cols = Math.max(...cells.map(c => c.x)) + 1, rows = Math.max(...cells.map(c => c.y)) + 1, wrap = $('board').parentElement.getBoundingClientRect();
  size = Math.floor(Math.min(56, (wrap.width - 8) / cols, (wrap.height - 8) / rows));
  const b = $('board'); b.style.width = cols * size + 'px'; b.style.height = rows * size + 'px'; b.className = 'board';
  $('la').innerHTML = ''; $('lb').innerHTML = ''; $('lb').style.transform = '';
  els = cells.map((c, i) => { const e = document.createElement('div'); e.className = 'c' + (on[i] ? ' on' : ''); e.style.cssText = `left:${c.x * size}px;top:${c.y * size}px;width:${size}px;height:${size}px`; $('la').appendChild(e); return e; });
}
function split() { const A = [], B = []; cells.forEach((c, i) => (on[i] ? A : B).push([c.x, c.y])); return { A, B }; }
// Says what is wrong with the current split, or returns the match when it is right
function judge() {
  const { A, B } = split(), half = cells.length / 2;
  if (!A.length) return { note: `Paint ${half} of the ${cells.length} squares.` };
  if (A.length !== half) return { note: `${A.length} painted. Each piece needs ${half}.` };
  if (!connected(A)) return { note: 'The painted piece is in separate parts.' };
  if (!connected(B)) return { note: 'The unpainted piece is in separate parts.' };
  const m = matchOnto(A, B); return m ? { match: m } : { note: 'Same size, but not the same shape.' };
}
function remember() { today.cur = { lv: L, on: on.map(v => v ? 1 : 0).join(''), ms: Math.round(now()) }; save(); }

/* ---------- painting ---------- */
let paintTo = null, lastHit = -1;
function hit(e) { const r = $('board').getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / size), y = Math.floor((e.clientY - r.top) / size); return cells.findIndex(c => c.x === x && c.y === y); }
function paint(i) { if (i < 0 || i === lastHit) return; lastHit = i; if (on[i] === paintTo) return; on[i] = paintTo; els[i].classList.toggle('on', paintTo); blip(paintTo ? 620 : 420, .04, .04); buzz(5); $('note').textContent = judge().note || 'That looks right…'; }
$('board').addEventListener('pointerdown', e => { if (mode !== 'play') return; audio(); const i = hit(e); if (i < 0) return; $('board').setPointerCapture(e.pointerId); paintTo = !on[i]; lastHit = -1; paint(i); });
$('board').addEventListener('pointermove', e => { if (paintTo === null || mode !== 'play') return; paint(hit(e)); });
const lift = () => { if (paintTo === null) return; paintTo = null; if (mode !== 'play') return; remember(); const j = judge(); if (j.match) solved(j.match, false); };
$('board').addEventListener('pointerup', lift); $('board').addEventListener('pointercancel', lift);
$('clear').onclick = () => { if (mode !== 'play') return; audio(); on = on.map(() => false); els.forEach(e => e.classList.remove('on')); $('note').textContent = judge().note; remember(); blip(300, .08, .05); };
$('reveal').onclick = () => { if (mode !== 'play') return; audio(); on = cells.map(c => c.a); els.forEach((e, i) => e.classList.toggle('on', on[i])); solved(judge().match, true); };

/* ---------- levels ---------- */
$('dayNo').textContent = '#' + DAY;
function renderDots() { $('dots').innerHTML = puzzles.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === L && !r ? 'on' : ''}"></div>`; }).join(''); }
function setup(i) {
  L = i; cells = puzzles[i]; mode = 'cover'; clearInterval(timer);
  const saved = today.cur && today.cur.lv === i ? today.cur : null;
  on = cells.map((_, k) => !!saved && saved.on[k] === '1'); elapsed = saved ? saved.ms : 0;
  $('kind').textContent = `Level ${i + 1} · ${NAMES[i]}`; $('count').textContent = `${i + 1} / ${LEVELS}`;
  $('result').classList.remove('show'); $('tools').classList.remove('hide'); $('reveal').classList.add('hide');
  $('clock').textContent = fmt(elapsed); $('note').textContent = '';
  $('coverText').textContent = saved ? `Level ${i + 1} is paused.` : i === 0 ? 'Three shapes. Split each one into two identical pieces. Turning and flipping are allowed.' : `Level ${i + 1}: ${NAMES[i].toLowerCase()}. The clock starts when you do.`;
  $('begin').textContent = saved ? 'Continue' : i === 0 ? 'Start' : 'Go';
  $('cover').classList.remove('hide'); build(); renderDots();
}
$('begin').onclick = () => {
  audio(); blip(660, .09, .08); $('cover').classList.add('hide'); mode = 'play'; tickFrom = performance.now(); $('note').textContent = judge().note || '';
  timer = setInterval(() => { const t = now(); $('clock').textContent = fmt(t); if (t > REVEAL_AFTER * 1000) $('reveal').classList.remove('hide'); if (Math.floor(t / 1000) % 5 === 0) remember(); }, 250);
};

/* ---------- solved ---------- */
function grade(ms, shown) { if (shown) return ['r', 'Answer shown']; const s = ms / 1000; if (s <= PAR[L]) return ['g', 'Sharp']; if (s <= PAR[L] * 2.5) return ['y', 'Solved']; return ['o', 'Got there']; }
function solved(match, shown) {
  const ms = Math.round(now()); mode = 'done'; clearInterval(timer); elapsed = ms;
  const [c, label] = grade(ms, shown); today.res[L] = { ms, c }; today.cur = null; save();
  $('clock').textContent = fmt(ms); $('note').textContent = shown ? 'Here is how it splits.' : 'Twins!'; $('tools').classList.add('hide');
  // proof: the dark piece lifts, turns and lands exactly on the pink one, then goes home
  els.forEach((e, i) => { if (!on[i]) $('lb').appendChild(e); }); $('board').classList.add('solved');
  const { M, shift } = match, home = 'matrix(1,0,0,1,0,0)';
  $('lb').style.transform = home; void $('lb').offsetWidth;
  if (!shown) { [523, 659, 784].forEach((f, i) => blip(f, .16, .07, 'triangle', i * .07)); buzz([15, 30, 15]); } else blip(240, .14, .08, 'sine');
  setTimeout(() => { $('board').classList.add('proof'); $('lb').style.transform = `matrix(${M[0]},${M[2]},${M[1]},${M[3]},${shift[0] * size},${shift[1] * size})`; blip(880, .5, .03, 'sine'); }, 450);
  setTimeout(() => { $('lb').style.transform = home; $('board').classList.remove('proof'); }, 2100);
  setTimeout(() => {
    $('pill').className = 'pill ' + c; $('pill').textContent = label;
    $('vtxt').innerHTML = `${shown ? 'No time for this one' : 'Solved in ' + fmt(ms)}<small>Level ${L + 1} of ${LEVELS}</small>`;
    $('next').textContent = L < LEVELS - 1 ? 'Next level' : 'See results'; $('result').classList.add('show'); renderDots();
    $('next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 3000);
}
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < LEVELS) { setup(n); scrollTo({ top: 0, behavior: 'smooth' }); } else finish(true); };
addEventListener('keydown', e => { if (e.key !== 'Enter' || $('end').classList.contains('show')) return; if (mode === 'cover') $('begin').click(); else if (mode === 'done' && $('result').classList.contains('show')) $('next').click(); });
// pause the clock when the page is hidden, so a phone call doesn't cost you
document.addEventListener('visibilitychange', () => { if (mode !== 'play') return; if (document.hidden) { elapsed = now(); tickFrom = performance.now(); remember(); mode = 'cover'; clearInterval(timer); $('coverText').textContent = `Level ${L + 1} is paused.`; $('begin').textContent = 'Continue'; $('cover').classList.remove('hide'); } });

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + (r.c === 'r' ? 0 : r.ms), 0);
const complete = d => d && d.res && d.res.length === LEVELS;
const clean = d => complete(d) && d.res.every(r => r.c !== 'r');
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { if (complete(store.days[d])) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { const shown = today.res.filter(r => r.c === 'r').length; return `Twins #${DAY} ${fmt(total(today.res))}${shown ? ` (${LEVELS - shown}/${LEVELS} solved)` : ''}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/twins`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); scrollTo(0, 0);
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  const shown = today.res.filter(r => r.c === 'r').length;
  $('endDay').textContent = '#' + DAY; document.querySelector('#end .sub').lastChild.textContent = shown ? ` · ${LEVELS - shown} of ${LEVELS} solved` : ' · today\'s time';
  $('total').innerHTML = fmt(total(today.res));
  $('rcard').innerHTML = today.res.map((r, i) => `<div class="rline"><div class="re">${i + 1}</div><div class="rt"><b>${NAMES[i]}</b>${puzzles[i].length} squares</div><div class="rp">${r.c === 'r' ? 'shown' : fmt(r.ms)}</div><div>${SQ[r.c]}</div></div>`).join('');
  const done = Object.values(store.days).filter(complete), wins = Object.values(store.days).filter(clean);
  const best = wins.length ? fmt(Math.min(...wins.map(d => total(d.res)))) : '–';
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${best}</b><span>best time</span></div>`;
  if (fresh) [392, 494, 587, 784].forEach((f, i) => blip(f, .25, .07, 'triangle', i * .09));
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
addEventListener('resize', () => { if (mode === 'play' || mode === 'cover') build(); });

window.TWINS_DEBUG = { puzzles, judge };
if (today.res.length >= LEVELS) finish(false); else setup(today.res.length);
})();
