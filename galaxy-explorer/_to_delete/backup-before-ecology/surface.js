// The landing site around a world's signal: atmosphere glow, rocks, plant and
// animal life, and what you collide with on foot.
// Rebuilt whenever you arrive at a world; game.js owns where you are.
import * as THREE from "./vendor/three.module.js";
import { terrainFor } from "./terrain.mjs";
import { buildFlora, plantFootprint } from "./flora-mesh.js";
import { buildFauna } from "./fauna-mesh.js";

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
export function buildSurface({ body, radius: RADIUS, signalNormal, landingNormal, surfacePoint, coarse }) {
    let randomState = body.seed;
    const random = () => {
        randomState = (1664525 * randomState + 1013904223) >>> 0;
        return randomState / 4294967296;
    };
    const group = new THREE.Group();
    const obstacles = [];
    // Faceted, vertex-coloured terrain; the same height function drives walking and landing.
    const terrainInfo = terrainFor(body);

    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS * 1.06, 64, 48),
        new THREE.ShaderMaterial({
            uniforms: {
                tint: { value: new THREE.Color(body.atmosphere) },
            },
            vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;
#include <logdepthbuf_vertex>
}`,
            fragmentShader: `#include <logdepthbuf_pars_fragment>
varying vec3 n; varying vec3 v; uniform vec3 tint; void main(){
#include <logdepthbuf_fragment>
float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),4.0);gl_FragColor=vec4(tint,rim*.2);}`,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }),
    );
    group.add(atmosphere);

    // Instancing keeps surface detail cheap enough for ordinary browser hardware.
    // Each rock takes a darker shade of the ground it sits on, so rocks blend in from orbit.
    const rockTint = new THREE.Color(body.rock);
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        flatShading: true,
    });
    const rockCount = coarse ? 500 : 800;
    const rocks = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 0),
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
            new THREE.Color(ground[0], ground[1], ground[2])
                .lerp(rockTint, 0.2)
                .multiplyScalar(0.86),
        );
        // Local Y is "up" for the rock, so scale.y is its height.
        obstacles.push({
            p: dummy.position.clone(),
            r: Math.max(dummy.scale.x, dummy.scale.z) * 0.8,
            h: dummy.scale.y * 0.9 + size * 0.25,
        });
    }
    group.add(rocks);
    // (The standing stones and crystal ring that used to mark the site are gone;
    // the site is ordinary terrain now.)

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
    for (const { species, positions, scales } of flora.placed) {
        const foot = plantFootprint(species);
        if (!foot) continue; // grasses and microbial mats are walked over
        for (let i = 0; i < scales.length; i++)
            obstacles.push({
                p: vec(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
                r: foot.r * scales[i],
                h: foot.h * scales[i],
            });
    }
    const grid = buildGrid(obstacles);

    // Animal life: species generated from this world's environment, roaming near the site.
    const fauna = buildFauna(THREE, {
        body: body,
        terrain: terrainInfo,
        radius: RADIUS,
        signalNormal,
        budget: coarse ? 50 : 90,
    });
    group.add(fauna.group);

    // Rings are drawn once, by system-view.js, for every world (including this one).
    return {
        group, obstacles, flora, fauna,
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
