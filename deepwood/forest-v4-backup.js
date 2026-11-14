// Gravity Dash: a ball dashing through a huge, dense forest.
// The ball stays in the middle of the screen and the camera goes with it, so the forest carries on in
// every direction: trees are worked out from where they stand, wherever the ball goes.
// The feel is the original game's: the same speed-up, the same fixed sideways steering, the same jump.
// (Earlier attempts are kept beside this file as forest3d-attempt.js and p5-forest-attempt.js. They aren't used.)
import * as THREE from 'three';

const R = 1;                 // the ball. Everything else is measured against it.
const CELL = 8;              // the forest is divided into squares this size; a square holds one tree, one rock, or nothing
const ROWS = 20, COLS = 16;  // how many squares ahead and to each side are drawn
const MAXT = (ROWS + 3) * (COLS * 2 + 1);
const TRUNK_H = 70;          // the trunks go up out of sight

// the original game's numbers, converted from pixels a frame (ball radius 20) to ball-radii a second
const SPEED_MIN = 22.5, SPEED_MAX = 45, SPEED_RAMP = (SPEED_MAX - SPEED_MIN) / 16.7;
const STEER = 15, JUMP = 36, GRAVITY = 90;

let seed = (Math.random() * 1e9) | 0;
function hash(i, j, k) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul((k + seed) | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
// rolling hills, about as tall and as wide as the original's
const groundH = (x, z) => 2.6 * Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.041) + 1.7 * Math.sin(z * 0.075 + x * 0.03) + 0.7 * Math.sin(x * 0.13 + z * 0.06) * Math.sin(z * 0.11);

// what stands in square (i, j): the forest thickens over the first couple of thousand metres
const treeChance = (j) => Math.min(0.42, 0.24 + j * 0.0007);
function tree(i, j, out) {
    if (j < 4 || hash(i, j, 1) > treeChance(j)) return false;
    out.r = 0.9 + 0.8 * hash(i, j, 2);                 // trunks are thicker than the ball
    out.x = (i + 0.15 + hash(i, j, 3) * 0.7) * CELL;
    out.z = -(j + 0.15 + hash(i, j, 4) * 0.7) * CELL;
    out.t = hash(i, j, 5);
    return true;
}
function rock(i, j, out) {
    if (j < 6 || hash(i, j, 1) < 0.5 || hash(i, j, 6) > 0.07) return false;   // only where there's no tree
    out.r = 1.0 + 0.5 * hash(i, j, 7);
    out.x = (i + 0.2 + hash(i, j, 8) * 0.6) * CELL;
    out.z = -(j + 0.2 + hash(i, j, 9) * 0.6) * CELL;
    out.t = hash(i, j, 10);
    return true;
}

// ---------- Scene ----------
const MIST = 0x16261f;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(MIST);
scene.fog = new THREE.Fog(MIST, 10, 150);
const camera = new THREE.PerspectiveCamera(70, 1, 0.4, 200);

const hemi = new THREE.HemisphereLight(0xb8dcc0, 0x16241a, 1.5);
const sun = new THREE.DirectionalLight(0xffe2ac, 2.0);
scene.add(hemi, sun, sun.target);

// the ground: one sheet of grass that follows the ball, snapped to its own squares so the hills never swim
const GS = 4, GX = 64, GZ = 48;
const groundGeo = new THREE.PlaneGeometry(GX * GS, GZ * GS, GX, GZ);
groundGeo.rotateX(-Math.PI / 2);
groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3));
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
ground.frustumCulled = false;
scene.add(ground);
const baseXZ = Float32Array.from(groundGeo.attributes.position.array);
const gA = new THREE.Color(0x2f6e2c), gB = new THREE.Color(0x4f9a3a), gC = new THREE.Color(0x245a2a), cTmp = new THREE.Color();
let groundKey = '';
function layGround(bx, bz) {
    const gx = Math.round(bx / GS) * GS, gz = Math.round((bz - 66) / GS) * GS, key = gx + ',' + gz;
    if (key === groundKey) return;
    groundKey = key;
    const pos = groundGeo.attributes.position.array, col = groundGeo.attributes.color.array;
    for (let v = 0; v < pos.length; v += 3) {
        const wx = baseXZ[v] + gx, wz = baseXZ[v + 2] + gz;
        pos[v] = wx; pos[v + 1] = groundH(wx, wz); pos[v + 2] = wz;
        const n = hash(Math.round(wx / GS), Math.round(wz / GS), 20), patch = 0.5 + 0.5 * Math.sin(wx * 0.11 + 2) * Math.sin(wz * 0.09);
        cTmp.copy(gA).lerp(gB, n * 0.7 + patch * 0.3).lerp(gC, Math.max(0, 0.4 - patch));
        col[v] = cTmp.r; col[v + 1] = cTmp.g; col[v + 2] = cTmp.b;
    }
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.attributes.color.needsUpdate = true;
    groundGeo.computeVertexNormals();
}

const lam = (flat) => new THREE.MeshLambertMaterial({ flatShading: !!flat });
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.86, 1.3, 1, 9, 1, true), lam(), MAXT);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(true), MAXT * 2);
const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(true), 200);
const GRASS_N = 3400, GSTEP = 2.2;
const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.34, 1, 4, 1, true), lam(), GRASS_N);
// shafts of light coming down through the leaves
function shaftTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, 64, 128);
    g.globalCompositeOperation = 'destination-in';
    const hgrad = g.createLinearGradient(0, 0, 64, 0); hgrad.addColorStop(0, 'rgba(0,0,0,0)'); hgrad.addColorStop(0.5, 'rgba(0,0,0,1)'); hgrad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hgrad; g.fillRect(0, 0, 64, 128);
    return new THREE.CanvasTexture(c);
}
const shafts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0xffe9b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }), 90);
for (const m of [trunks, crowns, rocks, grass, shafts]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }

const dummy = new THREE.Object3D(), T = {}, col = new THREE.Color();
const BARK_A = new THREE.Color(0x3d2c20), BARK_B = new THREE.Color(0x5e4631);
const LEAF_A = new THREE.Color(0x0f3a22), LEAF_B = new THREE.Color(0x1f5c33);
const ROCK_A = new THREE.Color(0x5b635c), ROCK_B = new THREE.Color(0x7b8478);
const GRASS_A = new THREE.Color(0x3f8f35), GRASS_B = new THREE.Color(0x79c450);

function layForest(bx, bz) {
    const jb = Math.floor(-bz / CELL), ib = Math.floor(bx / CELL);
    let nt = 0, nc = 0, nr = 0, ns = 0;
    for (let j = jb - 2; j <= jb + ROWS; j++) {
        for (let i = ib - COLS; i <= ib + COLS; i++) {
            if (tree(i, j, T)) {
                // a trunk that would end up inside the camera steps aside once you're past it
                if (T.z > bz + 3 && Math.abs(T.x - bx) < T.r + 1.6) continue;
                const g = groundH(T.x, T.z);
                dummy.position.set(T.x, g - 2 + TRUNK_H / 2, T.z); dummy.rotation.set(0, T.t * 6.28, 0); dummy.scale.set(T.r, TRUNK_H, T.r); dummy.updateMatrix();
                trunks.setMatrixAt(nt, dummy.matrix); trunks.setColorAt(nt, col.copy(BARK_A).lerp(BARK_B, T.t)); nt++;
                // dark leaves high overhead: two masses a tree, closing into a roof
                const cr = 9 + T.r * 3 + T.t * 3;
                dummy.position.set(T.x + (T.t - 0.5) * 5, g + 30 + T.t * 8, T.z); dummy.scale.set(cr, cr * 1.25, cr); dummy.updateMatrix();
                crowns.setMatrixAt(nc, dummy.matrix); crowns.setColorAt(nc, col.copy(LEAF_A).lerp(LEAF_B, hash(i, j, 11))); nc++;
                dummy.position.set(T.x - (T.t - 0.5) * 6, g + 44 + T.t * 6, T.z + 2); dummy.scale.set(cr * 0.8, cr, cr * 0.8); dummy.updateMatrix();
                crowns.setMatrixAt(nc, dummy.matrix); crowns.setColorAt(nc, col.copy(LEAF_A).lerp(LEAF_B, hash(i, j, 12) * 0.7)); nc++;
            } else if (nr < 200 && rock(i, j, T)) {
                dummy.position.set(T.x, groundH(T.x, T.z) + T.r * 0.35, T.z); dummy.rotation.set(T.t * 3, T.t * 5, 0); dummy.scale.set(T.r * 1.15, T.r * 0.95, T.r * 1.15); dummy.updateMatrix();
                rocks.setMatrixAt(nr, dummy.matrix); rocks.setColorAt(nr, col.copy(ROCK_A).lerp(ROCK_B, T.t)); nr++;
            }
            if (ns < 90 && (i & 1) === 0 && (j & 1) === 0 && hash(i, j, 30) < 0.5) {
                const sx = (i + hash(i, j, 31)) * CELL, sz = -(j + hash(i, j, 32)) * CELL, d = bz - sz;
                const fade = Math.max(0, Math.min(1, (125 - d) / 60)) * Math.max(0, Math.min(1, (d + 14) / 14));
                if (fade > 0.02) {
                    const hgt = 34 + hash(i, j, 33) * 10;
                    dummy.position.set(sx, groundH(sx, sz) + hgt / 2 - 1, sz); dummy.rotation.set(0, 0, 0.32); dummy.scale.set(3.5 + hash(i, j, 34) * 5, hgt, 1); dummy.updateMatrix();
                    shafts.setMatrixAt(ns, dummy.matrix); shafts.setColorAt(ns, col.setScalar(fade)); ns++;
                }
            }
        }
    }
    dummy.rotation.set(0, 0, 0);
    trunks.count = nt; crowns.count = nc; rocks.count = nr; shafts.count = ns;
    for (const m of [trunks, crowns, rocks, shafts]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
let grassKey = '';
function layGrass(bx, bz) {
    const i0 = Math.round(bx / GSTEP), j0 = Math.round(-bz / GSTEP), key = i0 + ',' + j0;
    if (key === grassKey) return;
    grassKey = key;
    let n = 0;
    for (let j = j0 - 5; j <= j0 + 44 && n < GRASS_N; j++) for (let i = i0 - 33; i <= i0 + 33 && n < GRASS_N; i++) {
        if (hash(i, j, 40) > 0.92) continue;
        const x = (i + hash(i, j, 41) - 0.5) * GSTEP, z = -(j + hash(i, j, 42) - 0.5) * GSTEP, hgt = 0.5 + hash(i, j, 43) * 0.9;
        dummy.position.set(x, groundH(x, z) + hgt * 0.45, z); dummy.rotation.set(0, hash(i, j, 44) * 3, 0); dummy.scale.set(1 + hash(i, j, 45), hgt, 1 + hash(i, j, 46)); dummy.updateMatrix();
        grass.setMatrixAt(n, dummy.matrix); grass.setColorAt(n, col.copy(GRASS_A).lerp(GRASS_B, hash(i, j, 47))); n++;
    }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
}

// the ball: the original's drifting purple and pink, with a little glow of its own so it shows in the gloom
const ballMat = new THREE.MeshLambertMaterial({ color: 0xb478ff });
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), ballMat);
scene.add(ballMesh);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshBasicMaterial({ color: 0x06100a, transparent: true, opacity: 0.4, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
scene.add(shadow);

// things in the air: dust in the light, and the burst when you crash
function cloud(n, size, color, additive) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ size, color, transparent: true, depthWrite: false, fog: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p);
    const base = []; for (let i = 0; i < n; i++) base.push([Math.random() * 80, Math.random(), Math.random() * 90, Math.random() * 6.28]);
    return { p, base, n };
}
const motes = cloud(260, 0.22, 0xffeebb, true); motes.p.material.opacity = 0.75;
const bits = cloud(80, 0.45, 0xd9a2ff, true);
const bitVel = []; bits.p.visible = false;
const mod = (a, n) => ((a % n) + n) % n;
function driftMotes(time, bx, bz) {
    const a = motes.p.geometry.attributes.position.array;
    for (let i = 0; i < motes.n; i++) {
        const b = motes.base[i];
        const x = bx + mod(b[0] - bx + 40, 80) - 40 + Math.sin(time * 0.5 + b[3]) * 1.5;
        const z = bz + 12 - mod(bz + 12 - b[2], 90);
        a[i * 3] = x; a[i * 3 + 1] = groundH(x, z) + 0.6 + b[1] * 9 + Math.sin(time * 0.8 + b[3]) * 0.6; a[i * 3 + 2] = z;
    }
    motes.p.geometry.attributes.position.needsUpdate = true;
}

// ---------- Game state ----------
const $ = id => document.getElementById(id);
const distEl = $('dist'), bestEl = $('best'), panel = $('panel'), box = $('box');
const ball = { x: 0, y: 0, z: 0, vy: 0, speed: SPEED_MIN, jumping: false };
let over = false, overAt = 0, shake = 0, shown = -1;
let best = 0; try { best = +localStorage.getItem('gravity-dash-best') || 0; } catch (e) {}
const metres = () => Math.floor(-ball.z);

function startGame() {
    seed = (Math.random() * 1e9) | 0;
    Object.assign(ball, { x: 0, z: 0, vy: 0, speed: SPEED_MIN, jumping: false });
    ball.y = groundH(0, 0) + R;
    over = false; shake = 0; shown = -1; groundKey = ''; grassKey = '';
    ballMesh.visible = true; shadow.visible = true; bits.p.visible = false;
    panel.hidden = true;
    bestEl.textContent = best ? 'Best ' + best : '';
}
function tryRestart() { if (over && performance.now() - overAt > 500) startGame(); }
function crash() {
    over = true; overAt = performance.now(); shake = 1;
    ballMesh.visible = false; shadow.visible = false;
    const a = bits.p.geometry.attributes.position.array; bitVel.length = 0;
    for (let i = 0; i < bits.n; i++) {
        a[i * 3] = ball.x; a[i * 3 + 1] = ball.y; a[i * 3 + 2] = ball.z;
        bitVel.push([(Math.random() - 0.5) * 18, Math.random() * 14 + 2, (Math.random() - 0.3) * -ball.speed * 0.5]);
    }
    bits.p.visible = true;
    const m = metres(), isBest = m > best;
    if (isBest) { best = m; try { localStorage.setItem('gravity-dash-best', String(best)); } catch (e) {} }
    bestEl.textContent = best ? 'Best ' + best : '';
    box.innerHTML = '<p>' + (isBest ? 'New best!' : 'Crashed') + '</p><div class="big">' + m + ' m</div><span class="go">R or tap to go again</span>';
    panel.hidden = false;
}

// ---------- Controls: as before ----------
const keys = {}, touch = { left: 0, right: 0, hop: false, ids: {} };
addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys[k] = true;
    if (over && !e.repeat && (k === 'r' || k === ' ')) tryRestart();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; touch.left = touch.right = 0; touch.ids = {}; });
addEventListener('pointerdown', e => {
    if (e.target && e.target.id === 'hop') { e.preventDefault(); if (over) tryRestart(); else touch.hop = true; return; }
    if (over) return tryRestart();
    if (e.pointerType === 'mouse') return;
    const s = e.clientX < innerWidth / 2 ? 'left' : 'right'; touch.ids[e.pointerId] = s; touch[s]++;
});
const liftPtr = e => { const s = touch.ids[e.pointerId]; if (s) { touch[s] = Math.max(0, touch[s] - 1); delete touch.ids[e.pointerId]; } };
addEventListener('pointerup', liftPtr);
addEventListener('pointercancel', liftPtr);
addEventListener('message', e => { if (e.data && e.data.type === 'focus') { try { window.focus(); } catch (err) {} } });
addEventListener('contextmenu', e => e.preventDefault());

// ---------- Each frame ----------
const X_AXIS = new THREE.Vector3(1, 0, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);
let camY = 5;
function step(dt) {
    ball.speed = Math.min(SPEED_MAX, ball.speed + SPEED_RAMP * dt);
    const steer = (keys['d'] || keys['arrowright'] || touch.right ? 1 : 0) - (keys['a'] || keys['arrowleft'] || touch.left ? 1 : 0);
    ball.x += steer * STEER * dt;                 // fixed sideways speed, no drift: the original steering
    ball.z -= ball.speed * dt;

    const g = groundH(ball.x, ball.z), floor = g + R;
    ball.vy -= GRAVITY * dt; ball.y += ball.vy * dt;
    if (ball.y <= floor) { ball.y = floor; ball.vy = ball.vy < -12 ? -ball.vy * 0.5 : 0; ball.jumping = false; }   // the little bounce on landing
    if ((keys[' '] || keys['arrowup'] || keys['w'] || touch.hop) && !ball.jumping) { ball.vy = JUMP; ball.jumping = true; }
    touch.hop = false;

    const jc = Math.floor(-ball.z / CELL), ic = Math.floor(ball.x / CELL);
    for (let j = jc - 1; j <= jc + 1; j++) for (let i = ic - 1; i <= ic + 1; i++) {
        if (tree(i, j, T)) {
            const dx = ball.x - T.x, dz = ball.z - T.z;
            if (dx * dx + dz * dz < (T.r * 1.05 + R * 0.85) ** 2) return crash();
        } else if (rock(i, j, T)) {
            const dx = ball.x - T.x, dz = ball.z - T.z;
            if (dx * dx + dz * dz < (T.r + R * 0.7) ** 2 && ball.y - R - g < T.r * 1.1) return crash();   // rocks are low enough to jump
        }
    }
    ballMesh.rotateOnWorldAxis(X_AXIS, -ball.speed * dt / R);
    ballMesh.rotateOnWorldAxis(Z_AXIS, -steer * STEER * dt / R);
}
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    const time = now / 1000;
    if (!over) step(dt);
    else if (bits.p.visible) {
        const a = bits.p.geometry.attributes.position.array;
        for (let i = 0; i < bits.n; i++) {
            const v = bitVel[i]; v[1] -= 30 * dt;
            a[i * 3] += v[0] * dt; a[i * 3 + 1] = Math.max(groundH(a[i * 3], a[i * 3 + 2]) + 0.1, a[i * 3 + 1] + v[1] * dt); a[i * 3 + 2] += v[2] * dt;
        }
        bits.p.geometry.attributes.position.needsUpdate = true;
    }
    const g = groundH(ball.x, ball.z), lift = Math.max(0, ball.y - R - g);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    shadow.position.set(ball.x, g + 0.1, ball.z); shadow.scale.setScalar(Math.max(0.5, 1 - lift * 0.07)); shadow.material.opacity = 0.4 * Math.max(0.35, 1 - lift * 0.1);
    // the original ball colours: they drift with time and flare when it's moving fast up or down
    const cf = Math.sin(time * 0.8) * 0.5 + 0.5, sf = Math.min(1, Math.abs(ball.vy) / 60);
    ballMat.color.setRGB((100 + 155 * (cf * 0.7 + sf * 0.3)) / 255, (80 + 100 * (1 - cf)) / 255, (200 + 55 * sf) / 255, THREE.SRGBColorSpace);
    ballMat.emissive.copy(ballMat.color).multiplyScalar(0.35);

    layGround(ball.x, ball.z);
    layForest(ball.x, ball.z);
    layGrass(ball.x, ball.z);
    driftMotes(time, ball.x, ball.z);

    // the camera goes wherever the ball goes: low and close behind it, looking up the trunks
    const camZ = ball.z + 8.5;
    camY += (Math.max(g + R + 3.0, groundH(ball.x, camZ) + 2.2) - camY) * Math.min(1, dt * 5);
    shake = Math.max(0, shake - dt * 2.2);
    camera.position.set(ball.x + (Math.random() - 0.5) * shake * 1.2, camY + (Math.random() - 0.5) * shake * 1.2, camZ);
    camera.lookAt(ball.x, camY + 1.6, ball.z - 30);
    sun.position.set(ball.x - 30, 70, ball.z - 40); sun.target.position.set(ball.x, 0, ball.z);

    const m = metres();
    if (m !== shown) { shown = m; distEl.firstChild.nodeValue = String(Math.max(0, m)); }
    renderer.render(scene, camera);
}
function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 82 : 70; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize(); startGame();
requestAnimationFrame(frame);
