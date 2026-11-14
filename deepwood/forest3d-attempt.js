// Gravity Dash: a ball rolling into a dense forest. Weave between the trunks, hop the fallen logs.
// The old wireframe version is still at /gravity_dash.js and /embeds/gravity_dash.html.
import * as THREE from 'three';

// ---------- The forest grid ----------
// Trees sit on a staggered grid (every other row is shifted half a cell), each one nudged a little.
// The numbers are chosen so the gap between two neighbouring trunks is always wider than the ball.
const S = 9;            // sideways distance between trees in a row
const D = 11;           // distance between rows
const R = 1;            // ball radius
const ROWS = 24;        // rows drawn ahead of the ball
const COLS = 9;         // columns drawn each side of the ball
const MAXT = (ROWS + 3) * (COLS * 2 + 1);
const TRUNK_H = 46;

let seed = (Math.random() * 1e9) | 0;
function hash(i, j, k) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul((k + seed) | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
const groundH = (x, z) => 2.2 * Math.sin(x * 0.043 + 1.3) * Math.cos(z * 0.031) + 1.0 * Math.sin(z * 0.06 + x * 0.021) + 0.35 * Math.sin(x * 0.15 + z * 0.05) * Math.sin(z * 0.12);

// how thick the forest is at row j (it fills in as you go)
const density = (j) => Math.min(0.72, 0.30 + j * 0.0022);
const logChance = (j) => Math.min(0.24, 0.08 + j * 0.0008);
function tree(i, j, out) {
    if (j < 3 || hash(i, j, 1) > density(j)) return false;
    const a = hash(i, j, 2);
    out.r = 0.7 + 0.9 * a * a;
    out.x = (i + (j & 1) * 0.5) * S + (hash(i, j, 3) - 0.5) * 3;
    out.z = -j * D + (hash(i, j, 4) - 0.5) * 5;
    out.t = hash(i, j, 5);
    return true;
}
// a fallen log lies between tree (i, j) and its neighbour (i + 1, j)
const TA = {}, TB = {};
function logAt(i, j) { return j >= 8 && hash(i, j, 6) < logChance(j) && tree(i, j, TA) && tree(i + 1, j, TB); }

// ---------- Scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe8d0);
scene.fog = new THREE.Fog(0xcfe8d0, 28, 235);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 330);

const hemi = new THREE.HemisphereLight(0xfff3d6, 0x4a6b3a, 1.6);
const sun = new THREE.DirectionalLight(0xffe2a8, 1.6);
sun.position.set(-0.5, 1, 0.35);
scene.add(hemi, sun);

// ground: one sheet that follows the ball, snapped to its own squares so the hills don't swim
const GS = 4, GX = 56, GZ = 80;
const groundGeo = new THREE.PlaneGeometry(GX * GS, GZ * GS, GX, GZ);
groundGeo.rotateX(-Math.PI / 2);
groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3));
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
ground.frustumCulled = false;
scene.add(ground);
const baseXZ = Float32Array.from(groundGeo.attributes.position.array);
const cMoss = new THREE.Color(0x5b8f3e), cDeep = new THREE.Color(0x3f7036), cDirt = new THREE.Color(0x7a6341), cTmp = new THREE.Color();
let groundKey = '';
function layGround(bx, bz) {
    const gx = Math.round(bx / GS) * GS, gz = Math.round((bz - 125) / GS) * GS, key = gx + ',' + gz;
    if (key === groundKey) return;
    groundKey = key;
    const pos = groundGeo.attributes.position.array, col = groundGeo.attributes.color.array;
    for (let v = 0; v < pos.length; v += 3) {
        const wx = baseXZ[v] + gx, wz = baseXZ[v + 2] + gz;
        pos[v] = wx; pos[v + 1] = groundH(wx, wz); pos[v + 2] = wz;
        const n = hash(Math.round(wx / GS), Math.round(wz / GS), 20);
        const patch = 0.5 + 0.5 * Math.sin(wx * 0.09 + 2) * Math.sin(wz * 0.07);
        cTmp.copy(cMoss).lerp(cDeep, n).lerp(cDirt, Math.max(0, patch - 0.62) * 2.2);
        col[v] = cTmp.r; col[v + 1] = cTmp.g; col[v + 2] = cTmp.b;
    }
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.attributes.color.needsUpdate = true;
}

// trees, crowns, logs and grass tufts are each one instanced mesh, laid out again every frame
const lam = () => new THREE.MeshLambertMaterial({ flatShading: true });
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.82, 1.2, 1, 7, 1, true), lam(), MAXT);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(), MAXT);
const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.65, 0.65, 1, 7), lam(), 160);
const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.45, 0.9, 5), lam(), MAXT);
for (const m of [trunks, crowns, logs, tufts]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
const dummy = new THREE.Object3D(), T = {}, col = new THREE.Color();
const BARK_A = new THREE.Color(0x6b4a32), BARK_B = new THREE.Color(0x94714c), BIRCH = new THREE.Color(0xe9e3d2);
const LEAF_A = new THREE.Color(0x2f7d3a), LEAF_B = new THREE.Color(0x6bb84e), AUTUMN = new THREE.Color(0xe08a2e);
const LOG_C = new THREE.Color(0x5a3d28), TUFT_A = new THREE.Color(0x7fc24f), TUFT_B = new THREE.Color(0xa9d86a);
const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();

function layForest(bx, bz) {
    const jb = Math.floor(-bz / D), ib = Math.round(bx / S);
    let nt = 0, nl = 0, ng = 0;
    for (let j = jb - 1; j <= jb + ROWS; j++) {
        for (let i = ib - COLS; i <= ib + COLS; i++) {
            if (tree(i, j, T) && T.z < bz + 2.5) { // trees you've passed step out of the camera's way
                const g = groundH(T.x, T.z);
                dummy.position.set(T.x, g - 2 + TRUNK_H / 2, T.z); dummy.rotation.set(0, T.t * 6.28, 0); dummy.scale.set(T.r, TRUNK_H, T.r); dummy.updateMatrix();
                trunks.setMatrixAt(nt, dummy.matrix);
                trunks.setColorAt(nt, T.t > 0.88 ? BIRCH : col.copy(BARK_A).lerp(BARK_B, T.t));
                const cr = 6 + T.r * 2.2 + T.t * 2;
                dummy.position.set(T.x, g + 25 + T.t * 7, T.z); dummy.scale.set(cr, cr * 0.8, cr); dummy.updateMatrix();
                crowns.setMatrixAt(nt, dummy.matrix);
                crowns.setColorAt(nt, hash(i, j, 7) < 0.08 ? AUTUMN : col.copy(LEAF_A).lerp(LEAF_B, hash(i, j, 8)));
                nt++;
            }
            if (nl < 160 && logAt(i, j) && Math.min(TA.z, TB.z) < bz + 2.5) {
                const mx = (TA.x + TB.x) / 2, mz = (TA.z + TB.z) / 2;
                dir.set(TB.x - TA.x, groundH(TB.x, TB.z) - groundH(TA.x, TA.z), TB.z - TA.z);
                const len = dir.length();
                dummy.position.set(mx, (groundH(TA.x, TA.z) + groundH(TB.x, TB.z)) / 2 + 0.55, mz);
                dummy.quaternion.setFromUnitVectors(UP, dir.normalize()); dummy.scale.set(1, len, 1); dummy.updateMatrix();
                logs.setMatrixAt(nl, dummy.matrix); logs.setColorAt(nl, LOG_C); nl++;
                dummy.rotation.set(0, 0, 0);
            }
            if (j >= 0 && hash(i, j, 10) < 0.45) { // grass tufts: scenery, the ball rolls straight over them
                const gx = (i + hash(i, j, 11)) * S, gz = -(j + hash(i, j, 12)) * D;
                if (gz < bz + 2.5) {
                    const sc = 0.6 + hash(i, j, 13) * 0.7;
                    dummy.position.set(gx, groundH(gx, gz) + 0.4 * sc, gz); dummy.rotation.set(0, 0, 0); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
                    tufts.setMatrixAt(ng, dummy.matrix); tufts.setColorAt(ng, col.copy(TUFT_A).lerp(TUFT_B, hash(i, j, 14))); ng++;
                }
            }
        }
    }
    trunks.count = crowns.count = nt; logs.count = nl; tufts.count = ng;
    for (const m of [trunks, crowns, logs, tufts]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

// the ball: striped so you can see it roll
function ballTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ff5a3c'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#fff3d6'; g.fillRect(0, 50, 256, 28);
    g.fillStyle = '#1d1a2b'; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 10, 58, 12, 12);
    g.fillStyle = '#ffe14d'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, 24, 7, 0, 7); g.fill(); g.beginPath(); g.arc(i * 32, 104, 7, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshLambertMaterial({ map: ballTexture() }));
scene.add(ballMesh);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshBasicMaterial({ color: 0x10140c, transparent: true, opacity: 0.3, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// drifting leaves, fireflies (night only) and the splinters when you crash
function cloud(n, size, color, additive) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ size, color, transparent: true, depthWrite: false, fog: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p);
    const base = []; for (let i = 0; i < n; i++) base.push([Math.random() * 90, Math.random(), Math.random() * 150, Math.random() * 6.28]);
    return { p, base, n };
}
const leaves = cloud(150, 0.38, 0xe9a23b, false);
const flies = cloud(130, 0.5, 0xfff29a, true);
const bits = cloud(70, 0.42, 0xb9824e, false);
const bitVel = []; bits.p.visible = false;
const mod = (a, n) => ((a % n) + n) % n;
function drift(c, time, bx, bz, fall) {
    const a = c.p.geometry.attributes.position.array;
    for (let i = 0; i < c.n; i++) {
        const b = c.base[i];
        const x = bx + mod(b[0] - bx + 45, 90) - 45 + Math.sin(time * 0.7 + b[3]) * 1.2;
        const z = bz + 25 - mod(bz + 25 - b[2], 150);
        const y = fall ? mod(b[1] * 20 - time * (1.2 + b[1]), 20) : 1 + b[1] * 4.5 + Math.sin(time * 1.3 + b[3]) * 0.5;
        a[i * 3] = x; a[i * 3 + 1] = groundH(x, z) + y; a[i * 3 + 2] = z;
    }
    c.p.geometry.attributes.position.needsUpdate = true;
}

// ---------- Time of day: morning, day, dusk, night, and round again ----------
const TOD = [
    { sky: 0xcfe8d0, hs: 0xfff3d6, hg: 0x4a6b3a, sun: 0xffe2a8, si: 1.6, hi: 1.6 },
    { sky: 0xbfe6f2, hs: 0xffffff, hg: 0x557a3c, sun: 0xffffff, si: 1.9, hi: 1.7 },
    { sky: 0xf4a871, hs: 0xffc79a, hg: 0x5a4a3a, sun: 0xff9a5a, si: 1.5, hi: 1.3 },
    { sky: 0x101a38, hs: 0x4a5f9a, hg: 0x141a24, sun: 0x8fa6ff, si: 0.55, hi: 0.95 }
].map(t => ({ sky: new THREE.Color(t.sky), hs: new THREE.Color(t.hs), hg: new THREE.Color(t.hg), sun: new THREE.Color(t.sun), si: t.si, hi: t.hi }));
const PHASE = 450; // metres each time of day lasts
let night = 0;
function setTime(dist) {
    const t = dist / PHASE, a = Math.floor(t) % 4, b = (a + 1) % 4;
    let f = Math.max(0, (t - Math.floor(t) - 0.6) / 0.4); f = f * f * (3 - 2 * f);
    const A = TOD[a], B = TOD[b];
    scene.background.copy(A.sky).lerp(B.sky, f); scene.fog.color.copy(scene.background);
    hemi.color.copy(A.hs).lerp(B.hs, f); hemi.groundColor.copy(A.hg).lerp(B.hg, f); hemi.intensity = A.hi + (B.hi - A.hi) * f;
    sun.color.copy(A.sun).lerp(B.sun, f); sun.intensity = A.si + (B.si - A.si) * f;
    night = a === 3 ? 1 - f : b === 3 ? f : 0;
    flies.p.material.opacity = night; flies.p.visible = night > 0.02;
    leaves.p.material.opacity = 0.9 - night * 0.6;
}

// ---------- Game state ----------
const $ = id => document.getElementById(id);
const distEl = $('dist'), subEl = $('sub'), bestEl = $('best'), toastEl = $('toast'), panel = $('panel'), box = $('box');
const ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, speed: 22, grounded: true };
let state = 'ready', dist = 0, bonus = 0, close = 0, combo = 0, comboAt = 0, overAt = 0, shake = 0, shownDist = -1;
let best = 0; try { best = +localStorage.getItem('gravity-dash-best') || 0; } catch (e) {}
const score = () => Math.floor(dist) + bonus;
const showBest = () => { bestEl.textContent = best ? 'Best ' + best : ''; };

function card(html) { box.innerHTML = html; panel.hidden = false; }
function readyCard() {
    card(`<h1>Gravity Dash</h1><p>Weave through the forest. Hop over the logs.</p>
        <p class="keys">A / D or arrows to steer · Space to hop</p><span class="go">Tap or press Space</span>`);
}
function reset() {
    seed = (Math.random() * 1e9) | 0;
    Object.assign(ball, { x: 0, z: 0, vx: 0, vy: 0, speed: 22, grounded: true });
    ball.y = groundH(0, 0) + R;
    dist = 0; bonus = 0; close = 0; combo = 0; shake = 0; shownDist = -1; groundKey = '';
    ballMesh.visible = true; shadow.visible = true; bits.p.visible = false;
    camPos.set(0, ball.y + 6.5, 13);
    subEl.textContent = '';
}
function start() { if (state === 'over') reset(); state = 'play'; panel.hidden = true; }
function crash() {
    state = 'over'; overAt = performance.now(); shake = 1;
    ballMesh.visible = false; shadow.visible = false;
    const a = bits.p.geometry.attributes.position.array; bitVel.length = 0;
    for (let i = 0; i < bits.n; i++) {
        a[i * 3] = ball.x; a[i * 3 + 1] = ball.y; a[i * 3 + 2] = ball.z;
        bitVel.push([(Math.random() - 0.5) * 16, Math.random() * 12 + 2, (Math.random() - 0.3) * -ball.speed * 0.6]);
    }
    bits.p.visible = true;
    const s = score(), isBest = s > best;
    if (isBest) { best = s; try { localStorage.setItem('gravity-dash-best', String(best)); } catch (e) {} }
    showBest();
    card(`<p>${isBest ? 'New best!' : 'Crashed'}</p><div class="big">${s}</div>
        <div class="row"><span>${Math.floor(dist)} m</span><span>${close} close ${close === 1 ? 'call' : 'calls'}</span></div>
        <span class="go">Go again</span>`);
    try { window.parent.postMessage({ type: 'game-over', game: 'gravity-dash', score: s, distance: Math.floor(dist) }, '*'); } catch (e) {}
}
let toastTimer = 0;
function toast(text) { toastEl.textContent = text; toastEl.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 650); }

// ---------- Controls ----------
const keys = {};
let touchSteer = 0, wantHop = false;
function press() {
    if (state === 'ready') return start();
    if (state === 'over') { if (performance.now() - overAt > 600) start(); return; }
    if (state === 'play') wantHop = true;
}
addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    keys[k] = true;
    if (k === ' ' || k === 'arrowup' || k === 'w') press();
    else if (k === 'r') { reset(); state = 'play'; panel.hidden = true; }
    else if (k === 'p') {
        if (state === 'play') { state = 'paused'; card('<h1>Paused</h1><span class="go">Press P</span>'); }
        else if (state === 'paused') { state = 'play'; panel.hidden = true; }
    }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; touchSteer = 0; });
let ptr = null;
canvas.addEventListener('pointerdown', e => {
    if (state !== 'play') { press(); return; }
    if (state === 'paused') return;
    ptr = { id: e.pointerId, x: e.clientX, t: performance.now(), moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x;
    if (Math.abs(dx) > 10) ptr.moved = true;
    touchSteer = Math.max(-1, Math.min(1, dx / Math.max(60, innerWidth * 0.16)));
});
const lift = e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.moved && performance.now() - ptr.t < 260) press();
    ptr = null; touchSteer = 0;
};
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
$('hop').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(); });
addEventListener('message', e => { if (e.data && e.data.type === 'focus') { try { window.focus(); } catch (err) {} } });
addEventListener('contextmenu', e => e.preventDefault());

// ---------- Each frame ----------
const camPos = new THREE.Vector3(0, 8, 13), X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
function step(dt, now) {
    const steer = Math.max(-1, Math.min(1, (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0) + touchSteer));
    ball.speed += (Math.min(46, 22 + dist * 0.011) - ball.speed) * Math.min(1, dt * 2);
    const vmax = 17 + ball.speed * 0.3;
    ball.vx += (steer * vmax - ball.vx) * Math.min(1, dt * 7); // momentum: it leans into a turn and drifts out of it
    const pz = ball.z, pg = groundH(ball.x, ball.z);
    ball.x += ball.vx * dt; ball.z -= ball.speed * dt; dist = -ball.z;

    const g = groundH(ball.x, ball.z), floor = g + R;
    ball.vy -= 34 * dt; ball.y += ball.vy * dt;
    if (ball.y <= floor) { ball.y = floor; ball.vy = Math.max(0, Math.min(6, (g - pg) / dt)); ball.grounded = true; } // rolls off the top of a rise
    else if (ball.y > floor + 0.3) ball.grounded = false;
    if (wantHop && ball.grounded) { ball.vy = 13; ball.grounded = false; }
    wantHop = false;

    // trunks and logs near the ball
    const jr = Math.round(-ball.z / D), ic = Math.round(ball.x / S);
    for (let j = jr - 1; j <= jr + 1; j++) for (let i = ic - 2; i <= ic + 2; i++) {
        if (tree(i, j, T)) {
            const dx = ball.x - T.x, dz = ball.z - T.z;
            if (dx * dx + dz * dz < (T.r + R * 0.82) ** 2) return crash();
            if (pz > T.z && ball.z <= T.z && Math.abs(dx) - T.r - R < 1.3) { // brushed past it
                combo = now - comboAt < 2500 ? Math.min(5, combo + 1) : 1; comboAt = now; close++;
                const pts = 25 * combo; bonus += pts; toast(combo > 1 ? `Close ×${combo}  +${pts}` : `Close!  +${pts}`);
            }
        }
        if (logAt(i, j) && ball.y - R - g < 1.0) {
            const ax = TB.x - TA.x, az = TB.z - TA.z, t = Math.max(0, Math.min(1, ((ball.x - TA.x) * ax + (ball.z - TA.z) * az) / (ax * ax + az * az)));
            const dx = ball.x - (TA.x + ax * t), dz = ball.z - (TA.z + az * t);
            if (dx * dx + dz * dz < (0.65 + R * 0.7) ** 2) return crash();
        }
    }
    ballMesh.rotateOnWorldAxis(X_AXIS, -ball.speed * dt / R);
    ballMesh.rotateOnWorldAxis(Z_AXIS, -ball.vx * dt / R);
}
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    const time = now / 1000;
    if (state === 'play') step(dt, now);
    if (state === 'over' && bits.p.visible) {
        const a = bits.p.geometry.attributes.position.array;
        for (let i = 0; i < bits.n; i++) {
            const v = bitVel[i]; v[1] -= 30 * dt;
            a[i * 3] += v[0] * dt; a[i * 3 + 1] = Math.max(groundH(a[i * 3], a[i * 3 + 2]) + 0.1, a[i * 3 + 1] + v[1] * dt); a[i * 3 + 2] += v[2] * dt;
        }
        bits.p.geometry.attributes.position.needsUpdate = true;
    }
    const g = groundH(ball.x, ball.z);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    const lift = Math.max(0, ball.y - R - g);
    shadow.position.set(ball.x, g + 0.08, ball.z); shadow.scale.setScalar(Math.max(0.45, 1 - lift * 0.15)); shadow.material.opacity = 0.3 * Math.max(0.3, 1 - lift * 0.2);

    layGround(ball.x, ball.z);
    layForest(ball.x, ball.z);
    setTime(dist);
    drift(leaves, time, ball.x, ball.z, true);
    if (flies.p.visible) drift(flies, time, ball.x, ball.z, false);

    // camera: behind and above, a little late on the turns
    const k = Math.min(1, dt * 6);
    camPos.x += (ball.x - ball.vx * 0.12 - camPos.x) * k;
    camPos.z = ball.z + 13;
    camPos.y += (Math.max(ball.y + 6.5, groundH(camPos.x, camPos.z) + 3.5) - camPos.y) * Math.min(1, dt * 4);
    shake = Math.max(0, shake - dt * 2.2);
    camera.position.set(camPos.x + (Math.random() - 0.5) * shake * 1.4, camPos.y + (Math.random() - 0.5) * shake * 1.4, camPos.z);
    camera.lookAt(ball.x + ball.vx * 0.1, g + 2.5, ball.z - 26);
    camera.rotateZ(-ball.vx * 0.0045);
    sun.position.set(ball.x - 40, 80, ball.z + 28); sun.target.position.set(ball.x, 0, ball.z); sun.target.updateMatrixWorld();

    const d = Math.floor(dist);
    if (d !== shownDist) { shownDist = d; distEl.firstChild.nodeValue = String(d); subEl.textContent = bonus ? '+' + bonus + ' close calls' : ''; }
    renderer.render(scene, camera);
}
function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 74 : 60; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize(); reset(); showBest(); readyCard();
requestAnimationFrame(frame);
