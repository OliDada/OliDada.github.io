// Deepwood: a ball dashing through a huge, dense forest. (It grew out of Gravity Dash, which is still at /gravity_dash.js.)
// The ball stays in the middle of the screen and the camera goes with it, so the forest carries on in
// every direction: everything is worked out from where it stands, wherever the ball goes.
// The feel is the original game's: the same speed-up, the same fixed sideways steering, the same jump.
// The forest changes as you go: dark pine woods, leafy woods, birch groves, open clearings, and streams to jump.
// (Earlier attempts are kept beside this file: forest3d-attempt.js, p5-forest-attempt.js, forest-v4-backup.js.)
import * as THREE from 'three';

const R = 1;                 // the ball. Everything else is measured against it.
const CELL = 8;              // the forest is divided into squares; a square holds one thing or nothing
const ROWS = 20, COLS = 16;  // how many squares ahead and to each side are drawn
const MAXC = (ROWS + 3) * (COLS * 2 + 1);
const TRUNK_H = 70;          // the trunks go up out of sight

// the original game's numbers, converted from pixels a frame (ball radius 20) to ball-radii a second
// it starts at the original's starting speed and builds to full speed over about 75 seconds (the original took 17)
const SPEED_MIN = 22.5, SPEED_MAX = 45, SPEED_RAMP = (SPEED_MAX - SPEED_MIN) / 75;
const STEER = 15, JUMP = 36, GRAVITY = 90;

let seed = (Math.random() * 1e9) | 0;
function hash(i, j, k) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul((k + seed) | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
// smooth noise for the big things: which kind of forest, where the clearings are, how hilly
function vnoise(x, z, size, k) {
    const u = x / size, v = z / size, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
    const a = hash(i, j, k), b = hash(i + 1, j, k), c = hash(i, j + 1, k), d = hash(i + 1, j + 1, k);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const forestKind = (x, z) => vnoise(x, z, 150, 50);     // low: pines, middle: leafy trees, high: birches
const openness = (x, z) => vnoise(x, z, 95, 51);        // high: a clearing
const clearingAt = (x, z) => smooth(0.70, 0.80, openness(x, z));
const hilliness = (x, z) => 0.35 + 1.5 * vnoise(x, z, 170, 52);

// ---------- Streams ----------
// Every few hundred metres a stream crosses the forest. It winds, and you have to jump it.
const STREAM_W = 7;          // half the width of the dip it runs in
const streamZ = s => -(380 + s * 330 + hash(s, 0, 60) * 140);
const streamCentre = (s, x) => streamZ(s) + 7 * Math.sin(x * 0.035 + s * 2.1) + 3 * Math.sin(x * 0.09 + s);
let SN_s = -1;               // set by nearStream: which stream is closest
function nearStream(x, z) {
    const s0 = Math.round((-z - 450) / 330);
    let best = 1e9; SN_s = -1;
    for (let s = Math.max(0, s0 - 1); s <= s0 + 1; s++) { const d = Math.abs(z - streamCentre(s, x)); if (d < best) { best = d; SN_s = s; } }
    return best;
}
function baseH(x, z) {
    return hilliness(x, z) * (2.6 * Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.041) + 1.7 * Math.sin(z * 0.075 + x * 0.03) + 0.7 * Math.sin(x * 0.13 + z * 0.06) * Math.sin(z * 0.11));
}
function groundH(x, z) {
    let h = baseH(x, z);
    const ad = nearStream(x, z);
    if (ad < STREAM_W) h -= 2.6 * smooth(0, 1, (STREAM_W - ad) / 3);
    return h;
}
const waterY = (s, x) => baseH(x, streamCentre(s, x)) - 0.9;

// ---------- What stands in square (i, j) ----------
// kinds: 1 leafy tree, 2 pine, 3 birch, 4 boulder (a big jump), 5 rock, 6 stump, 7 fallen log
const TREE = 1, PINE = 2, BIRCH = 3, BOULDER = 4, ROCK = 5, STUMP = 6, LOG = 7;
function cell(i, j, o) {
    if (j < 4) return 0;
    const cx = (i + 0.5) * CELL, cz = -(j + 0.5) * CELL;
    const fk = forestKind(cx, cz), clearing = clearingAt(cx, cz);
    let chance = Math.min(0.42, 0.24 + j * 0.0007) * (1 - 0.88 * clearing);
    if (fk < 0.36) chance *= 1.12;   // pines stand closer together
    o.t = hash(i, j, 5); o.h = 999; o.len = 0; o.a = 0;
    if (hash(i, j, 1) < chance) {
        o.kind = fk < 0.36 ? PINE : fk > 0.66 ? BIRCH : TREE;
        const s = hash(i, j, 2);
        o.r = o.kind === BIRCH ? 0.6 + 0.45 * s : o.kind === PINE ? 0.8 + 0.6 * s : 0.9 + 0.8 * s;
        o.x = (i + 0.15 + hash(i, j, 3) * 0.7) * CELL; o.z = -(j + 0.15 + hash(i, j, 4) * 0.7) * CELL;
    } else {
        if (j < 7) return 0;
        const r2 = hash(i, j, 6), s = hash(i, j, 7);
        o.x = (i + 0.2 + hash(i, j, 8) * 0.6) * CELL; o.z = -(j + 0.2 + hash(i, j, 9) * 0.6) * CELL;
        if (r2 < 0.025 && j >= 12) { o.kind = BOULDER; o.r = 2.2 + 1.3 * s; o.h = o.r * 1.3; o.x = cx; o.z = cz; }
        else if (r2 < 0.07) { o.kind = ROCK; o.r = 0.9 + 0.5 * s; o.h = o.r * 1.1; }
        else if (r2 < 0.10 && clearing < 0.5) { o.kind = STUMP; o.r = 0.85 + 0.35 * s; o.h = 1.2; }
        else if (r2 < 0.145 && j >= 9) { o.kind = LOG; o.r = 0.55 + 0.15 * s; o.h = o.r * 2; o.a = (hash(i, j, 10) - 0.5) * 1.1; o.len = 5.5 + hash(i, j, 11) * 1.5; o.x = cx; o.z = cz; }
        else return 0;
    }
    if (nearStream(o.x, o.z) < STREAM_W + (o.kind === LOG ? o.len / 2 : o.r) + 0.5) return 0;   // nothing stands in a stream
    return o.kind;
}

// what the ball would hit at (x, z) with its underside at height `bottom`; null if nothing
const C = {};
function hitTest(x, z, bottom) {
    const jc = Math.floor(-z / CELL), ic = Math.floor(x / CELL);
    for (let j = jc - 1; j <= jc + 1; j++) for (let i = ic - 1; i <= ic + 1; i++) {
        const k = cell(i, j, C);
        if (!k) continue;
        const dx = x - C.x, dz = z - C.z;
        if (k === LOG) {
            const ca = Math.cos(C.a), sa = Math.sin(C.a);
            const along = Math.max(-C.len / 2, Math.min(C.len / 2, dx * ca + dz * sa));
            if (Math.hypot(dx - along * ca, dz - along * sa) < C.r + R * 0.8 && bottom < groundH(C.x, C.z) + C.h) return 'log';
        } else if (dx * dx + dz * dz < (C.r * (k <= BIRCH ? 1.05 : 0.95) + R * 0.85) ** 2) {
            if (k <= BIRCH) return 'tree';
            if (bottom < groundH(C.x, C.z) + C.h) return ['', '', '', '', 'boulder', 'rock', 'stump'][k];
        }
    }
    if (nearStream(x, z) < 4.6 && bottom < waterY(SN_s, x) + 0.25) return 'water';
    return null;
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
const timeU = { value: 0 };

// the ground: one sheet that follows the ball, snapped to its own squares so the hills never swim
const GS = 3, GX = 86, GZ = 64;
const groundGeo = new THREE.PlaneGeometry(GX * GS, GZ * GS, GX, GZ);
groundGeo.rotateX(-Math.PI / 2);
groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.position.count * 3), 3));
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
ground.frustumCulled = false;
scene.add(ground);
const baseXZ = Float32Array.from(groundGeo.attributes.position.array);
const G_LEAF = [new THREE.Color(0x2c6a2a), new THREE.Color(0x4a9238)];
const G_PINE = [new THREE.Color(0x34401f), new THREE.Color(0x4f5a2a)];
const G_BIRCH = [new THREE.Color(0x4c8a36), new THREE.Color(0x77ac48)];
const G_CLEAR = new THREE.Color(0x63b347), G_MUD = new THREE.Color(0x45382a);
const cA = new THREE.Color(), cB = new THREE.Color(), cTmp = new THREE.Color();
function groundColour(x, z, n, out) {
    const fk = forestKind(x, z), pine = smooth(0.42, 0.30, fk), birch = smooth(0.60, 0.72, fk);
    cA.copy(G_LEAF[0]).lerp(G_LEAF[1], n);
    cB.copy(G_PINE[0]).lerp(G_PINE[1], n); cA.lerp(cB, pine);
    cB.copy(G_BIRCH[0]).lerp(G_BIRCH[1], n); cA.lerp(cB, birch);
    cA.lerp(G_CLEAR, clearingAt(x, z) * (0.6 + 0.4 * n));
    const ad = nearStream(x, z);
    if (ad < STREAM_W + 1.5) cA.lerp(G_MUD, smooth(STREAM_W + 1.5, STREAM_W - 1, ad));
    return out.copy(cA);
}
let groundKey = '';
function layGround(bx, bz) {
    const gx = Math.round(bx / GS) * GS, gz = Math.round((bz - 66) / GS) * GS, key = gx + ',' + gz;
    if (key === groundKey) return;
    groundKey = key;
    const pos = groundGeo.attributes.position.array, col = groundGeo.attributes.color.array;
    for (let v = 0; v < pos.length; v += 3) {
        const wx = baseXZ[v] + gx, wz = baseXZ[v + 2] + gz;
        pos[v] = wx; pos[v + 1] = groundH(wx, wz); pos[v + 2] = wz;
        groundColour(wx, wz, hash(Math.round(wx / GS), Math.round(wz / GS), 20), cTmp);
        col[v] = cTmp.r; col[v + 1] = cTmp.g; col[v + 2] = cTmp.b;
    }
    groundGeo.attributes.position.needsUpdate = true;
    groundGeo.attributes.color.needsUpdate = true;
    groundGeo.computeVertexNormals();
}

// water: a ribbon that follows the nearest stream
const WSEG = 96;
const waterGeo = new THREE.BufferGeometry();
waterGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * 2 * 3), 3));
waterGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((WSEG + 1) * 2 * 3).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
{ const idx = []; for (let k = 0; k < WSEG; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } waterGeo.setIndex(idx); }
const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({ color: 0x2f7280, emissive: 0x0c2d33, transparent: true, opacity: 0.88 }));
water.frustumCulled = false; water.visible = false;
scene.add(water);
function layWater(bx, bz) {
    let s = Math.max(0, Math.round((-bz - 450) / 330));
    if (streamZ(s) > bz + 20) s++;
    if (streamZ(s) < bz - 200) { water.visible = false; return; }
    const pos = waterGeo.attributes.position.array, x0 = Math.round(bx / 4) * 4;
    for (let k = 0; k <= WSEG; k++) {
        const x = x0 + (k - WSEG / 2) * 3.4, zc = streamCentre(s, x), y = waterY(s, x) + Math.sin(timeU.value * 2 + x * 0.3) * 0.04;
        pos.set([x, y, zc - 5.6, x, y, zc + 5.6], k * 6);
    }
    waterGeo.attributes.position.needsUpdate = true;
    water.visible = true;
}

// ---------- Trees, rocks, logs ----------
function birchTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e5d9'; g.fillRect(0, 0, 64, 256);
    g.fillStyle = 'rgba(32, 29, 26, 0.85)';
    for (let i = 0; i < 46; i++) g.fillRect(Math.random() * 64, Math.random() * 256, 5 + Math.random() * 16, 2 + Math.random() * 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const lam = (flat) => new THREE.MeshLambertMaterial({ flatShading: !!flat });
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.86, 1.3, 1, 9, 1, true), lam(), MAXC);
const birches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.1, 1, 10, 1, true), new THREE.MeshLambertMaterial({ map: birchTexture() }), MAXC);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(true), MAXC * 2);
const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), lam(true), MAXC * 3);
const boulders = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), lam(true), 120);
const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lam(true), 220);
const stumps = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.15, 1, 11), lam(true), 220);
const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 11), lam(true), 220);

// grass and ferns: little clumps of blades, darker at the root, swaying a little
function clumpGeo(blades, width, lean, hgt) {
    const P = [], N = [], Cc = [];
    for (let b = 0; b < blades; b++) {
        const ang = (b / blades) * Math.PI * 2 + Math.random() * 0.8, dx = Math.cos(ang), dz = Math.sin(ang);
        const ox = dx * 0.1, oz = dz * 0.1, h = hgt * (0.7 + Math.random() * 0.5), l = lean * (0.6 + Math.random() * 0.7);
        P.push(ox - dz * width / 2, 0, oz + dx * width / 2, ox + dz * width / 2, 0, oz - dx * width / 2, ox + dx * l, h, oz + dz * l);
        N.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        Cc.push(0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 1, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
    return g;
}
function swayMat() {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
        sh.uniforms.uTime = timeU;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float sw = sin(uTime * 1.7 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27);
  transformed.x += sw * 0.16 * position.y; transformed.z += sw * 0.07 * position.y;
#endif`);
        // a blade is a single sheet seen from both sides: light both sides the same, or the back faces come out black
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif');
    };
    return m;
}
const GRASS_N = 3600, FERN_N = 500, FLOWER_N = 700, GSTEP = 2.2;
const grass = new THREE.InstancedMesh(clumpGeo(7, 0.12, 0.28, 1.0), swayMat(), GRASS_N);
const ferns = new THREE.InstancedMesh(clumpGeo(9, 0.42, 1.0, 0.5), swayMat(), FERN_N);
const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial(), FLOWER_N);   // small and flat-lit, so they read as flowers, not pebbles

// shafts of light coming down through the leaves
function shaftTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v; g.fillRect(0, 0, 64, 128);
    g.globalCompositeOperation = 'destination-in';
    const hg = g.createLinearGradient(0, 0, 64, 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.fillRect(0, 0, 64, 128);
    return new THREE.CanvasTexture(c);
}
const shafts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0xffe9b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }), 90);
const ALL = [trunks, birches, crowns, cones, boulders, rocks, stumps, logs, grass, ferns, flowers, shafts];
for (const m of ALL) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }

const dummy = new THREE.Object3D(), col = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
const BARK_A = new THREE.Color(0x3d2c20), BARK_B = new THREE.Color(0x5e4631), PINE_BARK = new THREE.Color(0x4a2d1e);
const LEAF_A = new THREE.Color(0x0f3a22), LEAF_B = new THREE.Color(0x1f5c33);
const NEEDLE_A = new THREE.Color(0x0b2a1e), NEEDLE_B = new THREE.Color(0x173f2a);
const BLEAF_A = new THREE.Color(0x3d7a2c), BLEAF_B = new THREE.Color(0x6a9a38);
const ROCK_A = new THREE.Color(0x5b635c), ROCK_B = new THREE.Color(0x7b8478), MOSS = new THREE.Color(0x4f6b3a);
const WOOD_A = new THREE.Color(0x4a3526), WOOD_B = new THREE.Color(0x6a4d33);
const GRASS_A = new THREE.Color(0x3f8f35), GRASS_B = new THREE.Color(0x79c450), FERN_A = new THREE.Color(0x2f6e2a), FERN_B = new THREE.Color(0x4f8f34);
const PETALS = [new THREE.Color(0xfff6e0), new THREE.Color(0xffd84a), new THREE.Color(0xc39cff), new THREE.Color(0xff8fb8)];
const counts = new Map();
const put = (m, c) => { const n = counts.get(m); m.setMatrixAt(n, dummy.matrix); m.setColorAt(n, c); counts.set(m, n + 1); };
const room = m => counts.get(m) < m.instanceMatrix.count;

function layForest(bx, bz) {
    for (const m of [trunks, birches, crowns, cones, boulders, rocks, stumps, logs, shafts]) counts.set(m, 0);
    const jb = Math.floor(-bz / CELL), ib = Math.floor(bx / CELL), T = {};
    for (let j = jb - 2; j <= jb + ROWS; j++) {
        for (let i = ib - COLS; i <= ib + COLS; i++) {
            const k = cell(i, j, T);
            // something tall that would end up inside the camera steps aside once you're past it
            if (k && (k <= BOULDER) && T.z > bz + 3 && Math.abs(T.x - bx) < T.r + 1.6) continue;
            if (k) {
                const g = groundH(T.x, T.z), t = T.t;
                dummy.rotation.set(0, t * 6.28, 0);
                if (k === TREE || k === PINE) {
                    dummy.position.set(T.x, g - 2 + TRUNK_H / 2, T.z); dummy.scale.set(T.r, TRUNK_H, T.r); dummy.updateMatrix();
                    put(trunks, k === PINE ? PINE_BARK : col.copy(BARK_A).lerp(BARK_B, t));
                } else if (k === BIRCH) {
                    dummy.position.set(T.x, g - 2 + TRUNK_H / 2, T.z); dummy.scale.set(T.r, TRUNK_H, T.r); dummy.updateMatrix();
                    put(birches, col.setScalar(0.85 + 0.15 * t));
                }
                if (k === TREE) {
                    const cr = 9 + T.r * 3 + t * 3;
                    dummy.position.set(T.x + (t - 0.5) * 5, g + 30 + t * 8, T.z); dummy.scale.set(cr, cr * 1.25, cr); dummy.updateMatrix();
                    put(crowns, col.copy(LEAF_A).lerp(LEAF_B, hash(i, j, 11)));
                    dummy.position.set(T.x - (t - 0.5) * 6, g + 44 + t * 6, T.z + 2); dummy.scale.set(cr * 0.8, cr, cr * 0.8); dummy.updateMatrix();
                    put(crowns, col.copy(LEAF_A).lerp(LEAF_B, hash(i, j, 12) * 0.7));
                } else if (k === PINE) {        // tiers of dark needles, starting well above you
                    for (let q = 0; q < 3; q++) {
                        const rr = 7.5 - q * 1.8 + t * 1.5;
                        dummy.position.set(T.x, g + 22 + q * 12 + t * 6, T.z); dummy.scale.set(rr, 20, rr); dummy.updateMatrix();
                        put(cones, col.copy(NEEDLE_A).lerp(NEEDLE_B, hash(i, j, 13 + q)));
                    }
                } else if (k === BIRCH) {       // lighter, smaller leaves
                    const cr = 5.5 + t * 2.5;
                    dummy.position.set(T.x + (t - 0.5) * 3, g + 26 + t * 6, T.z); dummy.scale.set(cr, cr * 1.4, cr); dummy.updateMatrix();
                    put(crowns, col.copy(BLEAF_A).lerp(BLEAF_B, hash(i, j, 11)));
                    dummy.position.set(T.x - (t - 0.5) * 4, g + 36 + t * 5, T.z - 1); dummy.scale.set(cr * 0.8, cr, cr * 0.8); dummy.updateMatrix();
                    put(crowns, col.copy(BLEAF_A).lerp(BLEAF_B, hash(i, j, 12)));
                } else if (k === BOULDER && room(boulders)) {   // a big mossy boulder: you can only just jump it
                    dummy.position.set(T.x, g + T.r * 0.55, T.z); dummy.rotation.set(t * 2, t * 6, t); dummy.scale.set(T.r * 1.05, T.r * 1.0, T.r * 1.05); dummy.updateMatrix();
                    put(boulders, col.copy(ROCK_A).lerp(MOSS, 0.35 + t * 0.4));
                } else if (k === ROCK && room(rocks)) {
                    dummy.position.set(T.x, g + T.r * 0.35, T.z); dummy.rotation.set(t * 3, t * 5, 0); dummy.scale.set(T.r * 1.15, T.r * 0.95, T.r * 1.15); dummy.updateMatrix();
                    put(rocks, col.copy(ROCK_A).lerp(ROCK_B, t));
                } else if (k === STUMP && room(stumps)) {
                    dummy.position.set(T.x, g + T.h / 2 - 0.1, T.z); dummy.scale.set(T.r, T.h + 0.2, T.r); dummy.updateMatrix();
                    put(stumps, col.copy(WOOD_A).lerp(WOOD_B, t));
                } else if (k === LOG && room(logs)) {
                    const ca = Math.cos(T.a), sa = Math.sin(T.a);
                    dir.set(ca, 0, sa);
                    dummy.position.set(T.x, g + T.r * 0.9, T.z); dummy.quaternion.setFromUnitVectors(UP, dir); dummy.scale.set(T.r, T.len, T.r); dummy.updateMatrix();
                    put(logs, col.copy(WOOD_A).lerp(WOOD_B, t * 0.6));
                }
            }
            if (room(shafts) && (i & 1) === 0 && (j & 1) === 0 && hash(i, j, 30) < 0.5) {
                const sx = (i + hash(i, j, 31)) * CELL, sz = -(j + hash(i, j, 32)) * CELL, d = bz - sz;
                const fade = Math.max(0, Math.min(1, (125 - d) / 60)) * Math.max(0, Math.min(1, (d + 14) / 14)) * (0.6 + 0.8 * clearingAt(sx, sz));
                if (fade > 0.02) {
                    const hgt = 34 + hash(i, j, 33) * 10;
                    dummy.position.set(sx, groundH(sx, sz) + hgt / 2 - 1, sz); dummy.rotation.set(0, 0, 0.32); dummy.scale.set(3.5 + hash(i, j, 34) * 5, hgt, 1); dummy.updateMatrix();
                    put(shafts, col.setScalar(Math.min(1, fade)));
                }
            }
        }
    }
    dummy.rotation.set(0, 0, 0);
    for (const [m, n] of counts) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

let grassKey = '';
function layGrass(bx, bz) {
    const i0 = Math.round(bx / GSTEP), j0 = Math.round(-bz / GSTEP), key = i0 + ',' + j0;
    if (key === grassKey) return;
    grassKey = key;
    let ng = 0, nf = 0, nfl = 0;
    for (let j = j0 - 5; j <= j0 + 46; j++) for (let i = i0 - 34; i <= i0 + 34; i++) {
        const x = (i + hash(i, j, 41) - 0.5) * GSTEP, z = -(j + hash(i, j, 42) - 0.5) * GSTEP;
        const fk = forestKind(x, z), clear = clearingAt(x, z), r = hash(i, j, 40);
        if (nearStream(x, z) < 5.4) continue;
        const g = groundH(x, z);
        // pine woods: mostly bare needles and ferns. Leafy woods: grass and ferns. Birches and clearings: thick grass and flowers.
        const grassAmount = 0.35 + 0.45 * smooth(0.30, 0.45, fk) + 0.2 * clear;
        const fernAmount = (fk < 0.66 ? 0.16 : 0.04) * (1 - clear);
        if (r < grassAmount && ng < GRASS_N) {
            const hgt = (0.55 + hash(i, j, 43) * 0.8) * (1 + 0.5 * clear);
            dummy.position.set(x, g - 0.05, z); dummy.rotation.set(0, hash(i, j, 44) * 6.28, 0); dummy.scale.set(1 + hash(i, j, 45) * 0.6, hgt, 1 + hash(i, j, 46) * 0.6); dummy.updateMatrix();
            grass.setMatrixAt(ng, dummy.matrix); grass.setColorAt(ng, col.copy(GRASS_A).lerp(GRASS_B, hash(i, j, 47) * 0.7 + clear * 0.3)); ng++;
        } else if (r > 1 - fernAmount && nf < FERN_N) {
            const s = 1 + hash(i, j, 48) * 1.2;
            dummy.position.set(x, g - 0.02, z); dummy.rotation.set(0, hash(i, j, 44) * 6.28, 0); dummy.scale.set(s, s, s); dummy.updateMatrix();
            ferns.setMatrixAt(nf, dummy.matrix); ferns.setColorAt(nf, col.copy(FERN_A).lerp(FERN_B, hash(i, j, 49))); nf++;
        }
        if (clear > 0.2 && hash(i, j, 50) < 0.35 * clear && nfl < FLOWER_N) {
            const fx = x + hash(i, j, 51) - 0.5, fz = z + hash(i, j, 52) - 0.5;
            const fs = 0.8 + hash(i, j, 54) * 0.6; dummy.position.set(fx, groundH(fx, fz) + 0.7 + hash(i, j, 53) * 0.45, fz); dummy.rotation.set(0, 0, 0); dummy.scale.set(fs, fs * 0.45, fs); dummy.updateMatrix();
            flowers.setMatrixAt(nfl, dummy.matrix); flowers.setColorAt(nfl, PETALS[Math.floor(hash(i, j, 55) * 4)]); nfl++;
        }
    }
    for (const [m, n] of [[grass, ng], [ferns, nf], [flowers, nfl]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

// the ball: a glowing orange ember, the opposite of all that green, lighting the grass around it
const ballMat = new THREE.MeshLambertMaterial({ color: 0xff8a3d, emissive: new THREE.Color(0xff4a10).multiplyScalar(0.55) });
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), ballMat);
const glow = new THREE.PointLight(0xff8a3d, 40, 14, 1.6);
scene.add(ballMesh, glow);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), new THREE.MeshBasicMaterial({ color: 0x06100a, transparent: true, opacity: 0.4, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
scene.add(shadow);

// things in the air: dust in the light, and the burst when you crash (soft round dots, not squares)
const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
})();
function cloud(n, size, color, additive) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ size, color, map: dotTex, transparent: true, depthWrite: false, fog: !additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p);
    const base = []; for (let i = 0; i < n; i++) base.push([Math.random() * 80, Math.random(), Math.random() * 90, Math.random() * 6.28]);
    return { p, base, n };
}
const motes = cloud(260, 0.22, 0xffeebb, true); motes.p.material.opacity = 0.75;
const bits = cloud(80, 0.5, 0xffa055, false);
const bitVel = []; bits.p.visible = false;
const mod = (a, n) => ((a % n) + n) % n;
function driftMotes(time, bx, bz) {
    const a = motes.p.geometry.attributes.position.array;
    for (let i = 0; i < motes.n; i++) {
        const b = motes.base[i];
        const x = bx + mod(b[0] - bx + 40, 80) - 40 + Math.sin(time * 0.5 + b[3]) * 1.5;
        const z = bz + 12 - mod(bz + 12 - b[2], 90);
        a[i * 3] = x; a[i * 3 + 1] = baseH(x, z) + 0.6 + b[1] * 9 + Math.sin(time * 0.8 + b[3]) * 0.6; a[i * 3 + 2] = z;
    }
    motes.p.geometry.attributes.position.needsUpdate = true;
}

// ---------- Sounds: all made on the fly, no sound files ----------
let ac = null, sfxOut = null, noiseBuf = null;
// Sounds follow the site's Music button in the player header (it saves its choice under this key)
const SITE_MUTE = 'olid-music:game-muted';
let muted = false; try { muted = localStorage.getItem(SITE_MUTE) === '1'; } catch (e) {}
addEventListener('message', e => {
    if (!e.data || e.data.type !== 'olid-music:toggle') return;
    muted = !muted;
    setTimeout(() => { try { muted = localStorage.getItem(SITE_MUTE) === '1'; } catch (err) {} }, 0);   // and match what the music player saved
});
function audio() {
    if (ac) return ac;
    try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        sfxOut = ac.createGain(); sfxOut.gain.value = 0.55; sfxOut.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
}
const wake = () => { const a = audio(); if (a && a.state === 'suspended') a.resume(); };   // browsers only allow sound after a tap or key
addEventListener('pointerdown', wake, true);
addEventListener('keydown', wake, true);
function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxOut); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, vol, type, f0, f1, q = 1, delay = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + delay, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxOut); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
const sfx = {
    jump() { tone('sine', 230, 430, 0.15, 0.16); hiss(0.14, 0.05, 'bandpass', 900, 2600, 1.2); },
    land(impact) { const s = Math.min(1, impact / 40); tone('sine', 115, 48, 0.2, 0.08 + 0.3 * s); hiss(0.09, 0.03 + 0.08 * s, 'lowpass', 700, 200); },
    splash() { hiss(0.9, 0.35, 'bandpass', 1900, 450, 0.8); hiss(0.45, 0.2, 'highpass', 3200, 1400, 0.7, 0.05); tone('sine', 320, 90, 0.3, 0.14); },
    crash() { tone('sine', 150, 38, 0.5, 0.5); hiss(0.38, 0.35, 'lowpass', 2400, 260, 0.7); hiss(0.12, 0.22, 'bandpass', 3200, 1200, 1, 0.02); },
    bird() {   // a little bird: two to four quick notes
        const f = 2300 + Math.random() * 1500, n = 2 + Math.floor(Math.random() * 3), up = Math.random() < 0.5;
        for (let k = 0; k < n; k++) tone('sine', f * (up ? 1 : 1.35), f * (up ? 1.35 : 1), 0.07 + Math.random() * 0.04, 0.035 + Math.random() * 0.03, k * (0.1 + Math.random() * 0.05));
    }
};

// ---------- Game state ----------
const $ = id => document.getElementById(id);
const distEl = $('dist'), bestEl = $('best'), panel = $('panel'), box = $('box');
const ball = { x: 0, y: 0, z: 0, vy: 0, speed: SPEED_MIN, jumping: false };
let over = false, overAt = 0, shake = 0, shown = -1;
let best = 0; try { best = +(localStorage.getItem('deepwood-best') || localStorage.getItem('gravity-dash-best')) || 0; } catch (e) {}
const metres = () => Math.floor(-ball.z);
const CRASH_TEXT = { tree: 'Hit a tree', boulder: 'Hit a boulder', rock: 'Hit a rock', stump: 'Hit a stump', log: 'Hit a log', water: 'Splash!' };

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
function crash(what) {
    over = true; overAt = performance.now(); shake = what === 'water' ? 0.4 : 1;
    ballMesh.visible = false; shadow.visible = false;
    bits.p.material.color.set(what === 'water' ? 0xa8e4ff : 0xffa055);
    const a = bits.p.geometry.attributes.position.array; bitVel.length = 0;
    for (let i = 0; i < bits.n; i++) {
        a[i * 3] = ball.x; a[i * 3 + 1] = ball.y; a[i * 3 + 2] = ball.z;
        bitVel.push([(Math.random() - 0.5) * 18, Math.random() * 14 + 2, (Math.random() - 0.3) * -ball.speed * 0.5]);
    }
    bits.p.visible = true;
    if (what === 'water') sfx.splash(); else sfx.crash();
    const m = metres(), isBest = m > best;
    if (isBest) { best = m; try { localStorage.setItem('deepwood-best', String(best)); } catch (e) {} }
    bestEl.textContent = best ? 'Best ' + best : '';
    box.innerHTML = '<p>' + (isBest ? 'New best!' : CRASH_TEXT[what] || 'Crashed') + '</p><div class="big">' + m + ' m</div><span class="go">R or tap to go again</span>';
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
    if (ball.y <= floor) {
        if (ball.air && ball.vy < -10) sfx.land(-ball.vy);
        ball.y = floor; ball.vy = ball.vy < -12 ? -ball.vy * 0.5 : 0; ball.jumping = false; ball.air = false;   // the little bounce on landing
    } else if (ball.y > floor + 0.3) ball.air = true;
    if ((keys[' '] || keys['arrowup'] || keys['w'] || touch.hop) && !ball.jumping) { ball.vy = JUMP; ball.jumping = true; ball.air = true; sfx.jump(); }
    touch.hop = false;
    // birds: often in the clearings, now and then anywhere
    if (Math.random() < dt * (0.12 + 1.1 * clearingAt(ball.x, ball.z))) sfx.bird();
    const hit = hitTest(ball.x, ball.z, ball.y - R);
    if (hit) return crash(hit);
    ballMesh.rotateOnWorldAxis(X_AXIS, -ball.speed * dt / R);
    ballMesh.rotateOnWorldAxis(Z_AXIS, -steer * STEER * dt / R);
}
let last = performance.now();
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    const time = now / 1000;
    timeU.value = time;
    if (!over) step(dt);
    else if (bits.p.visible) {
        const a = bits.p.geometry.attributes.position.array;
        for (let i = 0; i < bits.n; i++) {
            const v = bitVel[i]; v[1] -= 30 * dt;
            a[i * 3] += v[0] * dt; a[i * 3 + 1] = Math.max(baseH(a[i * 3], a[i * 3 + 2]) - 2, a[i * 3 + 1] + v[1] * dt); a[i * 3 + 2] += v[2] * dt;
        }
        bits.p.geometry.attributes.position.needsUpdate = true;
    }
    const g = groundH(ball.x, ball.z), lift = Math.max(0, ball.y - R - g);
    ballMesh.position.set(ball.x, ball.y, ball.z);
    shadow.position.set(ball.x, g + 0.1, ball.z); shadow.scale.setScalar(Math.max(0.5, 1 - lift * 0.07)); shadow.material.opacity = 0.4 * Math.max(0.35, 1 - lift * 0.1);
    glow.position.set(ball.x, ball.y + 0.6, ball.z); glow.visible = ballMesh.visible;

    layGround(ball.x, ball.z);
    layWater(ball.x, ball.z);
    layForest(ball.x, ball.z);
    layGrass(ball.x, ball.z);
    driftMotes(time, ball.x, ball.z);

    // the camera goes wherever the ball goes: low and close behind it, looking up the trunks
    const camZ = ball.z + 8.5;
    camY += (Math.max(baseH(ball.x, ball.z) + R + 3.0, groundH(ball.x, camZ) + 2.2) - camY) * Math.min(1, dt * 5);
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
