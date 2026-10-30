import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { clearOfPier, railIsClear } from "./clearance.mjs";
import { route, ensureRoute, random, areaFor, routeRevision, groundOf, slopeOf, strangeness, waterLevel, swingLane } from "./motion.mjs";
import { dreamUniforms, MELTS, CRUMBLES } from "./dream.js";
export function createDistricts(scene, materials) {
    const chunks = new Map(),
        cube = new THREE.BoxGeometry(1, 1, 1);
    const roofGeometry = new THREE.ConeGeometry(1, 1, 4),
        swampCrown = new THREE.IcosahedronGeometry(1, 0);
    const padGeometry = new THREE.CircleGeometry(1, 8);
    const glow = new THREE.MeshBasicMaterial({ color: 0xa9a9a9 });
    // Obstacles always read in the brightest shade, even through fog, and every
    // gap or hazard is announced by a lit lamp a few metres before it.
    // Obstacles: a shade lighter than the timber around them, and lit by their own
    // small lanterns. In dark districts they glow a little more (see setDarkness).
    const hazardLight = new THREE.MeshLambertMaterial({ color: 0xb4b4b4, emissive: 0x141414 });
    const hazardDark = new THREE.MeshLambertMaterial({ color: 0x6a6a6a, emissive: 0x080808 });
    hazardLight.defines = { HATCH: 1 };
    const lanternGlow = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
    const beacon = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x606060, flatShading: true });
    rockMaterial.defines = { HATCH: 2 };
    const mudMaterial = new THREE.MeshLambertMaterial({ color: 0x343434 });
    mudMaterial.defines = { HATCH: 4 };
    // Moss and reeds sway from their roots (see the VINE hook in dream.js).
    const vineMaterial = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    vineMaterial.defines = { VINE: "" };
    const reedMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
    reedMaterial.defines = { VINE: "", REED: "" };
    const reedDark = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    reedDark.defines = { VINE: "", REED: "" };
    // Tree shapes that hold up at low resolution: tiered spruce, round broadleaf.
    const pineGeometry = new THREE.ConeGeometry(1, 1, 8);
    const lighthouseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    // The lighthouse beam: two long wedges of light, dithered so they read as light, not solid.
    const beamGeometry = (() => {
        const g = new THREE.BufferGeometry(), v = [];
        for (const dir of [1, -1]) {
            const L = 90 * dir, W = 7;
            v.push(0, 0, 0, L, -1.5, -W, L, -1.5, W, 0, 0, 0, L, -1.5, W, L, 1.5, W, 0, 0, 0, L, 1.5, W, L, 1.5, -W, 0, 0, 0, L, 1.5, -W, L, -1.5, -W);
        }
        g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
        return g;
    })();
    const beamMaterial = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        vertexShader: "varying float along;void main(){along=abs(position.x)/90.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "varying float along;void main(){vec2 f=floor(gl_FragCoord.xy);float d=mod(f.x+f.y,2.);if(d<.5||along>.98||fract(sin(dot(f,vec2(12.9,78.2)))*43758.)<along*.9)discard;gl_FragColor=vec4(vec3(.95-along*.4),1.);}",
    });
    const sporeMaterial = new THREE.ShaderMaterial({
        uniforms: { dreamTime: dreamUniforms.dreamTime },
        vertexShader: `uniform float dreamTime;attribute float seed;varying float glow;
          void main(){vec3 p=position;float t=dreamTime*(.3+seed*.4)+seed*40.;
            p+=vec3(sin(t)*1.2+sin(t*2.3)*.3,sin(t*.7+seed*9.)*.8,cos(t*.9)*1.2);
            glow=pow(.5+.5*sin(dreamTime*(1.5+seed*2.)+seed*30.),3.);
            vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
            gl_PointSize=(glow>.6&&-mv.z<14.)?2.:1.;if(glow<.08)gl_PointSize=0.;}`,
        fragmentShader: `varying float glow;void main(){gl_FragColor=vec4(vec3(.45+glow*.55),1.);}`,
    });
    let revision = routeRevision;
    const extras = new Map();
    const freeSlots = Array.from({ length: MELTS }, (_, i) => i);
    // Height of the mirror plane for the world above: ground level appears this high up, twice over.
    const MIRROR_HEIGHT = 25;
    const freeCrumbles = Array.from({ length: CRUMBLES }, (_, i) => i);
    function release(chunk) {
        for (const { slot } of chunk.crumbleSlots || []) {
            dreamUniforms.crumbleRect.value[slot].set(0, 0, 0, 0);
            dreamUniforms.crumbleParam.value[slot].x = 1e9;
            freeCrumbles.push(slot);
        }
        for (const { slot } of chunk.slots || []) {
            dreamUniforms.meltRect.value[slot].set(0, 0, 0, 0);
            dreamUniforms.meltParam.value[slot].x = 1e9;
            freeSlots.push(slot);
        }
    }
    function build(index, s = route[index]) {
        // Generate the route well past this stretch first, so scenery placed far out
        // is kept clear of legs that don't exist on screen yet.
        ensureRoute(index + 9);
        const hole = s.gap,
            swamp = s.area === "swamp",
            group = new THREE.Group();
        scene.add(group);
        // Past the door in Pip's finale: nothing at all.
        if (s.empty) { chunks.set(s, { group, trees: [], foliage: [], debris: [], slots: [], crumbleSlots: [], seaRocks: [], chunkLamps: [], spinners: [], reflection: null, index, collapseAt: null }); return; }
        const batches = new Map(), debris = [];
        function block(x, y, z, w, h, d, mat = materials.wood, rot = 0, geom = cube) {
            const key = geom.uuid + mat.uuid;
            if (!batches.has(key)) batches.set(key, { geom, mat, list: [] });
            const o = new THREE.Object3D();
            o.position.set(x, y, z);
            o.scale.set(w, h, d);
            if (Array.isArray(rot)) o.rotation.set(rot[0], rot[1], rot[2]);
            else o.rotation.z = rot;
            o.updateMatrix();
            batches.get(key).list.push(o.matrix.clone());
        }
        function at(p, side) {
            return {
                x: s.x + s.dx * p - s.dz * side,
                z: s.z + s.dz * p + s.dx * side,
            };
        }
        const ground = (p) => groundOf(s, p);
        const water = waterLevel(s.area);
        // A straight member from a point along a direction, so branches really join their trunks.
        const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
        const stick = (x, y, z, dx, dy, dz, len, thick, mat) => {
            const d = new THREE.Vector3(dx, dy, dz).normalize();
            e.setFromQuaternion(q.setFromUnitVectors(up, d));
            block(x + d.x * len / 2, y + d.y * len / 2, z + d.z * len / 2, thick, len, thick, mat, [e.x, e.y, e.z]);
            return [x + d.x * len, y + d.y * len, z + d.z * len];
        };
        // Tilt a block so it lies along the slope of a ramp.
        const tilt = (p) => {
            const a = Math.atan(slopeOf(s, p));
            return s.dz ? [-s.dz * a, 0, 0] : [0, 0, s.dx * a];
        };
        const along = (len, across) => (s.dx ? [len, across] : [across, len]);
        const inCover = (p) => s.cover && p > s.cover.start - 0.5 && p < s.cover.end + 0.5;
        const melts = [], crumbles = [], seaRocks = [], chunkLamps = [], spinners = [];
        // Boards start where the previous corner's landing ends, so two branches
        // leaving the same fork never draw planks on top of each other.
        const firstBoard = index === 0 ? 0 : 1.65;
        if (!s.narrow) {
            for (let p = firstBoard; p < s.length; p += 0.55) {
                if (hole && p + 0.55 > hole.start && p < hole.end) continue;
                if (s.stairs && p + 0.55 > s.stairs.start) continue; // the staircase and landing have their own boards
                const a = at(p, 0), y = ground(p), [w, d] = along(0.51, 3.6);
                block(a.x, y, a.z, w, 0.2, d, random(index * 977 + p * 10) > 0.45 ? materials.wood : materials.pale, tilt(p));
                for (const side of [-1, 1]) {
                    const b = at(p, side * 1.4), [gw, gd] = along(0.65, 0.025);
                    block(b.x, y + 0.11, b.z, gw, 0.01, gd, materials.dark, tilt(p));
                }
            }
        } else {
            // A single crooked beam: the walk narrows to one board's width.
            for (let p = index === 0 ? 0 : 1.1; p < s.length; p += 1.1) {
                if (hole && p + 1.1 > hole.start && p < hole.end) continue;
                const a = at(p + 0.55, (random(index * 31 + p) - 0.5) * 0.06), y = ground(p + 0.55);
                const [w, d] = along(1.14, 0.5);
                const r = tilt(p + 0.55);
                r[1] = (random(index * 71 + p) - 0.5) * 0.05;
                block(a.x, y - 0.02, a.z, w, 0.24, d, materials.wood, r);
                const [gw, gd] = along(1.0, 0.03);
                block(a.x, y + 0.1, a.z, gw, 0.01, gd, materials.dark, r);
            }
        }
        // Ragged board ends at a gap: lengthwise boards of uneven length poking
        // a little way into the hole, lying flat in the deck plane.
        if (hole)
            for (const edge of [hole.start, hole.end]) {
                const dir = edge === hole.start ? 1 : -1;
                const count = s.narrow ? 1 : 6;
                for (let k = 0; k < count; k++) {
                    const lane = s.narrow ? 0 : -1.5 + k * 0.6;
                    const reach = 0.15 + random(index * 7 + k + edge) * 0.55;
                    const a = at(edge + dir * reach / 2, lane);
                    const [w, d] = along(reach, s.narrow ? 0.46 : 0.52);
                    block(a.x, ground(edge) - 0.01, a.z, w, 0.18, d, materials.wood, tilt(edge));
                }
            }
        // Stilts down into the water, cross-braced under the higher decks.
        for (let p = 0; p <= s.length; p += 3.5)
            for (const side of [-1, 1]) {
                const offset = s.narrow ? 0.32 : 1.95;
                const a = at(p, side * offset), y = ground(p);
                block(a.x, (y - 2.7) / 2, a.z, 0.2, y + 2.7, 0.2, materials.dark);
                if (y > 1 && side === 1 && p + 3.5 <= s.length) {
                    const b = at(p + 1.75, 0), [w, d] = along(0.09, offset * 2);
                    const brace = Math.atan2(y, 3.5);
                    block(b.x, y / 2 - 0.6, b.z, s.dx ? Math.hypot(3.5, y) : w, s.dx ? 0.09 : 0.09, s.dx ? d : Math.hypot(3.5, y), materials.dark, s.dz ? [brace, 0, 0] : [0, 0, brace]);
                }
                if (s.narrow || inCover(p) || !railIsClear(index, p, p, side)) continue;
                block(a.x, y + 0.55, a.z, 0.2, 1.1, 0.2, materials.dark);
                block(a.x, y + 1.12, a.z, 0.28, 0.1, 0.28, materials.pale);
                if (p + 3.5 < s.length && railIsClear(index, p, p + 3.5, side) && !inCover(p + 3.5) &&
                    !(hole && p < hole.end && p + 3.5 > hole.start)) {
                    const b = at(p + 1.75, side * 1.95), dy = ground(p + 3.5) - y;
                    const [w, d] = along(Math.hypot(3.5, dy), 0.045), a2 = Math.atan2(dy, 3.5);
                    block(b.x, y + dy / 2 + 0.85, b.z, w, 0.04, d, materials.rope, s.dz ? [-s.dz * a2, 0, 0] : [0, 0, s.dx * a2]);
                }
            }
        {
            const end = at(s.length, 0), y = ground(s.length);
            block(end.x, y - 0.02, end.z, 4.3, 0.2, 4.3);
            for (const [u, v] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]])
                block(end.x + u, (y - 2.7) / 2, end.z + v, 0.24, y + 2.7, 0.24, materials.dark);
        }
        // Pip's finale: the staircase at the end of the long road, and the door at the top.
        if (s.finale) { finaleStairs(); return; }
        function finaleStairs() {
            // The same timber staircase that turns up in the dream (see "Impossible things" below):
            // open treads, thin stringers and rails, a small landing on tall legs, and a bare door
            // frame with the door ajar. Only here it's the end of the road, a bit bigger, and lit.
            const st = s.stairs, SC = st.scale, fx = s.dx, fz = s.dz, rx = -s.dz, rz = s.dx, yaw = Math.atan2(s.dx, s.dz);
            const yTop = k => s.y + k * st.riser;
            const atP = (p, side = 0, y = 0) => { const a = at(p, side); return [a.x, y, a.z]; };
            for (let k = 1; k <= st.steps; k++) {
                const [x, , z] = atP(st.start + (k - 0.5) * st.tread);
                block(x, yTop(k) + 0.1 - 0.045 * SC, z, 1.2 * SC, 0.09 * SC, 0.4 * SC, k % 4 ? materials.wood : materials.pale, [0, yaw, 0]);
            }
            const run = st.steps * st.tread, rise = st.steps * st.riser, len = Math.hypot(run, rise) + 0.3 * SC;
            const sdy = rise / Math.hypot(run, rise), sdh = run / Math.hypot(run, rise), base = water - 0.6;
            for (const side of [-0.62 * SC, 0.62 * SC]) {
                const [x0, , z0] = atP(st.start, side);
                stick(x0, s.y + 0.1 - 0.12 * SC, z0, fx * sdh, sdy, fz * sdh, len, 0.12 * SC, materials.dark);
                stick(x0, s.y + 0.1 + 0.95 * SC, z0, fx * sdh, sdy, fz * sdh, len, 0.06 * SC, materials.dark);
                for (let k = 0; k <= st.steps; k += 4) {
                    const [px, , pz] = atP(st.start + k * st.tread, side), py = yTop(k) + 0.1;
                    block(px, py + 0.45 * SC, pz, 0.08 * SC, 0.95 * SC, 0.08 * SC, materials.dark, [0, yaw, 0]);
                    if (k % 8 === 0 && k > 0) block(px, (py + base) / 2, pz, 0.14 * SC, py - base, 0.14 * SC, materials.dark);
                }
            }
            // The landing, on tall legs, and the door frame at its far edge.
            const ly = yTop(st.steps) + 0.1, lp = st.top + 0.75 * SC;
            { const [x, , z] = atP(lp); block(x, ly - 0.07 * SC, z, 1.6 * SC, 0.14 * SC, 1.5 * SC, materials.wood, [0, yaw, 0]); }
            for (const [u, v] of [[-0.7, -0.65], [0.7, -0.65], [-0.7, 0.65], [0.7, 0.65]]) {
                const [x, , z] = atP(lp + v * SC, u * SC);
                block(x, (ly + base) / 2, z, 0.14 * SC, ly - base, 0.14 * SC, materials.dark);
            }
            const dp = s.door, dy = ly, c = at(dp, 0);
            for (const side of [-0.55, 0.55]) { const [x, , z] = atP(dp, side * SC); block(x, dy + 1.15 * SC, z, 0.12 * SC, 2.2 * SC, 0.12 * SC, materials.dark, [0, yaw, 0]); }
            block(c.x, dy + 2.3 * SC, c.z, 1.3 * SC, 0.14 * SC, 0.14 * SC, materials.dark, [0, yaw, 0]);
            // The door, ajar, the same way the dream's doors stand.
            {
                const hx = c.x + rx * 0.5 * SC, hz = c.z + rz * 0.5 * SC, open = 0.9;
                block(hx - (rx * Math.cos(open) - fx * Math.sin(open)) * 0.48 * SC, dy + 1.1 * SC, hz - (rz * Math.cos(open) - fz * Math.sin(open)) * 0.48 * SC, 0.96 * SC, 2.05 * SC, 0.05 * SC, materials.wood, [0, yaw + open, 0]);
            }
            // Light in the doorway, so it can be found from far down the road.
            block(c.x + fx * 0.04, dy + 1.1 * SC, c.z + fz * 0.04, 1.0 * SC, 2.15 * SC, 0.03, beacon, [0, yaw, 0]);
            chunkLamps.push({ p: new THREE.Vector3(c.x, dy + 1.4, c.z), strength: 2 });
            for (const { geom, mat, list: transforms } of batches.values()) {
                const mesh = new THREE.InstancedMesh(geom, mat, transforms.length);
                transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
                mesh.castShadow = mesh.receiveShadow = true;
                group.add(mesh);
            }
            const light = new THREE.PointLight(0xffffff, 40, 22, 1.6);
            light.position.set(c.x - s.dx * 1.5, dy + 1.8, c.z - s.dz * 1.5);
            group.add(light);
            group.traverse((o) => { o.frustumCulled = false; });
            // The road is mirrored in the still water like the rest of the shallows.
            const reflection = new THREE.Group();
            for (const child of group.children) if (child.isInstancedMesh) { const copy = new THREE.InstancedMesh(child.geometry, child.material, child.count); copy.instanceMatrix = child.instanceMatrix; copy.frustumCulled = false; reflection.add(copy); }
            reflection.scale.y = -1; reflection.position.y = water * 2; scene.add(reflection);
            chunks.set(s, { group, trees: [], foliage: [], debris: [], slots: [], crumbleSlots: [], seaRocks: [], chunkLamps, spinners: [], reflection, index, collapseAt: null });
        }
        // Covered passages: straight through a house, or under a run of arches.
        if (s.cover?.type === "house") {
            const { start, end } = s.cover;
            let top = -10;
            for (let p = start; p <= end; p += 0.5) top = Math.max(top, ground(p));
            for (let p = start; p <= end; p += 0.52) {
                const y = ground(p);
                for (const side of [-1, 1]) {
                    // Wall boards with the odd one missing so slits of light get in.
                    if (random(index * 313 + p * 7 + side) < 0.12) continue;
                    const a = at(p, side * 2.35), [w, d] = along(0.46, 0.12);
                    block(a.x, y + 1.7, a.z, w, 3.6 + random(p + side) * 0.2, d, random(p * 3 + side) > 0.3 ? materials.wood : materials.pale);
                }
                const a = at(p, 0), [w, d] = along(0.48, 5.2);
                block(a.x, y + 3.55, a.z, w, 0.14, d, materials.dark);
            }
            // Pitched roof and gable ends, so it reads as a house from outside.
            const mid = at((start + end) / 2, 0), len = end - start, yTop = top + 3.6;
            for (const side of [-1, 1]) {
                const a = at((start + end) / 2, side * 1.45), [w, d] = along(len + 0.8, 3.3);
                block(a.x, yTop + 0.9, a.z, w, 0.16, d, materials.roof, s.dz ? [0, 0, -side * 0.62] : [side * 0.62 * s.dx, 0, 0]);
            }
            for (const p of [start, end]) {
                const a = at(p, 0), [w, d] = along(0.3, 5.0);
                block(a.x, ground(p) + 3.9, a.z, w, 1.2, d, materials.wood);
                for (const side of [-1, 1]) {
                    const b = at(p, side * 2.2);
                    block(b.x, ground(p) + 1.8, b.z, 0.34, 3.8, 0.34, materials.dark);
                }
            }
            block(mid.x, yTop + 2.2, mid.z, 0.7, 2.4, 0.7, materials.dark);
            const [hx, hz] = along(len / 2 + 0.4, 2.7);

        } else if (s.cover?.type === "bridge") {
            // Canal bridges: stone decks crossing high over the walk, stepping up to each bank.
            for (let p = s.cover.start; p <= s.cover.end; p += 6.5) {
                const y = ground(p) + 3.5, c = at(p, 0), [w, d] = along(2.6, 18);
                block(c.x, y, c.z, w, 0.5, d, materials.pale);
                for (const side of [-1, 1]) {
                    const r = at(p, side * 1.25), [rw, rd] = along(0.25, 18);
                    for (const lane of [-1.2, 1.2]) {
                        const q = at(p + lane, 0), [qw, qd] = along(0.18, 18);
                        block(q.x, y + 0.6, q.z, qw, 0.7, qd, materials.dark);
                    }
                    for (const off of [2.6, 3.4]) {
                        const leg = at(p, side * off);
                        block(leg.x, (y - 2.6) / 2, leg.z, 2.2, y + 2.6, 0.7, materials.pale);
                    }
                    for (let k = 0; k < 5; k++) {
                        const st = at(p, side * (9 + k * 0.9)), [sw, sd] = along(2.6, 0.9);
                        block(st.x, y - 0.4 - k * 0.7, st.z, sw, 0.4, sd, materials.pale);
                    }
                }
                if (random(index * 61 + p) < 0.5) {
                    const lamp = at(p, 1.6);
                    block(lamp.x, y + 1.4, lamp.z, 0.1, 1.6, 0.1, materials.dark);
                    block(lamp.x, y + 2.3, lamp.z, 0.36, 0.42, 0.36, glow);
                }
            }
        } else if (s.cover) {
            // Curved members across the walk, laid as overlapping segments along a
            // polyline in the cross-section (cross offset, height above the deck).
            const curve = (p, pts, mat, thick, depth) => {
                const y0 = ground(p);
                for (let k = 0; k < pts.length - 1; k++) {
                    const [c1, h1] = pts[k], [c2, h2] = pts[k + 1];
                    const dc = c2 - c1, dh = h2 - h1, len = Math.hypot(dc, dh) * 1.25;
                    const a = at(p, (c1 + c2) / 2);
                    const [w, d] = along(depth, len);
                    const rot = s.dz ? [0, 0, Math.atan2(dh, dc)] : [Math.atan2(-dh, s.dx * dc), 0, 0];
                    block(a.x, y0 + (h1 + h2) / 2, a.z, w, thick, d, mat, rot);
                }
            };
            const { start, end, type } = s.cover;
            const R = s.narrow ? 1.3 : 2.6;
            if (type === "arches") {
                // Stone arches (harbor and the outer reach only).
                const span = s.narrow ? 1.1 : 2.15;
                for (let p = start; p <= end; p += 4.6) {
                    const y = ground(p);
                    for (const side of [-1, 1]) {
                        const a = at(p, side * span), foot = s.narrow ? -2.7 : y;
                        block(a.x, (foot + y + 2.4) / 2, a.z, 0.42, y + 2.4 - foot, 0.42, materials.pale);
                    }
                    const pts = [];
                    for (let k = 0; k <= 12; k++) { const t = Math.PI * k / 12; pts.push([Math.cos(t) * span, 2.4 + Math.sin(t) * span]); }
                    curve(p, pts, materials.pale, 0.42, 0.62);
                }
            } else if (type === "ribs") {
                // A ship's ribs: you run through the skeleton of a hull. Some are broken off.
                for (let p = start; p <= end; p += 1.9) {
                    for (const side of [-1, 1]) {
                        const reach = 0.6 + random(index * 37 + p * 3 + side) * 0.4;
                        const pts = [];
                        for (let k = 0; k <= 10 * reach; k++) {
                            const t = k / 10;
                            pts.push([side * ((R + 0.2) * (1 - Math.pow(t, 1.6)) + 0.9 * Math.sin(Math.PI * t)), -0.8 + t * (4.6 + (s.narrow ? 0 : 0.4))]);
                        }
                        curve(p, pts, materials.dark, 0.2, 0.32);
                    }
                }
                const keel = at((start + end) / 2, 0), [kw, kd] = along(end - start, 0.3);
                block(keel.x, ground(start) + 4.2, keel.z, kw, 0.22, kd, materials.dark);
            } else if (type === "roots") {
                // Gnarled roots arching right over the walk, flat-topped so they clear a jump.
                for (let p = start; p <= end; p += 3 + random(index + p) * 3) {
                    const H = 3.5 + random(p * 7 + index) * 1.2, thick = 0.4 + random(p + index * 3) * 0.35;
                    const pts = [];
                    for (let k = 0; k <= 14; k++) {
                        const c = -R - 0.6 + (2 * R + 1.2) * k / 14;
                        const e = Math.max(0, 1 - Math.pow(Math.abs(c) / (R + 0.6), 4));
                        pts.push([c + Math.sin(k * 1.7 + p) * 0.18, -0.9 + (H + 0.9) * Math.pow(e, 0.25) + Math.sin(k * 2.3 + p) * 0.15]);
                    }
                    curve(p, pts, materials.dark, thick, thick * 1.1);
                    for (let k = 0; k < 3; k++) {
                        const c = (random(p * 3 + k) - 0.5) * 2 * R, len = 0.6 + random(k + p) * 1.2;
                        const a = at(p, c);
                        block(a.x, ground(p) + H - len / 2, a.z, 0.08, len, 0.08, vineMaterial);
                    }
                }
            } else if (type === "overhang") {
                // The cliff leans out over the path: hanging rock, always well above head height.
                const wallSide = random(index * 5 + 77) < 0.5 ? -1 : 1;
                for (let p = start; p <= end; p += 2.4) {
                    // High overhead and leaning in from the wall side, so it never blocks the view ahead.
                    const a = at(p, wallSide * (3.2 + random(p) * 1.2)), y = ground(p);
                    block(a.x, y + 8 + random(p * 3) * 1.5, a.z, 3.5 + random(p) * 1.5, 2, 3, materials.pale, [0, random(p + 1) * 6, 0], swampCrown);
                }
            }
        }
        // Distinct timber houses with courses of siding, divided windows, roofs and chimneys.
        const area = s.area;
        const houseCount = index === 0 ? 0 : { swamp: 1, forest: 1, exposed: 2, harbor: 3, village: 4, wrecks: 1 }[area] ?? 0;
        for (let i = 0; i < houseCount; i++) {
            const side = i % 2 ? 1 : -1,
                a = at(
                    6 + (i * (s.length - 12)) / 4,
                    side * (6 + random(index * 17 + i) * 4),
                );
            const big = area === "harbor" ? 1.5 : 1;
            const w = (5 + random(index + i) * 3) * big,
                d = (5 + random(index + i + 70) * 3) * big,
                h = 5 + random(index + i + 13) * 6 * big;
            const safe = clearOfPier(
                a.x,
                a.z,
                Math.hypot(w / 2 + 0.6, d / 2 + 0.6) + 0.8,
            );
            a.x = safe.x;
            a.z = safe.z;
            // Some houses give way and pour down into the water as you pass.
            if (random(index * 211 + i * 5) < (area === "village" ? 0.6 : 0.4) + strangeness(index) * 0.4)
                crumbles.push({ rect: [a.x, a.z, w / 2 + 0.25, d / 2 + 0.25], base: -0.6, top: h + w * 0.34 + 2.5, away: [-s.dz * side, s.dx * side], delay: random(index * 7 + i) * 2.5 });
            block(a.x, h / 2 - 1, a.z, w, h, d);
            block(a.x, -0.25, a.z, w + 0.8, 0.25, d + 0.8, materials.dark);
            for (const side of [-1, 1])
                for (const end of [-1, 1])
                    block(
                        a.x + side * (w / 2 - 0.5),
                        -1.5,
                        a.z + end * (d / 2 - 0.5),
                        0.35,
                        3,
                        0.35,
                        materials.dark,
                    );
            for (let y = 0.1; y < h - 1; y += 0.4) {
                block(
                    a.x,
                    y,
                    a.z + d / 2 + 0.04,
                    w,
                    0.04,
                    0.07,
                    materials.pale,
                );
                block(
                    a.x + w / 2 + 0.04,
                    y,
                    a.z,
                    0.07,
                    0.04,
                    d,
                    materials.pale,
                );
                block(
                    a.x - w / 2 - 0.04,
                    y,
                    a.z,
                    0.07,
                    0.04,
                    d,
                    materials.pale,
                );
            }
            for (const sign of [-1, 1]) {
                // Missing roof sections expose the rafters and the black attic beneath.
                for(let r=0;r<8;r++) for(let col=0;col<Math.ceil(d/.65);col++) {
                    const u=(r+.5)/8, z=a.z-d/2+col*.65;
                    if(random(index*251+i*41+r*13+col)<.25) continue;
                    block(a.x+sign*w*u/2,h-1+w*.34*(1-u),z,w/15,.09,.61,materials.roof,-sign*Math.atan(.68));
                }
                for(let r=0;r<5;r++)block(a.x+sign*w*.25,h-1+w*.17,a.z-d/2+r*d/4,Math.hypot(w/2,w*.34),.12,.1,materials.dark,-sign*Math.atan(.68));
                for (let floor = 0; floor < 2; floor++)
                    for (let window = 0; window < 2; window++) {
                        const z = a.z + (window - 0.5) * d * 0.5,
                            y = 2 + floor * 2.6,
                            x = a.x + sign * (w / 2 + 0.08);
                        block(x, y, z, 0.08, 1.4, 1, materials.black);
                        for (let board=0; board<3; board++) {
                            block(x+sign*.16,y-.5+board*.43,z+.1*(board%2),.14,.19,1.3,materials.wood,(board-1)*.08);
                        }
                        block(
                            x + sign * 0.05,
                            y,
                            z,
                            0.05,
                            1.5,
                            0.07,
                            materials.dark,
                        );
                        block(
                            x + sign * 0.05,
                            y,
                            z,
                            0.05,
                            0.07,
                            1.1,
                            materials.dark,
                        );
                        block(
                            x + sign * 0.1,
                            y - 0.8,
                            z,
                            0.3,
                            0.12,
                            1.3,
                            materials.pale,
                        );
                    }
            }
            block(a.x + 1, h + w * 0.34, a.z, 0.8, 3, 1, materials.dark);
            for(let fragment=0;fragment<5;fragment++) {
                const piece=new THREE.Mesh(cube,fragment%2?materials.roof:materials.wood);
                piece.position.set(a.x+w*.47,h-1+fragment*.16,a.z+(fragment-2)*.6);
                piece.scale.set(.7,.09,.55);piece.rotation.z=-.6;group.add(piece);
                debris.push({piece,origin:piece.position.clone(),delay:i*.8+fragment*.18});
            }
            for (const sign of [-1, 1])
                block(
                    a.x + sign * (w / 2 - 0.15),
                    h / 2 - 1,
                    a.z + d / 2 + 0.09,
                    0.16,
                    h,
                    0.16,
                    materials.dark,
                );
        }
        const forest = area === "forest";
        const sideAt = (salt, near, far) => {
            const side = random(index * 97 + salt) < 0.5 ? -1 : 1;
            const a = at(random(index * 89 + salt * 3) * s.length, side * (near + Math.pow(random(index * 83 + salt * 5), 1.4) * (far - near)));
            return { ...a, side };
        };
        if (forest) {
            // Solid ground: a lumpy mud floor over the water, dipping into black puddles.
            {
                const cx = s.x + s.dx * s.length / 2, cz = s.z + s.dz * s.length / 2;
                const sx = s.dx ? s.length + 14 : 52, sz = s.dz ? s.length + 14 : 52;
                const geo = new THREE.PlaneGeometry(sx, sz, Math.ceil(sx / 1.3), Math.ceil(sz / 1.3));
                geo.rotateX(-Math.PI / 2);
                const pos = geo.attributes.position;
                const n2 = (x, z) => Math.sin(x * 0.37 + Math.sin(z * 0.21) * 2) * Math.cos(z * 0.31 + Math.sin(x * 0.17) * 2);
                for (let v = 0; v < pos.count; v++) {
                    const x = pos.getX(v) + cx, z = pos.getZ(v) + cz;
                    const lumps = n2(x, z) * 0.35 + n2(x * 2.3 + 5, z * 2.3) * 0.12;
                    const puddle = Math.max(0, -n2(x * 0.6 + 11, z * 0.6 - 7) - 0.35) * 2.2;
                    pos.setY(v, -0.42 + lumps - puddle + (index % 2) * 0.012 + (s.dx > 0 ? 0.006 : 0));
                }
                geo.computeVertexNormals();
                const mud = new THREE.Mesh(geo, mudMaterial);
                mud.position.set(cx, 0, cz);
                mud.receiveShadow = true;
                group.add(mud);
            }
            // The deep woods: huge leaning trunks close to the walk, buttress roots,
            // a canopy that closes overhead, moss curtains and drifting spores.
            for (let i = 0; i < 78; i++) {
                const r = 0.35 + random(index * 61 + i) * 0.9, a = sideAt(i, 3.4 + r, 16);
                const c = clearOfPier(a.x, a.z, r + 0.8), h = 15 + random(i * 7 + index) * 11;
                const lean = [(random(i + 3) - 0.5) * 0.12, random(i) * 6, (random(i + 5) - 0.5) * 0.12];
                block(c.x, h / 2 - 2.6, c.z, r, h, r * (0.8 + random(i + 1) * 0.4), materials.dark, lean);
                for (let b = 0; b < 4; b++) {
                    const ang = b * 1.57 + random(i + b) * 0.8;
                    block(c.x + Math.cos(ang) * r * 0.9, -0.9, c.z + Math.sin(ang) * r * 0.9, r * 0.25, 2.6, r * 1.6, materials.dark, [Math.sin(ang) * 0.7, ang, Math.cos(ang) * 0.7]);
                }
                for (let k = 0; k < 4; k++) {
                    const sz = 2.5 + random(i * 5 + k) * 3.5;
                    block(c.x + (random(i + k * 9) - 0.5) * 1.6, h - 3 - k * 1.6, c.z + (random(i + k * 11) - 0.5) * 1.6, sz, sz * 0.45, sz, k % 2 ? materials.roof : materials.dark, [0, random(k + i) * 6, 0], swampCrown);
                }
                // Moss hanging from the lower branches beside the walk.
                if (i % 2 === 0)
                    for (let k = 0; k < 3; k++) {
                        const len = 2 + random(i + k * 13) * 5;
                        block(c.x + (random(i * 3 + k) - 0.5) * 2.4, h * 0.55 - len / 2, c.z + (random(i * 5 + k) - 0.5) * 2.4, 0.07, len, 0.1, vineMaterial, 0);
                    }
            }
            // Canopy closing over the boardwalk.
            for (let p = 0; p < s.length; p += 2.6) {
                const a = at(p, (random(index * 7 + p) - 0.5) * 5), y = ground(p);
                const sz = 4 + random(p + index) * 3;
                block(a.x, y + 9.5 + random(p * 3) * 3, a.z, sz, 1.1, sz, random(p) < 0.5 ? materials.dark : materials.roof, [0, random(p * 7) * 6, 0], swampCrown);
                // Curtains of moss over the walk, always above head height (and above a jump).
                for (let k = 0; k < 3; k++) {
                    const lane = (random(index * 13 + p * 5 + k) - 0.5) * 5.2, len = 3 + random(p + k * 7) * 3;
                    const v = at(p + random(k + p) * 2.6, lane);
                    const bottom = y + (Math.abs(lane) < 1.9 ? 3.4 : 0.3 + random(k * 3 + p) * 2);
                    block(v.x, bottom + len / 2, v.z, 0.06, len, 0.09, vineMaterial, 0);
                }
            }
            // Cypress knees and fallen logs in the black water.
            for (let i = 0; i < 46; i++) {
                const a = sideAt(i + 300, 2.6, 14), c = clearOfPier(a.x, a.z, 0.4);
                block(c.x, -1.6, c.z, 0.35 + random(i) * 0.3, 1 + random(i + 2) * 1.4, 0.35, materials.dark, [0, random(i) * 6, 0], roofGeometry);
            }
            for (let i = 0; i < 6; i++) {
                const len = 7 + random(i) * 5, a = sideAt(i + 400, 5, 14), c = clearOfPier(a.x, a.z, len / 2 + 0.8);
                block(c.x, -1.15, c.z, 0.7, 0.7, len, materials.dark, [0.1, random(i) * 6, (random(i + 1) - 0.5) * 0.3]);
            }
            // Spores and fireflies drifting between the trunks.
            const sporeCount = 180, sporePos = new Float32Array(sporeCount * 3), sporeSeed = new Float32Array(sporeCount);
            for (let i = 0; i < sporeCount; i++) {
                const a = at(random(index * 5 + i * 3) * s.length, (random(i * 7 + index) - 0.5) * 18);
                sporePos.set([a.x, ground(0) + 0.5 + random(i * 11) * 6, a.z], i * 3);
                sporeSeed[i] = random(i * 13 + index);
            }
            const sporeGeometry = new THREE.BufferGeometry();
            sporeGeometry.setAttribute("position", new THREE.BufferAttribute(sporePos, 3));
            sporeGeometry.setAttribute("seed", new THREE.BufferAttribute(sporeSeed, 1));
            const spores = new THREE.Points(sporeGeometry, sporeMaterial);
            spores.frustumCulled = false;
            group.add(spores);
            // The way in: two great trunks leaning together over the walk.
            if (areaFor(index - 1) !== "forest") {
                for (const side of [-1, 1]) {
                    const a = at(1.5, side * 2.7), y = ground(1.5);
                    block(a.x - s.dz * side * -1.7, y + 6, a.z + s.dx * side * -1.7, 0.9, 14, 0.9, materials.dark, s.dz ? [0, 0, side * 0.24 * -s.dz] : [-side * 0.24 * s.dx, 0, 0]);
                }
            }
        } else if (area === "harbor" || area === "exposed") {
            // A wreck's ribs sticking out of the water.
            if (random(index * 17 + 2) < 0.55) {
                const a = sideAt(500, 9, 15), c = clearOfPier(a.x, a.z, 5), yaw = random(index) * 6;
                block(c.x, -1.7, c.z, 0.5, 0.5, 8, materials.dark, [0, yaw, 0]);
                for (let k = -3; k <= 3; k++) {
                    const ox = Math.sin(yaw) * k * 1.1, oz = Math.cos(yaw) * k * 1.1;
                    for (const side of [-1, 1]) {
                        if (random(k * 7 + side + index) < 0.2) continue;
                        const len = 2.6 - Math.abs(k) * 0.25;
                        block(c.x + ox + Math.cos(yaw) * side * 0.9, -1.2 + len * 0.3, c.z + oz - Math.sin(yaw) * side * 0.9, 0.18, len, 0.22, materials.dark, [0, yaw, side * 0.5]);
                    }
                }
            }
            // Standing stones and a broken sea wall out on the exposed reach.
            if (area === "exposed")
                for (let i = 0; i < 9; i++) {
                    const a = sideAt(600 + i, 7, 20), c = clearOfPier(a.x, a.z, 1.5), h = 1.5 + random(i + index) * 3.5;
                    block(c.x, -1 + h / 2, c.z, 0.7 + random(i) * 0.6, h, 0.5, materials.pale, [(random(i + 2) - 0.5) * 0.25, random(i) * 6, (random(i + 4) - 0.5) * 0.25]);
                }
        } else if (area === "canal") {
            // The narrow canals: tall terraced houses shoulder to shoulder on both
            // sides, stepped gables, window grids, washing lines across the gap.
            for (const side of [-1, 1]) {
                let p = -2;
                while (p < s.length + 2) {
                    const w = 3 + random(index * 17 + p + side) * 2.5, h = 8 + random(index * 23 + p * 3 + side) * 9;
                    const depth = 6, off = 3.4 + random(p * 7 + side) * 0.6 + depth / 2;
                    const c = at(p + w / 2, side * off), [bw, bd] = along(w - 0.1, depth);
                    // Skip any house that would stand on a neighbouring stretch near a corner.
                    const fits = clearOfPier(c.x, c.z, Math.hypot(w, depth) / 2 - 0.4);
                    if (Math.hypot(fits.x - c.x, fits.z - c.z) > 0.05) { p += w; continue; }
                    block(c.x, h / 2 - 1.5, c.z, bw, h, bd, random(p + side * 3) < 0.5 ? materials.wood : materials.pale);
                    const steps = 3;
                    for (let k = 1; k <= steps; k++) {
                        const [gw, gd] = along((w - 0.1) * (1 - k / (steps + 1)), depth * 0.98);
                        block(c.x, h - 1.5 + k * 0.55, c.z, gw, 0.55, gd, materials.roof);
                    }
                    const face = at(p + w / 2, side * (off - depth / 2 - 0.04));
                    for (let fy = 1.2; fy < h - 2; fy += 2.1)
                        for (let fx = -1; fx <= 1; fx += 2) {
                            if (w < 3.6 && fx > 0) continue;
                            const q = at(p + w / 2 + fx * w * 0.22 * (w < 3.6 ? 0 : 1), side * (off - depth / 2 - 0.05)), [ww, wd] = along(0.8, 0.06);
                            block(q.x, fy, q.z, ww, 1.2, wd, random(fy * 5 + p + fx) < 0.12 ? glow : materials.black);
                        }
                    block(face.x, 0.2, face.z, ...along(w - 0.1, 0.12), materials.dark);
                    p += w;
                }
            }
            for (let p = 3; p < s.length; p += 5 + random(index + p) * 4) {
                const y = ground(p) + 5 + random(p) * 2;
                const a = at(p, 0), [lw, ld] = along(0.03, 8);
                block(a.x, y, a.z, lw, 0.03, ld, materials.dark);
                for (let k = -3; k <= 3; k++) {
                    if (Math.abs(k) < 1 || random(p * 9 + k) < 0.3) continue;
                    const q = at(p, k * 0.95), [cw, cd] = along(0.05, 0.6);
                    block(q.x, y - 0.4, q.z, cw, 0.75 + random(k + p) * 0.4, cd, random(k) < 0.5 ? materials.pale : vineMaterial);
                }
            }
        } else if (area === "cliffs") {
            // The cliff road: a sheer rock wall on one side, open sea far below on the other.
            const wallSide = random(index * 5 + 77) < 0.5 ? -1 : 1;
            for (let p = -4; p < s.length + 4; p += 2.2) {
                const off = 5.5 + random(index * 31 + p) * 2, h = 18 + random(p * 5 + index) * 14;
                const rw = 3.5 + random(p) * 1.5;
                const c0 = at(p, wallSide * (off + rw)), c = clearOfPier(c0.x, c0.z, Math.max(rw, 4) + 0.6 + h * 0.06);
                block(c.x, h / 2 - 3, c.z, rw, h / 2, 4, materials.pale, [random(p + 1) * 0.2 - 0.1, random(p) * 6, random(p + 2) * 0.2 - 0.1], swampCrown);
                if (random(p * 3 + index) < 0.3) {
                    const ledge = at(p, wallSide * (off + 0.4));
                    block(ledge.x, ground(p) + 1 + random(p) * 6, ledge.z, 1.6, 0.5, 1.4, materials.dark, [0, random(p) * 6, 0]);
                }
            }
            for (let i = 0; i < 6; i++) {
                const a = sideAt(900 + i, 14, 40), c = clearOfPier(a.x, a.z, 4);
                if (Math.sign((c.x - s.x) * -s.dz + (c.z - s.z) * s.dx) === wallSide) continue;
                const h = 8 + random(i + index) * 16;
                block(c.x, h / 2 - 3, c.z, 1.5 + random(i) * 1.5, h / 2, 1.5 + random(i + 1) * 1.5, materials.pale, [0, random(i) * 6, 0], swampCrown);
                block(c.x, h - 2.5, c.z, 2.5, 1, 2.5, materials.dark, [0, random(i + 3) * 6, 0], swampCrown);
            }
        } else if (area === "marsh") {
            // The reed sea: clumps with open water between them, short near the walk and
            // taller further out, mixing pale and dark stems so the layers read apart.
            for (let i = 0; i < 46; i++) {
                const a = sideAt(1000 + i, 2.6, 16), c = clearOfPier(a.x, a.z, 0.8);
                const dist = Math.hypot(c.x - (s.x + s.dx * s.length / 2), c.z - (s.z + s.dz * s.length / 2));
                const reach = Math.min(1, Math.abs((c.x - s.x) * -s.dz + (c.z - s.z) * s.dx) / 12);
                const spread = 0.7 + random(i * 3) * 1.1;
                for (let k = 0; k < 11; k++) {
                    const h = (1.1 + reach * 2.6) * (0.6 + random(k + i * 7) * 0.7);
                    const x = c.x + (random(i * 9 + k) - 0.5) * spread * 2, z = c.z + (random(i * 11 + k) - 0.5) * spread * 2;
                    block(x, water + h / 2 - 0.1, z, 0.07, h, 0.07, k % 3 ? reedMaterial : reedDark, [(random(k) - 0.5) * 0.25, 0, (random(k + 1) - 0.5) * 0.25]);
                }
                void dist;
            }
            // Dead trees standing in the water, branches growing out of the trunk.
            for (let i = 0; i < 3; i++) {
                const a = sideAt(1100 + i, 7, 18), c = clearOfPier(a.x, a.z, 2.5);
                const top = stick(c.x, water - 0.3, c.z, (random(i) - 0.5) * 0.15, 1, (random(i + 1) - 0.5) * 0.15, 6 + random(i + 2) * 3, 0.28, materials.dark);
                for (let b = 0; b < 4; b++) {
                    const f = 0.45 + b * 0.15, ang = b * 1.9 + random(i + b) * 1.2;
                    const bx = c.x + (top[0] - c.x) * f, by = water - 0.3 + (top[1] - water + 0.3) * f, bz = c.z + (top[2] - c.z) * f;
                    const tip = stick(bx, by, bz, Math.cos(ang), 0.55 + random(b) * 0.5, Math.sin(ang), 1.6 + random(b + i) * 1.4, 0.1, materials.dark);
                    stick(tip[0], tip[1], tip[2], Math.cos(ang + 0.6), 0.9, Math.sin(ang + 0.6), 0.7, 0.06, materials.dark);
                }
            }
        } else if (area === "shallows") {
            // The mirror shallows: still water to the horizon, rows of old mooring poles
            // marching away in perfect lines, a moored rowing boat, a lone hut on stilts.
            for (let row = 0; row < 4; row++) {
                const side = row % 2 ? 1 : -1, off = 7 + row * 6 + random(index + row) * 3;
                for (let p = random(row + index) * 4; p < s.length; p += 4 + (row % 2) * 2) {
                    const a = at(p, side * off), c = clearOfPier(a.x, a.z, 1.2), h = 1.2 + random(p * 3 + row) * 1.6;
                    // Poles that would land on (or be shoved beside) another leg are simply left out.
                    if (Math.hypot(c.x - a.x, c.z - a.z) > 0.05) continue;
                    block(c.x, water + h / 2 - 0.3, c.z, 0.16, h, 0.16, materials.dark, [(random(p + row) - 0.5) * 0.1, 0, (random(p * 7) - 0.5) * 0.1]);
                }
            }
            if (random(index * 9 + 1) < 0.6) {
                const a = sideAt(1600, 6, 14), c = clearOfPier(a.x, a.z, 2.5), yaw = random(index) * 6;
                block(c.x, water + 0.12, c.z, 1.2, 0.35, 3.2, materials.wood, [0, yaw, 0]);
                block(c.x, water + 0.3, c.z, 1.0, 0.06, 2.8, materials.dark, [0, yaw, 0]);
                block(c.x + Math.sin(yaw) * 1.6, water + 0.45, c.z + Math.cos(yaw) * 1.6, 0.05, 0.05, 2.2, materials.rope, [0.2, yaw + 0.4, 0]);
            }
            if (random(index * 9 + 2) < 0.45) {
                const a = sideAt(1610, 16, 26), c = clearOfPier(a.x, a.z, 4);
                for (const [u, v] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) block(c.x + u, water + 0.9, c.z + v, 0.15, 2.4, 0.15, materials.dark);
                block(c.x, water + 3.1, c.z, 3, 2.2, 3, materials.wood);
                block(c.x, water + 4.8, c.z, 2.4, 1.6, 2.4, materials.roof, [0, 0.78, 0], roofGeometry);
                block(c.x + 1.51, water + 3.2, c.z, 0.04, 0.7, 0.6, glow);
            }
        } else if (area === "sunken") {
            // The sunken town: a flooded square. Houses stand up to their eaves in the
            // water, lampposts still burn, and the walk is laid across the rooftops.
            for (let i = 0; i < 6; i++) {
                const a = sideAt(1700 + i, 6, 18), w = 4 + random(i + index) * 3, d = 4 + random(i * 3 + index) * 3;
                const c = clearOfPier(a.x, a.z, Math.hypot(w, d) / 2 + 0.8), h = 2 + random(i * 5) * 3, yaw = Math.round(random(i + 9) * 4) * Math.PI / 2 + (random(i) - 0.5) * 0.2;
                block(c.x, water + h / 2 - 0.4, c.z, w, h, d, random(i) < 0.5 ? materials.wood : materials.pale, [0, yaw, 0]);
                block(c.x, water + h + 0.9, c.z, w * 0.75, 2.2, d * 0.75, materials.roof, [0, yaw + 0.78, 0], roofGeometry);
                for (let k = -1; k <= 1; k += 2) block(c.x + Math.cos(yaw) * k * w * 0.25, water + h - 0.9, c.z - Math.sin(yaw) * k * w * 0.25, 0.7, 0.9, d + 0.04, random(i + k) < 0.25 ? glow : materials.black, [0, yaw, 0]);
                if (random(i * 7) < 0.6) block(c.x + Math.cos(yaw) * w * 0.3, water + h + 1.8, c.z, 0.5, 1.4, 0.5, materials.dark, [0, yaw, 0]);
            }
            // Lampposts standing in the flood, still lit.
            for (let p = 4; p < s.length; p += 9) {
                const side = (Math.floor(p / 9) % 2) ? 1 : -1, a = at(p, side * 3.4), c = clearOfPier(a.x, a.z, 0.4);
                block(c.x, water + 1.4, c.z, 0.12, 3.6, 0.12, materials.dark);
                block(c.x, water + 3.35, c.z, 0.34, 0.42, 0.34, glow);
                block(c.x, water + 3.62, c.z, 0.48, 0.08, 0.48, materials.dark);
                chunkLamps.push({ p: new THREE.Vector3(c.x, water + 3.35, c.z), strength: 2.2 });
            }
            // Roof ridges beneath the boards: you are running over the drowned houses.
            if (!s.narrow)
                for (let p = 3; p < s.length - 2; p += 6.5) {
                    const a = at(p, 0), y = ground(p), [rw, rd] = along(5.5, 5);
                    block(a.x, y - 1.1, a.z, rw * 0.75, 1.8, rd * 0.75, materials.roof, [0, (s.dx ? 0 : Math.PI / 2) + 0.78, 0], roofGeometry);
                    block(a.x, (y - 2 + water - 2) / 2, a.z, rw * 0.9, Math.max(0.5, y - water), rd * 0.9, materials.wood);
                }
            // A drowned church: its tower and spire rising out of the square.
            if (areaFor(index - 1) !== "sunken" || index % 5 === 0) {
                const a = sideAt(1750, 16, 24), c = clearOfPier(a.x, a.z, 4.5);
                block(c.x, water + 6, c.z, 4.2, 14, 4.2, materials.pale);
                for (let k = -1; k <= 1; k += 2) block(c.x + k * 2.12, water + 10.5, c.z, 0.06, 2.4, 1.1, materials.black);
                block(c.x, water + 10.5, c.z + 2.12, 1.1, 2.4, 0.06, materials.black);
                block(c.x, water + 10, c.z, 1, 1.1, 1, materials.dark, 0, rockGeometry);
                block(c.x, water + 18, c.z, 3.6, 7, 3.6, materials.roof, [0, 0.78, 0], roofGeometry);
                block(c.x, water + 22.2, c.z, 0.12, 1.4, 0.12, materials.dark);
                block(c.x, water + 22.4, c.z, 0.7, 0.1, 0.1, materials.dark);
            }
        } else if (area === "lighthouse") {
            // The lighthouse isle: bare rock and wiry grass, and a huge striped lighthouse
            // whose beam sweeps the whole district.
            for (let i = 0; i < 12; i++) {
                const a = sideAt(1800 + i, 6, 22), r = 3 + random(i + index) * 4, c = clearOfPier(a.x, a.z, r * 1.2 + 0.6);
                block(c.x, water + 0.2, c.z, r, 1.4 + random(i) * 1.5, r * 0.9, rockMaterial, [0, random(i) * 6, 0], rockGeometry);
                for (let k = 0; k < 10; k++)
                    block(c.x + (random(i * 9 + k) - 0.5) * r, water + 1.5 + random(k) * 0.4, c.z + (random(i * 7 + k) - 0.5) * r, 0.05, 0.5 + random(k + i) * 0.5, 0.05, reedMaterial, [(random(k) - 0.5) * 0.5, 0, (random(k + 1) - 0.5) * 0.5]);
            }
            if (areaFor(index - 1) !== "lighthouse" || index % 4 === 0) {
                const a = sideAt(1850, 22, 30), c = clearOfPier(a.x, a.z, 6);
                block(c.x, water + 1, c.z, 9, 3, 8, rockMaterial, [0, random(index) * 6, 0], rockGeometry);
                const H = 30;
                for (let k = 0; k < 6; k++) {
                    const r = 3.2 - k * 0.25;
                    block(c.x, water + 3 + k * H / 6 + H / 12, c.z, r * 2, H / 6, r * 2, k % 2 ? materials.dark : materials.pale, [0, k * 0.4, 0], lighthouseGeometry);
                }
                block(c.x, water + 3 + H + 0.3, c.z, 4.6, 0.5, 4.6, materials.dark, 0, lighthouseGeometry);
                block(c.x, water + 3 + H + 1.6, c.z, 2.6, 2.2, 2.6, glow, 0, lighthouseGeometry);
                block(c.x, water + 3 + H + 3.6, c.z, 3, 2, 3, materials.dark, 0, pineGeometry);
                const beam = new THREE.Mesh(beamGeometry, beamMaterial);
                beam.position.set(c.x, water + 3 + H + 1.6, c.z);
                beam.frustumCulled = false;
                group.add(beam);
                spinners.push(beam);
                // The keeper's cottage at its foot.
                block(c.x + 5, water + 2.8, c.z + 3, 4, 2.6, 3, materials.pale);
                block(c.x + 5, water + 4.9, c.z + 3, 3.2, 1.8, 2.6, materials.roof, [0, 0.78, 0], roofGeometry);
                block(c.x + 7.02, water + 2.8, c.z + 3, 0.04, 0.8, 0.7, glow);
            }
        } else if (area === "breakers") {
            // The breakers: the walk picks its way across a field of black rocks in
            // open sea. Big rocks stand close on both sides and the swell explodes on them.
            for (let i = 0; i < 30; i++) {
                const near = i < 14;
                const a = sideAt(1400 + i, near ? 3.5 : 9, near ? 9 : 30);
                const r = near ? 1 + random(index * 5 + i) * 1.4 : 1.8 + random(index * 5 + i) * 3;
                const c = clearOfPier(a.x, a.z, r * 1.35 + 0.9), rh = r * (0.9 + random(i + 3) * 1.4);
                block(c.x, water + rh * 0.35, c.z, r, rh, r * (0.8 + random(i + 4) * 0.4), rockMaterial, [random(i) * 0.12, random(i + 2) * 6, random(i + 6) * 0.12], rockGeometry);
                if (random(i * 3 + index) < 0.5) {
                    const b = clearOfPier(c.x + r * 0.6, c.z - r * 0.4, r * 0.6 + 0.6);
                    block(b.x, water + 0.2, b.z, r * 0.5, r * 0.5, r * 0.45, rockMaterial, [random(i + 1) * 0.3, random(i) * 6, 0], rockGeometry);
                }
                seaRocks.push({ x: c.x, z: c.z, r: r * 0.92 });
            }
            // Rubble heaped around the stilts, so the walk looks built on the rocks.
            for (let p = 2; p < s.length; p += 3.5)
                for (const side of [-1, 1]) {
                    if (random(index * 17 + p + side) < 0.45) continue;
                    const a = at(p, side * (s.narrow ? 0.5 : 2.1)), r = 0.6 + random(p + side) * 0.6;
                    block(a.x, water + 0.1, a.z, r, r * 0.8, r, rockMaterial, [random(p), random(p + 1) * 6, 0], rockGeometry);
                }
            // A navigation beacon on the largest outcrop.
            if (random(index * 23 + 5) < 0.5) {
                const a = sideAt(1500, 14, 22), c = clearOfPier(a.x, a.z, 3);
                block(c.x, water + 1.5, c.z, 2.6, 2.4, 2.4, rockMaterial, [0, random(index) * 6, 0], rockGeometry);
                block(c.x, water + 5, c.z, 0.25, 4, 0.25, materials.dark);
                block(c.x, water + 7.2, c.z, 0.5, 0.6, 0.5, glow);
                for (const y of [3.6, 4.6]) block(c.x, water + y, c.z, 0.5, 0.5, 0.5, materials.pale, [0, 0.78, 0]);
            }
        } else if (area === "wrecks") {
            // The ship graveyard: hulls lying on their sides, leaning masts and loose rigging.
            for (let i = 0; i < 4; i++) {
                const len = 10 + random(i) * 8;
                const a = sideAt(1200 + i, 7, 22), c = clearOfPier(a.x, a.z, len / 2 + 2.5), yaw = random(index * 3 + i) * 6, roll = (random(i + index) - 0.5) * 1.2;
                const fx = Math.sin(yaw), fz = Math.cos(yaw);
                block(c.x, -1.2, c.z, 0.5, 0.6, len, materials.dark, [0, yaw, roll]);
                for (let k = 0; k < len; k += 1.1) {
                    const u = k / len - 0.5, ox = fx * u * len, oz = fz * u * len, size = 1 - Math.abs(u) * 1.3;
                    for (const side of [-1, 1]) {
                        if (random(i * 41 + k * 3 + side) < 0.25) continue;
                        block(c.x + ox + fz * side * size * 1.2, -0.6 + size, c.z + oz - fx * side * size * 1.2, 0.16, 2.4 * size + 0.4, 0.2, materials.dark, [0, yaw, roll + side * 0.55]);
                        if (random(i + k * 7 + side) < 0.45)
                            block(c.x + ox + fz * side * size * 1.7, -0.2 + size * 0.6, c.z + oz - fx * side * size * 1.7, 0.08, 0.5, 1.05, materials.wood, [0, yaw, roll + side * 0.9]);
                    }
                }
                const mastLean = (random(i + 9) - 0.5) * 0.9, mh = 9 + random(i + 4) * 6;
                block(c.x, mh / 2 - 1, c.z, 0.22, mh, 0.22, materials.dark, [mastLean * 0.4, yaw, mastLean]);
                block(c.x - Math.sin(mastLean) * mh * 0.35, mh * 0.62, c.z, 4.5, 0.14, 0.14, materials.dark, [0, yaw + 1.57, mastLean]);
            }
        } else if (swamp) {
            // Reed beds along the margins.
            for (let i = 0; i < 26; i++) {
                const a = sideAt(700 + i, 3, 12), c = clearOfPier(a.x, a.z, 1);
                for (let k = 0; k < 9; k++)
                    block(c.x + (random(i * 9 + k) - 0.5) * 1.6, -0.9, c.z + (random(i * 11 + k) - 0.5) * 1.6, 0.03, 1.4 + random(k + i) * 1.4, 0.03, reedMaterial, [(random(k) - 0.5) * 0.4, 0, (random(k + 1) - 0.5) * 0.4]);
            }
        }
        // Impossible things, placed calmly as if they belonged: stairs that end in
        // the air, doors standing in the sea, a house hanging upside down from the
        // sky, a boardwalk that climbs off into the clouds, a pier overhead.
        // Oddities grow more common the deeper the run goes.
        const deep = strangeness(index);
        const oddity = index > 0 && random(index * 173 + 1) < 0.35 + deep * 0.65 ? Math.floor(random(index * 131 + 7) * 5) : -1;
        const yawAt = (salt) => random(index * 7 + salt) * Math.PI * 2;
        if (oddity === 0 || oddity === 1) {
            // A proper timber staircase climbing out of the water to a small landing
            // high up, with nothing beyond it but a door frame (sometimes a door, ajar).
            const a = sideAt(800, 8, 16), c = clearOfPier(a.x, a.z, 8), yaw = yawAt(1);
            const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
            const steps = 16, run = 0.42, riseStep = 0.3, base = water - 0.2;
            const pt = (k, side = 0, up = 0) => [c.x + fx * k * run + rx * side, base + k * riseStep + up, c.z + fz * k * run + rz * side];
            for (let k = 1; k <= steps; k++) {
                const [x, y, z] = pt(k);
                block(x, y, z, 1.2, 0.09, 0.4, k % 4 ? materials.wood : materials.pale, [0, yaw, 0]);
            }
            const slopeLen = Math.hypot(steps * run, steps * riseStep), sdy = riseStep / Math.hypot(run, riseStep), sdh = run / Math.hypot(run, riseStep);
            for (const side of [-0.62, 0.62]) {
                const [x0, y0, z0] = pt(0, side, -0.05);
                stick(x0, y0, z0, fx * sdh, sdy, fz * sdh, slopeLen + 0.3, 0.12, materials.dark);
                const [hx, hy, hz] = pt(0, side, 0.95);
                stick(hx, hy, hz, fx * sdh, sdy, fz * sdh, slopeLen + 0.3, 0.06, materials.dark);
                for (let k = 0; k <= steps; k += 4) {
                    const [px, py, pz] = pt(k, side);
                    block(px, py + 0.45, pz, 0.08, 0.95, 0.08, materials.dark, [0, yaw, 0]);
                    if (k % 8 === 0 && k > 0) block(px, (py + base - 0.6) / 2, pz, 0.14, py - base + 0.6, 0.14, materials.dark);
                }
            }
            // The landing, on tall legs, and the door frame at its far edge.
            const [lx, ly, lz] = pt(steps + 2);
            block(lx, ly, lz, 1.6, 0.14, 1.5, materials.wood, [0, yaw, 0]);
            for (const [u, v] of [[-0.7, -0.65], [0.7, -0.65], [-0.7, 0.65], [0.7, 0.65]])
                block(lx + rx * u + fx * v, (ly + base - 0.6) / 2, lz + rz * u + fz * v, 0.14, ly - base + 0.6, 0.14, materials.dark);
            const dx = lx + fx * 0.6, dz = lz + fz * 0.6;
            for (const side of [-0.55, 0.55]) block(dx + rx * side, ly + 1.15, dz + rz * side, 0.12, 2.2, 0.12, materials.dark, [0, yaw, 0]);
            block(dx, ly + 2.3, dz, 1.3, 0.14, 0.14, materials.dark, [0, yaw, 0]);
            if (oddity === 1) {
                const hingeX = dx + rx * 0.5, hingeZ = dz + rz * 0.5, open = 0.9;
                block(hingeX - (rx * Math.cos(open) - fx * Math.sin(open)) * 0.48, ly + 1.1, hingeZ - (rz * Math.cos(open) - fz * Math.sin(open)) * 0.48, 0.96, 2.05, 0.05, materials.wood, [0, yaw + open, 0]);
            }
        } else if (oddity === 2) {
            for (let n = 0; n < 2; n++) {
                const a = sideAt(810 + n, 6, 16), c = clearOfPier(a.x, a.z, 1.5), yaw = yawAt(2 + n);
                for (const side of [-1, 1]) block(c.x + Math.cos(yaw) * side * 0.6, 0.15, c.z - Math.sin(yaw) * side * 0.6, 0.14, 2.6, 0.14, materials.dark, [0, yaw, 0]);
                block(c.x, 1.5, c.z, 1.35, 0.14, 0.16, materials.dark, [0, yaw, 0]);
                block(c.x, 1.45, c.z, 1.1, 0.12, 0.06, materials.pale, [0, yaw, 0]);
                block(c.x + Math.cos(yaw) * 0.25, 0.25, c.z - Math.sin(yaw) * 0.25, 1, 2.2, 0.06, materials.wood, [0, yaw + 0.55 + n * 0.4, 0]);
                block(c.x, 0.25, c.z, 1.05, 2.2, 0.02, materials.black, [0, yaw, 0]);
            }
        } else if (oddity === 3) {
            const a = sideAt(820, 10, 24), yaw = yawAt(4), y = 19 + random(index + 5) * 6;
            block(a.x, y, a.z, 6, 4.5, 5.5, materials.wood, [0, yaw, 0]);
            block(a.x, y - 3.8, a.z, 4.6, 3, 4.6, materials.roof, [Math.PI, yaw + 0.78, 0], roofGeometry);
            for (let w = -1; w <= 1; w += 2) block(a.x + Math.cos(yaw) * w * 1.5, y + 0.6, a.z - Math.sin(yaw) * w * 1.5, 1, 1.3, 5.62, materials.black, [0, yaw, 0]);
            block(a.x + 1.2, y - 5.4, a.z, 0.7, 2.2, 0.7, materials.dark, [Math.PI, yaw, 0]);
            block(a.x, y + 2.35, a.z, 6.6, 0.25, 6.1, materials.dark, [0, yaw, 0]);
        } else if (oddity === 4) {
            const side = random(index * 3 + 9) < 0.5 ? -1 : 1, startAt = 6 + random(index + 2) * Math.max(1, s.length - 14);
            const o = clearOfPier(at(startAt, side * 7.5).x, at(startAt, side * 7.5).z, 1.5), ox = -s.dz * side, oz = s.dx * side;
            for (let k = 0; k < 70; k++) {
                const u = k / 69, dist = u * 24, h = -0.2 + 22 * Math.pow(u, 2.3);
                const slope = Math.atan(22 * 2.3 * Math.pow(Math.max(u, 0.001), 1.3) / 24);
                const x = o.x + ox * dist, z = o.z + oz * dist;
                const yaw = Math.atan2(ox, oz);
                block(x, h, z, 2.4, 0.16, 0.32, k % 4 ? materials.wood : materials.pale, [-slope, yaw, 0]);
                if (k < 14 && k % 3 === 0) block(x, (h - 2.6) / 2, z, 0.18, h + 2.6, 0.18, materials.dark);
            }
        }
        // Rocks along the shore, built with their stretch so they never jump around.
        if (["harbor", "exposed", "cliffs", "wrecks", "village"].includes(area))
            for (let i = 0; i < 26; i++) {
                const a = sideAt(1300 + i, 8, 32), r = 1 + random(index * 3 + i) * 3, rz = r * (0.8 + random(i + 2) * 0.8);
                const c = clearOfPier(a.x, a.z, Math.max(r, rz) * 1.1 + 0.9);
                const rh = 1 + random(i + 1) * 3;
                block(c.x, water + rh * 0.3, c.z, r, rh, rz, rockMaterial, [random(i) * 0.12, random(i + 2) * 6, random(i + 6) * 0.12], rockGeometry);
            }
        // Rot streaks, missing siding and fallen timber break the regular facades.
        for(let i=0;i<32;i++) {
            const a=at(3+random(index*79+i)* (s.length-6),(i%2?1:-1)*(4.5+random(i+22)*3));
            const safe=clearOfPier(a.x,a.z,.5);
            block(safe.x,water+.04,safe.z,.14,.1,1+random(i)*2,materials.dark,[0,random(i)*6,0]);
        }
        // Rocks and wind-bent coastal trees remain outside a generous route corridor.
        const trees = [];
        // Trees with distinct silhouettes that hold up at low resolution. Each district
        // draws from its own mix, so its tree line has a character of its own.
        const TREE_MIX = {
            harbor: ["fir", "fir", "birch", "shrub", "broadleaf"],
            village: ["broadleaf", "willow", "birch", "fir", "shrub"],
            exposed: ["pine", "snag", "shrub", "pine", "fir"],
            cliffs: ["pine", "pine", "fir", "snag"],
            swamp: ["cypress", "cypress", "willow", "snag"],
            breakers: ["snag", "shrub"],
            shallows: ["snag"],
            lighthouse: ["shrub", "shrub", "snag"],
        };
        const CROWN = { fir: 1.95, pine: 2.5, birch: 1.6, willow: 3.1, snag: 1.7, shrub: 1.5, broadleaf: 2.6, cypress: 3.4 };
        const treeCount = index === 0 ? 0 : { swamp: 30, harbor: 16, village: 22, exposed: 12, cliffs: 10, breakers: 4, shallows: 2, lighthouse: 8 }[area] ?? 0;
        for (let i = 0; i < treeCount; i++) {
            const a = at(random(i + index * 51) * s.length, (i % 2 ? 1 : -1) * (4.5 + random(i + index) * 12));
            const size = 0.75 + random(i * 5 + index) * 0.75;
            const mix = TREE_MIX[area] || TREE_MIX.harbor;
            const kind = mix[Math.floor(random(i * 7 + index) * mix.length)];
            // Clear by the widest part of the crown, so nothing hangs over the walk.
            const safe = clearOfPier(a.x, a.z, CROWN[kind] * size + 0.4);
            const tree = new THREE.Group();
            tree.position.set(safe.x, water - 0.2, safe.z);
            tree.rotation.y = random(i * 3 + index) * 6;
            // Wind-bent trees out on the exposed reach and the cliffs.
            if (area === "exposed" || area === "cliffs") tree.rotation.x = 0.08 + random(i + 3) * 0.12;
            tree.scale.setScalar(size);
            group.add(tree);
            const part = (geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
                const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); tree.add(m);
            };
            const r1 = (k) => random(i * 13 + index * 7 + k);
            // A limb from one point to another in the tree's own space, so foliage always hangs off wood.
            const limb = (x0, y0, z0, x1, y1, z1, thick, mat = materials.dark) => {
                const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = d.length();
                const m = new THREE.Mesh(cube, mat);
                m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
                m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                m.scale.set(thick, len + thick, thick);
                tree.add(m);
            };
            if (kind === "fir") {
                // Tiers of drooping branch blades radiating from the trunk: a ragged, saw-toothed outline.
                const height = 6 + r1(1) * 4, tiers = 6 + Math.floor(r1(2) * 3);
                part(cube, materials.dark, 0, height / 2, 0, 0.22, height, 0.22);
                for (let t = 0; t < tiers; t++) {
                    const u = t / tiers, r = 1.8 * (1 - u) + 0.3, y = 1.4 + u * (height - 1.6);
                    const blades = 7 - Math.floor(u * 3);
                    for (let k = 0; k < blades; k++) {
                        const ang = (k / blades) * Math.PI * 2 + t * 0.45 + r1(k + 10) * 0.3;
                        const len = r * (0.8 + r1(k + t * 7) * 0.4);
                        part(cube, (t + k) % 3 ? materials.dark : materials.roof, Math.cos(ang) * len / 2, y, -Math.sin(ang) * len / 2, len, 0.16, 0.35 + r * 0.25, 0, ang, -0.42);
                    }
                }
                part(pineGeometry, materials.dark, 0, height + 0.3, 0, 0.25, 1.2, 0.25);
            } else if (kind === "pine") {
                // A tall, slightly crooked bare trunk; limbs fan out at the top into a flat dark crown.
                const height = 8 + r1(1) * 4, kx = 0.3 + r1(2) * 0.3;
                limb(0, 0, 0, kx, height * 0.6, 0, 0.3);
                limb(kx, height * 0.6, 0, 0.1, height, 0, 0.24);
                for (let k = 0; k < 6; k++) {
                    const ang = k * 1.05 + r1(k) * 0.5, rr = 1 + r1(k + 9) * 0.7, y = height - 0.4 + r1(k + 3) * 0.6;
                    const ex = 0.1 + Math.cos(ang) * rr, ez = Math.sin(ang) * rr;
                    limb(0.1, height - 1.2, 0, ex, y, ez, 0.1);
                    part(rockGeometry, k % 2 ? materials.roof : materials.dark, ex, y + 0.15, ez, 1.35, 0.5, 1.2, 0, ang, 0);
                }
                part(rockGeometry, materials.dark, 0.1, height + 0.35, 0, 1.6, 0.6, 1.5);
            } else if (kind === "birch") {
                // Pale twin stems; small branches each end in a dense clump of leaves.
                for (let st = 0; st < 2; st++) {
                    const height = 6 + r1(st + 4) * 3, bx = st * 0.5, tx = bx + (st ? 0.5 : -0.35);
                    limb(bx, 0, 0, tx, height, 0, 0.14, materials.pale);
                    for (let k = 0; k < 4; k++) {
                        const u = 0.55 + k * 0.12, ang = k * 2.2 + st * 1.3;
                        const sx = bx + (tx - bx) * u, sy = height * u, rr = 0.7 + r1(k + st * 5) * 0.4;
                        const ex = sx + Math.cos(ang) * rr, ey = sy + 0.5, ez = Math.sin(ang) * rr;
                        limb(sx, sy, 0, ex, ey, ez, 0.06, materials.pale);
                        part(rockGeometry, k % 2 ? materials.roof : materials.dark, ex, ey + 0.15, ez, 0.85, 0.7, 0.85);
                        part(rockGeometry, materials.dark, ex * 0.7 + sx * 0.3, ey - 0.2, ez * 0.7, 0.6, 0.5, 0.6);
                    }
                    part(rockGeometry, materials.roof, tx, height + 0.2, 0, 0.9, 1, 0.9);
                }
            } else if (kind === "willow") {
                // A round crown with long strands hanging almost to the water.
                part(cube, materials.dark, 0, 2.3, 0, 0.45, 4.6, 0.45, 0, 0, 0.06);
                part(rockGeometry, materials.dark, 0, 4.8, 0, 2.4, 1.3, 2.4);
                part(rockGeometry, materials.roof, 0.4, 5.5, 0.2, 1.6, 0.9, 1.6);
                for (let k = 0; k < 22; k++) {
                    const ang = (k / 22) * Math.PI * 2, rr = 1.7 + r1(k) * 0.6, len = 2.4 + r1(k + 30) * 1.6;
                    part(cube, k % 3 ? vineMaterial : materials.rope, Math.cos(ang) * rr, 4.5 - len / 2, Math.sin(ang) * rr, 0.08, len, 0.08);
                }
            } else if (kind === "snag") {
                // A dead tree: a broken trunk and a few bare, forked limbs growing out of it.
                const height = 4 + r1(1) * 4, tx = (r1(2) - 0.5) * 0.6;
                limb(0, 0, 0, tx, height, 0, 0.3);
                for (let k = 0; k < 4; k++) {
                    const ang = k * 1.7 + r1(k) * 1.2, u = 0.45 + k * 0.13, len = 1.2 + r1(k + 5) * 1.3;
                    const sx = tx * u, sy = height * u, ex = sx + Math.cos(ang) * len, ey = sy + len * 0.7, ez = Math.sin(ang) * len;
                    limb(sx, sy, 0, ex, ey, ez, 0.1);
                    limb(ex, ey, ez, ex + Math.cos(ang + 0.7) * 0.6, ey + 0.5, ez + Math.sin(ang + 0.7) * 0.6, 0.06);
                }
            } else if (kind === "shrub") {
                for (let k = 0; k < 4; k++) {
                    const ang = k * 1.6 + r1(k), rr = k ? 0.7 : 0;
                    part(rockGeometry, k % 2 ? materials.roof : materials.dark, Math.cos(ang) * rr, 0.9 + r1(k + 4) * 0.5, Math.sin(ang) * rr, 1 + r1(k + 8) * 0.4, 0.8, 1);
                }
            } else if (kind === "broadleaf") {
                // A short trunk splitting into limbs, each carrying a mass of leaves; the masses overlap.
                limb(0, 0, 0, 0, 3.4, 0, 0.34);
                for (let k = 0; k < 6; k++) {
                    const ang = k * 1.05 + r1(k), rr = 0.9 + r1(k + 2) * 0.6, y = 4.3 + r1(k + 5) * 0.8;
                    const ex = Math.cos(ang) * rr, ez = Math.sin(ang) * rr;
                    limb(0, 3.2, 0, ex, y, ez, 0.14);
                    part(rockGeometry, k % 2 ? materials.roof : materials.dark, ex, y + 0.2, ez, 1.35 + r1(k + 7) * 0.4, 1.05, 1.35 + r1(k + 9) * 0.4);
                }
                part(rockGeometry, materials.dark, 0, 5.3, 0, 1.6, 1.2, 1.6);
            } else {
                part(pineGeometry, materials.dark, 0, 0.6, 0, 0.7, 1.8, 0.7);
                part(cube, materials.dark, 0, 3.6, 0, 0.32, 6, 0.32);
                for (let k = 0; k < 3; k++) {
                    const ang = k * 2.1 + r1(k) * 2, rr = 0.6 + k * 0.3;
                    part(rockGeometry, k % 2 ? materials.roof : materials.dark, Math.cos(ang) * rr, 6.2 + k * 0.5, Math.sin(ang) * rr, 2.2, 0.55, 2);
                    for (let m = 0; m < 3; m++) part(cube, materials.rope, Math.cos(ang) * rr + (m - 1) * 0.6, 5.2 + k * 0.5, Math.sin(ang) * rr + (m - 1) * 0.3, 0.06, 1.6 + r1(m + k) * 0.8, 0.06);
                }
            }
            trees.push(tree);
        }
        if (swamp) {
            const pads = new THREE.InstancedMesh(
                padGeometry,
                materials.wood,
                80,
            );
            const roots = new THREE.InstancedMesh(cube, materials.dark, 100),
                o = new THREE.Object3D();
            for (let i = 0; i < 100; i++) {
                const a = at(
                    random(i + index * 83) * s.length,
                    (i % 2 ? 1 : -1) * (3.5 + random(i + index) * 10),
                );
                const safe = clearOfPier(a.x, a.z, 0.6);
                o.position.set(safe.x, -0.5, safe.z);
                o.rotation.set(0, random(i) * 6, (random(i + 3) - 0.5) * 0.6);
                o.scale.set(0.09, 1.5 + random(i + 41) * 1.8, 0.09);
                o.updateMatrix();
                roots.setMatrixAt(i, o.matrix);
                if (i < 80) {
                    o.position.y = -0.86;
                    o.rotation.set(-Math.PI / 2, 0, random(i) * 6);
                    o.scale.setScalar(0.2 + random(i + 20) * 0.45);
                    o.updateMatrix();
                    pads.setMatrixAt(i, o.matrix);
                }
            }
            group.add(pads, roots);
        }
        const lamp = at(s.length - 4, s.narrow ? 0.45 : 1.7), ly = ground(s.length - 4);
        block(lamp.x, ly + 1.6, lamp.z, 0.12, 3.2, 0.12, materials.dark);
        block(lamp.x, ly + 3, lamp.z, 0.42, 0.6, 0.42, glow);
        block(lamp.x, ly + 3.35, lamp.z, 0.6, 0.12, 0.6, materials.dark);
        for (const { geom, mat, list: transforms } of batches.values()) {
            const mesh = new THREE.InstancedMesh(geom, mat, transforms.length);
            transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
            mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh);
        }
        const light = new THREE.PointLight(0xffffff, 28, 12, 2);
        light.position.set(lamp.x, ly + 2.7, lamp.z);
        group.add(light);
        // Keep the dense canopy cheap: a handful of instanced draws per district.
        const foliage = [];
        const foliageGroups = new Map();
        for(const tree of trees) {
            tree.updateMatrix();group.remove(tree);
            for(const child of tree.children) {
                child.updateMatrix();const key=child.geometry.uuid+child.material.uuid;
                if(!foliageGroups.has(key))foliageGroups.set(key,{geometry:child.geometry,material:child.material,items:[]});
                foliageGroups.get(key).items.push({tree,matrix:child.matrix.clone()});
            }
        }
        for(const batch of foliageGroups.values()) {
            const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length);
            mesh.frustumCulled=false;group.add(mesh);foliage.push({...batch,mesh});
        }
        // Reserve melt slots for this stretch; they start when the player gets close.
        const slots = [];
        for (const melt of melts) {
            const slot = freeSlots.pop();
            if (slot === undefined) break;
            dreamUniforms.meltRect.value[slot].set(...melt.rect);
            dreamUniforms.meltParam.value[slot].set(1e9, melt.base, melt.strength, melt.spread);
            slots.push({ slot, melt });
        }
        // The dream bend moves vertices far from their original bounds, so
        // frustum culling would drop things that are still on screen.
        group.traverse((o) => { o.frustumCulled = false; });
        const crumbleSlots = [];
        for (const c of crumbles) {
            const slot = freeCrumbles.pop();
            if (slot === undefined) break;
            dreamUniforms.crumbleRect.value[slot].set(...c.rect);
            dreamUniforms.crumbleParam.value[slot].set(1e9, c.base, c.top, 0);
            dreamUniforms.crumbleAway.value[slot].set(c.away[0], c.away[1], 0, 0);
            crumbleSlots.push({ slot, c });
        }
        // In the mirror shallows the world is reflected for real: the stretch is drawn
        // again upside down under the water, which is dithered thin so it shows through.
        let reflection = null;
        if (area === "shallows") {
            reflection = new THREE.Group();
            for (const child of group.children) {
                if (child.isInstancedMesh) { const copy = new THREE.InstancedMesh(child.geometry, child.material, child.count); copy.instanceMatrix = child.instanceMatrix; copy.frustumCulled = false; reflection.add(copy); }
                else if (child.isMesh) { const copy = child.clone(); copy.frustumCulled = false; reflection.add(copy); }
            }
            reflection.scale.y = -1;
            reflection.position.y = water * 2;
            scene.add(reflection);
        }
        chunks.set(s, { group, trees, foliage, debris, slots, crumbleSlots, seaRocks, chunkLamps, spinners, reflection, index, collapseAt: null });
    }
    return {
        // 0 in open, bright districts; 1 in the darkest woods.
        // The world above: during a sky event each stretch's scenery (not its
        // lights) is drawn again upside down, high overhead, sinking into view.
        setMirror(amount) {
            for (const chunk of chunks.values()) {
                if (amount <= 0.001) { if (chunk.mirror) chunk.mirror.visible = false; continue; }
                if (!chunk.mirror) {
                    const m = new THREE.Group();
                    for (const child of chunk.group.children) {
                        if (child.isInstancedMesh) {
                            const copy = new THREE.InstancedMesh(child.geometry, child.material, child.count);
                            copy.instanceMatrix = child.instanceMatrix;
                            copy.frustumCulled = false;
                            m.add(copy);
                        } else if (child.isMesh) {
                            const copy = child.clone();
                            copy.frustumCulled = false;
                            m.add(copy);
                        }
                    }
                    m.scale.y = -1;
                    scene.add(m);
                    chunk.mirror = m;
                }
                chunk.mirror.visible = true;
                chunk.mirror.position.y = MIRROR_HEIGHT * 2 + (1 - amount) * 140;
            }
        },
        // Every rock the sea is currently breaking against.
        lanterns() { const all = []; for (const e of extras.values()) all.push(...(e.lamps || [])); for (const c of chunks.values()) all.push(...c.chunkLamps); return all; },
        seaRocks() { const all = []; for (const chunk of chunks.values()) all.push(...chunk.seaRocks); return all; },
        setDarkness(d) { hazardLight.emissive.setScalar(0.08 + 0.2 * d); hazardDark.emissive.setScalar(0.03 + 0.08 * d); },
        update(index, time, run, meltNow = false) {
            ensureRoute(index);
            // Everything is keyed by the stretch itself, so choosing a fork (or any
            // route change) only adds or removes the stretches that really changed.
            const wanted = new Map();
            for (let i = Math.max(0, index - 2); i <= index + 4; i++) {
                const seg = route[i];
                if (!seg) continue;
                wanted.set(seg, i);
                // An undecided fork shows both branches, and nothing beyond either,
                // so choosing never makes anything already visible disappear.
                if (seg.fork && seg.alt && i >= index) {
                    wanted.set(seg.alt, i + 1);
                    if (!seg.decided) { if (route[i + 1]) wanted.set(route[i + 1], i + 1); break; }
                }
            }
            for (const [seg, i] of wanted) if (i >= index - 1 && !extras.has(seg)) {
                const s=seg,group=new THREE.Group();scene.add(group);
                const add=(p,lane,y,w,h,d,mat=materials.dark)=>{
                    const mesh=new THREE.Mesh(cube,mat);mesh.position.set(s.x+s.dx*p-s.dz*lane,y+groundOf(s,p),s.z+s.dz*p+s.dx*lane);
                    mesh.scale.set(s.dx?d:w,h,s.dx?w:d);group.add(mesh);return mesh;
                };
                // A warning lamp on a short post, on the outer edge a few metres ahead of trouble.
                // Every lamp here also lights its surroundings (see lanternGlowAt in dream.js).
                const lamps=[];
                const lamp=(mesh,strength)=>{lamps.push({p:mesh.position.clone(),strength});return mesh;};
                const warn=(p,side)=>{
                    if(p<1)return;
                    const edge=s.narrow?.45:1.85;
                    add(p,side*edge,.75,.1,1.5,.1,hazardDark);
                    lamp(add(p,side*edge,1.6,.3,.34,.3,beacon),1.8);
                    add(p,side*edge,1.82,.42,.08,.42,hazardDark);
                };
                const swings=[];
                const ar=s.area;
                const lit=(p,lane,y)=>{lamp(add(p,lane,y,.18,.22,.18,lanternGlow),2);add(p,lane,y+.14,.24,.05,.24,hazardDark);};
                for(const h of s.hazards) {
                    const half=s.narrow?.7:1.9;
                    if(h.type==='beam') {
                        // Duck: something across the walk at head height (shape depends on the district).
                        const span=s.narrow?1.4:3.8;
                        if(ar==='forest'||ar==='swamp'){
                            add(h.at,0,1.45,span+1.2,.55,.55,hazardDark);
                            for(let k=-2;k<=2;k++)add(h.at,k*.8,1.72,.12,.25,.12,hazardDark);
                        } else if(ar==='canal'||ar==='village'){
                            add(h.at,0,1.95,span,.04,.04,hazardDark);
                            for(let k=-3;k<=3;k++)if(Math.abs(k*.5)<span/2-.2)add(h.at,k*.5,1.55,.42,.75,.03,k%2?hazardLight:hazardDark);
                        } else {
                            add(h.at,0,1.4,span,.48,.5,hazardLight);
                            for(let k=-3;k<=3;k++)if(Math.abs(k*.45)<span/2)add(h.at-.27,k*.45,1.4,.18,.32,.03,hazardDark);
                        }
                        // Lanterns sit on the posts at both ends, never in the space you duck through.
                        for(const side of [-1,1]){add(h.at,side*(span/2-.15),s.narrow?-.6:.8,.16,s.narrow?4:1.6,.18,hazardDark);lit(h.at,side*(span/2-.15),1.86);}
                    } else if(h.type==='cargo') {
                        // Dodge or jump: something heavy in one lane.
                        if(['breakers','cliffs','lighthouse','exposed'].includes(ar)){
                            const m=add(h.at,h.lane,.5,1.1,1,1.1,hazardLight);m.geometry=rockGeometry;m.scale.multiplyScalar(.55);m.rotation.y=h.at;
                        } else if(ar==='forest'||ar==='swamp'||ar==='marsh'){
                            const m=add(h.at,h.lane,.5,.9,1,.9,hazardLight);m.geometry=lighthouseGeometry;
                            for(let k=0;k<4;k++){const r=add(h.at,h.lane,.08,.18,.16,.7,hazardDark);r.rotation.y=k*1.57;}
                        } else if(ar==='wrecks'||ar==='harbor'||ar==='sunken'){
                            for(const [dl,y] of [[-.25,.35],[.25,.35],[0,1]]){const m=add(h.at,h.lane+dl,y,.55,.7,.55,hazardLight);m.geometry=lighthouseGeometry;}
                        } else {
                            add(h.at,h.lane,.55,1.05,1.1,1.05,hazardLight);
                            for(const y of [.16,.9])add(h.at,h.lane,y,1.1,.07,1.1,hazardDark);
                        }
                        lit(h.at,h.lane,1.25);
                    } else if(h.type==='log') {
                        // Jump: something low right across the walk.
                        if(ar==='forest'||ar==='swamp'||ar==='marsh'||ar==='shallows'){
                            const m=add(h.at,0,.25,half*2+.6,.45,.45,hazardLight);
                            for(let k=0;k<3;k++)add(h.at+.1,-half+k*1.2,.42,.12,.3,.12,hazardDark);
                        } else if(ar==='canal'||ar==='harbor'||ar==='sunken'||ar==='wrecks'){
                            // A low painted barrier: two rails with bold stripes, clearly something to jump.
                            add(h.at,0,.48,half*2,.14,.12,hazardLight);add(h.at,0,.2,half*2,.1,.12,hazardLight);
                            for(let k=-4;k<=4;k++)if(Math.abs(k*.45)<half)add(h.at-.07,k*.45,.48,.2,.15,.02,hazardDark);
                        } else {
                            add(h.at,0,.35,half*2,.12,.1,hazardLight);add(h.at,0,.12,half*2,.08,.1,hazardDark);
                            for(let k=-2;k<=2;k++)if(Math.abs(k*.9)<half)add(h.at,k*.9,.25,.1,.5,.1,hazardDark);
                        }
                        for(const side of [-1,1]){add(h.at,side*half,.45,.12,.9,.12,hazardDark);lit(h.at,side*half,.98);}
                    } else if(h.type==='wall') {
                        // Dodge: two lanes blocked, one open.
                        for(const l of [-.9,0,.9]){
                            if(Math.abs(l-h.open)<.1)continue;
                            if(['breakers','cliffs','lighthouse','exposed'].includes(ar)){const m=add(h.at,l,.8,1.2,1.6,1.1,hazardLight);m.geometry=rockGeometry;m.scale.multiplyScalar(.6);m.rotation.y=l*3;}
                            else{add(h.at,l,.5,.95,.95,.95,hazardLight);add(h.at,l+.05,1.35,.85,.75,.85,hazardLight);add(h.at,l,.95,1,.06,1,hazardDark);}
                        }
                        const lamps2=[-.9,0,.9].filter(l=>Math.abs(l-h.open)>.1);
                        lit(h.at,lamps2[0],1.9);
                    } else if(h.type==='swing') {
                        // Duck (or time it): a weight swinging across the walk on a gantry.
                        for(const side of [-1,1])add(h.at,side*(half+.1),1.8,.16,3.6,.16,hazardDark);
                        add(h.at,0,3.6,half*2+.4,.16,.16,hazardDark);
                        const g=new THREE.Group();
                        g.position.set(s.x+s.dx*h.at,groundOf(s,h.at)+3.55,s.z+s.dz*h.at);
                        const rope=new THREE.Mesh(cube,hazardDark);rope.scale.set(.04,2.1,.04);rope.position.y=-1.05;g.add(rope);
                        const weight=new THREE.Mesh(ar==='sunken'||ar==='village'?pineGeometry:rockGeometry,hazardLight);
                        weight.scale.set(.32,ar==='sunken'||ar==='village'?.5:.3,.32);weight.position.y=-2.25;g.add(weight);
                        const glowBit=new THREE.Mesh(cube,lanternGlow);glowBit.scale.set(.14,.14,.14);glowBit.position.y=-2.55;g.add(glowBit);
                        group.add(g);swings.push({g,h,s});
                        lit(h.at,half+.1,3.75);
                    }
                    warn(h.at-6,(h.type==='wall'?h.open:h.lane)>.1?-1:1);
                }
                const hole=s.gap;
                if(hole){
                    warn(hole.start-5,-1);warn(hole.start-5,1);
                    // Pale painted lips on both broken edges.
                    for(const p of [hole.start-.12,hole.end+.12])add(p,0,.11,s.narrow?.5:3.5,.04,.2,hazardLight);
                }
                if(s.fork) {
                    for(const side of [-1,1]) {
                        add(s.length+1.8,side*3,1.4,.12,2.8,.12);
                        const sign=add(s.length+1.8,side*3,2.6,1.5,.5,.12,materials.pale);
                        sign.rotation.z=side*.12;
                    }
                }
                group.traverse((o)=>{o.frustumCulled=false;});
                extras.set(s,{group,lamps,swings});
            }
            for(const [seg,chunk] of extras)if(!wanted.has(seg)){scene.remove(chunk.group);extras.delete(seg);}
            // Swinging weights follow the same clock as the collision test.
            for(const e of extras.values())for(const {g,h,s:seg} of e.swings||[]){
                const th=Math.asin(Math.max(-.99,Math.min(.99,swingLane(h,run?.clock??time)/2.25)));
                if(seg.dz){g.rotation.set(0,0,-seg.dz*th);}else{g.rotation.set(-seg.dx*th,0,0);}
            }

            for (const [seg, i] of wanted) if (i >= index - 1 && !chunks.has(seg)) build(i, seg);
            for (const [seg, chunk] of chunks) {
                if (!wanted.has(seg)) {
                    release(chunk);
                    if (chunk.mirror) scene.remove(chunk.mirror);
                    if (chunk.reflection) scene.remove(chunk.reflection);
                    scene.remove(chunk.group);
                    chunk.group.traverse((o) => {
                        if (o.isInstancedMesh) o.dispose();
                    });
                    chunks.delete(seg);
                } else {
                    const i = wanted.get(seg);
                    for (const beam of chunk.spinners) beam.rotation.y = time * 0.55;
                    if(i===index && chunk.collapseAt===null)chunk.collapseAt=time;
                    // Houses ahead crumble into pixels during a crumble event, and now and
                    // then on their own once the run is deep enough.
                    for (const entry of chunk.crumbleSlots) {
                        if (entry.started) continue;
                        const deepChance = strangeness(i) * 0.5;
                        const go = (meltNow && i >= index && i <= index + 2) ||
                            (i === index + 1 && entry.roll === undefined && (entry.roll = Math.random()) < deepChance);
                        if (go) {
                            entry.started = true;
                            dreamUniforms.crumbleParam.value[entry.slot].x = time + 0.5 + entry.c.delay;
                        }
                    }
                    for (const entry of chunk.slots) {
                        if (entry.started) continue;
                        if (entry.melt.inside ? i === index : meltNow && i >= index && i <= index + 2) {
                            entry.started = true;
                            dreamUniforms.meltParam.value[entry.slot].x = time + (entry.melt.inside ? 0.4 : 0.8 + (entry.melt.delay || 0));
                        }
                    }
                    if(chunk.collapseAt!==null)for(const fragment of chunk.debris) {
                        const t=Math.max(0,time-chunk.collapseAt-1.5-fragment.delay);
                        fragment.piece.position.y=fragment.origin.y-3*t*t;
                        fragment.piece.rotation.x=t*.8;
                        fragment.piece.visible=fragment.piece.position.y> -2;
                    }
                    chunk.trees.forEach((tree, j) => {
                        tree.rotation.z = Math.sin(time * 1.7 + j) * 0.035;
                        tree.updateMatrix();
                    });
                    const matrix=new THREE.Matrix4();
                    for(const batch of chunk.foliage) {
                        batch.items.forEach((item,n)=>batch.mesh.setMatrixAt(n,matrix.multiplyMatrices(item.tree.matrix,item.matrix)));
                        batch.mesh.instanceMatrix.needsUpdate=true;
                    }
                }
            }
        },
    };
}
