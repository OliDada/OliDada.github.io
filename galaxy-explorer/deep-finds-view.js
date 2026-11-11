// What the finds between the stars look like (deep-finds.mjs), drawn in the deep-space scene
// (deep-space.js): like a near star, each is drawn at a fixed distance in its true direction,
// scaled to the size it would look from where you are.
//
//   rogue   a dark, frozen world, its real surface painted from the world generator
//           (world-bake-worker.js), lit by faint starlight with a little glow of its own
//   dwarf   a dim red banded ball with a soft deep-red glow
//   hole    a black core, a thin bright ring of bent light and a tilted, glowing disc
//   nebula  from outside a soft glow; inside, drifting lumps of lit gas all round you and
//           the sky turned to its colour (game.js tints the background)
import * as THREE from "./vendor/three.module.js";
import { toScene } from "./deep-space.js";
import { paintBand } from "./world-paint.mjs";
import { generateSystem } from "./system.mjs";
import { SIZE } from "./scale.mjs";

const DRAW_AT = 50000; // scene distance the find is drawn at (inside the far plane)
const glowTexture = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.25, "rgba(255,255,255,.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
})();
function discTexture() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 1;
    const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(255,250,235,1)"); grad.addColorStop(.12, "rgba(255,200,120,.95)"); grad.addColorStop(.45, "rgba(255,120,50,.55)"); grad.addColorStop(1, "rgba(120,30,10,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A rogue world's body: a cold world of its own seed, turned out into the dark.
export function rogueBody(f) {
    const sys = generateSystem(f.seed), base = sys.bodies.find((b) => !b.giant && !b.parent) || sys.bodies.find((b) => !b.giant) || sys.bodies[0];
    const b = JSON.parse(JSON.stringify(base));
    b.id = "rogue"; b.name = f.title;
    b.physics = { ...b.physics, temperature: 45, equilibrium: 40, waterState: "ice", waterCoverage: 0, solvent: null, solventCoverage: 0, life: f.life ? "microbial" : "none", subsurfaceOcean: !!f.life, biochemistry: "carbon" };
    return b;
}

export function createFindViews(scene, { puffMaterial }) {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const views = new Map(); // find id -> { group, kind }
    let worker = null;
    const glow = (color, opacity) => new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    function build(f) {
        const g = new THREE.Group();
        if (f.kind === "rogue") {
            const mat = new THREE.MeshStandardMaterial({ color: 0x46505a, roughness: 1, emissive: 0x0b1018 });
            g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat));
            // Its surface, painted off the main thread; darkened, it is a world without a sun.
            try {
                worker ||= new Worker(new URL(`./world-bake-worker.js?size=${SIZE}`, import.meta.url), { type: "module" });
                const W = 512, H = 256, id = `rogue:${f.id}`;
                const done = (e) => {
                    if (e.data.id !== id) return;
                    worker.removeEventListener("message", done);
                    const px = new Uint8Array(W * H * 4), col = e.data.col;
                    for (let i = 0; i < W * H; i++) { for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.min(255, col[i * 3 + k] * 255); px[i * 4 + 3] = 255; }
                    const tex = new THREE.DataTexture(px, W, H); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = true; tex.needsUpdate = true;
                    tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
                    Object.assign(mat, { map: tex, color: new THREE.Color(0x9aa4b0), emissiveMap: tex, emissive: new THREE.Color(f.life ? 0x1b2f3a : 0x10161e) });
                    mat.needsUpdate = true;
                };
                worker.addEventListener("message", done);
                worker.postMessage({ id, body: rogueBody(f), W, H, y0: 0, y1: H });
            } catch { /* stays plain */ }
            const air = glow(0x6f8cb0, .12); air.scale.setScalar(2.6); g.add(air);
        } else if (f.kind === "dwarf") {
            const body = { seed: f.seed, bands: 9, palette: ["#2a0710", "#5e1420", "#94302a", "#c45a3a"], storm: { lat: .25, lon: 1, size: .14 } };
            const W = 256, H = 128, col = paintBand(null, body, W, H, 0, H), px = new Uint8Array(W * H * 4);
            for (let i = 0; i < W * H; i++) { for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.min(255, col[i * 3 + k] * 255); px[i * 4 + 3] = 255; }
            const tex = new THREE.DataTexture(px, W, H); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = true; tex.needsUpdate = true;
            g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshBasicMaterial({ map: tex })));
            const halo = glow(0xff4a2a, .35); halo.scale.setScalar(4.2); g.add(halo);
        } else if (f.kind === "hole") {
            g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })));
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
            const photon = new THREE.Mesh(new THREE.RingGeometry(1.04, 1.16, 128), ringMat);
            g.add(photon); g.userData.facing = photon; // always faces you, like a halo
            const disc = new THREE.Mesh(new THREE.RingGeometry(1.5, 5.5, 160, 1), new THREE.MeshBasicMaterial({ map: discTexture(), transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
            // Map the gradient across the disc's radius.
            const uv = disc.geometry.attributes.uv, pos = disc.geometry.attributes.position;
            for (let i = 0; i < uv.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 1.5) / 4, .5); }
            disc.rotation.x = -Math.PI / 2 + .32; disc.rotation.z = .2;
            g.add(disc); g.userData.disc = disc;
            const halo = glow(0xffb070, .25); halo.scale.setScalar(9); g.add(halo);
        } else {
            const [hi, lo] = f.hue;
            const a = glow(new THREE.Color(hi), .5), b = glow(new THREE.Color(lo), .7);
            a.scale.setScalar(1.6); b.scale.setScalar(2.4); g.add(b, a);
        }
        group.add(g);
        return { group: g, kind: f.kind };
    }
    // Lumps of gas round you inside a nebula.
    const N = 90, puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), puffMaterial(), N), slots = [];
    puffs.frustumCulled = false; puffs.visible = false; puffs.renderOrder = 3; puffs.setColorAt(0, new THREE.Color());
    scene.add(puffs);
    for (let i = 0; i < N; i++) slots.push({ p: new THREE.Vector3(), s: 0, c: 0 });
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), C = new THREE.Color(), D = new THREE.Vector3();
    return {
        // near: [{ f, d, edge }] (deep-finds.mjs findsNear), from the ship (galactic ly).
        update(camera, galactic, near, dt) {
            group.visible = true;
            const live = new Set();
            for (const { f, d } of near) {
                if (f.kind === "nebula" && d < f.size) continue; // inside: the puffs instead
                let v = views.get(f.id);
                if (!v) views.set(f.id, (v = build(f)));
                live.add(f.id);
                const off = [f.x - galactic[0], f.y - galactic[1], f.z - galactic[2]];
                const scale = DRAW_AT * f.size / Math.max(d, f.size * 1.02);
                v.group.position.copy(toScene(off, D).normalize().multiplyScalar(DRAW_AT).add(camera.position));
                v.group.scale.setScalar(scale);
                v.group.visible = scale > 6 || f.kind === "nebula" || f.kind === "dwarf";
                if (v.group.visible && scale <= 6) v.group.scale.setScalar(6); // a bright point when far
                if (v.group.userData.facing) v.group.userData.facing.quaternion.copy(camera.quaternion);
                if (v.group.userData.disc) v.group.userData.disc.rotation.z += dt * .05;
            }
            for (const [id, v] of views) if (!live.has(id)) { v.group.visible = false; if (views.size > 12) { group.remove(v.group); v.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); views.delete(id); } }
        },
        // Inside a nebula: gas drifting past (flow: how fast, scene m/s), in its colours.
        inside(camera, f, forward, flow, dt, light) {
            puffs.visible = !!f;
            if (!f) return;
            const [hi, lo] = f.hue, u = puffs.material.uniforms;
            u.uMurk.value.set(lo).multiplyScalar(.35); u.uDensity.value = .00045; u.uLight.value = light;
            u.uUp.value.set(0, 1, 0); u.uSun.value.copy(forward).negate();
            for (let i = 0; i < N; i++) {
                const o = slots[i];
                o.p.addScaledVector(forward, -flow * dt);
                if (!o.s || o.p.lengthSq() > 3400 * 3400 || (o.p.dot(forward) < -900)) {
                    const dir = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
                    if (o.s && dir.dot(forward) < 0) dir.negate();
                    o.p.copy(dir).multiplyScalar(o.s ? 2200 + Math.random() * 1100 : 300 + Math.random() * 2800);
                    o.s = 260 + Math.random() * 700; o.c = Math.random();
                }
                puffs.setMatrixAt(i, M.compose(D.copy(o.p).add(camera.position), Q, S.setScalar(o.s)));
                puffs.setColorAt(i, C.set(o.c < .5 ? hi : lo).lerp(C.clone().set(hi), o.c * .4).multiplyScalar(.5 + .5 * o.c));
            }
            puffs.instanceMatrix.needsUpdate = true; puffs.instanceColor.needsUpdate = true;
        },
        hide() { group.visible = false; puffs.visible = false; },
    };
}
