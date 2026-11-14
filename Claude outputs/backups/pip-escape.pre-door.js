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
    // Thin cracks spread out from a point on the edge, like glass, then a jagged piece
    // of the screen pops out and falls away, leaving a dark hole the snake fits through.
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let hole = [], cracks = [], shards = [];
    // into the play area / along the edge → x, y on the canvas, for whichever edge
    const P = (into, al) => side === 'right' ? [width - into, al] : [al, height - into];
    function planHole() {
        const a0 = gap[0] * scl - 10, a1 = (gap[2] + 1) * scl + 10, am = (a0 + a1) / 2;
        // the outline of the piece that breaks out: along the edge, then a ragged line back inside
        hole = [[0, a0]];
        const n = 9;
        for (let i = 0; i <= n; i++) { const al = a0 + (a1 - a0) * i / n, mid = 1 - Math.abs(i / n - 0.5) * 2; hole.push([scl * (0.5 + 1.5 * mid) + rnd() * scl * 0.6, al + (rnd() - 0.5) * 8]); }
        hole.push([0, a1]);
        // cracks: rays from the edge, kinked, a couple of them forked, plus a ring joining them
        cracks = [];
        const rays = [];
        for (let k = 0; k < 9; k++) {
            const ang = -1.25 + 2.5 * (k / 8) + (rnd() - 0.5) * 0.25, len = 70 + rnd() * 120, pts = [[0, am]];
            let u = 0, a = am;
            for (let d = 0; d < len; d += 14 + rnd() * 16) { const aa = ang + (rnd() - 0.5) * 0.5; u = Math.max(0, u + Math.cos(aa) * 18); a += Math.sin(aa) * 18; pts.push([u, a]); }
            cracks.push(pts); rays.push(pts);
            if (rnd() < 0.4 && pts.length > 3) { const f = pts[2], br = [f]; let fu = f[0], fa = f[1]; for (let j = 0; j < 3; j++) { fu += 12 + rnd() * 10; fa += (rnd() - 0.5) * 30; br.push([fu, fa]); } cracks.push(br); }
        }
        for (const r of [70]) { const ring = []; for (const ray of rays) { const p = ray[Math.min(ray.length - 1, Math.round(r / 22))]; if (p) ring.push(p); } cracks.push(ring); }
    }
    const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([u, a], i) => { const [x, y] = P(u, a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); };
    // under the snake: the dark hole, once it's open
    function drawUnder() {
        if (state === 'wait' || state === 'cracking' || state === 'done' || !hole.length) return;
        const ctx = drawingContext;
        ctx.save();
        path(ctx, hole); ctx.closePath();
        const [gx, gy] = P(0, (hole[0][1] + hole[hole.length - 1][1]) / 2), [hx, hy] = P(scl * 1.6, (hole[0][1] + hole[hole.length - 1][1]) / 2);
        const g = ctx.createLinearGradient(gx, gy, hx, hy); g.addColorStop(0, '#000'); g.addColorStop(1, '#111118');
        ctx.fillStyle = g; ctx.fill();
        // the broken edge catches a little light
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1.5; path(ctx, hole.slice(1, -1)); ctx.stroke();
        ctx.restore();
    }
    // over the snake: the cracks in the screen, and the broken piece falling out
    function drawOver() {
        if (state === 'wait' || state === 'done' || !cracks.length) return;
        const ctx = drawingContext, now = Date.now();
        const grow = state === 'cracking' ? Math.min(1, (now - crackT) / 4000) : 1;
        ctx.save();
        if (now < shakeUntil) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // once the piece is out, the cracks stop at the edge of the hole
        if (state !== 'cracking') { ctx.beginPath(); ctx.rect(-10, -10, width + 20, height + 20); hole.forEach(([u, a], i) => { const [x, y] = P(u, a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip('evenodd'); }
        cracks.forEach((c, i) => {
            const m = Math.max(2, Math.ceil(c.length * Math.min(1, grow * (1.3 - (i % 4) * 0.12))));
            if (grow <= 0) return;
            const part = c.slice(0, m);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'; ctx.lineWidth = 2.6; path(ctx, part); ctx.stroke();
            ctx.strokeStyle = 'rgba(232, 232, 245, 0.62)'; ctx.lineWidth = 1.1; path(ctx, part); ctx.stroke();
        });
        // the pieces of screen that popped out
        for (const sh of shards) {
            sh.t += 0.1; sh.u += sh.vu; sh.a += sh.va; sh.vu -= 1.2; sh.va *= 0.96; sh.r += sh.vr;
            const [cx, cy] = P(sh.u, sh.a);
            ctx.save(); ctx.globalAlpha = Math.max(0, 1 - sh.t / 1.2); ctx.translate(cx, cy); ctx.rotate(sh.r);
            ctx.beginPath(); sh.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
            ctx.fillStyle = '#3a3a44'; ctx.fill(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.restore();
        }
        shards = shards.filter(sh => sh.t < 1.2);
        ctx.restore();
    }
    function knockOut() {
        // break the hole's outline into triangles around its middle, and throw them out of the screen
        const cu = hole.reduce((t, p) => t + p[0], 0) / hole.length, ca = hole.reduce((t, p) => t + p[1], 0) / hole.length;
        for (let i = 0; i < hole.length - 1; i++) {
            const pts = [[cu, ca], hole[i], hole[i + 1]], mu = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, ma = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
            const [ox, oy] = P(mu, ma);
            shards.push({ u: mu, a: ma, vu: -(3 + Math.random() * 5), va: (Math.random() - 0.5) * 6, r: 0, vr: (Math.random() - 0.5) * 0.5, t: 0,
                pts: pts.map(([u, a]) => { const [x, y] = P(u, a); return [x - ox, y - oy]; }) });
        }
        shakeUntil = Date.now() + 420;
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
        noLoop(); redraw(); // one last frame: the game without the snake, just the hole
    }

    addEventListener('message', e => {
        if (!e.data || e.data.type !== 'pip-snake-back') return;
        state = 'done';
        snake.total = 0; snake.tail = []; snake.x = 0; snake.y = 0; snake.dir(1, 0);
        queue = []; mode = 'real';
        loop();
    });
    start();
})();
