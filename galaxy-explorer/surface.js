// The landing site around a world's signal: atmosphere glow, rocks, plant and
// animal life, and what you collide with on foot.
// Rebuilt whenever you arrive at a world; game.js owns where you are.
import * as THREE from "./vendor/three.module.js";
import { terrainFor } from "./terrain.mjs";
import { buildFlora, plantFootprint } from "./flora-mesh.js";
import { buildFauna } from "./fauna-mesh.js";
import { buildStructures } from "./structures-mesh.js";
import { buildGeology, footprint as rockFootprint } from "./geology-mesh.js";
import { createGroundCover } from "./groundcover.js";
import { addSurfaceDetail } from "./planet-lod.js";

const Y = new THREE.Vector3(0, 1, 0);
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Things you bump into on foot (rocks and plants), kept in a
// coarse spatial grid so each step only checks what is nearby.
const GRID = 10;
function buildGrid(list) {
    const grid = new Map();
    for (const o of list) {
        const k = `${Math.floor(o.p.x / GRID)},${Math.floor(o.p.y / GRID)},${Math.floor(o.p.z / GRID)}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(o);
    }
    return grid;
}
function nearbyIn(obstacleGrid, p) {
    const out = [],
        cx = Math.floor(p.x / GRID),
        cy = Math.floor(p.y / GRID),
        cz = Math.floor(p.z / GRID);
    for (let x = cx - 1; x <= cx + 1; x++)
        for (let y = cy - 1; y <= cy + 1; y++)
            for (let z = cz - 1; z <= cz + 1; z++) {
                const cell = obstacleGrid.get(`${x},${y},${z}`);
                if (cell) out.push(...cell);
            }
    return out;
}

// body: the world; signalNormal/landingNormal: unit vectors of the site and pad;
// surfacePoint(n, offset): point on the ground. Returns the scene group and the
// animated parts game.js drives.
export function buildSurface({ body, radius: RADIUS, signalNormal, landingNormal, surfacePoint, coarse, colonist = null }) {
    let randomState = body.seed;
    const random = () => {
        randomState = (1664525 * randomState + 1013904223) >>> 0;
        return randomState / 4294967296;
    };
    const group = new THREE.Group();
    const obstacles = [];
    // Faceted, vertex-coloured terrain; the same height function drives walking and landing.
    const terrainInfo = terrainFor(body);

    // Atmosphere halo, seen from space as a glowing rim around the world. Close to
    // the ground the sky itself takes on the air's colour (game.js updateAtmosphere),
    // so the halo fades out as you come down, rather than hanging as a band above the
    // horizon while you fly. Airless worlds get none.
    const air = Math.min(1, Math.max(0, (Math.log10(Math.max(body.physics?.pressure ?? 0, 1e-4)) + 1.5) / 2.5));
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.06, 64, 48),
        new THREE.ShaderMaterial({
            uniforms: {
                tint: { value: new THREE.Color(body.atmosphere) },
                strength: { value: 0.2 * (0.5 + 0.7 * air) },
                fadeFrom: { value: RADIUS + 400 },
                fadeTo: { value: RADIUS + 1100 },
            },
            vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
uniform float fadeFrom, fadeTo;
varying vec3 n; varying vec3 v; varying float fade; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz);
fade=smoothstep(fadeFrom,fadeTo,distance(cameraPosition,(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz));
gl_Position=projectionMatrix*p;
#include <logdepthbuf_vertex>
}`,
            fragmentShader: `#include <logdepthbuf_pars_fragment>
varying vec3 n; varying vec3 v; varying float fade; uniform vec3 tint; uniform float strength; void main(){
#include <logdepthbuf_fragment>
float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),4.0);gl_FragColor=vec4(tint,rim*strength*fade);}`,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }),
    );
    atmosphere.visible = air > 0;
    group.add(atmosphere);

    // Instancing keeps surface detail cheap enough for ordinary browser hardware.
    // Rocks are the same stone as the world's cliffs (terrain.mjs rockColor), blended a
    // little with the ground they sit on, with the same close-up detail as bare ground.
    const rockTint = new THREE.Color().setRGB(...terrainInfo.rockColor, THREE.SRGBColorSpace);
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        flatShading: true,
    });
    addSurfaceDetail(rockMaterial, { ground: terrainInfo.ground, airless: terrainInfo.airless, lite: coarse, objects: true });
    const rockCount = coarse ? 500 : 800;
    // Lumpy rather than round: each corner is pushed in or out by a function of its
    // position, so faces that share a corner still meet.
    const rockGeometry = new THREE.IcosahedronGeometry(1, coarse ? 0 : 1);
    const rp = rockGeometry.attributes.position;
    for (let i = 0; i < rp.count; i++) {
        const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
        const k = 1 + 0.22 * Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - x * 2.2) - 0.18 * Math.max(0, -y);
        rp.setXYZ(i, x * k, y * k, z * k);
    }
    rockGeometry.computeVertexNormals();
    const rocks = new THREE.InstancedMesh(
        rockGeometry,
        rockMaterial,
        rockCount,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockCount; i++) {
        let n;
        let tries = 0;
                do {
            if (random() < 0.6) {
                // Most rocks lie within ~300 m of the site you explore on foot.
                const a = Math.acos(1 - random() * (1 - Math.cos(300 / RADIUS))),
                    b = random() * Math.PI * 2;
                n = vec(
                    Math.sin(a) * Math.cos(b),
                    Math.cos(a),
                    Math.sin(a) * Math.sin(b),
                ).applyQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(Y, signalNormal),
                );
            } else {
                const y = random() * 2 - 1,
                    a = random() * Math.PI * 2;
                n = vec(
                    Math.sqrt(1 - y * y) * Math.cos(a),
                    y,
                    Math.sqrt(1 - y * y) * Math.sin(a),
                );
            }
        } while (
            (n.distanceTo(signalNormal) < 45 / RADIUS || terrainInfo.isLiquid(n)) &&
            ++tries < 30
        );
        const size = 0.5 + random() ** 3 * 6;
        dummy.position.copy(surfacePoint(n, size * 0.25));
        dummy.quaternion.setFromUnitVectors(Y, n);
        dummy.rotateY(random() * 6.28);
        dummy.scale.set(size * (0.6 + random()), size * (0.6 + random()), size);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
        const ground = terrainInfo.color(n, terrainInfo.meshHeight(n));
        rocks.setColorAt(
            i,
            new THREE.Color().setRGB(ground[0], ground[1], ground[2], THREE.SRGBColorSpace)
                .lerp(rockTint, 0.7)
                .multiplyScalar(0.85 + random() * 0.25),
        );
        // Local Y is "up" for the rock, so scale.y is its height.
        obstacles.push({
            p: dummy.position.clone(),
            r: Math.max(dummy.scale.x, dummy.scale.z) * 0.8,
            h: dummy.scale.y * 0.9 + size * 0.25,
            rock: i, // so a settlement built later can clear it
        });
    }
    group.add(rocks);
    // (The standing stones and crystal ring that used to mark the site are gone;
    // the site is ordinary terrain now.)

    // Geology: rock and ice formations to find and record, chosen from the world's physics.
    const geology = buildGeology(THREE, { body, terrain: terrainInfo, radius: RADIUS, signalNormal, landingNormal, coarse });
    group.add(geology.group);

    // Plant life: species generated from this world's environment, placed where they would thrive.
    const flora = buildFlora(THREE, {
        body: body,
        terrain: terrainInfo,
        radius: RADIUS,
        signalNormal,
        landingNormal,
        budget: coarse ? 900 : 1600,
    });
    group.add(flora.group);

    // Animal life: species generated from this world's environment, living near the site:
    // they eat the plants above, drink at the shore, hunt each other and sleep by night or day.
    const fauna = buildFauna(THREE, {
        body: body,
        terrain: terrainInfo,
        radius: RADIUS,
        signalNormal,
        budget: coarse ? 50 : 90,
        plants: flora.placed, // grazers walk to these and eat
    });
    group.add(fauna.group);

    // What an intelligent species has built: its capital beside the landing site, towns and
    // roads nearby, the rest of its world as distant towns and night lights (settlements.mjs).
    const structures = buildStructures(THREE, {
        body: body,
        terrain: terrainInfo,
        radius: RADIUS,
        signalNormal,
        landingNormal,
        fauna,
        colonist, // a spacefaring civilization from elsewhere in this system that has settled here
    });
    group.add(structures.group);
    obstacles.push(...structures.obstacles);

    // Builders clear their ground: plants inside settlements are removed (a few are kept),
    // and the rest become obstacles on foot.
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), n = vec(),
        clear = structures.clearings.map((c) => ({ n: c.n, cos: Math.cos(c.r / RADIUS) }));
    for (const { species, positions, scales, mesh } of flora.placed) {
        const foot = plantFootprint(species);
        let cleared = false;
        for (let i = 0; i < scales.length; i++) {
            n.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            n.normalize();
            if (clear.some((c) => c.n.dot(n) > c.cos) && ((i * 2654435761) >>> 0) % 7 !== 0) {
                mesh.setMatrixAt(i, zero);
                cleared = true;
                continue;
            }
            if (foot) // grasses and microbial mats are walked over
                obstacles.push({
                    p: vec(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
                    r: foot.r * scales[i],
                    h: foot.h * scales[i],
                });
        }
        if (cleared) mesh.instanceMatrix.needsUpdate = true;
    }
    // Rocks too: a rock is cleared if any part of it lies inside cleared ground.
    let rocksCleared = false;
    for (let k = obstacles.length - 1; k >= 0; k--) {
        const o = obstacles[k];
        if (o.rock === undefined) continue;
        const reach = Math.cos(o.r / RADIUS);
        n.copy(o.p).normalize();
        if (clear.some((c) => c.n.dot(n) > Math.cos(Math.acos(Math.min(1, c.cos)) + Math.acos(reach)))) {
            rocks.setMatrixAt(o.rock, zero);
            obstacles.splice(k, 1);
            rocksCleared = true;
        }
    }
    if (rocksCleared) rocks.instanceMatrix.needsUpdate = true;
    // Formations inside settlements are cleared too; the rest are solid on foot.
    for (const p of geology.placed) {
        let cleared = false;
        for (let i = 0; i < p.scales.length; i++) {
            n.set(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]).normalize();
            if (clear.some((c) => c.n.dot(n) > c.cos)) {
                for (const m of p.meshes) m.setMatrixAt(i, zero);
                p.scales[i] = 0; // gone: cannot be recorded or bumped into
                cleared = true;
                continue;
            }
            const f = rockFootprint(p, i);
            obstacles.push({ p: vec(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]), r: f.r, h: f.h });
        }
        if (cleared) for (const m of p.meshes) m.instanceMatrix.needsUpdate = true;
    }
    const grid = buildGrid(obstacles);

    // Grass tufts, flowers, pebbles and shards in a circle around the player (not inside settlements).
    const groundCover = createGroundCover(THREE, {
        body,
        radius: RADIUS,
        coarse,
        blocked: (p) => clear.some((c) => c.n.x * p.x + c.n.y * p.y + c.n.z * p.z > c.cos),
    });
    group.add(groundCover.group);

    // Rings are drawn once, by system-view.js, for every world (including this one).
    return {
        group, obstacles, flora, fauna, structures, geology, groundCover,
        nearbyObstacles: (p) => nearbyIn(grid, p),
    };
}

// Frees every geometry, material and instance buffer in a surface group.
export function disposeSurface(group) {
    const geometries = new Set(),
        materials = new Set();
    group.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry) geometries.add(object.geometry);
        if (object.material)
            for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    });
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
}
