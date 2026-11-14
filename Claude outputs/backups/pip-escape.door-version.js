// Pip's story (see bit.js on olid.is): the second piece of Oli's password is hidden
// outside this game. bit.js loads this file into Snake while you're looking for it.
// Pip talks by deleting the score at the top and typing over it. He opens a gap in the
// edge of the board, and when the snake goes through it slides out of the game and onto
// the website, where bit.js takes over.
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

    // ---- the way out: drawn in the game's own squares
    // Pip marks a doorway on the edge with two white posts, the wall between them shows up as grey
    // squares, then those squares slide out of the game one by one and leave a gap the snake fits through.
    let wall = [];
    // a cell on the edge (the last column, or the last row), as canvas x, y
    const edgeCell = i => side === 'right' ? [width - scl, i * scl] : [i * scl, height - scl];
    function planHole() { wall = gap.map((g, k) => ({ g, out: 0, delay: k * 140 })); }
    const sq = (x, y, fillC, a = 1) => { push(); noStroke(); fill(fillC[0], fillC[1], fillC[2], 255 * a); rect(x + 1, y + 1, scl - 2, scl - 2); pop(); };
    // under the snake: nothing (the gap is just the black of the game)
    function drawUnder() {}
    // over the snake: the posts, and the wall sliding out
    function drawOver() {
        if (state === 'wait' || state === 'done' || !wall.length) return;
        const now = Date.now(), p = state === 'cracking' ? Math.min(1, (now - crackT) / 3600) : 1;
        // posts either side of the doorway: they appear first
        const pa = Math.min(1, p / 0.3);
        for (const g of [gap[0] - 1, gap[2] + 1]) { const [x, y] = edgeCell(g); sq(x, y, [255, 255, 255], pa); }
        // the wall between them
        for (const w of wall) {
            const [x, y] = edgeCell(w.g);
            if (state === 'cracking') { if (p > 0.35) sq(x, y, [150, 150, 165], Math.min(1, (p - 0.35) / 0.3)); continue; }
            const t = Math.max(0, now - openedAt - w.delay), k = Math.min(1, t / 450);
            if (k >= 1) continue;
            const e = k * k, dx = side === 'right' ? e * scl * 1.4 : 0, dy = side === 'bottom' ? e * scl * 1.4 : 0;
            sq(x + dx, y + dy, [150, 150, 165], 1 - k);
        }
    }
    function knockOut() { shakeUntil = Date.now() + 160; }

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
        setTimeout(() => { state = 'open'; openedAt = Date.now(); knockOut(); post('open'); sayInGame('There. A way out.', 'Go through it.', 3400); }, 8700);
        // and if you take your time, he reminds you
        const NAGS = [['The gap!', where], ['Go on.', 'Through the gap.'], ['I opened it', 'for you. Use it.'], ['Still open.', where]];
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
