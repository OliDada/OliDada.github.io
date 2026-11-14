// Oli.is — the redesigned pages (index, jokes, programs).
// Loads after script.js, which owns the page background (--page-bg), the in-page game
// player (playFromAnchor) and the 3D background (enableDecorative3D / three-scene.js).
// This file adds: the Customise panel, the game cards, the joke note and small bits of fun.
(function () {
    'use strict';

    const FLOATIE_DEFAULTS = { shape: 'sparkles', amount: 'some', speed: 1, color: 'auto', follow: true };
    // once Pip is free, a few of his heads are the standard floaties
    try { if (JSON.parse(localStorage.getItem('bit-memory') || '{}').freed) Object.assign(FLOATIE_DEFAULTS, { shape: 'pips', amount: 'few' }); } catch (e) {}
    const SWATCHES = ['#ffa500', '#38b6ff', '#ff5436', '#7ed957', '#ffc8dd', '#b58cff', '#1e1645'];
    const ALL_SHAPES = [['sparkles', 'Sparkles'], ['bubbles', 'Bubbles'], ['cubes', 'Cubes'], ['dolphins', 'Ós'], ['snow', 'Snow'], ['pips', 'Pips'], ['none', 'Nothing']];
    // Pip's own things (his heads as floaties, his colour as the site's original look) only exist once he's free
    const pipFree = () => (typeof window.pipIsFree === 'function' ? window.pipIsFree() : false);
    const shapes = () => ALL_SHAPES.filter(([k]) => k !== 'pips' || pipFree());
    const AMOUNTS = [['few', 'A few'], ['some', 'Some'], ['loads', 'Loads']];
    const SPEEDS = [[0.35, 'Chill'], [1, 'Normal'], [2.6, 'Zoomy']];
    const FONTS = [['bubbly', 'Bubbly'], ['pixel', 'Pixel'], ['chunky', 'Chunky'], ['comic', 'Comic'], ['clean', 'Clean']];
    // Themes: one tap sets the background, the floaties and the font together
    const THEMES = [
        ['night',  'Night',  { bg: '#1e1645', font: 'clean',  fl: { shape: 'sparkles', amount: 'loads', speed: 0.35, color: '#ffffff' } }],
        ['candy',  'Candy',  { bg: '#ffc8dd', font: 'bubbly', fl: { shape: 'bubbles',  amount: 'some',  speed: 1,    color: '#ff6fb1' } }],
        ['ocean',  'Ocean',  { bg: '#38b6ff', font: 'bubbly', fl: { shape: 'bubbles',  amount: 'loads', speed: 0.35, color: '#ffffff' } }],
        ['arcade', 'Arcade', { bg: '#1d1a2b', font: 'pixel',  fl: { shape: 'cubes',    amount: 'some',  speed: 1,    color: '#ffe14d' } }],
        ['winter', 'Winter', { bg: '#9be7ff', font: 'clean',  fl: { shape: 'snow',     amount: 'loads', speed: 0.35, color: '#ffffff' } }],
        ['lava',   'Lava',   { bg: '#ff5436', font: 'chunky', fl: { shape: 'cubes',    amount: 'loads', speed: 2.6,  color: '#ffe14d' } }]
    ];
    const FLOATIE_COLORS = ['#ffffff', '#1d1a2b', '#ffe14d', '#ff6fb1', '#9be7ff'];

    const $ = (sel, root) => (root || document).querySelector(sel);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };

    // ---------- Text colour on the background ----------
    function hexToRgb(hex) {
        let h = String(hex || '').trim().replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (!/^[0-9a-f]{6}$/i.test(h)) return null;
        return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
    }
    function luminance(rgb) {
        const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function currentBg() {
        return (getComputedStyle(document.documentElement).getPropertyValue('--page-bg') || '').trim();
    }
    function applyInk() {
        const rgb = hexToRgb(currentBg());
        let ink = '#1d1a2b';
        if (rgb) {
            const L = luminance(rgb);
            const darkText = (L + 0.05) / (0.0136 + 0.05);   // contrast of #1d1a2b on the bg
            const lightText = 1.0 / (L + 0.05);               // contrast of near-white on the bg
            ink = darkText >= lightText ? '#1d1a2b' : '#fff8e7';
        }
        document.documentElement.style.setProperty('--page-ink', ink);
    }
    function setBg(color) {
        if (typeof window.setBackgroundColor === 'function') window.setBackgroundColor(color);
        else document.documentElement.style.setProperty('--page-bg', color);
        applyInk();
        syncPanel();
    }
    function randomColor() {
        const h = Math.random() * 360, s = 65 + Math.random() * 30, l = 42 + Math.random() * 28;
        const a = s * Math.min(l, 100 - l) / 10000;
        const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0'); };
        return '#' + f(0) + f(8) + f(4);
    }

    // ---------- Font ----------
    function setFont(f) {
        FONTS.forEach(([k]) => document.documentElement.classList.remove('font-' + k));
        if (f && f !== 'bubbly') document.documentElement.classList.add('font-' + f);
        store.set('site-font', f || 'bubbly');
        syncPanel();
    }

    // ---------- Floaties (the 3D background) ----------
    let floaties = Object.assign({}, FLOATIE_DEFAULTS, store.get('floaties', {}));
    async function setFloaties(change) {
        floaties = Object.assign({}, floaties, change);
        store.set('floaties', floaties);
        syncPanel();
        try {
            if (floaties.shape === 'none') {
                if (typeof enableDecorative3D === 'function') await enableDecorative3D(false);
                try { threeEnabled = false; } catch (e) {}
                return;
            }
            if (typeof enableDecorative3D === 'function' && (typeof threeEnabled === 'undefined' || !threeEnabled)) {
                await enableDecorative3D(true);
                try { threeEnabled = true; } catch (e) {}
            }
            if (window.__threeScene && window.__threeScene.setOptions) window.__threeScene.setOptions(floaties);
        } catch (e) { console.warn('Could not update floaties', e); }
    }

    // ---------- Customise panel ----------
    const pills = (name, list, cur) => list.map(([v, label]) =>
        `<button type="button" class="pill" data-${name}="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${esc(label)}</button>`).join('');

    const seg = (name, list) => list.map(([v, label]) =>
        `<button type="button" data-${name}="${esc(v)}" aria-pressed="false">${esc(label)}</button>`).join('');

    function buildPanel() {
        if ($('#customise')) return;
        const p = document.createElement('section');
        p.id = 'customise';
        p.className = 'panel stk';
        p.hidden = true;
        p.setAttribute('aria-label', 'Customise');
        p.innerHTML = `
            <div class="panel-head">
                <button type="button" class="pill" data-close aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
            </div>
            <div>
                <p class="label">Themes</p>
                <div class="row">${THEMES.map(([k, label, t]) => `<button type="button" class="pill" data-theme="${k}" aria-pressed="false"><span class="dot" style="background:${t.bg}"></span>${label}</button>`).join('')}</div>
            </div>
            <div>
                <p class="label">Background</p>
                <div class="row">
                    ${pipFree()
                        ? `<button type="button" class="sw sw-pip" data-bg="original" aria-label="Pip's colour (the original)" title="Pip's colour" style="background:${window.PIP_BACKGROUND || '#14111f'}"></button>`
                        : `<button type="button" class="sw" data-bg="original" aria-label="Original orange" style="background:url('/images/1.jpg') center/cover"></button>`}
                    ${SWATCHES.map(h => `<button type="button" class="sw" data-bg="${h}" aria-label="${h}" style="background:${h}"></button>`).join('')}
                    <label class="row" style="gap:8px;font-weight:700;font-size:14px"><input type="color" class="sw-input" data-bgpick value="#ffa500"> Any colour</label>
                    <label class="row hex-row" style="gap:8px;font-weight:700;font-size:14px">Code <input type="text" class="hex-input" data-bghex maxlength="7" placeholder="#000000" spellcheck="false" autocomplete="off" aria-label="Colour code, like #000000"></label>
                </div>
                <div class="row"><button type="button" class="btn btn-pink" data-surprise>Surprise me!</button></div>
            </div>
            <div>
                <p class="label">Floating in the background</p>
                <div class="group">
                    <div>
                        <p class="sub">What</p>
                        <div class="row">${pills('shape', shapes(), floaties.shape)}</div>
                    </div>
                    <div data-when-floaties>
                        <p class="sub">How many</p>
                        <div class="seg" role="group" aria-label="How many">${seg('amount', AMOUNTS)}</div>
                    </div>
                    <div data-when-floaties>
                        <p class="sub">How fast</p>
                        <div class="seg" role="group" aria-label="How fast">${seg('speed', SPEEDS)}</div>
                    </div>
                    <div data-when-floaties>
                        <p class="sub">Colour</p>
                        <div class="row">
                            <button type="button" class="pill" data-fcolor="auto" aria-pressed="false">Auto</button>
                            ${FLOATIE_COLORS.map(h => `<button type="button" class="sw" data-fcolor="${h}" aria-label="Floaties ${h}" style="background:${h};width:36px;height:36px"></button>`).join('')}
                        </div>
                    </div>
                    <div data-when-floaties>
                        <button type="button" class="pill" data-follow aria-pressed="true">Lean towards my mouse</button>
                        <p class="hint">Click an empty bit of the background for a whoosh.</p>
                    </div>
                </div>
            </div>
            <div>
                <p class="label">Font</p>
                <div class="row">${pills('font', FONTS, store.get('site-font', 'bubbly'))}</div>
            </div>
            <div class="panel-foot">
                <span></span>
                <button type="button" class="pill" data-reset>Reset everything</button>
            </div>`;
        document.body.appendChild(p);

        p.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-close')) return togglePanel(false);
            if (b.dataset.theme) {
                const t = (THEMES.find(x => x[0] === b.dataset.theme) || [])[2];
                if (t) { setBg(t.bg); setFloaties(t.fl); setFont(t.font); poke(); }
                return;
            }
            if (b.dataset.bg) {
                if (b.dataset.bg === 'original') { if (window.revertToOriginalBackground) window.revertToOriginalBackground(); applyInk(); syncPanel(); }
                else setBg(b.dataset.bg);
                return;
            }
            if (b.hasAttribute('data-surprise')) {
                setBg(randomColor());
                const pickable = shapes().filter(s => s[0] !== 'none');
                setFloaties({ shape: pickable[Math.floor(Math.random() * pickable.length)][0], color: 'auto' });
                setFont(FONTS[Math.floor(Math.random() * FONTS.length)][0]);
                poke();
                return;
            }
            if (b.dataset.shape) return setFloaties({ shape: b.dataset.shape });
            if (b.dataset.amount) return setFloaties({ amount: b.dataset.amount });
            if (b.dataset.speed) return setFloaties({ speed: +b.dataset.speed });
            if (b.dataset.fcolor) return setFloaties({ color: b.dataset.fcolor });
            if (b.hasAttribute('data-follow')) return setFloaties({ follow: !floaties.follow });
            if (b.dataset.font) return setFont(b.dataset.font);
            if (b.hasAttribute('data-reset')) {
                if (window.revertToOriginalBackground) window.revertToOriginalBackground();
                applyInk();
                setFont('bubbly');
                setFloaties(Object.assign({}, FLOATIE_DEFAULTS));
            }
        });
        const pick = $('[data-bgpick]', p);
        pick.addEventListener('input', () => setBg(pick.value));
        // typing a colour code: #000000, 000000 or #000 all work
        const hex = $('[data-bghex]', p);
        const applyHex = () => {
            let v = hex.value.trim().replace(/^#?/, '#').toLowerCase();
            if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v.slice(1).split('').map(c => c + c).join('');
            if (/^#[0-9a-f]{6}$/.test(v)) { hex.classList.remove('bad'); setBg(v); } else if (hex.value.length >= 4) hex.classList.add('bad');
        };
        hex.addEventListener('input', applyHex);
        hex.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyHex(); } });
        syncPanel();
    }

    function syncPanel() {
        const p = $('#customise');
        if (!p) return;
        const bg = currentBg().toLowerCase();
        let saved = ''; try { saved = localStorage.getItem('backgroundColor') || ''; } catch (e) {}
        const isOriginal = !saved || !hexToRgb(bg);
        p.querySelectorAll('[data-bg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bg === 'original' ? isOriginal : b.dataset.bg === bg)));
        const pick = $('[data-bgpick]', p);
        if (pick && hexToRgb(bg)) pick.value = bg.length === 4 ? '#' + bg.slice(1).split('').map(c => c + c).join('') : bg;
        const hx = $('[data-bghex]', p);
        if (hx && document.activeElement !== hx) hx.value = hexToRgb(bg) ? (bg.length === 4 ? '#' + bg.slice(1).split('').map(c => c + c).join('') : bg) : '';
        const font = store.get('site-font', 'bubbly');
        p.querySelectorAll('[data-theme]').forEach(b => { const t = (THEMES.find(x => x[0] === b.dataset.theme) || [])[2];
            b.setAttribute('aria-pressed', String(!!t && !isOriginal && t.bg === bg && t.font === font && Object.keys(t.fl).every(k => String(t.fl[k]) === String(floaties[k])))); });
        p.querySelectorAll('[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === floaties.shape)));
        p.querySelectorAll('[data-amount]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.amount === floaties.amount)));
        p.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === +floaties.speed)));
        p.querySelectorAll('[data-fcolor]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fcolor === floaties.color)));
        p.querySelectorAll('[data-font]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === font)));
        const f = $('[data-follow]', p);
        if (f) f.setAttribute('aria-pressed', String(!!floaties.follow));
        p.querySelectorAll('[data-when-floaties]').forEach(r => { r.style.display = floaties.shape === 'none' ? 'none' : ''; });
    }

    function togglePanel(open) {
        const p = $('#customise');
        const btn = $('#customiseBtn');
        if (!p) return;
        const show = open == null ? p.hidden : open;
        p.hidden = !show;
        if (btn) btn.setAttribute('aria-expanded', String(show));
        if (show) { const first = p.querySelector('button'); if (first) first.focus(); }
        else if (btn && p.contains(document.activeElement)) btn.focus();
    }

    // ---------- Whoosh ----------
    function poke() { try { window.__threeScene && window.__threeScene.poke && window.__threeScene.poke(); } catch (e) {} }

    // ---------- Home page ----------
    // Every game has one kind (data/projects.json). It's the chip on the card and what the filter row filters by.
    // Switched off for now: set SHOW_KINDS to true to bring back the chips and the filter row above "More games".
    const SHOW_KINDS = false;
    const KINDS = { adventure: ['Adventure', 'c3'], arcade: ['Arcade', 'c2'], puzzle: ['Puzzle', 'c1'], experiment: ['Experiments', 'c4'], daily: ['Daily', 'c0'], creative: ['Creative', 'c0'] };
    const kindChip = (p) => { const k = SHOW_KINDS && KINDS[p.kind]; return k ? `<span class="chip ${k[1]}">${esc(p.kind)}</span>` : ''; };

    function cardHtml(p) {
        const desc = p.description || p.subtitle || '';
        return `<a class="card stk play-link" data-kind="${esc(p.kind || '')}" href="${esc(p.path)}" data-path="${esc(p.path)}">
            ${p.thumbnail ? `<img class="thumb" src="${esc(p.thumbnail)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
            <span class="card-body">
                <span class="card-title disp">${esc(p.title)}</span>
                ${kindChip(p) ? `<span class="tags">${kindChip(p)}</span>` : ''}
                ${desc ? `<span class="card-desc">${esc(desc)}</span>` : ''}
            </span>
        </a>`;
    }

    async function renderHome() {
        const featureEl = $('#feature'), gridEl = $('#gameGrid'), shelfEl = $('#shelfGrid');
        if (!featureEl && !gridEl && !shelfEl) return;
        let projects = [];
        try { projects = await (await fetch('data/projects.json', { cache: 'no-cache' })).json(); } catch (e) { console.warn('Could not load projects.json', e); }
        projects = projects.filter(p => !p.daily); // daily games live on /daily.html (the home page links there instead)
        projects = projects.filter(p => !p.page);  // pages of their own (the Studio) have their own strip on the home page
        const featured = projects.filter(p => p.featured);
        const others = projects.filter(p => !p.featured);
        const top = featured[0];

        if (featureEl && top) {
            featureEl.innerHTML = `
                ${top.thumbnail ? `<img class="feature-img" src="${esc(top.thumbnail)}" alt="${esc(top.title)} screenshot">` : ''}
                <div class="feature-body">
                    ${kindChip(top) ? `<div class="tags">${kindChip(top)}</div>` : ''}
                    <h2 class="disp">${esc(top.title)}</h2>
                    ${top.description ? `<p>${esc(top.description)}</p>` : ''}
                    <div class="actions">
                        <a class="btn btn-pink play-link" href="${esc(top.path)}" data-path="${esc(top.path)}" style="font-size:20px;padding:12px 26px">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>Play
                        </a>
                    </div>
                </div>
                <span class="badge disp" aria-hidden="true">New!</span>`;
        }
        if (featureEl && top && !featureEl.dataset.wholeCard) { // clicking anywhere on the featured card plays it
            featureEl.dataset.wholeCard = '1';
            featureEl.addEventListener('click', (e) => { if (e.target.closest('a, button')) return; const a = featureEl.querySelector('.play-link'); if (a) a.click(); });
        }
        if (gridEl) gridEl.innerHTML = featured.slice(1).map(cardHtml).join('');
        const filtersEl = $('#gameFilters');
        if (filtersEl && gridEl && SHOW_KINDS) {
            const have = new Set(featured.slice(1).map(p => p.kind)); // only the main games, not the "Other stuff" shelf
            const kinds = Object.keys(KINDS).filter(k => have.has(k));
            filtersEl.innerHTML = kinds.length < 2 ? '' : ['', ...kinds].map(k => `<button type="button" class="pill" data-kind="${k}" aria-pressed="${k ? 'false' : 'true'}">${k ? KINDS[k][0] : 'All'}</button>`).join('');
            filtersEl.hidden = kinds.length < 2;
            filtersEl.onclick = (e) => { const b = e.target.closest('.pill'); if (b) setFilter(b.dataset.kind); };
        }
        if (shelfEl) shelfEl.innerHTML = others.map(p => `
            <a class="mini-link play-link" href="${esc(p.path)}" data-path="${esc(p.path)}">
                ${p.thumbnail ? `<img src="${esc(p.thumbnail)}" alt="" loading="lazy">` : ''}${esc(p.title)}
            </a>`).join('');
    }

    // The filter row: only filters the cards under "More games". The "Other stuff" shelf is left alone.
    function setFilter(kind) {
        document.querySelectorAll('#gameFilters .pill').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
        document.querySelectorAll('#gameGrid .card').forEach(c => { c.hidden = !!kind && c.dataset.kind !== kind; });
    }

    // Clicking a game plays it in the page; ctrl/cmd/middle-click still opens a new tab
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('.play-link');
        if (!a || typeof window.playFromAnchor !== 'function') return;
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.playFromAnchor(a);
    });

    // Cards lean towards the pointer in 3D
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
        document.addEventListener('pointermove', (e) => {
            const card = e.target.closest && e.target.closest('.card');
            if (!card || e.pointerType === 'touch') return;
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
            card.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
        }, { passive: true });
        document.addEventListener('pointerout', (e) => {
            const card = e.target.closest && e.target.closest('.card');
            if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
        });
    }

    // ---------- Jokes ----------
    let jokes = null, jokeIdx = -1;
    async function loadJokes() {
        if (jokes) return jokes;
        try { jokes = await (await fetch('data/jokes.json')).json(); } catch (e) { jokes = []; }
        return jokes;
    }
    async function nextJoke() {
        const el = $('#jokeText');
        if (!el) return;
        const list = await loadJokes();
        if (!list.length) return;
        let i;
        do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === jokeIdx);
        jokeIdx = i;
        el.textContent = list[i];
    }
    async function toggleAllJokes() {
        const box = $('#allJokes'), btn = $('#allJokesBtn');
        if (!box || !btn) return;
        if (box.hidden) {
            const list = await loadJokes();
            box.innerHTML = list.map((j, i) => `<div class="joke-item"><strong>${i + 1}.</strong> ${esc(j)}</div>`).join('');
            box.hidden = false;
            btn.textContent = 'Hide all jokes';
            btn.setAttribute('aria-expanded', 'true');
        } else {
            box.hidden = true;
            btn.textContent = 'Show all jokes';
            btn.setAttribute('aria-expanded', 'false');
        }
    }

    // ---------- Start ----------
    // Called by bit.js the moment Pip is set free: the site switches to his look, his heads float
    // in the background, and Customise gets his colour (as the new original) and the Pips floaties.
    window.pipTakesOver = function () {
        if (window.revertToOriginalBackground) window.revertToOriginalBackground();
        applyInk();
        const old = $('#customise'), wasOpen = old && !old.hidden;
        if (old) old.remove();
        buildPanel();
        if (wasOpen) togglePanel(true);
        Object.assign(FLOATIE_DEFAULTS, { shape: 'pips', amount: 'few' });
        setFloaties({ shape: 'pips', amount: 'few', color: 'auto' });
    };

    function start() {
        applyInk();
        const font = store.get('site-font', 'bubbly');
        if (font !== 'bubbly') document.documentElement.classList.add('font-' + font);
        buildPanel();
        const btn = $('#customiseBtn');
        if (btn) btn.addEventListener('click', () => togglePanel());
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') togglePanel(false); });
        document.addEventListener('pointerdown', (e) => {
            const p = $('#customise');
            const inside = e.target.closest && e.target.closest('a, button, input, label, .stk, .joke-note, .player-area, .modal');
            if (p && !p.hidden && !inside) togglePanel(false);
            if (!inside) poke();
        });
        renderHome();
        const jb = $('#jokeBtn');
        if (jb) jb.addEventListener('click', nextJoke);
        const ab = $('#allJokesBtn');
        if (ab) ab.addEventListener('click', toggleAllJokes);
        nextJoke();
        // script.js turns the 3D background on a moment after load; give it the saved floaties then
        let tries = 0;
        const t = setInterval(() => {
            if (window.__threeScene && window.__threeScene.setOptions) { window.__threeScene.setOptions(floaties); clearInterval(t); }
            else if (++tries > 40) clearInterval(t);
        }, 250);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

// The logo (the Ó) comes alive in the header: two eyes appear in the hole, follow the mouse and blink.
// They sit on top of the logo image, so everything that already uses `.brand img` keeps working.
(() => {
    const img = document.querySelector('.brand img'); if (!img) return;
    const brand = img.closest('.brand'); if (getComputedStyle(brand).position === 'static') brand.style.position = 'relative';
    const eyes = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    eyes.setAttribute('viewBox', '-10 -10 20 20'); eyes.setAttribute('class', 'brand-eyes'); eyes.setAttribute('aria-hidden', 'true');
    eyes.innerHTML = '<g class="be-look"><g class="be-blink"><ellipse cx="-3.6" cy="0" rx="2.4" ry="3.1"/><ellipse cx="3.6" cy="0" rx="2.4" ry="3.1"/></g><circle class="be-shine" cx="-4.4" cy="-1.3" r=".9"/><circle class="be-shine" cx="2.8" cy="-1.3" r=".9"/></g>';
    brand.appendChild(eyes);
    const look = eyes.querySelector('.be-look');
    let mx = innerWidth / 2, my = 0, gaze = null, gazeUntil = 0;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });
    // Pip and the Ó: bit.js can make it glance at him, look away, or blink (it never says anything)
    const pipAt = () => { const el = [document.querySelector('#bit:not([hidden])'), document.querySelector('.bit-launch .pip-head')].find(x => x && x.offsetWidth); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + Math.min(r.width / 2, 60), r.top + Math.min(r.height / 2, 60)]; };
    const blinkN = n => { for (let i = 0; i < n; i++) setTimeout(() => { eyes.classList.add('blink'); setTimeout(() => eyes.classList.remove('blink'), 120); }, i * 260); };
    window.pipLogo = {
        look(where, ms = 1800) { gaze = where; gazeUntil = Date.now() + ms; },
        blink: (n = 1) => blinkN(n),
        // a short reaction: 'glance' (at Pip), 'away' (looks away from him), 'blink', 'stare' (at Pip, long), 'roll' (looks up, then at Pip)
        react(kind) {
            if (kind === 'glance') { this.look('pip', 1600); setTimeout(() => blinkN(1), 700); }
            else if (kind === 'away') { this.look('away', 2200); }
            else if (kind === 'stare') { this.look('pip', 4200); }
            else if (kind === 'roll') { this.look('up', 900); setTimeout(() => this.look('pip', 1400), 900); }
            else blinkN(2);
        }
    };
    (function place() {
        // while the logo is being knocked about (Pip's Snake quest), the eyes ride along with it instead of being re-measured
        if (brand.classList.contains('pip-bumped') || brand.classList.contains('pip-bump-back')) { requestAnimationFrame(place); return; }
        const src = img.getAttribute('src') || '', on = /logo(-pip)?\.svg/.test(src) && img.offsetWidth > 0;
        eyes.style.display = on ? '' : 'none';
        if (on) {
            const br = brand.getBoundingClientRect(), ir = img.getBoundingClientRect(), w = img.offsetWidth, h = img.offsetHeight;
            const t = getComputedStyle(img).transform, m = new DOMMatrix(t === 'none' ? undefined : t);
            const dy = h * .13; // the hole is 13% below the middle of logo.svg
            const cx = ir.left + ir.width / 2 + m.c * dy - br.left, cy = ir.top + ir.height / 2 + m.d * dy - br.top, size = w * .26;
            eyes.style.width = eyes.style.height = size + 'px'; eyes.style.left = (cx - size / 2) + 'px'; eyes.style.top = (cy - size / 2) + 'px';
            eyes.style.transform = `rotate(${Math.atan2(m.b, m.a)}rad)`;
            const ex = br.left + cx, ey = br.top + cy;
            let tx = mx, ty = my;
            if (gaze && Date.now() < gazeUntil) { const p = pipAt(); if (gaze === 'pip' && p) [tx, ty] = p; else if (gaze === 'away' && p) [tx, ty] = [2 * ex - p[0], 2 * ey - p[1]]; else if (gaze === 'up') [tx, ty] = [ex, ey - 400]; } else gaze = null;
            const a = Math.atan2(ty - ey, tx - ex), d = Math.min(1, Math.hypot(tx - ex, ty - ey) / 300);
            look.setAttribute('transform', `translate(${(Math.cos(a) * 2.6 * d).toFixed(2)} ${(Math.sin(a) * 2.6 * d).toFixed(2)})`);
            eyes.classList.toggle('pip', /logo-pip/.test(src));
        }
        requestAnimationFrame(place);
    })();
    (function blink() { setTimeout(() => { eyes.classList.add('blink'); setTimeout(() => eyes.classList.remove('blink'), 130); if (Math.random() < .2) setTimeout(() => { eyes.classList.add('blink'); setTimeout(() => eyes.classList.remove('blink'), 120); }, 260); blink(); }, 2600 + Math.random() * 4200); })();
})();
