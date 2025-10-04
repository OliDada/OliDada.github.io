import * as THREE from 'three';
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import spline from './spline.js';
import { EffectComposer } from 'jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'jsm/postprocessing/UnrealBloomPass.js';
import { Line2 } from 'jsm/lines/Line2.js';
import { LineMaterial } from 'jsm/lines/LineMaterial.js';
import { LineGeometry } from 'jsm/lines/LineGeometry.js';
import StyleManager from './styleManager.js';
import TUBE_STYLES from './styles.js';
// We need a renderer, a scene, and a camera

const width = window.innerWidth;
const height = window.innerHeight;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
// use device pixel ratio for crisp rendering on HiDPI displays (cap for performance)
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// Camera
const fov = 75; // Field of view
const aspect = width / height; // Aspect ratio
const near = 0.01; // Near clipping plane
const far = 1000; // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
// Move the camera back so the full spline is in view
camera.position.z = 40;

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;
controls.minDistance = 0.5;
controls.maxDistance = 200;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.002;
bloomPass.strength = 1.2; // Bloom strength
bloomPass.radius = 0.4; // Bloom radius
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
// handle window resizes: update camera, renderer, composer, and line material resolution
function onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    // update composer and postprocessing
    if (composer && typeof composer.setSize === 'function') composer.setSize(w, h);
    // LineMaterial needs resolution updated for correct linewidth scaling
    if (typeof lineMat2 !== 'undefined' && lineMat2 && lineMat2.resolution) lineMat2.resolution.set(w, h);
}

// create a tube geometry along the spline path
// reduce resolution to lower vertex count for performance /visual simplicity
const TUBE_TUBULAR_SEGMENTS = 256; // along-path subdivisions (was 222)
const TUBE_RADIAL_SEGMENTS = 16;    // cross-section subdivisions (was 16)
let tubeGeometry = new THREE.TubeGeometry(spline, TUBE_TUBULAR_SEGMENTS, 0.65, TUBE_RADIAL_SEGMENTS, true);
// compute polygon cross-section inradius (apothem) so we can clamp movement to the
// true inner wall of the tube (prevents escaping through polygon corners)
let _radialSegments = tubeGeometry.parameters.radialSegments || TUBE_RADIAL_SEGMENTS;
const _tubeRadius = tubeGeometry.parameters.radius || 0.65;
let tubeInradius = Math.cos(Math.PI / _radialSegments) * _tubeRadius;
const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: false, opacity: 1 });
let tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
// render the tube after the edge lines so it can occlude them when appropriate (gives "inside" feel)
tubeMesh.renderOrder = 1;
scene.add(tubeMesh);

// create edges geometry from the tube mesh and build a fat/antialiased Line2 from it
const edges = new THREE.EdgesGeometry(tubeGeometry, 0.2);
// prefer the initial style's line color so visuals (and HUD accent) start consistently
let initialLineColor = null;
try {
    if (Array.isArray(TUBE_STYLES) && TUBE_STYLES.length > 0 && typeof TUBE_STYLES[0].lineColor !== 'undefined') {
        initialLineColor = TUBE_STYLES[0].lineColor;
    }
} catch (e) {}
const color = initialLineColor ? new THREE.Color(initialLineColor) : new THREE.Color(`hsl(${(Math.random()) * 360}, 100%, 50%)`);
// Convert the edges position attribute into a flat positions array for LineGeometry
// To avoid edge lines visually sticking out of the tube, inset edge vertices
// slightly along the tube's vertex normals (move them inward by EDGE_INSET).
const rawEdgePositions = Array.from(edges.attributes.position.array);
const lineGeometry = new LineGeometry();
// build a map of tube vertex position -> normal for quick lookup
const normalMap = new Map();
if (tubeGeometry && tubeGeometry.attributes && tubeGeometry.attributes.position && tubeGeometry.attributes.normal) {
    const posArr = tubeGeometry.attributes.position.array;
    const nArr = tubeGeometry.attributes.normal.array;
    for (let i = 0; i < posArr.length; i += 3) {
        const k = `${posArr[i].toFixed(6)}|${posArr[i+1].toFixed(6)}|${posArr[i+2].toFixed(6)}`;
        normalMap.set(k, new THREE.Vector3(nArr[i], nArr[i+1], nArr[i+2]));
    }
}
const EDGE_INSET = 0.012; // how far to move edges inward along normals (tweakable)
const positionsArray = [];
for (let i = 0; i < rawEdgePositions.length; i += 3) {
    let x = rawEdgePositions[i], y = rawEdgePositions[i+1], z = rawEdgePositions[i+2];
    const key = `${x.toFixed(6)}|${y.toFixed(6)}|${z.toFixed(6)}`;
    const n = normalMap.get(key);
    if (n) {
        x = x - n.x * EDGE_INSET;
        y = y - n.y * EDGE_INSET;
        z = z - n.z * EDGE_INSET;
    }
    positionsArray.push(x, y, z);
}
lineGeometry.setPositions(positionsArray);
// LineMaterial for Line2 (supports linewidth in screen pixels when worldUnits=false)
const lineMat2 = new LineMaterial({
    color: color.getHex(),
    linewidth: 2.0, // in pixels when worldUnits=false; tune as needed
    worldUnits: false,
    dashed: false,
    transparent: true,
    opacity: 1.0
});
// resolution must be set for LineMaterial to render correctly
lineMat2.resolution.set(window.innerWidth, window.innerHeight);
// draw on top when visible (we gate visibility with isCameraInsideTube()),
// disabling depthTest avoids z-fighting / flicker against the tube interior
// enable depth testing so the lines respect the tube's faces; we'll use polygonOffset
// on the tube material to avoid z-fighting when the camera is inside
lineMat2.depthTest = true;
lineMat2.depthWrite = false;
// now that lineMat2 exists, register resize handler and initialize sizes
window.addEventListener('resize', onWindowResize, false);
onWindowResize();
// edge hue animation speed (revolutions per second)
const EDGE_HUE_SPEED = 0.006;
let centerLine = new Line2(lineGeometry, lineMat2);
centerLine.computeLineDistances();
// draw lines first so the tube (renderOrder=1) can overwrite/occlude them where needed
centerLine.renderOrder = 0;
// show the continuous edges by default so they share color with vertices/boxes
// don't frustum-cull Line2 (its bounds can be inaccurate); we'll control visibility manually
centerLine.frustumCulled = false;
centerLine.visible = true;
// ensure lineMat2.color is a THREE.Color instance we can setHSL() on
if (lineMat2 && typeof lineMat2.color === 'number') {
    lineMat2.color = new THREE.Color(lineMat2.color);
}
scene.add(centerLine);

// --- Vertex-only points (light up only the edge vertices) ---
// Deduplicate edge positions (positionsArray is flat [x,y,z,...])
const uniqueMap = new Map();
// use higher precision when deduplicating so near-identical vertices collapse
// this reduces overlapping points which can appear brighter due to additive blending
for (let i = 0; i < positionsArray.length; i += 3) {
    const x = positionsArray[i];
    const y = positionsArray[i + 1];
    const z = positionsArray[i + 2];
    const key = `${x.toFixed(6)}|${y.toFixed(6)}|${z.toFixed(6)}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, [x, y, z]);
}
const uniqueVerts = Array.from(uniqueMap.values()).flat();
const pointsGeometry = new THREE.BufferGeometry();
pointsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uniqueVerts), 3));
// PointsMaterial: size in pixels (sizeAttenuation=false) so they look consistent
// enable depthTest so points are occluded correctly; we'll avoid z-fighting via polygonOffset
// use a round canvas texture for uniform point sprites, normal blending, and depth write
function makeRoundPointTexture(px = 64, fill = '#ffffff') {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = px;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}
const pointsMat = new THREE.PointsMaterial({
    color: color.getHex(),
    size: 6,
    sizeAttenuation: false,
    map: makeRoundPointTexture(64, '#ffffff'),
    transparent: true,
    opacity: 1.0,
    alphaTest: 0.01,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending
});
let edgeVertices = new THREE.Points(pointsGeometry, pointsMat);
// avoid frustum-culling for these helper primitives (Line2/Points bounds can be conservative)
edgeVertices.frustumCulled = false;
edgeVertices.renderOrder = 2;
scene.add(edgeVertices);

// Allow dynamic rebuild of tube/edges/points when radial segments change
const RADIAL_CHOICES = [3, 5, 7, 8, 16];
const styleRadialMap = new Map(); // styleIndex -> radialSegments

function rebuildTube(radialSegments) {
    try {
        // dispose previous geometry/meshes where sensible
        if (tubeMesh) {
            try { scene.remove(tubeMesh); } catch (e) {}
            try { tubeMesh.geometry.dispose(); } catch (e) {}
        }
        if (centerLine) { try { scene.remove(centerLine); } catch (e) {} }
        if (edgeVertices) { try { scene.remove(edgeVertices); } catch (e) {} }
    } catch (e) {}

    // recreate tube geometry
    tubeGeometry = new THREE.TubeGeometry(spline, TUBE_TUBULAR_SEGMENTS, 0.65, radialSegments, true);
    _radialSegments = tubeGeometry.parameters.radialSegments || radialSegments;
    tubeInradius = Math.cos(Math.PI / _radialSegments) * _tubeRadius;
    // recreate tube mesh
    const newTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    newTube.renderOrder = 1;
    tubeMesh = newTube;
    scene.add(tubeMesh);

    // edges
    const newEdges = new THREE.EdgesGeometry(tubeGeometry, 0.2);
    const rawNewPos = Array.from(newEdges.attributes.position.array);
    // build normal map for the new tube geometry
    const posArr = tubeGeometry.attributes.position.array;
    const nArr = tubeGeometry.attributes.normal.array;
    const nm = new Map();
    for (let i = 0; i < posArr.length; i += 3) {
        const k = `${posArr[i].toFixed(6)}|${posArr[i+1].toFixed(6)}|${posArr[i+2].toFixed(6)}`;
        nm.set(k, new THREE.Vector3(nArr[i], nArr[i+1], nArr[i+2]));
    }
    const newPosArr = [];
    for (let i = 0; i < rawNewPos.length; i += 3) {
        let x = rawNewPos[i], y = rawNewPos[i+1], z = rawNewPos[i+2];
        const key = `${x.toFixed(6)}|${y.toFixed(6)}|${z.toFixed(6)}`;
        const nn = nm.get(key);
        if (nn) {
            x = x - nn.x * EDGE_INSET;
            y = y - nn.y * EDGE_INSET;
            z = z - nn.z * EDGE_INSET;
        }
        newPosArr.push(x, y, z);
    }
    const newLineGeom = new LineGeometry();
    newLineGeom.setPositions(newPosArr);
    const newCenterLine = new Line2(newLineGeom, lineMat2);
    newCenterLine.computeLineDistances();
    newCenterLine.renderOrder = 0;
    newCenterLine.frustumCulled = false;
    scene.add(newCenterLine);
    // recreate deduplicated points for vertices
    const newMap = new Map();
    for (let i = 0; i < newPosArr.length; i += 3) {
        const x = newPosArr[i]; const y = newPosArr[i + 1]; const z = newPosArr[i + 2];
        const key = `${x.toFixed(6)}|${y.toFixed(6)}|${z.toFixed(6)}`;
        if (!newMap.has(key)) newMap.set(key, [x, y, z]);
    }
    const newUnique = Array.from(newMap.values()).flat();
    const newPointsGeom = new THREE.BufferGeometry();
    newPointsGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newUnique), 3));
    const newPoints = new THREE.Points(newPointsGeom, pointsMat);
    newPoints.frustumCulled = false;
    newPoints.renderOrder = 2;
    scene.add(newPoints);

    // update globals to the new objects so other code uses them
    centerLine = newCenterLine;
    edgeVertices = newPoints;
}

// push tube triangles slightly back so lines/points don't z-fight when the camera is inside
// (polygonOffset works on triangle materials)
tubeMaterial.polygonOffset = true;
tubeMaterial.polygonOffsetFactor = 1.0;
tubeMaterial.polygonOffsetUnits = 1.0;

// style manager will be created once all materials exist
let styleManager = null;
try {
    styleManager = new StyleManager({ tubeMaterial, lineMaterial: lineMat2, pointsMaterial: pointsMat, bloomPass });
} catch (e) {
    // if the module failed to load for any reason, leave defaults intact
    console.warn('StyleManager not available:', e);
}

// Tube opacity animation parameters
const TUBE_OPACITY_MIN = 0;
const TUBE_OPACITY_MAX = 0.25;
const TUBE_OPACITY_SPEED = 0.0008; // cycles per ms
// a phase offset so opacity animation is not synchronized with edge hue
const TUBE_OPACITY_PHASE = Math.random() * Math.PI * 2;

// ---- WASD movement state (lateral within tube) ----
let lateralOffset = new THREE.Vector2(0, 0); // x = right (binormal), y = up (normal)
let lateralVelocity = new THREE.Vector2(0, 0);
const LATERAL_SPEED = 0.5; // units per second
const MAX_LATERAL = 0.45; // maximum radial offset (keep inside tube radius ~0.65)
// forward loop duration (ms) - increase to slow down camera along the path
let FORWARD_LOOP_DURATION = 120000; // 120 seconds per loop (slower)
const LATERAL_ACCEL = 18.0; // how fast velocity moves toward target
const keyState = { w: false, a: false, s: false, d: false };

// speed-up tuning: each scored point multiplies the forward speed by this factor (<1 speeds up)
// make per-point speed increases much gentler to avoid rapid pacing
const SPEED_MULTIPLIER_PER_POINT = 0.995; // ~0.5% faster per point
const MIN_LOOP_DURATION = 3000; // don't go faster than 3s per loop
// maximum forward speed in loops per second (loops = full path revolutions)
// e.g. 1/6 = 0.166... loops/sec => 6s per loop. Set to Infinity to disable.
// Reduced absolute maximum forward speed: previously 1/3, then 1/6; make it much slower now.
// Set to 1/60 loops/sec => 60 seconds per full loop at the absolute max.
const MAX_FORWARD_SPEED = 1 / 60;
// cap the score used for speed calculation so the speed tops out after this many points
const SPEED_SCORE_CAP = 100;

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyState) {
        keyState[k] = true;
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyState) {
        keyState[k] = false;
        e.preventDefault();
    }
});

// adjust forward speed at runtime with [ (slower) and ] (faster)
window.addEventListener('keydown', (e) => {
    if (e.key === '[') {
        FORWARD_LOOP_DURATION = Math.min(60 * 60 * 1000, FORWARD_LOOP_DURATION * 1.5);
        console.log('FORWARD_LOOP_DURATION ->', FORWARD_LOOP_DURATION);
    } else if (e.key === ']') {
        FORWARD_LOOP_DURATION = Math.max(1000, FORWARD_LOOP_DURATION / 1.5);
        console.log('FORWARD_LOOP_DURATION ->', FORWARD_LOOP_DURATION);
    }
});

// helper object and last-time for smooth, frame-rate independent lateral movement
const _camHelper = new THREE.Object3D();
let _lastTime = null;
// exposed last frame delta (seconds) so other animate code can reuse the same timing
let lastDeltaSec = 0;

// scoring
let score = 0;
// persistent highscore (localStorage)
let highscore = 0;
try {
    const raw = localStorage.getItem('wormholeHighscore');
    highscore = raw ? parseInt(raw, 10) || 0 : 0;
} catch (e) {
    highscore = 0;
}
// inject neon CSS for score HUD
const styleEl = document.createElement('style');
styleEl.textContent = `
.score-panel {
    position: fixed;
    left: 24px;
    top: 18px;
    padding: 6px 8px;
    background: transparent;
    color: #fff;
    z-index: 9998;
    /* use CSS variable so we can swap in a loaded OTF via FontFace API; prefer Conthrax if available */
    font-family: var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
}
.score-panel .big { font-size: 48px; font-weight: 800; color: var(--hud-accent, #66f5ffff); letter-spacing: 0.6px; line-height:1; }
.score-panel .small { font-size: 13px; color: rgba(255,255,255,0.85); margin-top:6px; }
.score-panel .bar { margin-top:10px; height:12px; width:160px; max-width: calc(100vw - 48px); background: rgba(255,255,255,0.03); border-radius:6px; overflow:hidden; position:relative; }
.score-panel .bar .fill { height:100%; width:0%; background: linear-gradient(90deg, var(--hud-accent, #66f5ffff), rgba(255,255,255,0.12)); transition: width 350ms ease; }
/* start overlay shown at game start */
.start-overlay {
    position: fixed;
    left: 0; right: 0; top: 0; bottom: 0;
    display: flex;
    /* move overlay higher on the screen */
    align-items: flex-start;
    justify-content: center;
    padding-top: 6vh;
    /* no background so the tunnel remains visible; overlay contents will be visible via accent color */
    background: transparent;
    z-index: 10000;
    opacity: 1;
    transition: opacity 450ms ease, transform 450ms ease;
}
.start-overlay .panel {
    text-align: center;
    color: var(--hud-accent, #fff);
    padding: 12px 18px;
    border-radius: 6px;
    backdrop-filter: none;
    /* use the same HUD font variable so Conthrax is applied when available */
    font-family: var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif);
    font-weight: 600;

    /* subtle glow so text reads over the scene */
    text-shadow: 0 0 12px rgba(0,0,0,0.6), 0 0 18px rgba(255,255,255,0.04);
}
.start-overlay .title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.start-overlay .hint { font-size: 14px; opacity: 0.9; }
.start-overlay.fade-out { opacity: 0; pointer-events: none; transform: translateY(-6px); }
/* ensure game over overlay uses the HUD font and accent color */
#game-over-overlay, #game-over-overlay * {
    font-family: var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif) !important;
    color: var(--hud-accent, #fff) !important;
}
#game-over-overlay button {
    font-family: var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif) !important;
}
`;

// ensure the HUD accent starts with the initial style color to avoid a pink flash
try {
    if (initialLineColor && typeof document !== 'undefined' && document.documentElement) {
        const accentHex = '#' + new THREE.Color(initialLineColor).getHexString();
        document.documentElement.style.setProperty('--hud-accent', accentHex);
    }
} catch (e) {}

document.head.appendChild(styleEl);

// Set a default --hud-font to prefer Conthrax (system-installed) so the HUD uses it if available.
try {
    const defaultFamily = "'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    document.documentElement.style.setProperty('--hud-font', defaultFamily);
} catch (e) {}

// Attempt to load a custom OTF font for the HUD. Assumptions:
// - The user places their .otf file at one of the candidate paths below (e.g. ./fonts/game-font.otf)
// If found, we register it as 'GameFont' and set --hud-font to prefer it.
(async function loadGameFont() {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
    // Prefer Conthrax SemiBold if present, then fall back to generic candidates
    const candidates = [
        './fonts/Conthrax-SemiBold.otf',
        './assets/fonts/Conthrax-SemiBold.otf',
        './Conthrax-SemiBold.otf',
        './fonts/game-font.otf',
        './assets/fonts/game-font.otf',
        './font.otf',
        './GameFont.otf',
        './game-font.otf'
    ];
    for (const url of candidates) {
        try {
            // try to load as OpenType
            const looksLikeConthrax = /conthrax/i.test(url);
            const familyName = looksLikeConthrax ? 'ConthraxSemi' : 'GameFont';
            const weight = looksLikeConthrax ? '600' : '400';
            const face = new FontFace(familyName, `url(${url}) format('opentype')`, { style: 'normal', weight });
            await face.load();
            document.fonts.add(face);
            const family = looksLikeConthrax
                ? "'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                : "'GameFont', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
            document.documentElement.style.setProperty('--hud-font', family);
            console.debug('[font] loaded', url, 'as', familyName);
            return;
        } catch (e) {
            // try next candidate
            console.debug('[font] failed to load', url, e);
        }
    }
})();

const scoreDiv = document.createElement('div');
scoreDiv.id = 'score-div';
scoreDiv.className = 'score-panel';
scoreDiv.innerHTML = `<div class="big">${score}</div><div class="small">Hi: ${highscore}</div><div class="bar"><div class="fill"></div></div>`;
document.body.appendChild(scoreDiv);

// Start overlay: instruct player to use WASD. It fades out on first WASD key or a click.
let startOverlay = null;
try {
    startOverlay = document.createElement('div');
    startOverlay.className = 'start-overlay';
    startOverlay.innerHTML = `<div class="panel"><div class="title">Use WASD to move</div>`;
    document.body.appendChild(startOverlay);
    // hide overlay on click
    startOverlay.addEventListener('click', () => {
        startOverlay.classList.add('fade-out');
        setTimeout(() => { try { startOverlay.remove(); } catch (e) {} }, 480);
    }, { once: true });
    // hide overlay on first WASD key
    const hideOnKey = (ev) => {
        const k = (ev.key || '').toLowerCase();
        if (['w','a','s','d'].includes(k)) {
            try { startOverlay.classList.add('fade-out'); } catch (e) {}
            setTimeout(() => { try { startOverlay.remove(); } catch (e) {} }, 480);
            window.removeEventListener('keydown', hideOnKey);
        }
    };
    window.addEventListener('keydown', hideOnKey);
} catch (e) {
    startOverlay = null;
}

// ...highscore initialized above

function updateScoreDisplay() {
    // update numeric fields
    const big = scoreDiv.querySelector('.big');
    const small = scoreDiv.querySelector('.small');
    const fill = scoreDiv.querySelector('.bar .fill');
    if (big) big.textContent = `${score}`;
    if (small) small.textContent = `Hi-Score: ${highscore}`;
    // fill indicates progress to next 10-point bucket (0..100)
    const toNext = score % 10;
    const pct = Math.min(100, (toNext / 10) * 100);
    if (fill) fill.style.width = `${pct}%`;
    // determine accent color: prefer the active style's lineColor (from StyleManager or styles table)
    try {
        let accentHex = null;
        if (styleManager && typeof styleManager.currentIndex === 'number' && styleManager.currentIndex >= 0) {
            const s = TUBE_STYLES[styleManager.currentIndex % TUBE_STYLES.length];
            if (s && typeof s.lineColor !== 'undefined') accentHex = '#' + new THREE.Color(s.lineColor).getHexString();
        }
        if (!accentHex) {
            // fallback to bucket based on score
            const bucket = Math.floor(score / 10) % TUBE_STYLES.length;
            const s2 = TUBE_STYLES[bucket];
            if (s2 && typeof s2.lineColor !== 'undefined') accentHex = '#' + new THREE.Color(s2.lineColor).getHexString();
        }
        if (!accentHex && typeof lineMat2 !== 'undefined' && lineMat2 && lineMat2.color) {
            accentHex = '#' + lineMat2.color.getHexString();
        }
        if (accentHex) {
            // normalize to a readable accent so it doesn't become near-black or desaturated
            try {
                const c = new THREE.Color(accentHex);
                const hsl = c.getHSL({ h: 0, s: 0, l: 0 });
                if (hsl.l < 0.15) hsl.l = 0.5;
                if (hsl.s < 0.18) hsl.s = Math.max(hsl.s, 0.7);
                c.setHSL(hsl.h, hsl.s, hsl.l);
                const readable = '#' + c.getHexString();
                scoreDiv.style.setProperty('--hud-accent', readable);
            } catch (e) {
                scoreDiv.style.setProperty('--hud-accent', accentHex);
            }
        }
    } catch (e) {}
    if (styleManager) styleManager.applyForScore(score);
    // if we've reached score threshold, allow per-style random radialSegments
    try {
        if (score >= 50 && styleManager && typeof styleManager.currentIndex === 'number') {
            const styleIdx = styleManager.currentIndex % TUBE_STYLES.length;
            // if we don't have a selection for this style, pick one randomly from choices
            if (!styleRadialMap.has(styleIdx)) {
                const pick = RADIAL_CHOICES[Math.floor(Math.random() * RADIAL_CHOICES.length)];
                styleRadialMap.set(styleIdx, pick);
            }
            const chosen = styleRadialMap.get(styleIdx);
            if (chosen && chosen !== _radialSegments) {
                // rebuild the tube with the chosen radial segments
                rebuildTube(chosen);
            }
        }
    } catch (e) {}
}
updateScoreDisplay();

// previous path parameter to detect passing boxes
let prevP = null;

// smooth forward progress state to avoid jumps when loop duration changes
let currentLoopDuration = FORWARD_LOOP_DURATION;
let pathProgress = 0; // normalized 0..1

// game state
let gameOver = false;

function endGame() {
    if (gameOver) return;
    gameOver = true;
    // disable controls
    if (controls) controls.enabled = false;
    // overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.color = '#fff';
    overlay.style.zIndex = '9999';
    overlay.style.flexDirection = 'column';
    // prefer the HUD font (Conthrax) when available
    try { overlay.style.fontFamily = "var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)"; } catch (e) {}
    // check highscore
    let isNewHigh = false;
    if (score > highscore) {
        highscore = score;
        try { localStorage.setItem('wormholeHighscore', String(highscore)); } catch (e) {}
        isNewHigh = true;
    }
    overlay.innerHTML = `<div style="text-align:center"><h1 style="margin:0 0 10px 0; color: var(--hud-accent, #fff)">Game Over</h1><p style="margin:0 0 6px 0">You crashed!</p><p style="margin:0 0 14px 0">Score: ${score} &nbsp; High: ${highscore}${isNewHigh ? ' &nbsp; <strong style=\"color:#ffd700\">New!</strong>' : ''}</p></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Restart';
    btn.style.padding = '10px 18px';
    btn.style.fontSize = '16px';
    btn.style.fontFamily = "var(--hud-font, 'ConthraxSemi', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)";
    btn.style.cursor = 'pointer';
    btn.onclick = () => location.reload();
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
}


const size = 0.075;
const boxGeometry = new THREE.BoxGeometry(size, size, size);
// keep references to boxes for collision checks and dynamic spawning
const boxes = [];
// spawning configuration
const STARTING_BOXES = 40; // initial count (increased)
const MAX_BOXES = 400; // hard cap (increased)
const BOXS_PER_10_SCORE = 12; // how many extra boxes to add per 10 score (increased density)

function spawnBox() {
    // choose an initial box color from the existing line material (if available)
    let initialBoxHex = 0xffffff;
    if (typeof lineMat2 !== 'undefined' && lineMat2 && lineMat2.color) {
        try { initialBoxHex = lineMat2.color.getHex(); } catch (e) {}
    }
    const boxMaterial = new THREE.MeshBasicMaterial({ color: initialBoxHex, wireframe: false });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    // place the box at a random path parameter so boxes are spread along the tube
    // but avoid spawning too close to the camera's current pathProgress
    const MIN_PATH_AWAY = 0.08; // normalized path distance to avoid (8% of loop)
    let p = Math.random();
    // rejection sampling up to N attempts to avoid camera start area
    let attempts = 0;
    while (attempts < 12) {
        const d = Math.abs(((p - pathProgress) + 1.5) % 1.0 - 0.5) * 2.0; // normalized wrapped distance 0..1
        if (d >= MIN_PATH_AWAY) break;
        p = Math.random();
        attempts++;
    }
    const pos = tubeGeometry.parameters.path.getPointAt(p);
    // compute local frame (tangent, normal, binormal) to place box inside cross-section
    const tangent = tubeGeometry.parameters.path.getTangentAt(p).normalize();
    let normal = new THREE.Vector3(0, 1, 0);
    if (Math.abs(tangent.dot(normal)) > 0.9) normal = new THREE.Vector3(1, 0, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
    // allow boxes to spawn up to the polygon inradius minus the box sphere radius
    const boxSphereR = Math.sqrt(3) * (size / 2);
    const epsilon = 0.001;
    const maxR = Math.max(0, tubeInradius - boxSphereR - epsilon);
    const r = Math.sqrt(Math.random()) * maxR; // uniform disk sampling
    const theta = Math.random() * Math.PI * 2;
    const offsetWorld = normal.clone().multiplyScalar(Math.cos(theta) * r).add(binormal.clone().multiplyScalar(Math.sin(theta) * r));
    pos.add(offsetWorld);
    box.position.copy(pos);
    // orient box so its local +Z faces along the path tangent
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    box.quaternion.copy(quaternion);
    scene.add(box);
    // remember the path parameter so we can score when the camera passes it
    box.userData.pathT = p;
    // random small rotation speed (radians/sec) and random axis so boxes slowly rotate
    // keep speeds small so rotation is subtle
    const rotSpeed = (Math.random() * 0.8 + 0.5) * (Math.random() < 0.5 ? -1 : 1) * 1; // -0.5..0.5 * ~0.2..1.0
    box.userData.rotSpeed = rotSpeed; 
    // pick a normalized axis that's not aligned with the path tangent to produce visible tumble
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    box.userData.rotAxis = axis;
    // if style manager is available, apply current style to this new box
    if (styleManager && typeof styleManager.setBoxes === 'function') {
        // temporarily push and then re-register so style manager colors it
        boxes.push(box);
        styleManager.setBoxes(boxes);
        styleManager.applyForScore(score);
    } else {
        boxes.push(box);
    }
}

// populate initial boxes
for (let i = 0; i < STARTING_BOXES; i++) spawnBox();

// hand boxes to the style manager so it can color/animate them per style
if (styleManager && typeof styleManager.setBoxes === 'function') {
    console.debug('[index] registering boxes with styleManager, numBoxes=', boxes.length);
    styleManager.setBoxes(boxes);
    // apply style again now that boxes are registered
    console.debug('[index] calling styleManager.applyForScore(', score, ')');
    styleManager.applyForScore(score);
}

    // helper: test whether the camera is currently inside the tube by sampling points along the spline
    function isCameraInsideTube() {
        const SAMPLES = 256;
        let best = Infinity;
        for (let i = 0; i < SAMPLES; i++) {
            const t = i / (SAMPLES - 1);
            const pt = spline.getPointAt(t);
            const d = pt.distanceTo(camera.position);
            if (d < best) best = d;
        }
        // use polygon inradius (apothem) so inside-test matches the true inner wall
        return best <= tubeInradius * 0.99; // slightly inside
    }

// camera fly-through
function updateCamera(t) {
    const timeMs = t;
    if (_lastTime === null) _lastTime = timeMs;
    const deltaSec = Math.min(0.05, Math.max(0.0001, (timeMs - _lastTime) / 1000));
    _lastTime = timeMs;
    // expose for animate() to consume
    lastDeltaSec = deltaSec;

    // compute effective looptime that speeds up as score increases
    // cap the score used in the exponential so speed tops out after SPEED_SCORE_CAP points
    const scoreForSpeed = Math.min(score, SPEED_SCORE_CAP);
    const rawTarget = FORWARD_LOOP_DURATION * Math.pow(SPEED_MULTIPLIER_PER_POINT, scoreForSpeed);
    // convert MAX_FORWARD_SPEED (loops per second) into a minimum ms per loop
    let maxSpeedMinLoopMs = 0;
    if (typeof MAX_FORWARD_SPEED === 'number' && isFinite(MAX_FORWARD_SPEED) && MAX_FORWARD_SPEED > 0) {
        maxSpeedMinLoopMs = 1000 / MAX_FORWARD_SPEED;
    }
    const effectiveMinLoop = Math.max(MIN_LOOP_DURATION, maxSpeedMinLoopMs || 0);
    const targetLoop = Math.max(effectiveMinLoop, rawTarget);
    // smoothly approach the target loop duration to avoid instant jumps
    const LERP_SPEED = 2.5; // how fast duration adapts (higher = faster)
    currentLoopDuration = THREE.MathUtils.lerp(currentLoopDuration, targetLoop, Math.min(1, LERP_SPEED * deltaSec));
    // advance normalized path progress using time and currentLoopDuration
    pathProgress = (pathProgress + (deltaSec * 1000) / currentLoopDuration) % 1.0;
    const p = pathProgress; // normalized 0..1
    // initialize prevP on first frame to avoid spurious scoring
    if (prevP === null) prevP = p;
    // update lateral velocity from keys (W/S = up/down, A/D = left/right)
    // desired input directions in screen space: left/right/up/down relative to screen
    const want = new THREE.Vector2(0, 0);
    if (keyState.w) want.y += 1;
    if (keyState.s) want.y -= 1;
    if (keyState.d) want.x -= 1;
    if (keyState.a) want.x += 1;

    // accelerate velocity toward that target
    lateralVelocity.x = THREE.MathUtils.lerp(lateralVelocity.x, want.x * LATERAL_SPEED, Math.min(1, LATERAL_ACCEL * deltaSec));
    lateralVelocity.y = THREE.MathUtils.lerp(lateralVelocity.y, want.y * LATERAL_SPEED, Math.min(1, LATERAL_ACCEL * deltaSec));

    // integrate offset using real delta time
    lateralOffset.x = THREE.MathUtils.clamp(lateralOffset.x + lateralVelocity.x * deltaSec, -MAX_LATERAL, MAX_LATERAL);
    lateralOffset.y = THREE.MathUtils.clamp(lateralOffset.y + lateralVelocity.y * deltaSec, -MAX_LATERAL, MAX_LATERAL);

    // base target position along the curve
    const pos = spline.getPointAt(p);
    const ahead = spline.getPointAt((p + 0.002) % 1); // small ahead sample for tangent

    // compute screen-relative axes from the camera orientation
    // We'll orient a temp object to look along the tangent so screen axes align with movement direction
    _camHelper.position.copy(pos);
    _camHelper.lookAt(ahead);
    // camera right (screen right) is local +X, screen up is local +Y
    const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(_camHelper.quaternion).normalize();
    const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(_camHelper.quaternion).normalize();

    // build world offset from lateralOffset (x=right, y=up in screen space)
    const offsetWorld = screenRight.multiplyScalar(lateralOffset.x).add(screenUp.multiplyScalar(lateralOffset.y));

    // ensure the camera stays inside the tube: clamp offset magnitude to slightly less than the polygon inradius
    const epsilon = 0.005;
    const maxCameraR = Math.max(0, tubeInradius - 0.06 - epsilon);
    const offLen = offsetWorld.length();
    if (offLen > maxCameraR) {
        offsetWorld.setLength(maxCameraR);
        // also reflect that lateralOffset shouldn't suggest a larger value next frame
        // convert back into screen-space components (approx)
        // we normalize by screen axes length (they are unit length) so divide accordingly
        lateralOffset.x = new THREE.Vector3(1,0,0).applyQuaternion(_camHelper.quaternion).dot(offsetWorld);
        lateralOffset.y = new THREE.Vector3(0,1,0).applyQuaternion(_camHelper.quaternion).dot(offsetWorld);
    }

    const cameraPos = pos.clone().add(offsetWorld);

    // score: check whether we passed any boxes this frame based on path parameter (handle wrap)
    // when prevP <= p (normal progress): a box is passed if prevP < box.p <= p
    // when wrapped (p < prevP): a box is passed if box.p > prevP || box.p <= p
    for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const boxT = b.userData.pathT;
        if (prevP <= p) {
            if (prevP < boxT && boxT <= p) {
                score += 1;
                updateScoreDisplay();
            }
        } else {
            // wrapped
            if (boxT > prevP || boxT <= p) {
                score += 1;
                updateScoreDisplay();
            }
        }
    }

    // dynamic box growth: increase box count as score increases
    const extraBuckets = Math.floor(score / 10);
    const desiredBoxes = Math.min(MAX_BOXES, STARTING_BOXES + extraBuckets * BOXS_PER_10_SCORE);
    if (boxes.length < desiredBoxes) {
        const toSpawn = Math.min(desiredBoxes - boxes.length, 24); // cap per-frame spawns (allow bursts)
        for (let s = 0; s < toSpawn; s++) spawnBox();
    }

    // simple collision detection/resolution: approximate boxes as spheres and resolve overlap
    const CAMERA_RADIUS = 0.06;
    const boxSphereR = Math.sqrt(3) * (size / 2); // approximate box as sphere
    let resolvedPos = cameraPos.clone();
    let collided = false;
    const minDist = CAMERA_RADIUS + boxSphereR;
    for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const toCam = resolvedPos.clone().sub(b.position);
        const dist = toCam.length();
        if (dist < minDist && dist > 1e-8) {
            // mark collision and push camera out
            collided = true;
            const push = toCam.normalize().multiplyScalar(minDist - dist + 1e-4);
            resolvedPos.add(push);
        }
    }

    // apply resolved position
    camera.position.copy(resolvedPos);
    const newOffsetWorld = resolvedPos.clone().sub(pos);
    const lookAtPos = ahead.clone().add(newOffsetWorld);
    camera.lookAt(lookAtPos);

    // update lateralOffset approximation so input smoothing doesn't immediately push us back into colliders
    lateralOffset.x = newOffsetWorld.dot(new THREE.Vector3(1,0,0).applyQuaternion(_camHelper.quaternion));
    lateralOffset.y = newOffsetWorld.dot(new THREE.Vector3(0,1,0).applyQuaternion(_camHelper.quaternion));

    if (collided) {
        // end the game after we've positioned the camera to a stable resolved spot
        endGame();
        return;
    }
    // remember this frame's path parameter so we don't re-score the same boxes
    prevP = p;
}

function animate(p = 1) {
    if (gameOver) return; // stop the animation loop when game ends
    requestAnimationFrame(animate);
    updateCamera(p);
    // animate edge color smoothly over time
    // `p` is the timestamp in milliseconds passed by requestAnimationFrame
    const hue = (p * 0.001 * EDGE_HUE_SPEED) % 1; // normalized 0..1
    // animate only the vertex points color so vertices light up by modulating baseColor
    if (pointsMat && pointsMat.userData && pointsMat.userData.baseColor) {
        const base = pointsMat.userData.baseColor.clone();
        const animate = !!pointsMat.userData.animateColor;
        const strength = typeof pointsMat.userData.animationStrength === 'number' ? pointsMat.userData.animationStrength : 1.0;
        if (animate && strength > 0) {
            // compute delta hue and scale it by strength
            const baseH = base.getHSL({ h: 0 }).h;
            const delta = (hue - baseH) * strength;
            base.offsetHSL(delta, 0.0, 0.0);
        }
        pointsMat.color.copy(base);
    } else if (pointsMat.color) {
        pointsMat.color.setHSL(hue, 1.0, 0.5);
    }
    pointsMat.needsUpdate = true;
    // also update edge colors so lines match the vertex hue but preserve base style
    if (lineMat2 && lineMat2.userData && lineMat2.userData.baseColor) {
        const baseL = lineMat2.userData.baseColor.clone();
        const animateL = !!lineMat2.userData.animateColor;
        const strengthL = typeof lineMat2.userData.animationStrength === 'number' ? lineMat2.userData.animationStrength : 1.0;
        if (animateL && strengthL > 0) {
            const baseH = baseL.getHSL({ h: 0 }).h;
            const delta = (hue - baseH) * strengthL;
            baseL.offsetHSL(delta, 0.0, 0.0);
        }
        if (lineMat2.color) lineMat2.color.copy(baseL);
    } else if (lineMat2 && lineMat2.color) {
        lineMat2.color.setHSL(hue, 1.0, 0.5);
    }
    if (lineMat2) lineMat2.needsUpdate = true;
    if (typeof fallbackEdges !== 'undefined' && fallbackEdges.material && fallbackEdges.material.color) {
        fallbackEdges.material.color.setHSL(hue, 1.0, 0.5);
        fallbackEdges.material.needsUpdate = true;
    }
    // animate boxes' colors if StyleManager stored baseColor + animate flags on their materials
    if (typeof boxes !== 'undefined' && Array.isArray(boxes) && boxes.length > 0) {
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            if (!b || !b.material) continue;
            // apply subtle self-rotation using per-box axis and speed
            try {
                const rs = typeof b.userData.rotSpeed === 'number' ? b.userData.rotSpeed : 0;
                if (rs !== 0 && lastDeltaSec > 0) {
                    b.rotateOnAxis(b.userData.rotAxis || new THREE.Vector3(0,1,0), rs * lastDeltaSec);
                }
            } catch (e) {}
            const mat = b.material;
            if (mat.userData && mat.userData.baseColor) {
                const base = mat.userData.baseColor.clone();
                const animate = !!mat.userData.animateColor;
                const strength = typeof mat.userData.animationStrength === 'number' ? mat.userData.animationStrength : 1.0;
                if (animate && strength > 0) {
                    const baseH = base.getHSL({ h: 0 }).h;
                    const delta = (hue - baseH) * strength;
                    base.offsetHSL(delta, 0.0, 0.0);
                }
                try { mat.color.copy(base); mat.needsUpdate = true; } catch (e) {}
            }
        }
    }
    // animate tube opacity with a slow sine wave
    const tms = p;
    const opa = TUBE_OPACITY_MIN + (TUBE_OPACITY_MAX - TUBE_OPACITY_MIN) * (0.5 + 0.5 * Math.sin((tms * TUBE_OPACITY_SPEED) + TUBE_OPACITY_PHASE));
    tubeMaterial.opacity = opa;
    // show vertex points only when camera is inside the tube
    const inside = isCameraInsideTube();
    edgeVertices.visible = inside;
    edgeVertices.material.depthTest = true;
    // also only show the continuous center line when inside
    centerLine.visible = inside;
    composer.render();
    controls.update();
}
animate();