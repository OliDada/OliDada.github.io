// Pip's story (see bit.js on olid.is): the second piece of Oli's password is hidden
// outside this game. bit.js loads this file into Snake while you're looking for it.
// Pip talks by deleting the score at the top and typing over it. He cracks the wall,
// knocks a hole in it, and when the snake goes through it slides out of the game and
// onto the website, where bit.js takes over.
(function () {
    if (window.__pipEscape) return;
    window.__pipEscape = true;
    const post = (ev, data) => { try { parent.postMessage(Object.assign({ type: 'pip-snake', ev }, data || {}), '*'); } catch (e) {} };
    let state = 'wait', gap = [], openedAt = 0, crackT = 0, shakeUntil = 0;
    const side = window.__pipHoleSide === 'bottom' ? 'bottom' : 'right'; // (on narrow screens there's more website below the game than beside it)

    // ---- phones: swipe to steer (the game only had arrow keys)
    let touch = null;
    const turn = (dx, dy) => {
        if (state === 'out') { post('key', { dx, dy }); return; }
        if (typeof snake === 'undefined' || (typeof gameOver !== 'undefined' && gameOver)) return;
        if (dx && snake.xspeed === -dx && snake.tail.length) return; // no turning back on yourself
        if (dy && snake.yspeed === -dy && snake.tail.length) return;
        snake.dir(dx, dy);
    };
    addEventListener('touchstart', e => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true });
    addEventListener('touchend', e => {
        if (!touch) return; const t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
    }, { passive: true });
    // once you're out, the arrow keys steer the snake out on the website
    addEventListener('keydown', e => {
        if (state !== 'out') return;
        const k = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
        if (k) { e.preventDefault(); post('key', { dx: k[0], dy: k[1] }); }
    });

    // ---- Pip types over the score
    // lines: what's on screen now; queue: what he wants to say next
    let lines = null, mode = 'real', target = null, modeAt = 0, queue = [], isPip = false;
    const realLines = () => ['Score: ' + snake.tail.length, typeof hiscore !== 'undefined' && hiscore ? 'Hi-Score: ' + hiscore : ''];
    const sayInGame = (a, b, hold = 2600) => queue.push({ l: [a, b || ''], hold });
    const ERASE = 35, TYPE = 75;
    function scoreText() {
        // keep the game's own bookkeeping (the hi-score)
        const sc = snake.tail.length;
        if (typeof hiscore !== 'undefined' && sc > hiscore) { hiscore = sc; try { localStorage.setItem('snakeHiscore', hiscore); } catch (e) {} }
        const now = Date.now(), real = realLines();
        if (!lines) lines = real.slice();
        if (mode === 'real') { lines = real.slice(); if (queue.length) { target = queue.shift(); mode = 'erase'; modeAt = now; } }
        else if (mode === 'erase' || mode === 'eraseBack') {
            const total = lines[0].length + lines[1].length, n = Math.floor((now - modeAt) / ERASE);
            if (n > 0) { modeAt += n * ERASE; for (let i = 0; i < n; i++) { if (lines[1]) lines[1] = lines[1].slice(0, -1); else lines[0] = lines[0].slice(0, -1); } }
            if (!lines[0] && !lines[1] || total === 0) { mode = mode === 'erase' ? 'type' : 'typeBack'; isPip = mode === 'type'; modeAt = now; }
        } else if (mode === 'type' || mode === 'typeBack') {
            const want = mode === 'type' ? target.l : real, n = Math.floor((now - modeAt) / TYPE);
            for (let i = 0; i < n; i++) {
                if (lines[0].length < want[0].length) lines[0] = want[0].slice(0, lines[0].length + 1);
                else if (lines[1].length < want[1].length) lines[1] = want[1].slice(0, lines[1].length + 1);
            }
            if (n > 0) modeAt += n * TYPE;
            if (lines[0] === want[0] && lines[1] === want[1]) { if (mode === 'type') { mode = 'hold'; modeAt = now; } else mode = 'real'; }
        } else if (mode === 'hold' && now - modeAt > target.hold) {
            if (queue.length) { target = queue.shift(); mode = 'erase'; modeAt = now; } else { mode = 'eraseBack'; modeAt = now; }
        }
        const typing = mode === 'type' || mode === 'typeBack';
        const want = mode === 'type' ? target.l : realLines(), caretLine = lines[1].length || lines[0].length >= want[0].length ? 1 : 0;
        fill(isPip ? color(213, 194, 255) : 255);
        textFont('Press Start 2P'); textAlign(CENTER);
        for (let i = 0; i < 2; i++) {
            const t = lines[i] + (typing && i === caretLine && Math.floor(now / 250) % 2 ? '_' : '');
            if (!t) continue;
            textSize(Math.min(32, Math.floor(560 / Math.max(1, t.length)))); text(t, width / 2, i ? 60 : 30);
        }
    }

    // ---- the hole: Pip breaks the game's screen from the outside
    // Three hits, each harder than the last. Every hit shakes the whole game and the cracks jump further:
    // blocky, right-angled cracks, in the game's own pixel look. The last hit knocks a chunk of the edge
    // into the board in a spray of squares and leaves a black hole the snake fits through.
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let hole = [], cracks = [], debris = [], holeMid = 0;
    const HITS = [300, 1700, 3100]; // ms after the cracking starts
    let hitsDone = 0, shakeAmp = 0, impactAt = 0, flashUntil = 0;
    // into the play area / along the edge → x, y on the canvas, for whichever edge
    const P = (into, al) => side === 'right' ? [width - into, al] : [al, height - into];
    function planHole() {
        const u = scl / 2, a0 = gap[0] * scl - u, a1 = (gap[2] + 1) * scl + u;
        holeMid = (a0 + a1) / 2;
        // the outline of the chunk that breaks out: stepped, like everything else in this game
        hole = [[0, a0]];
        const n = Math.round((a1 - a0) / u);
        for (let i = 0; i < n; i++) {
            const mid = 1 - Math.abs((i + 0.5) / n - 0.5) * 2;
            const d = u * Math.max(1, Math.round(1 + mid * 3 + (rnd() - 0.5) * 1.5));
            hole.push([d, a0 + i * u], [d, a0 + (i + 1) * u]);
        }
        hole.push([0, a1]);
        // the cracks: right-angled zigzags running in from the edge, forking as they go
        cracks = [];
        const branch = (u0, al0, dirA, len, depth) => {
            const pts = [[u0, al0]]; let cu = u0, ca = al0, inward = true;
            for (let k = 0; k < len; k++) {
                if (inward) cu += u * (1 + Math.floor(rnd() * 2)); else ca += dirA * u * (1 + Math.floor(rnd() * 2));
                pts.push([cu, ca]); inward = !inward;
                if (depth < 2 && k > 1 && rnd() < 0.3) branch(cu, ca, -dirA, Math.max(2, len - k - 1), depth + 1);
            }
            cracks.push(pts);
        };
        for (let k = 0; k < 6; k++) branch(0, holeMid + (k - 2.5) * u * 1.6, k < 3 ? -1 : 1, 5 + Math.floor(rnd() * 5), 0);
    }
    const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([u, a], i) => { const [x, y] = P(u, a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
    const spray = (n, power) => {
        const u = scl / 2;
        for (let i = 0; i < n; i++) {
            const al = hole[0][1] + Math.random() * (hole[hole.length - 1][1] - hole[0][1]), [x, y] = P(Math.random() * u * 2, al), sp = power * (0.4 + Math.random());
            debris.push(Object.assign({ x, y, s: Math.max(3, u * (0.4 + Math.random() * 0.7)), c: Math.random() < 0.5 ? '#ffffff' : '#9a9aa8' },
                side === 'right' ? { vx: -sp, vy: (Math.random() - 0.65) * power * 0.9 } : { vx: (Math.random() - 0.5) * power * 1.1, vy: -sp * 1.3 }));
        }
    };
    // under the snake: the black hole, once it's open
    function drawUnder() {
        if (state === 'wait' || state === 'cracking' || state === 'done' || !hole.length) return;
        const ctx = drawingContext;
        ctx.save(); ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
        path(ctx, hole); ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; path(ctx, hole.slice(1, -1)); ctx.stroke(); // the broken edge
        ctx.restore();
    }
    // over the snake: the hits, the cracks, and the squares flying out of the wall
    function drawOver() {
        const ctx = drawingContext, now = Date.now();
        // the whole game shakes when Pip hits it
        ctx.canvas.style.transform = now < shakeUntil ? `translate(${((Math.random() - 0.5) * 2 * shakeAmp).toFixed(1)}px, ${((Math.random() - 0.5) * 2 * shakeAmp).toFixed(1)}px)` : '';
        if (state === 'wait' || state === 'done' || !cracks.length) return;
        if (state === 'cracking') while (hitsDone < HITS.length && now - crackT >= HITS[hitsDone]) { hitsDone++; shakeAmp = 2 + hitsDone * 2; shakeUntil = now + 230; impactAt = now; spray(3 + hitsDone * 2, 3 + hitsDone); }
        const grow = state === 'cracking' ? hitsDone / HITS.length : 1;
        ctx.save();
        ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
        ctx.save();
        // once the chunk is out, the cracks stop at the edge of the hole
        if (state !== 'cracking') { ctx.beginPath(); ctx.rect(-10, -10, width + 20, height + 20); hole.forEach(([u, a], i) => { const [x, y] = P(u, a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip('evenodd'); }
        if (grow > 0) for (const c of cracks) {
            const part = c.slice(0, Math.max(2, Math.ceil(c.length * grow)));
            ctx.strokeStyle = '#000'; ctx.lineWidth = 6; path(ctx, part); ctx.stroke();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; path(ctx, part); ctx.stroke();
        }
        ctx.restore();
        // the hit itself: a white burst on the edge, for a blink
        if (now - impactAt < 110) { const [x, y] = P(0, holeMid), r = scl * (0.6 + hitsDone * 0.35); ctx.fillStyle = '#fff'; ctx.fillRect(x - r, y - r / 3, r * 2, r / 1.5); ctx.fillRect(x - r / 3, y - r, r / 1.5, r * 2); }
        // the chunk flashes white as it goes
        if (now < flashUntil) { path(ctx, hole); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); }
        // squares knocked out of the wall, falling
        for (const d of debris) { d.x += d.vx; d.y += d.vy; d.vy += 0.45; ctx.fillStyle = d.c; ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s, d.s); }
        debris = debris.filter(d => d.y < height + 30 && d.x > -30 && d.x < width + 30);
        ctx.restore();
    }
    function knockOut() {
        const now = Date.now();
        hitsDone = HITS.length; impactAt = now; flashUntil = now + 90;
        shakeAmp = 11; shakeUntil = now + 520;
        spray(34, 9);
    }

    const start = () => {
        if (typeof snake === 'undefined' || typeof width === 'undefined') { setTimeout(start, 300); return; }
        const rows = Math.floor(height / scl), cols = Math.floor(width / scl);
        const mid = side === 'right' ? 8 + Math.floor(Math.random() * (rows - 14)) /* clear of the score at the top */ : 6 + Math.floor(Math.random() * (cols - 12));
        gap = [mid - 1, mid, mid + 1]; window.__pipGap = gap;
        planHole();
        // the snake can leave through the gap instead of dying on the wall
        const update = snake.update;
        snake.update = function () {
            if (state === 'out') return;
            if (state === 'open' && side === 'right' && this.xspeed === 1 && this.x + scl > width - scl && gap.includes(Math.round(this.y / scl))) { escape(this); return; }
            if (state === 'open' && side === 'bottom' && this.yspeed === 1 && this.y + scl > height - scl && gap.includes(Math.round(this.x / scl))) { escape(this); return; }
            update.call(this);
        };
        const death0 = snake.death;
        snake.death = function () { if (state !== 'out') death0.call(this); }; // nothing can kill it while it's out on the website
        snake.show0 = snake.show;
        const show0 = snake.show;
        snake.show = function () { if (state !== 'out') show0.call(this); }; // the normal snake; once it's on the website it's drawn there
        // the game draws its score after the snake and before the game-over screen: the hole and Pip's typing go there
        window.score = function () { drawOver(); scoreText(); };
        // and the hole goes down first, under the snake
        const bg0 = window.background;
        window.background = function () { bg0.apply(this, arguments); drawUnder(); };
        const where = side === 'right' ? 'On the right.' : 'At the bottom.';
        setTimeout(() => { sayInGame('Hold on.', 'Let me try something.', 3200); }, 2500);
        setTimeout(() => { state = 'cracking'; crackT = Date.now(); post('cracking'); }, 4500);
        setTimeout(() => { state = 'open'; openedAt = Date.now(); knockOut(); post('open'); sayInGame('There. A hole.', 'Go through it.', 3400); }, 8700);
        // and if you take your time, he reminds you
        const NAGS = [['The hole!', where], ['Go on.', 'Through the hole.'], ['I broke it', 'for you. Use it.'], ['Still here.', where]];
        let nag = 0;
        setInterval(() => { if (state === 'open' && Date.now() - openedAt > 12000 && !queue.length && mode === 'real' && !(typeof gameOver !== 'undefined' && gameOver)) { const [a, b] = NAGS[nag++ % NAGS.length]; sayInGame(a, b, 2600); openedAt = Date.now(); } }, 1000);
        post('ready');
    };

    function escape(s) {
        state = 'out';
        // hand the whole snake to the website: where every piece of it is, in game cells
        const hc = Math.round(s.x / scl), hr = Math.round(s.y / scl);
        const cells = [side === 'right' ? [hc + 1, hr] : [hc, hr + 1], [hc, hr]];
        for (let i = s.tail.length - 1; i >= 0; i--) if (s.tail[i]) cells.push([Math.round(s.tail[i].x / scl), Math.round(s.tail[i].y / scl)]);
        const c = document.querySelector('canvas').getBoundingClientRect();
        post('out', { canvas: { left: c.left, top: c.top, width: c.width }, cols: width / scl, cells, dir: side === 'right' ? [1, 0] : [0, 1] });
        shakeUntil = 0; debris = [];
        queue = []; // the game keeps running without the snake, so Pip can keep typing over the score
    }

    // lines from the website while the snake is out there: typed over the score like everything else
    addEventListener('message', e => {
        if (!e.data || e.data.type !== 'pip-snake-say') return;
        const next = { l: [String(e.data.a || ''), String(e.data.b || '')], hold: e.data.hold || 2400 };
        queue = [];
        if (mode === 'real' || !lines) queue.push(next); else { target = next; mode = 'erase'; modeAt = Date.now(); } // interrupts what he was saying
    });
    addEventListener('message', e => {
        if (!e.data || e.data.type !== 'pip-snake-back') return;
        state = 'done';
        snake.total = 0; snake.tail = []; snake.x = 0; snake.y = 0; snake.dir(1, 0);
        queue = []; mode = 'real';
        loop();
    });
    start();
})();
