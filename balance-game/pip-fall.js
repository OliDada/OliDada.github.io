// Pip's story (see bit.js on olid.is): the last piece of Oli's password is hidden in
// A Little Higher, the one place nobody looks: underneath it. bit.js loads this file
// into the game while you're looking for it. Pip is the ball. As soon as the climb
// starts he stops it, breaks the beam, and you fall through the meadow into a cave
// that was never part of the game. Steer down it, dodge the roots and rocks, slow
// down for the landing, and the piece is waiting at the bottom.
(function () {
    if (window.__pipFall) return;
    window.__pipFall = true;
    const post = (ev, data) => { try { parent.postMessage(Object.assign({ type: 'pip-fall', ev }, data || {}), '*'); } catch (e) {} };
    const phone = () => typeof isPhone === 'function' && isPhone();
    const face = new Image(); if (window.__pipFaceSrc) face.src = window.__pipFaceSrc;
    const SOIL = ['#b98d63', '#9c7653', '#7f6147', '#654f3d', '#4f4034', '#3d342c'];

    // ---- Pip, typing, on a little paper label like the game's own
    let line = '', shown = '', lineAt = 0, lineHold = 0, queue = [];
    const say = (text, hold = 2200, now = false) => { if (now) { queue = []; line = ''; } queue.push({ text, hold }); };
    function drawLine(t) {
        if (!line && queue.length) { const q = queue.shift(); line = q.text; lineHold = q.hold; lineAt = t; }
        if (!line) return;
        const n = Math.min(line.length, Math.floor((t - lineAt) / 45));
        shown = line.slice(0, n);
        if (n >= line.length && t - lineAt - line.length * 45 > lineHold) { line = ''; return; }
        const c = drawingContext;
        c.save(); c.font = '13px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const w = Math.max(60, c.measureText(line).width + 26), x = width / 2, y = 82;
        c.fillStyle = paper; c.strokeStyle = ink; c.lineWidth = 1.1;
        c.beginPath(); c.rect(x - w / 2, y - 14, w, 28); c.fill(); c.stroke();
        c.fillStyle = ink; c.fillText(shown + (n < line.length && Math.floor(t / 250) % 2 ? '|' : ''), x, y + 1);
        c.restore();
    }

    // ---- Pip is the ball
    const buddy0 = window.drawBuddy;
    function drawPip(x, y, r, spin) {
        const c = drawingContext;
        c.save(); c.translate(x, y); c.rotate(spin || 0);
        c.fillStyle = '#d5c2ff'; c.strokeStyle = ink; c.lineWidth = 1.25;
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
        if (face.complete && face.naturalWidth) c.drawImage(face, -r, -r, r * 2, r * 2);
        c.restore();
    }
    window.drawBuddy = function (x, y, radius, rotation) {
        if (gameState !== 'playing') return buddy0(x, y, radius, rotation);
        drawPip(x, y, radius, Math.max(-.3, Math.min(.3, ballVelX * .05)));
    };

    // ---- the cave under the meadow
    let W = 400, H = 500, top = 0, floorY = 0, cx0 = 200, split = [0, 0];
    let rocks = [], roots = [], fossils = [];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const DEPTH = 8600;
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const shaftC = y => { const d = y - top; const wob = W / 2 + Math.sin(d * 0.0021) * W * 0.16 + Math.sin(d * 0.0057 + 1) * W * 0.05; return cx0 + (wob - cx0) * smooth(0, 380, d); };
    const shaftW = y => { const d = y - top; const base = W * 0.6 + Math.sin(d * 0.0033) * W * 0.08; const wide = base + (W * 0.86 - base) * smooth(DEPTH - 420, DEPTH - 160, d); return 90 + (wide - 90) * smooth(0, 300, d); };
    const pillar = y => { if (y < split[0] || y > split[1]) return 0; const f = (y - split[0]) / (split[1] - split[0]); return shaftW(y) * 0.2 * Math.sin(Math.PI * f) ** 0.6; };
    function planCave() {
        W = width; H = height;
        top = H - 130; floorY = top + DEPTH;
        cx0 = W / 2 + barPosX + ballX;
        split = [top + DEPTH * 0.56, top + DEPTH * 0.56 + 720];
        rocks = []; roots = []; fossils = [];
        for (let y = top + 520; y < floorY - 520; y += 150 + rnd() * 90) {
            if (y > split[0] - 120 && y < split[1] + 80) continue;
            const c = shaftC(y), w = shaftW(y), k = rnd();
            if (k < 0.55) { // a root from one of the walls
                const side = rnd() < 0.5 ? -1 : 1, x0 = c + side * w / 2, len = w * (0.3 + rnd() * 0.22);
                const pts = [[x0, y]]; let px = x0, py = y;
                for (let i = 1; i <= 4; i++) { px -= side * len / 4; py += 6 + rnd() * 10; pts.push([px, py]); }
                roots.push({ pts, th: 5 + rnd() * 4 });
            } else { // a rock in the middle of the way
                const rr = 11 + rnd() * 10, x = c + (rnd() - 0.5) * (w - rr * 2 - 70);
                const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, q = rr * (0.85 + rnd() * 0.3); pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
                rocks.push({ x, y, r: rr, pts });
            }
        }
        // one root in the left-hand way through the split: right really was quicker
        { const y = (split[0] + split[1]) / 2, c = shaftC(y), w = shaftW(y), x0 = c - w / 2, len = (w / 2 - pillar(y)) * 0.55, pts = [[x0, y]]; for (let i = 1; i <= 3; i++) pts.push([x0 + len * i / 3, y + i * 7]); roots.push({ pts, th: 7 }); }
        // things buried in the walls on the way down (Oli's old stuff)
        const kinds = ['snake', 'jar', 'dolphin', 'disk', 'code', 'snake2'];
        kinds.forEach((kind, i) => { const y = top + DEPTH * (0.14 + i * 0.13), side = i % 2 ? 1 : -1; fossils.push({ kind, y, side, said: false }); });
    }
    function drawCave(camY) {
        const c = drawingContext, y0 = Math.max(top, camY - 40), y1 = camY + H + 40;
        // soil, in bands that get darker the deeper you go
        for (let i = 0; i < SOIL.length; i++) {
            const a = Math.max(y0, H + i * DEPTH / SOIL.length), b = Math.min(y1, H + (i + 1) * DEPTH / SOIL.length + (i === SOIL.length - 1 ? 600 : 0));
            if (b > a) { c.fillStyle = SOIL[i]; c.fillRect(0, a - camY, W, b - a + 1); }
        }
        // a few stones and specks in the soil
        c.fillStyle = 'rgba(53, 79, 69, 0.18)';
        for (let y = Math.floor(y0 / 37) * 37; y < y1; y += 37) { const k = (y * 9301 + 49297) % 233280 / 233280; c.fillRect(k * W, y - camY, 3, 2); c.fillRect((1 - k) * W * 0.9, y + 15 - camY, 2, 2); }
        // the things buried in the walls
        for (const f of fossils) if (f.y > y0 - 60 && f.y < y1 + 60) drawFossil(f, camY);
        // the way down: a dark, winding shaft with inked edges
        const step = 10, L = [], R = [];
        for (let y = y0; y <= y1; y += step) { const cc = shaftC(y), w = shaftW(y) / 2; L.push([cc - w, y]); R.push([cc + w, y]); }
        if (y1 > floorY) { /* the chamber at the bottom */ }
        const g = c.createLinearGradient(0, -camY + top, 0, -camY + floorY); g.addColorStop(0, '#3b2f27'); g.addColorStop(1, '#1d1814');
        c.save(); c.translate(0, -camY);
        c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, Math.min(y, floorY)) : c.moveTo(x, y))); for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], Math.min(R[i][1], floorY)); c.closePath();
        c.fillStyle = g; c.fill();
        c.strokeStyle = ink; c.lineWidth = 1.3;
        c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, Math.min(y, floorY)) : c.moveTo(x, y))); c.stroke();
        c.beginPath(); R.forEach(([x, y], i) => (i ? c.lineTo(x, Math.min(y, floorY)) : c.moveTo(x, y))); c.stroke();
        // the floor
        if (floorY - 30 < y1) {
            const fl = -4, fr = W + 4;
            c.fillStyle = '#8a6a4f'; c.beginPath(); c.moveTo(fl, floorY + 4); for (let x = fl; x <= fr; x += 10) c.lineTo(x, floorY + Math.sin(x * 0.11) * 2.2); c.lineTo(fr, floorY + 500); c.lineTo(fl, floorY + 500); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = 'rgba(53, 79, 69, 0.28)'; for (let i = 0; i < 26; i++) { const k = (i * 7919 % 997) / 997, x = fl + 10 + k * (fr - fl - 20), y = floorY + 12 + ((i * 131) % 60); c.beginPath(); c.ellipse(x, y, 3 + (i % 3), 2, 0, 0, Math.PI * 2); c.fill(); }
        }
        // the rock pillar where the way splits in two
        if (y1 > split[0] && y0 < split[1]) {
            c.beginPath(); let first = true;
            for (let y = split[0]; y <= split[1]; y += 8) { const p = pillar(y), x = shaftC(y) - p; first ? c.moveTo(x, y) : c.lineTo(x, y); first = false; }
            for (let y = split[1]; y >= split[0]; y -= 8) c.lineTo(shaftC(y) + pillar(y), y);
            c.closePath(); c.fillStyle = SOIL[3]; c.fill(); c.stroke();
        }
        // roots and rocks
        for (const r of roots) {
            if (r.pts[0][1] < y0 - 60 || r.pts[0][1] > y1 + 60) continue;
            c.lineCap = 'round'; c.lineJoin = 'round';
            c.strokeStyle = ink; c.lineWidth = r.th + 2.4; c.beginPath(); r.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
            c.strokeStyle = '#b98d63'; c.lineWidth = r.th; c.stroke();
        }
        for (const k of rocks) {
            if (k.y < y0 - 40 || k.y > y1 + 40) continue;
            c.beginPath(); k.pts.forEach(([x, y], i) => (i ? c.lineTo(k.x + x, k.y + y) : c.moveTo(k.x + x, k.y + y))); c.closePath();
            c.fillStyle = '#978f89'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
            c.fillStyle = '#b6aba0'; c.beginPath(); c.ellipse(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.32, k.r * 0.22, 0, 0, Math.PI * 2); c.fill();
        }
        c.restore();
    }
    function drawFossil(f, camY) {
        const c = drawingContext, cc = shaftC(f.y), w = shaftW(f.y) / 2;
        const edge = f.side < 0 ? cc - w : cc + w, room = f.side < 0 ? edge : W - edge;
        if (room < 34) return;
        const x = f.side < 0 ? edge / 2 : edge + room / 2, y = f.y - camY;
        c.save(); c.translate(x, y); c.strokeStyle = ink; c.lineWidth = 1;
        if (f.kind === 'snake' || f.kind === 'snake2') { // an old snake, all bones (white squares)
            for (let i = 0; i < 7; i++) { const sx = (i - 3) * 6, sy = Math.sin(i * 0.9) * 5; c.fillStyle = '#f4efe0'; c.fillRect(sx - 2.5, sy - 2.5, 5, 5); c.strokeRect(sx - 2.5, sy - 2.5, 5, 5); }
        } else if (f.kind === 'dolphin') { // a tiny dolphin
            c.fillStyle = '#c9d7dc'; c.beginPath(); c.ellipse(0, 0, 13, 5, -0.2, 0, Math.PI * 2); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(11, -2); c.lineTo(18, -6); c.lineTo(17, 2); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-2, -4); c.lineTo(2, -9); c.lineTo(4, -4); c.fill(); c.stroke();
        } else if (f.kind === 'jar') { // a jar of old jokes
            c.fillStyle = 'rgba(220, 235, 238, 0.85)'; c.fillRect(-9, -12, 18, 24); c.strokeRect(-9, -12, 18, 24);
            c.fillStyle = paper; c.fillRect(-7, -3, 14, 7); c.strokeRect(-7, -3, 14, 7);
            c.fillStyle = ink; c.font = '5px "Trebuchet MS"'; c.textAlign = 'center'; c.fillText('jokes', 0, 2.5);
        } else if (f.kind === 'disk') { // a floppy disk
            c.fillStyle = '#59677e'; c.fillRect(-10, -10, 20, 20); c.strokeRect(-10, -10, 20, 20);
            c.fillStyle = '#c7cfd6'; c.fillRect(-5, -10, 10, 7); c.fillStyle = paper; c.fillRect(-7, 2, 14, 7);
        } else if (f.kind === 'code') { // a scrap of Oli's old code
            c.rotate(-0.15); c.fillStyle = paper; c.fillRect(-15, -9, 30, 18); c.strokeRect(-15, -9, 30, 18);
            c.fillStyle = ink; c.fillRect(-11, -5, 16, 1.5); c.fillRect(-11, -1, 22, 1.5); c.fillRect(-7, 3, 14, 1.5);
        }
        c.restore();
    }

    // ---- falling
    let state = 'wait', t0 = 0, playAt = 0, bx = 0, by = 0, vx = 0, vy = 0, camY = 0, spin = 0, shake = 0, lastOw = 0, braking = false, landed = 0, gotIt = 0;
    let stuckY = 0, stuckN = 0, ghost = 0;
    let beam = null; const said = new Set();
    const once = (k, text, hold) => { if (said.has(k)) return; said.add(k); say(text, hold); };
    addEventListener('keydown', e => { if (['ArrowUp', 'KeyW', 'Space'].includes(e.code) && state === 'fall') { braking = true; e.preventDefault(); } }, true);
    addEventListener('keyup', e => { if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) braking = false; }, true);
    let topTouch = null;
    addEventListener('touchstart', e => { const cv = document.querySelector('canvas'); if (!cv || state !== 'fall') return; const r = cv.getBoundingClientRect(); for (const t of e.changedTouches) if (t.clientY - r.top < r.height * 0.3) { topTouch = t.identifier; braking = true; } }, { passive: true });
    addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === topTouch) { topTouch = null; braking = false; } }, { passive: true });
    const steer = () => {
        let d = (isHeld('KeyD') || isHeld('ArrowRight') ? 1 : 0) - (isHeld('KeyA') || isHeld('ArrowLeft') ? 1 : 0);
        if (dragTarget !== null) d = Math.max(-1, Math.min(1, (W / 2 + dragTarget - bx) / 40));
        if (phoneTiltEnabled && phoneTiltReady) d += tiltTarget * 2.4;
        return Math.max(-1, Math.min(1, d));
    };
    const ow = () => { const now = Date.now(); if (now - lastOw < 1600 || line) return; lastOw = now; say(['Ow.', 'Ow! Roots.', 'That was a rock.', 'I felt that.', 'Steering is allowed.', 'My face.', 'Ow ow ow.'][Math.floor(Math.random() * 7)], 900); };
    const segDist = (px, py, ax, ay, bx2, by2) => { const dx = bx2 - ax, dy = by2 - ay, l = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)), qx = ax + t * dx, qy = ay + t * dy; return [Math.hypot(px - qx, py - qy), qx, qy]; };
    const R = 15;
    try { if (/piptest/.test(parent.location.search)) window.__pipFallDbg = () => ({ state, bx, by, vy, camY, c: shaftC(by + 120), p: pillar(by + 120), floorY, W, w: shaftW(by), p0: pillar(by), c0: shaftC(by), split, stuckN, near: rocks.filter(k => Math.abs(k.y - by) < 60).map(k => [Math.round(k.x), Math.round(k.y), Math.round(k.r)]), nr: roots.filter(r => Math.abs(r.pts[0][1] - by) < 80).map(r => r.pts.map(q => q.map(Math.round))) }); } catch (e) {}
    function fallStep() {
        if (state === 'drop') { // the beam's just gone: a short drop through the hole in the grass
            vy = Math.min(vy + 0.45, 6); by += vy; spin += vx * 0.04;
            if (by > top + 60) state = 'fall';
        } else if (state === 'fall') {
            const f = Math.max(0, (by - top) / DEPTH);
            const target = 2.4 + 8.4 * Math.pow(f, 1.35);
            vy = braking ? Math.max(1.6, vy - 0.32) : Math.min(target, vy + 0.06);
            vx = Math.max(-6, Math.min(6, vx * 0.9 + steer() * 0.6));
            bx += vx; by += vy; spin += vx * 0.05;
            // walls
            const cc = shaftC(by), w = shaftW(by) / 2;
            if (bx - R < cc - w) { bx = cc - w + R; if (vx < -1.5) { ow(); vy *= 0.85; shake = 6; } vx = Math.abs(vx) * 0.5; }
            if (bx + R > cc + w) { bx = cc + w - R; if (vx > 1.5) { ow(); vy *= 0.85; shake = 6; } vx = -Math.abs(vx) * 0.5; }
            // the pillar where it splits
            const p = pillar(by);
            if (p > 0 && Math.abs(bx - cc) < p + R) { const s = bx < cc ? -1 : 1; bx = cc + s * (p + R); vx = s * Math.abs(vx) * 0.5 + s; vy *= 0.8; ow(); shake = 5; }
            // rocks and roots
            if (ghost > 0) ghost--; else {
            for (const k of rocks) { if (Math.abs(k.y - by) > 40) continue; const d = Math.hypot(bx - k.x, by - k.y); if (d < k.r + R) { const nx = (bx - k.x) / (d || 1), ny = (by - k.y) / (d || 1); bx = k.x + nx * (k.r + R); by = k.y + ny * (k.r + R); const fresh = !k.hit || Date.now() - k.hit > 400; k.hit = Date.now(); vx += (nx || (bx < k.x ? -1 : 1)) * (fresh ? 3 : 0.8) + (Math.abs(nx) < 0.25 ? (bx < k.x ? -0.8 : 0.8) : 0); if (fresh) { vy *= 0.5; ow(); shake = 8; } } }
            for (const r of roots) { if (Math.abs(r.pts[0][1] - by) > 60) continue; for (let i = 1; i < r.pts.length; i++) { const [d, qx, qy] = segDist(bx, by, r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]); if (d < R + r.th / 2) { const nx = (bx - qx) / (d || 1), ny = (by - qy) / (d || 1); bx = qx + nx * (R + r.th / 2); by = qy + ny * (R + r.th / 2); const fresh = !r.hit || Date.now() - r.hit > 400; r.hit = Date.now(); const [ax, ay] = r.pts[i - 1], [cx2, cy2] = r.pts[i], down = (cy2 - ay) * (cx2 - ax) >= 0 ? Math.sign(cx2 - ax) || 1 : -Math.sign(cx2 - ax) || 1; vx += nx * (fresh ? 2.5 : 0) + down * 0.9; if (fresh) { vy *= 0.55; ow(); shake = 6; } } } }
            }
            // never get wedged for good: if we stop going down, squeeze through
            if (by > stuckY + 2) { stuckY = by; stuckN = 0; } else if (++stuckN > 40) { ghost = 24; stuckN = 0; once('stuck', "I'm stuck. Wiggle. Wiggle.", 1400); }
            // things Pip says on the way down
            if (f > 0.03) once('steer', phone() ? 'Drag to steer!' : 'Left and right to steer!', 2000);
            if (f > 0.1) once('dirt', "It's mostly dirt down here.", 1800);
            for (const fo of fossils) if (!fo.said && Math.abs(fo.y - by) < 120) { fo.said = true; const L = { snake: 'Is that the first snake?', jar: "Oli's old jokes. Buried. Good.", dolphin: 'There are dolphins down here too. They get everywhere.', disk: 'A floppy disk. How old is this website?', code: "Oli's old code. Even worse than the new code.", snake2: 'Another snake. This is where they go.' }[fo.kind]; if (!line) say(L, 1800); }
            if (by > split[0] - 520) once('split', 'It splits. Left? No. Right. Definitely right.', 2000);
            if (by > split[0] - 100) once('split2', "...I'm guessing.", 1200);
            if (f > 0.8) once('fast', "This is faster than I'd like.", 1500);
            if (f > 0.86) once('brake', phone() ? 'Hold the top of the screen to slow down!' : 'Hold ↑ to slow down!', 2600);
            if (by + R >= floorY) { by = floorY - R; landed = Date.now(); const hard = vy > 5; vy = 0; state = 'landed'; shake = hard ? 16 : 3; say(hard ? "I'm fine. I'm fine." : 'Nice landing.', 1600, true); post('landed', { hard }); }
        } else if (state === 'landed') {
            // roll over to the piece
            const px = shaftC(floorY) + 46;
            if (Date.now() - landed > 1500) { vx += (px - bx) * 0.004; vx *= 0.9; bx += vx; spin += vx * 0.08; }
            if (!gotIt && Math.abs(px - bx) < 18 && Date.now() - landed > 1500) {
                gotIt = Date.now(); state = 'got';
                try { const k = JSON.parse(localStorage.getItem('pip-keys') || '[]'); if (!k.includes('123')) { k.push('123'); localStorage.setItem('pip-keys', JSON.stringify(k)); } } catch (e) {}
                say('Piece 3 of 3: "123"', 2400, true); say("That's all three.", 2000);
                post('piece');
                setTimeout(() => post('done'), 6000);
            }
        }
        camY += (Math.min(floorY - H * 0.72, Math.max(0, by - H * 0.32)) - camY) * (state === 'drop' ? 0.06 : 0.12);
        if (shake > 0) shake *= 0.85;
    }
    function fallDraw() {
        const t = Date.now();
        if (typeof paused !== 'undefined' && paused) { drawPaused(); return; }
        fallStep();
        push();
        drawingContext.save();
        if (shake > 0.5) drawingContext.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        // the sky and meadow, as the game draws them, scrolling up out of view
        const gs = gameState; gameState = 'menu'; drawingContext.save(); drawingContext.translate(0, -camY); drawBackdrop(); drawingContext.restore(); gameState = gs;
        drawCave(camY);
        // the beam, snapped in two and falling away
        if (beam) { beam.t++; beam.parts.forEach(b => { b.vy += 0.4; b.y += b.vy; b.x += b.vx; b.a += b.va; drawingContext.save(); drawingContext.translate(b.x, b.y - camY); drawingContext.rotate(b.a); push(); translate(-b.off, 0); drawRail(beam.len); pop(); drawingContext.restore(); }); if (beam.t > 160) beam = null; }
        // the piece, at the bottom
        if (floorY - camY < H + 40 && !gotIt) {
            const px = shaftC(floorY) + 46, py = floorY - 16 - camY, c = drawingContext;
            c.fillStyle = paper; c.strokeStyle = ink; c.lineWidth = 1.2; c.fillRect(px - 21, py - 13, 42, 26); c.strokeRect(px - 21, py - 13, 42, 26);
            c.fillStyle = ink; c.font = 'bold 15px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('123', px, py + 1);
        }
        drawPip(bx, by - camY, R, spin);
        drawingContext.restore();
        // "height ↑" is "depth ↓" now
        const depth = Math.max(0, Math.floor((by - top) / 10));
        fill(paper); noStroke(); textFont('Trebuchet MS, sans-serif'); textAlign(LEFT, TOP); textSize(9); text('depth ↓', 20, 13); textSize(23); textStyle(BOLD); text(depth + 'm', 20, 25); textStyle(NORMAL);
        textAlign(CENTER, TOP); textSize(9); text(depth < 40 ? 'Under the meadow' : depth < 500 ? 'Underground' : 'Very underground', width / 2, 16);
        pop();
        drawLine(t);
    }
    function drawPaused() { push(); noStroke(); fill(paper); rect(width / 2, height * .44, 230, 97, 2); fill(ink); textAlign(CENTER, CENTER); textSize(25); text('paused', width / 2, height * .44 - 18); textSize(11); text('Tap here or press P to resume', width / 2, height * .44 + 20); pop(); }

    // ---- before the fall: Pip stops the climb and talks, then the beam snaps
    const draw0 = window.draw, climb0 = window.climbPerTick, interval0 = window.obstacleInterval, end0 = window.endGame;
    let introAt = 0;
    window.draw = function () {
        if (state === 'fall' || state === 'drop' || state === 'landed' || state === 'got') { fallDraw(); return; }
        draw0();
        if (gameState === 'playing' && !gameOver) {
            if (!introAt) {
                introAt = Date.now(); post('started');
                window.climbPerTick = () => 0; window.obstacleInterval = () => 1e9; powerUpSpawnInterval = 1e9; obstacles = []; powerUps = [];
                window.endGame = () => { breakBeam(); }; // falling off just starts the fall early
                say('Everyone goes up in this game.', 1700); say('Oli hid the piece where nobody looks.', 2000); say('Down.', 1300);
                setTimeout(breakBeam, 7400);
            }
            if (Date.now() - introAt > 5600) { shake = 3; drawCracks(Math.min(1, (Date.now() - introAt - 5600) / 1600)); }
        }
        drawLine(Date.now());
    };
    function drawCracks(k) { // cracks spreading through the grass under the beam
        const c = drawingContext, x = width / 2 + barPosX, y = beamY() + 14;
        c.save(); c.strokeStyle = ink; c.lineWidth = 1.2; c.lineCap = 'round';
        for (const [dx, dy] of [[-60, 30], [-25, 50], [10, 55], [45, 40], [70, 20]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * k * 0.5, y + dy * k * 0.4); c.lineTo(x + dx * k, y + dy * k); c.stroke(); }
        c.restore();
    }
    function breakBeam() {
        if (state !== 'wait') return;
        window.climbPerTick = climb0; window.obstacleInterval = interval0; window.endGame = end0;
        planCave();
        state = 'drop'; post('falling');
        { const st = document.createElement('style'); st.textContent = '#game-ui{visibility:hidden!important}'; document.head.append(st); } // tilt buttons would cover the cave on phones; dragging steers
        bx = W / 2 + barPosX + ballX; by = beamY() + ballY; vx = ballVelX * 0.5; vy = 0;
        const len = baseBarLength * currentWidenFactor;
        beam = { t: 0, len: len / 2, parts: [{ x: W / 2 + barPosX - len / 4, y: beamY(), vx: -0.8, vy: -1, a: barAngle, va: -0.04, off: 0 }, { x: W / 2 + barPosX + len / 4, y: beamY(), vx: 0.8, vy: -0.5, a: barAngle, va: 0.05, off: 0 }] };
        shake = 10;
        say('Here we go.', 1200, true);
    }
})();
