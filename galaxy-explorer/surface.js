// The landing site around a world's signal: atmosphere glow, rocks, crystals,
// the monument, plant and animal life, and what you collide with on foot.
// Rebuilt whenever you arrive at a world; game.js owns where you are.
import * as THREE from "./vendor/three.module.js";
import { terrainFor } from "./terrain.mjs";
import { buildFlora, plantFootprint } from "./flora-mesh.js";
import { buildFauna } from "./fauna-mesh.js";

const Y = new THREE.Vector3(0, 1, 0);
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Things you bump into on foot (rocks, crystals, pillars, plants), kept in a
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
    // Scatter low mineral outcrops near the site, leaving the central footpath open.
    const crystalMaterial = new THREE.MeshStandardMaterial({
        color: body.crystal,
        emissive: 0x315a48,
        emissiveIntensity: 0.35,
        roughness: 0.6,
        flatShading: true,
    });
    const crystals = new THREE.InstancedMesh(
        new THREE.ConeGeometry(0.35, 1.8, 5),
        crystalMaterial,
        140,
    );
    for (let i = 0; i < 140; i++) {
        const a = random() * 6.28,
            d = (10 + random() * 45) / RADIUS;
        const n = vec(Math.cos(a) * d, 1, Math.sin(a) * d).normalize();
        if (Math.abs(n.x) < 0.025 && n.z > 0) n.x += 0.045;
        n.normalize().applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(Y, signalNormal),
        );
        dummy.position.copy(surfacePoint(n, 0.4));
        dummy.quaternion.setFromUnitVectors(Y, n);
        dummy.scale.setScalar(0.5 + random() * 1.2);
        dummy.updateMatrix();
                crystals.setMatrixAt(i, dummy.matrix);
        obstacles.push({
            p: dummy.position.clone(),
            r: 0.3 * dummy.scale.x,
            h: 1.8 * dummy.scale.x,
        });
    }
    group.add(crystals);

    // The observatory: three broken standing stones around a suspended core.
    const monument = new THREE.Group();
    monument.position.copy(surfacePoint(signalNormal));
    monument.quaternion.setFromUnitVectors(Y, signalNormal);
    group.add(monument);
    const stone = new THREE.MeshStandardMaterial({
        color: 0x263f44,
        metalness: 0.25,
        roughness: 0.7,
        flatShading: true,
    });
    const luminous = new THREE.MeshStandardMaterial({
        color: 0xc5ffe0,
        emissive: 0x7ef9cd,
        emissiveIntensity: 2.5,
    });
    for (let i = 0; i < body.landmarkCount; i++) {
        const a = (i * Math.PI * 2) / body.landmarkCount + 0.5;
        const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 7 + i * 0.7, 1.7),
            stone,
        );
        pillar.position.set(Math.cos(a) * 3, 3.5 + i * 0.35, Math.sin(a) * 3);
        pillar.rotation.y = -a;
        pillar.rotation.z = i === 1 ? -0.13 : 0.06;
                monument.add(pillar);
        obstacles.push({
            p: pillar.position
                .clone()
                .setY(0)
                .applyQuaternion(monument.quaternion)
                .add(monument.position),
            r: 1.2,
            h: 9,
        });
        const slit = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 4.5, 1.73),
            luminous,
        );
        slit.position.copy(pillar.position);
        slit.rotation.copy(pillar.rotation);
        monument.add(slit);
    }
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), luminous);
    core.position.y = 4;
    monument.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.035, 8, 64), luminous);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.1;
    monument.add(ring);
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.25, 85, 8),
        new THREE.MeshBasicMaterial({
            color: 0xa6f0d0,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
        }),
    );
    beacon.position.y = 43;
    monument.add(beacon);
    const glow = new THREE.PointLight(0xa4ffcb, 15, 24, 1.5);
    glow.position.y = 4;
    monument.add(glow);

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

    if (body.ringed) {
        const planetaryRing = new THREE.Mesh(
            new THREE.RingGeometry(RADIUS * 1.45, RADIUS * 2.05, 128),
            new THREE.MeshBasicMaterial({
                color: body.atmosphere,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.27,
                depthWrite: false,
            }),
        );
        planetaryRing.rotation.x = Math.PI / 2 + 0.12;
        group.add(planetaryRing);
    }
    return {
        group, obstacles, core, ring, beacon, glow, flora, fauna,
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
