// Time Capsule — a daily game. The most-read Wikipedia pages from one mystery day. Guess the year and month.
// Four pages to start; show more if you need them (each costs points). Three guesses: a miss says earlier or later and roughly how far,
// and opens another page for free. Closer guesses, in fewer tries, score more.
// No backend: the date picks the days; the lists come from tools/capsule.py.
(() => {
const $ = id => document.getElementById(id);
const PER_DAY = 3, LAUNCH = [2026, 10, 13];        // same numbering as the other daily games (month is 0-based)
const START_SHOWN = 4, MAX_SHOWN = 8, MORE_COST = 10, MONTH_COST = 4, MAX_GUESSES = 3, GUESS_COST = 15;
const DAYS = window.CAPSULE_DAYS.map(([date, pages]) => ({ date, y: +date.slice(0, 4), m: +date.slice(5, 7) - 1, pages }));
const YEARS = [...new Set(DAYS.map(d => d.y))].sort();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Every mystery day is used once per cycle, so nothing repeats for over a year.
function daysFor(day) {
  const per = Math.floor(DAYS.length / PER_DAY), cycle = Math.floor((day - 1) / per), slot = (day - 1) % per;
  const order = shuffle(DAYS.map((_, i) => i), mulberry(cycle * 6151 + 29));
  return order.slice(slot * PER_DAY, slot * PER_DAY + PER_DAY).map(i => DAYS[i]);
}
// Years in titles would give the answer away, so they show as ____ until the round is over.
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const masked = t => esc(t).replace(/\b(20[12]\d|199\d)\b/g, '<span class="yr">____</span>');
const longDate = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const wiki = t => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_'));

/* ---------- saved progress ---------- */
const KEY = 'capsule:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], cur: null });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('capsule:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0, slide) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('capsule:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- state ---------- */
const items = daysFor(DAY);
let I = 0, D, shown = START_SHOWN, bought = 0, gy = null, gm = null, tries = [], mode = 'play';
$('dayNo').textContent = '#' + DAY;
$('years').innerHTML = YEARS.map(y => `<button class="chip" data-y="${y}">${y}</button>`).join('');
$('months').innerHTML = MON.map((m, i) => `<button class="chip" data-m="${i}">${m}</button>`).join('');
$('years').querySelectorAll('.chip').forEach(b => b.onclick = () => { if (mode !== 'play') return; audio(); gy = +b.dataset.y; blip(560, .05, .04); renderPick(); saveCur(); });
$('months').querySelectorAll('.chip').forEach(b => b.onclick = () => { if (mode !== 'play') return; audio(); gm = +b.dataset.m; blip(640, .05, .04); renderPick(); saveCur(); });

function start(i) {
  I = i; D = items[i]; mode = 'play';
  const c = today.cur && today.cur.i === i ? today.cur : null;
  shown = c ? c.shown : START_SHOWN; bought = c ? c.bought || 0 : 0; tries = c ? c.tries || [] : []; gy = c ? c.gy : null; gm = c ? c.gm : null;
  $('name').textContent = 'When was this?'; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('result').classList.remove('show'); $('pick').classList.remove('hide'); $('more').classList.remove('hide');
  renderPages(); renderPick(); renderTries(); renderDots();
}
function saveCur() { today.cur = { i: I, shown, bought, tries, gy, gm }; save(); }
// Earlier guesses, each with which way to go and roughly how far.
const band = m => m <= 3 ? 'within 3 months' : m <= 12 ? 'within a year' : m <= 24 ? '1–2 years' : 'more than 2 years';
function renderTries() {
  const left = MAX_GUESSES - tries.length;
  $('tries').innerHTML = tries.map(t => `<div class="try"><b>${MON[t.m]} ${t.y}</b><span>${t.dir > 0 ? 'Later' : 'Earlier'} · ${band(t.off)}</span><i>${t.dir > 0 ? '→' : '←'}</i></div>`).join('');
  $('go').textContent = mode !== 'play' ? 'Guess' : left === MAX_GUESSES ? 'Guess' : left === 1 ? 'Last guess' : `Guess again (${left} left)`;
}
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }
function renderPages() {
  const done = mode !== 'play';
  $('pages').innerHTML = D.pages.map((t, k) => done ? `<li><a href="${wiki(t)}" target="_blank" rel="noopener">${esc(t)}</a></li>`
    : k < shown ? `<li>${masked(t)}</li>` : `<li class="locked">Hidden</li>`).join('');
  $('more').textContent = shown < MAX_SHOWN ? `Show another page (−${MORE_COST} pts)` : 'All pages shown';
  $('more').disabled = shown >= MAX_SHOWN || done;
}
function renderPick() {
  const done = mode !== 'play';
  $('years').querySelectorAll('.chip').forEach(b => { const y = +b.dataset.y; b.className = 'chip' + (y === gy ? (done ? ' you' : ' on') : '') + (done && y === D.y ? ' ans' : ''); });
  $('months').querySelectorAll('.chip').forEach(b => { const m = +b.dataset.m; b.className = 'chip' + (m === gm ? (done ? ' you' : ' on') : '') + (done && m === D.m ? ' ans' : ''); });
  $('go').disabled = gy === null || gm === null || done;
}
$('more').onclick = () => { if (mode !== 'play' || shown >= MAX_SHOWN) return; audio(); shown++; bought++; saveCur(); renderPages(); blip(700, .08, .05); };

/* ---------- guessing + scoring ---------- */
// 100 for the right month, 4 less for every month away (on your last guess), 15 less for every extra guess, 10 less for every page you bought.
const off = () => Math.abs((gy * 12 + gm) - (D.y * 12 + D.m));
const gradeOf = m => m === 0 ? 'g' : m <= 2 ? 'y' : m <= 12 ? 'o' : 'r';
const offText = m => m === 0 ? 'right month' : m < 12 ? `${m} ${m === 1 ? 'month' : 'months'} off` : (() => { const y = Math.floor(m / 12), r = m % 12; return `${y} ${y === 1 ? 'year' : 'years'}${r ? ` ${r} mo` : ''} off`; })();
$('go').onclick = () => {
  if (mode !== 'play' || gy === null || gm === null) return; audio();
  const m = off(), dir = Math.sign((D.y * 12 + D.m) - (gy * 12 + gm));
  if (m > 0 && tries.length < MAX_GUESSES - 1) {          // a miss with guesses left: a hint, and one more page for free
    tries.push({ y: gy, m: gm, off: m, dir }); if (shown < MAX_SHOWN) shown++;
    gy = gm = null; saveCur(); renderTries(); renderPages(); renderPick();
    const st = $('pick'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
    blip(dir > 0 ? 300 : 420, .18, .07, 'sine', 0, dir > 0 ? 520 : 240); buzz([30, 30, 30]);
    return;
  }
  const n = tries.length + 1, pts = Math.max(0, 100 - MONTH_COST * m - GUESS_COST * (n - 1) - MORE_COST * bought);
  const r = { off: m, guesses: n, shown, pts, gy, gm, c: gradeOf(m) };
  today.res[I] = r; today.cur = null; save();
  mode = 'done'; renderPages(); renderPick(); renderTries(); renderDots();
  $('pick').classList.add('hide'); $('result').classList.add('show');
  $('name').textContent = new Date(D.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('pill').className = 'pill ' + r.c; $('pill').textContent = m === 0 ? (n === 1 ? 'Spot on!' : 'Got it') : m <= 2 ? 'Close' : m <= 12 ? 'Same-ish' : 'Way off';
  $('vtxt').innerHTML = `${longDate(D.date)}<small>${m === 0 ? `Right month in ${n} ${n === 1 ? 'guess' : 'guesses'}` : `Last guess ${MON[gm]} ${gy} · ${offText(m)}`} · +${pts} points</small>`;
  $('next').textContent = I < PER_DAY - 1 ? 'Next day' : 'See results';
  if (m <= 2) { [523, 659, 784, 1047].forEach((f, k) => blip(f, .22, .08, 'triangle', k * .07)); buzz([20, 40, 20]); }
  else [330, 262].forEach((f, k) => blip(f, .25, .08, 'sine', k * .13));
};
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) { start(n); scrollTo(0, 0); } else finish(true); };

/* ---------- end + stats ---------- */
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Time Capsule #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => r.off === 0 ? `right month, ${r.guesses} ${r.guesses === 1 ? 'guess' : 'guesses'}` : offText(r.off)).join('\n')}\nolid.is/capsule`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = items.map((d, i) => { const r = today.res[i]; return `<div class="rline"><div class="rd">${longDate(d.date)}<small>${r.off === 0 ? `right month, ${r.guesses || 1} ${(r.guesses || 1) === 1 ? 'guess' : 'guesses'}` : offText(r.off)}</small></div><div class="rp">${r.pts}</div></div>`; }).join('');
  const done = Object.values(store.days).filter(d => d.res && d.res.length === PER_DAY);
  const avg = Math.round(done.reduce((s, d) => s + total(d.res), 0) / done.length);
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${avg}</b><span>average</span></div>`;
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

window.CAPSULE_DEBUG = { items, daysFor };
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
