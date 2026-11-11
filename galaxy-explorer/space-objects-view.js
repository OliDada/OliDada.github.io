// Drawing belts, Trojan swarms and comets (space-objects.mjs) in a system's scene.
//   From afar: a belt is a faint ring of dust and glints, a swarm a faint cloud, so you can see
//   where they are; a comet is a bright head with a long tail pointing away from the star.
//   Close by: real rocks all round you (the nearest few hundred), laid out cell by cell from
//   the rock density at each place, so the same rocks are always in the same places.
// Everything is placed in scene coordinates (system coordinates less the world origin).
import * as THREE from "./vendor/three.module.js";
import { spaceObjectsOf, cometPosition, trojanCentre, rockDensity } from "./space-objects.mjs";
import { rng, hash32 } from "./rng.mjs";

const CELL = 520; // metres: rocks are laid out per cell of this size
const REACH = 2; // cells each way kept filled round you
const VARIANTS = 4, PER = 160; // rock shapes, rocks per shape

function rockGeometry(seed) {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, r = rng(seed, "rock");
    const sx = r.range(.7, 1.3), sy = r.range(.55, 1), sz = r.range(.8, 1.4), bumps = [0, 1, 2, 3].map(() => [r() - .5, r() - .5, r() - .5, r.range(.15, .35)]);
    for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1;
        for (const [a, b, c, s] of bumps) k -= s * Math.max(0, x * a + y * b + z * c) ** 2; // flattened faces, chipped
        k *= 1 + .08 * Math.sin(x * 7 + y * 5) * Math.cos(z * 6);
        p.setXYZ(i, x * sx * k, y * sy * k, z * sz * k);
    }
    g.computeVertexNormals();
    return g;
}
const glow = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.3, "rgba(255,255,255,.4)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
})();

export function createSpaceObjectsView(scene, system) {
    const objs = spaceObjectsOf(system), group = new THREE.Group();
    scene.add(group);
    // --- Far: dust rings and swarm clouds (points), placed with the star.
    const far = new THREE.Group(); group.add(far);
    for (const b of objs.belts) {
        const n = 9000, pos = new Float32Array(n * 3), r = rng(b.seed, "dust");
        for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = b.R + (r() + r() + r() - 1.5) * b.width * .6, y = (r() + r() - 1) * b.thick * .5; pos.set([Math.cos(a) * d, y, Math.sin(a) * d], i * 3); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: b.tint, size: 2.2, sizeAttenuation: false, transparent: true, opacity: .55, depthWrite: false }));
        pts.frustumCulled = false; far.add(pts);
    }
    const swarms = objs.trojans.map((tr) => {
        const n = 1800, pos = new Float32Array(n * 3), r = rng(tr.seed, "dust"), g = system.bodies.find((x) => x.id === tr.giant);
        for (let i = 0; i < n; i++) { const a = (r() + r() - 1) * tr.spread * 1.4, d = g.orbit + (r() + r() - 1) * tr.radial * 1.2, y = (r() + r() - 1) * tr.thick; pos.set([Math.cos(a) * d, y, Math.sin(a) * d], i * 3); }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: tr.tint, size: 2, sizeAttenuation: false, transparent: true, opacity: .5, depthWrite: false }));
        pts.frustumCulled = false; far.add(pts);
        return { tr, pts };
    });
    // --- Comets: nucleus, head and tail.
    const comets = objs.comets.map((c) => {
        const g = new THREE.Group();
        const nucleus = new THREE.Mesh(rockGeometry(c.seed), new THREE.MeshStandardMaterial({ color: 0x5d5853, roughness: 1, flatShading: true }));
        nucleus.scale.setScalar(c.radius);
        const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xcfeaff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        // The tail: a long cone of glowing gas, brightest at the head, fading out.
        const tailGeo = new THREE.ConeGeometry(1, 1, 24, 1, true); tailGeo.translate(0, -.5, 0); tailGeo.rotateX(-Math.PI / 2); // from the head (origin) back along +z
        const cols = new Float32Array(tailGeo.attributes.position.count * 3);
        for (let i = 0; i < tailGeo.attributes.position.count; i++) { const f = Math.max(0, 1 - tailGeo.attributes.position.getZ(i)); cols.set([.75 * f, .9 * f, 1 * f], i * 3); }
        tailGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
        const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.add(nucleus, head, tail); group.add(g);
        g.traverse((o) => (o.frustumCulled = false));
        return { c, g, nucleus, head, tail };
    });
    // --- Near: rocks round the camera.
    const meshes = [], mat = new THREE.MeshStandardMaterial({ color: 0x8a8079, roughness: .95, flatShading: true });
    for (let v = 0; v < VARIANTS; v++) { const m = new THREE.InstancedMesh(rockGeometry(system.seed * 7 + v), mat, PER); m.count = 0; m.frustumCulled = false; m.castShadow = false; group.add(m); meshes.push(m); }
    let cellKey = "", rocks = []; // { p: system coords [x,y,z], s: radius, v: variant, q: quaternion }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
    function fillRocks(cam, t) {
        rocks = [];
        const cx = Math.floor(cam[0] / CELL), cy = Math.floor(cam[1] / CELL), cz = Math.floor(cam[2] / CELL);
        for (let i = -REACH; i <= REACH; i++) for (let j = -REACH; j <= REACH; j++) for (let k = -REACH; k <= REACH; k++) {
            const x = cx + i, y = cy + j, z = cz + k, centre = [(x + .5) * CELL, (y + .5) * CELL, (z + .5) * CELL];
            const dens = rockDensity(system, objs, centre, t);
            if (dens < .04) continue;
            const r = rng(system.seed, "rocks", x, y, z), count = Math.round(dens * 9 * r.range(.6, 1.4));
            for (let n = 0; n < count; n++) {
                const big = r() < .04;
                rocks.push({ p: [(x + r()) * CELL, (y + r()) * CELL, (z + r()) * CELL], s: big ? r.range(60, 180) : r.log(3, 45), v: r.int(0, VARIANTS - 1), q: new THREE.Quaternion().setFromEuler(E.set(r() * 6.3, r() * 6.3, r() * 6.3)), spin: r.range(-.05, .05) });
            }
        }
    }
    return {
        objs,
        // camScene: camera position (scene); origin: the world origin (system coords of the scene origin); t: orbit time.
        update(camScene, origin, t, starScene, dt) {
            group.visible = true;
            far.position.copy(starScene);
            for (const s of swarms) { const c = trojanCentre(system, s.tr, t); s.pts.rotation.y = -Math.atan2(c[2], c[0]); }
            const cam = [camScene.x + origin.x, camScene.y + origin.y, camScene.z + origin.z];
            for (const k of comets) {
                const p = cometPosition(k.c, t), d = Math.hypot(...p);
                k.g.position.set(p[0] - origin.x, p[1] - origin.y, p[2] - origin.z);
                // Activity: a head and tail only as it nears the star, longer the closer it is.
                const act = Math.min(1, Math.max(0, (k.c.a * .9 - d) / (k.c.a * .75)));
                k.head.visible = k.tail.visible = act > .02;
                k.head.scale.setScalar(k.c.radius * (6 + 40 * act));
                k.head.material.opacity = .25 + .6 * act;
                const away = P.set(p[0], p[1], p[2]).normalize();
                k.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), away);
                const L = k.c.radius * (60 + 900 * act * act), W = k.c.radius * (5 + 30 * act);
                k.tail.scale.set(W, W, L);
                k.tail.material.opacity = .15 + .5 * act;
                k.nucleus.rotation.y += dt * .05;
            }
            const key = cam.map((v) => Math.floor(v / CELL)).join(",");
            if (key !== cellKey) { cellKey = key; fillRocks(cam, t); }
            const counts = new Array(VARIANTS).fill(0);
            for (const r of rocks) {
                const m = meshes[r.v], i = counts[r.v];
                if (i >= PER) continue;
                counts[r.v]++;
                r.q.multiply(Q.setFromAxisAngle(S.set(0, 1, 0), r.spin * dt));
                m.setMatrixAt(i, M.compose(P.set(r.p[0] - origin.x, r.p[1] - origin.y, r.p[2] - origin.z), r.q, S.setScalar(r.s)));
            }
            meshes.forEach((m, v) => { m.count = counts[v]; m.instanceMatrix.needsUpdate = true; });
        },
        // Pushes a sphere (the ship, scene coords) out of any rock; returns true if it hit one.
        collide(pScene, radius, origin) {
            let hit = false;
            for (const r of rocks) {
                const dx = pScene.x + origin.x - r.p[0], dy = pScene.y + origin.y - r.p[1], dz = pScene.z + origin.z - r.p[2], d = Math.hypot(dx, dy, dz), min = r.s * .85 + radius;
                if (d < min && d > 1e-6) { pScene.x += dx / d * (min - d); pScene.y += dy / d * (min - d); pScene.z += dz / d * (min - d); hit = true; }
            }
            return hit;
        },
        // The comet nearest a point (system coords), and its distance.
        nearestComet(p, t) { let best = null; for (const k of comets) { const q = cometPosition(k.c, t), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) - k.c.radius; if (!best || d < best.d) best = { c: k.c, d }; } return best; },
        set visible(v) { group.visible = v; },
        dispose() { scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); },
    };
}
