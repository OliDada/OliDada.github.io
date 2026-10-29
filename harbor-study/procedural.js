import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { clearOfPier, railIsClear } from "./clearance.mjs";
import { route, ensureRoute, gapFor, random, areaFor, isFork, hazardsFor, routeRevision, groundAt, slopeAt } from "./motion.mjs";
import { dreamUniforms, MELTS } from "./dream.js";
export function createDistricts(scene, materials) {
    const chunks = new Map(),
        cube = new THREE.BoxGeometry(1, 1, 1);
    const roofGeometry = new THREE.ConeGeometry(1, 1, 4),
        swampCrown = new THREE.IcosahedronGeometry(1, 0);
    const padGeometry = new THREE.CircleGeometry(1, 8);
    const glow = new THREE.MeshBasicMaterial({ color: 0xa9a9a9 });
    // Moss and reeds sway from their roots (see the VINE hook in dream.js).
    const vineMaterial = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    vineMaterial.defines = { VINE: "" };
    const reedMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
    reedMaterial.defines = { VINE: "", REED: "" };
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
    function release(chunk) {
        for (const { slot } of chunk.slots || []) {
            dreamUniforms.meltRect.value[slot].set(0, 0, 0, 0);
            dreamUniforms.meltParam.value[slot].x = 1e9;
            freeSlots.push(slot);
        }
    }
    function build(index) {
        const s = route[index],
            hole = gapFor(index),
            swamp = areaFor(index) === "swamp",
            group = new THREE.Group();
        scene.add(group);
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
        const ground = (p) => groundAt(index, p);
        // Tilt a block so it lies along the slope of a ramp.
        const tilt = (p) => {
            const a = Math.atan(slopeAt(index, p));
            return s.dz ? [-s.dz * a, 0, 0] : [0, 0, s.dx * a];
        };
        const along = (len, across) => (s.dx ? [len, across] : [across, len]);
        const inCover = (p) => s.cover && p > s.cover.start - 0.5 && p < s.cover.end + 0.5;
        const melts = [];
        if (!s.narrow) {
            for (let p = 0; p < s.length; p += 0.55) {
                if (hole && p + 0.55 > hole.start && p < hole.end) continue;
                const a = at(p, 0), y = ground(p), [w, d] = along(0.51, 3.6);
                block(a.x, y, a.z, w, 0.2, d, random(index * 977 + p * 10) > 0.45 ? materials.wood : materials.pale, tilt(p));
                for (const side of [-1, 1]) {
                    const b = at(p, side * 1.4), [gw, gd] = along(0.65, 0.025);
                    block(b.x, y + 0.11, b.z, gw, 0.01, gd, materials.dark, tilt(p));
                }
            }
        } else {
            // A single crooked beam: the walk narrows to one board's width.
            for (let p = 0; p < s.length; p += 1.1) {
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
        // Splintered board ends either side of a gap.
        if (hole)
            for (const edge of [hole.start, hole.end])
                for (let k = 0; k < (s.narrow ? 2 : 6); k++) {
                    const lane = s.narrow ? (k - 0.5) * 0.2 : -1.5 + k * 0.6;
                    const dir = edge === hole.start ? 1 : -1;
                    const a = at(edge + dir * random(index + k) * 0.45, lane);
                    const [w, d] = along(0.5 + random(k + index) * 0.4, s.narrow ? 0.22 : 0.48);
                    block(a.x, ground(edge) - 0.05 - random(k * 3 + index) * 0.25, a.z, w, 0.18, d, materials.wood, [(random(k) - 0.5) * 0.5, (random(k + 4) - 0.5) * 0.6, (random(k + 9) - 0.5) * 0.4]);
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
            melts.push({ rect: [mid.x, mid.z, hx, hz], base: top + 0.6, strength: 0.42, spread: 0, inside: true });
        } else if (s.cover?.type === "arches") {
            const { start, end } = s.cover, span = s.narrow ? 1.1 : 2.15;
            for (let p = start; p <= end; p += 4.6) {
                const y = ground(p), arch = [];
                for (const side of [-1, 1]) {
                    const a = at(p, side * span);
                    const foot = s.narrow ? -2.7 : y;
                    block(a.x, (foot + y + 2.4) / 2, a.z, 0.42, y + 2.4 - foot, 0.42, materials.pale);
                }
                for (let k = 0; k <= 8; k++) {
                    const angle = Math.PI * (k / 8), a = at(p, Math.cos(angle) * span);
                    const [w, d] = along(0.44, 0.62);
                    block(a.x, y + 2.4 + Math.sin(angle) * span, a.z, w, 0.36, d, materials.pale, s.dz ? [0, 0, angle - Math.PI / 2] : [-(angle - Math.PI / 2) * s.dx, 0, 0]);
                }
                if (random(index * 59 + p) < 0.35) {
                    const a = at(p, 0), [hx, hz] = along(0.5, span + 0.5);
                    melts.push({ rect: [a.x, a.z, hx, hz], base: y + 1.4, strength: 0.6, spread: 0, inside: true });
                }
            }
        }
        // Distinct timber houses with courses of siding, divided windows, roofs and chimneys.
        const area = areaFor(index);
        const houseCount = index === 0 ? 0 : swamp || area === "forest" ? 1 : area === "exposed" ? 2 : area === "harbor" ? 3 : 4;
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
            if (random(index * 211 + i * 5) < (area === "village" ? 0.6 : 0.4))
                melts.push({ rect: [a.x, a.z, w / 2 + 0.6, d / 2 + 0.6], base: -1.3, strength: 1, spread: 0.32, delay: random(index * 7 + i) * 3 });
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
            // The deep woods: huge leaning trunks close to the walk, buttress roots,
            // a canopy that closes overhead, moss curtains and drifting spores.
            for (let i = 0; i < 78; i++) {
                const r = 0.35 + random(index * 61 + i) * 0.9, a = sideAt(i, 2.9 + r, 16);
                const c = clearOfPier(a.x, a.z, r + 0.2), h = 15 + random(i * 7 + index) * 11;
                const lean = [(random(i + 3) - 0.5) * 0.12, random(i) * 6, (random(i + 5) - 0.5) * 0.12];
                block(c.x, h / 2 - 2.6, c.z, r, h, r * (0.8 + random(i + 1) * 0.4), materials.dark, lean);
                for (let b = 0; b < 4; b++) {
                    const ang = b * 1.57 + random(i + b) * 0.8;
                    block(c.x + Math.cos(ang) * r * 0.9, -0.9, c.z + Math.sin(ang) * r * 0.9, r * 0.25, 2.6, r * 1.6, materials.dark, [Math.sin(ang) * 0.7, ang, Math.cos(ang) * 0.7]);
                }
                for (let k = 0; k < 4; k++) {
                    const sz = 2.5 + random(i * 5 + k) * 3.5;
                    block(c.x + (random(i + k * 9) - 0.5) * 4, h - 3 - k * 1.6, c.z + (random(i + k * 11) - 0.5) * 4, sz, sz * 0.45, sz, k % 2 ? materials.roof : materials.dark, [0, random(k + i) * 6, 0], swampCrown);
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
                const a = sideAt(i + 400, 4, 13), c = clearOfPier(a.x, a.z, 3);
                block(c.x, -1.15, c.z, 0.7, 0.7, 7 + random(i) * 5, materials.dark, [0.1, random(i) * 6, (random(i + 1) - 0.5) * 0.3]);
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
        const oddity = index > 0 ? Math.floor(random(index * 131 + 7) * 7) : -1;
        const yawAt = (salt) => random(index * 7 + salt) * Math.PI * 2;
        if (oddity === 0 || oddity === 1) {
            const a = sideAt(800, 7, 15), c = clearOfPier(a.x, a.z, 4), yaw = yawAt(1);
            const fx = Math.sin(yaw), fz = Math.cos(yaw);
            for (let k = 0; k < 15; k++)
                block(c.x + fx * k * 0.45, -1 + k * 0.38, c.z + fz * k * 0.45, 1, 0.12, 0.47, k % 3 ? materials.wood : materials.pale, [0, yaw, 0]);
            for (const side of [-1, 1])
                block(c.x + fx * 3.2 + fz * side * 0.55, 1.7, c.z + fz * 3.2 - fx * side * 0.55, 0.08, 0.1, 7.4, materials.dark, [Math.atan2(0.38, 0.45) * -1, yaw, 0]);
            const tx = c.x + fx * 6.6, tz = c.z + fz * 6.6, ty = -1 + 15 * 0.38;
            for (const side of [-1, 1]) block(tx + fz * side * 0.55, ty + 1.1, tz - fx * side * 0.55, 0.12, 2.2, 0.12, materials.dark, [0, yaw, 0]);
            block(tx, ty + 2.25, tz, 1.25, 0.12, 0.14, materials.dark, [0, yaw, 0]);
            if (oddity === 1) block(tx + fz * 0.3, ty + 1.05, tz - fx * 0.3, 0.95, 2.05, 0.05, materials.wood, [0, yaw + 0.7, 0]);
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
        if (index > 2 && random(index * 151 + 3) < 0.16) {
            for (let p = 0; p < s.length; p += 0.55) {
                const a = at(p, 0), [w, d] = along(0.51, 3.6), y = 16 - ground(p) * 0.3;
                block(a.x, y, a.z, w, 0.2, d, random(p * 9 + index) > 0.45 ? materials.wood : materials.pale);
            }
            for (let p = 0; p <= s.length; p += 3.5)
                for (const side of [-1, 1]) {
                    const a = at(p, side * 1.95), y = 16 - ground(p) * 0.3;
                    block(a.x, y + 1.5, a.z, 0.2, 3, 0.2, materials.dark);
                    block(a.x, y - 0.55, a.z, 0.2, 1.1, 0.2, materials.dark);
                    if (side === 1 && Math.floor(p / 3.5) % 3 === 1) block(a.x, y - 1.6, a.z, 0.42, 0.6, 0.42, glow);
                }
        }
        // Rot streaks, missing siding and fallen timber break the regular facades.
        for(let i=0;i<32;i++) {
            const a=at(3+random(index*79+i)* (s.length-6),(i%2?1:-1)*(4.5+random(i+22)*3));
            const safe=clearOfPier(a.x,a.z,.5);
            block(safe.x,-.25,safe.z,.12,.12,1+random(i)*2,materials.dark,(random(i)-.5)*.7);
        }
        // Rocks and wind-bent coastal trees remain outside a generous route corridor.
        const trees = [];
        for (let i = 0; i < (index === 0 || forest ? 0 : swamp ? 58 : 28); i++) {
            const a = at(
                random(i + index * 51) * s.length,
                (i % 2 ? 1 : -1) * (3.3 + random(i + index) * 9),
            );
            const safe = clearOfPier(a.x, a.z, .65);
            const tree = new THREE.Group();
            tree.position.set(safe.x, -0.7, safe.z);
            group.add(tree);
            const trunk = new THREE.Mesh(cube, materials.dark);
            trunk.scale.set(
                swamp ? 0.38 : 0.15,
                6,
                swamp ? 0.38 : 0.15,
            );
            trunk.position.y = 2.4;
            trunk.rotation.z = (random(i + index) - 0.5) * 0.13;
            tree.add(trunk);
            for (let j = 0; j < (swamp ? 5 : 3); j++) {
                const crown = new THREE.Mesh(
                    swamp ? swampCrown : roofGeometry,
                    swamp
                        ? j % 2
                            ? materials.rope
                            : materials.wood
                        : j % 2
                          ? materials.wood
                          : materials.roof,
                );
                crown.position.set(
                    swamp ? Math.sin(j * 2) * 1.1 : 0,
                    (swamp ? 5.8 : 5) + j * 0.7,
                    swamp ? Math.cos(j * 2) * 1.1 : 0,
                );
                crown.scale.set(
                    swamp ? 2.4 : 1.8 - j * 0.2,
                    swamp ? 0.85 : 2.2,
                    swamp ? 2.2 : 1.8 - j * 0.2,
                );
                tree.add(crown);
                if (swamp) {
                    const moss = new THREE.Mesh(cube, materials.rope);
                    moss.scale.set(0.07, 1.5 + random(j + i) * 1.2, 0.09);
                    moss.position.set(
                        crown.position.x,
                        5.3 + j * 0.4,
                        crown.position.z,
                    );
                    tree.add(moss);
                }
            }
            for(let b=0;b<9;b++) {
                const branch=new THREE.Mesh(cube,materials.dark);
                const angle=b*2.4+random(i)*2;
                branch.position.set(Math.cos(angle)*.7,3.8+b*.27,Math.sin(angle)*.7);
                branch.scale.set(.1,2.4,.12);branch.rotation.set(Math.sin(angle)*.85,0,Math.cos(angle)*.85);tree.add(branch);
                for(let leaf=0;leaf<3;leaf++) {
                    const twig=new THREE.Mesh(swampCrown,leaf%2?materials.roof:materials.wood);
                    twig.position.set(Math.cos(angle)*(1.4+leaf*.25),5+b*.2+leaf*.12,Math.sin(angle)*(1.4+leaf*.25));
                    twig.scale.set(.6,.23,.5);tree.add(twig);
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
        chunks.set(index, { group, trees, foliage, debris, slots, collapseAt: null });
    }
    return {
        update(index, time, run, meltNow = false) {
            ensureRoute(index);
            if(revision !== routeRevision) {
                for(const chunk of [...chunks.values(),...extras.values()]) {
                    release(chunk);scene.remove(chunk.group);chunk.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
                }
                chunks.clear();extras.clear();revision=routeRevision;
            }
            for(let i=Math.max(0,index-1);i<=index+4;i++)if(!extras.has(i)) {
                const s=route[i],group=new THREE.Group();scene.add(group);
                const add=(p,lane,y,w,h,d,mat=materials.dark)=>{
                    const mesh=new THREE.Mesh(cube,mat);mesh.position.set(s.x+s.dx*p-s.dz*lane,y+groundAt(i,p),s.z+s.dz*p+s.dx*lane);
                    mesh.scale.set(s.dx?d:w,h,s.dx?w:d);group.add(mesh);return mesh;
                };
                for(const h of hazardsFor(i)) {
                    if(h.type==='beam') {
                        const span=s.narrow?1.4:3.8;
                        add(h.at,0,1.4,span,.48,.5);
                        for(const side of [-1,1])add(h.at,side*(span/2-.15),s.narrow?-.6:.8,.16,s.narrow?4:1.6,.18);
                        for(let k=-3;k<=3;k++)if(Math.abs(k*.45)<span/2)add(h.at-.27,k*.45,1.4,.18,.32,.03,materials.pale);
                    } else {
                        add(h.at,h.lane,.55,1.05,1.1,1.05,materials.wood);
                        for(const y of [.16,.9])add(h.at,h.lane,y,1.1,.07,1.1,materials.pale);
                    }
                }
                if(isFork(i)) {
                    for(let lane=-9;lane<=9;lane+=.55) {
                        if(Math.abs(lane)<2.2)continue;
                        add(s.length,lane,-.04,.51,.16,3.6,materials.wood);
                    }
                    for(const side of [-1,1]) {
                        add(s.length+1.8,side*3,1.4,.12,2.8,.12);
                        const sign=add(s.length+1.8,side*3,2.6,1.5,.5,.12,materials.pale);
                        sign.rotation.z=side*.12;
                    }
                }
                extras.set(i,{group});
            }
            for(const [i,chunk] of extras)if(i<index-2){scene.remove(chunk.group);extras.delete(i);}


            for (let i = Math.max(0, index - 1); i <= index + 4; i++)
                if (!chunks.has(i)) build(i);
            for (const [i, chunk] of chunks) {
                if (i < index - 2) {
                    release(chunk);
                    scene.remove(chunk.group);
                    chunk.group.traverse((o) => {
                        if (o.isInstancedMesh) o.dispose();
                    });
                    chunks.delete(i);
                } else {
                    if(i===index && chunk.collapseAt===null)chunk.collapseAt=time;
                    // Side houses start pouring away as you approach; covered passages sag once you're inside.
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
