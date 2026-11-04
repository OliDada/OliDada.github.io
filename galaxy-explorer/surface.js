// A world's surface around you: atmosphere glow, rocks, plant and animal life
// (filled in wherever you go, not just at the landing site), and what you collide
// with on foot.
// Rebuilt whenever you arrive at a world; game.js owns where you are.
import * as THREE from "./vendor/three.module.js";
import { terrainFor } from "./terrain.mjs";
import { buildFlora } from "./flora-mesh.js";
import { buildFauna, suitUp } from "./fauna-mesh.js";
import { buildStructures } from "./structures-mesh.js";
import { buildGeology, footprint as rockFootprint } from "./geology-mesh.js";
import { createGroundCover } from "./groundcover.js";
import { addSurfaceDetail } from "./planet-lod.js";
import { createScatter, obstacleGrid } from "./scatter.js";

const Y = new THREE.Vector3(0, 1, 0);
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// body: the world; signalNormal/landingNormal: unit vectors of the site and pad;
// surfacePoint(n, offset): point on the ground. Returns the scene group and the
// animated parts game.js drives.
export function buildSurface({ body, radius: RADIUS, signalNormal, landingNormal, surfacePoint, coarse, colonist = null }) {
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
                // Fades out far away too; set per use by game.js (a world you are
                // approaching gains its glow gradually as you come closer).
                farFrom: { value: 1e9 },
                farTo: { value: 1e9 + 1 },
            },
            vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
uniform float fadeFrom, fadeTo, farFrom, farTo;
varying vec3 n; varying vec3 v; varying float fade; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz);
float d=distance(cameraPosition,(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz);
fade=smoothstep(fadeFrom,fadeTo,d)*(1.0-smoothstep(farFrom,farTo,d));
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
    // (Loose rocks are scattered further down, once settlements have cleared their ground.)
    // (The standing stones and crystal ring that used to mark the site are gone;
    // the site is ordinary terrain now.)

    // Geology: rock and ice formations to find and record, chosen from the world's physics.
    const geology = buildGeology(THREE, { body, terrain: terrainInfo, radius: RADIUS, signalNormal, landingNormal, coarse });
    group.add(geology.group);

    // Plant life: species generated from this world's environment, growing all over it in
    // its biomes and filled in around you as you go (flora-mesh.js).
    const flora = buildFlora(THREE, {
        body: body,
        terrain: terrainInfo,
        radius: RADIUS,
        signalNormal,
        landingNormal,
        budget: coarse ? 900 : 1600,
        coarse,
    });
    group.add(flora.group);

    // Animal life: species generated from this world's environment, living around you (they
    // start near the site and follow you across the world):
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

    // A colony's colonists: their species from their home world, suited where they need it.
    if (structures.civ?.colony && structures.sites.length) {
        const colonists = buildFauna(THREE, {
            body, terrain: terrainInfo, radius: RADIUS, signalNormal, budget: 12,
            species: [suitUp(structures.civ.species, { suit: structures.civ.suits !== false })],
            herdCentres: structures.sites,
        });
        group.add(colonists.group);
        const own = fauna.update.bind(fauna);
        fauna.update = (...args) => { own(...args); colonists.update(...args); };
        fauna.colonists = colonists;
        // Colonists count as this world's animals: they can be scanned, watched and recorded
        // like any other, and the tally counts them (the fauna's own herds keep their list).
        if (colonists.species.length) {
            const mine = (sp) => colonists.species.includes(sp), positionsOf = fauna.positionsOf.bind(fauna), individualsOf = fauna.individualsOf.bind(fauna);
            fauna.species = [...fauna.species, ...colonists.species];
            fauna.positionsOf = (sp) => mine(sp) ? colonists.positionsOf(sp) : positionsOf(sp);
            fauna.individualsOf = (sp) => mine(sp) ? colonists.individualsOf(sp) : individualsOf(sp);
        }
    }

    // Builders clear their ground: plants inside settlements are removed (a few are kept;
    // flora-mesh.js), and so are rocks and formations.
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), n = vec(),
        clear = structures.clearings.map((c) => ({ n: c.n, angle: c.r / RADIUS }));
    // True if anything within `margin` metres of direction m lies inside cleared ground.
    const cleared = (m, margin = 0) => clear.some((c) => c.n.dot(m) > Math.cos(c.angle + margin / RADIUS));
    if (clear.length) flora.setBlocked((m) => cleared(m));
    // Builders stay in their settlements; other animals follow you across the world.
    if (structures.civ?.species) fauna.pin?.(structures.civ.species.id);

    // Loose rocks, scattered evenly over the whole world on a fixed grid (scatter.js)
    // and filled in around you as you go: more on rocky and volcanic ground and on
    // steep slopes, fewer on sand and soft ground, none in the sea.
    const rockShape = (detail, fine) => {
        // Lumpy rather than round: each corner is pushed in or out by a function of its
        // position, so faces that share a corner still meet. Big rocks (over 2.5 m) get a
        // finer shape with a second, smaller layer of lumps, so their facets stay about
        // as small as a small rock's and they don't stand out as low-detail from afar.
        const g = new THREE.IcosahedronGeometry(1, detail), rp = g.attributes.position;
        for (let i = 0; i < rp.count; i++) {
            const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
            const k = 1 + 0.22 * Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - x * 2.2) - 0.18 * Math.max(0, -y)
                + fine * 0.07 * Math.sin(x * 13.3 - z * 9.1 + 1.7) * Math.cos(y * 11.2 + x * 6.4);
            rp.setXYZ(i, x * k, y * k, z * k);
        }
        g.computeVertexNormals();
        return g;
    };
    const BIG_ROCK = 2.5, rockCap = coarse ? 500 : 900, rockReach = coarse ? 200 : 300, ROCK_CELL = 16;
    const rocks = new THREE.InstancedMesh(rockShape(coarse ? 0 : 1, 0), rockMaterial, rockCap);
    const bigRocks = new THREE.InstancedMesh(rockShape(coarse ? 1 : 2, 1), rockMaterial, rockCap);
    for (const m of [rocks, bigRocks]) {
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(rockCap * 3), 3);
        m.count = 0; m.frustumCulled = false;
    }
    group.add(rocks, bigRocks);
    const stony = { rocky: 1.6, volcanic: 1.6, ice: .8, toxic: 1, soft: .7, sand: .5 }[terrainInfo.ground] ?? (terrainInfo.airless ? 1.6 : 1);
    const dummy = new THREE.Object3D(), rn = vec(), side = vec(), tmpColor = new THREE.Color();
    const rockField = createScatter({
        radius: RADIUS, cell: ROCK_CELL, reach: rockReach,
        fill(f, i, j, cell) {
            const items = [];
            for (let slot = 0; slot < 2; slot++) {
                const h = (q) => cell.hash(slot * 16 + q), u = h(1), v = h(2);
                if (!cell.point(u, v, rn)) continue;
                // About one rock per 550 m² of rocky ground (fewer on soft ground and sand); steep ground sheds more.
                const ht = terrainInfo.height(rn);
                if ((terrainInfo.liquid === "water" || terrainInfo.liquid === "lava") && ht < terrainInfo.sea) continue;
                side.set(Math.abs(rn.x) < 0.9 ? 1 : 0, Math.abs(rn.x) < 0.9 ? 0 : 1, 0).cross(rn).normalize();
                const slope = Math.abs(terrainInfo.height(side.multiplyScalar(4 / RADIUS).add(rn).normalize()) - ht) / 4;
                if (h(3) > .15 * stony * (1 + Math.min(1, slope * 2)) * cell.area(u, v)) continue;
                const size = 0.5 + h(4) ** 3 * 6;
                if (rn.distanceTo(signalNormal) < (45 + size) / RADIUS || rn.distanceTo(landingNormal) < (14 + size) / RADIUS) continue;
                if (clear.length && cleared(rn, size * 1.3)) continue; // any part of it inside cleared ground
                dummy.position.copy(surfacePoint(rn, size * 0.25));
                dummy.quaternion.setFromUnitVectors(Y, rn);
                dummy.rotateY(h(5) * 6.28);
                dummy.scale.set(size * (0.6 + h(6)), size * (0.6 + h(7)), size);
                dummy.updateMatrix();
                const ground = terrainInfo.color(rn, terrainInfo.meshHeight(rn));
                tmpColor.setRGB(ground[0], ground[1], ground[2], THREE.SRGBColorSpace).lerp(rockTint, 0.7).multiplyScalar(0.85 + h(8) * 0.25);
                items.push({
                    big: size > BIG_ROCK, m: Float32Array.from(dummy.matrix.elements), c: [tmpColor.r, tmpColor.g, tmpColor.b],
                    // Local Y is "up" for the rock, so scale.y is its height.
                    ob: { p: dummy.position.clone(), r: Math.max(dummy.scale.x, dummy.scale.z) * 0.8, h: dummy.scale.y * 0.9 + size * 0.25, rock: true },
                });
            }
            return items;
        },
    });
    let rockGrid = obstacleGrid([]);
    function drawRocks() {
        let small = 0, big = 0;
        const obs = [];
        for (const rec of rockField.active) {
            if (!rec.ready) continue;
            if (small >= rockCap && big >= rockCap) break;
            for (const it of rec.items) {
                const mesh = it.big ? bigRocks : rocks, k = it.big ? big : small;
                if (k >= rockCap) continue;
                mesh.instanceMatrix.array.set(it.m, k * 16);
                mesh.instanceColor.array.set(it.c, k * 3);
                if (it.big) big++; else small++;
                obs.push(it.ob);
            }
        }
        rocks.count = small; bigRocks.count = big;
        for (const m of [rocks, bigRocks]) m.instanceMatrix.needsUpdate = m.instanceColor.needsUpdate = true;
        rockGrid = obstacleGrid(obs);
    }
    rockField.prime(landingNormal, coarse ? 150 : 220);
    drawRocks();
    let rocksDirty = false, rocksWait = 0;
    const rockDir = vec();
    const updateRocks = (camera) => {
        rockDir.copy(camera).normalize();
        const altitude = camera.length() - RADIUS - terrainInfo.surface(rockDir);
        rocks.visible = bigRocks.visible = altitude < rockReach;
        if (!rocks.visible) return altitude;
        if (rockField.update(rockDir, 1)) rocksDirty = true;
        if (rocksDirty && (--rocksWait <= 0 || !rockField.busy)) { drawRocks(); rocksDirty = false; rocksWait = 8; }
        return altitude;
    };

    // Formations inside settlements are cleared too; the rest are solid on foot.
    for (const p of geology.placed) {
        let gone = false;
        for (let i = 0; i < p.scales.length; i++) {
            n.set(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]).normalize();
            if (cleared(n)) {
                for (const m of p.meshes) m.setMatrixAt(i, zero);
                p.scales[i] = 0; // gone: cannot be recorded or bumped into
                gone = true;
                continue;
            }
            const f = rockFootprint(p, i);
            obstacles.push({ p: vec(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]), r: f.r, h: f.h });
        }
        if (gone) for (const m of p.meshes) m.instanceMatrix.needsUpdate = true;
    }
    // Buildings and formations stay put; plants and rocks come and go as you move.
    const grid = obstacleGrid(obstacles);

    // Grass tufts, flowers, pebbles and shards in a circle around the player (not inside settlements).
    const groundCover = createGroundCover(THREE, {
        body,
        radius: RADIUS,
        coarse,
        blocked: (p) => clear.some((c) => c.n.x * p.x + c.n.y * p.y + c.n.z * p.z > c.cos),
    });
    group.add(groundCover.group);

    // Rings are drawn once, by system-view.js, for every world (including this one).
    // One look for everything on the ground: plants, animals and buildings get the same
    // close-up grain and bump as rocks and the ground (planet-lod.js addSurfaceDetail).
    // Glass, glowing parts and shiny metal are left clean.
    group.traverse((o) => {
        if (!o.isMesh || o.parent === groundCover.group) return; // tufts and pebbles are too small to need it
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m.isMeshStandardMaterial && !m.transparent && m.metalness < 0.35)
                addSurfaceDetail(m, { ground: terrainInfo.ground, airless: terrainInfo.airless, lite: coarse, objects: true });
    });

    return {
        group, obstacles, flora, fauna, structures, geology, groundCover,
        halo: atmosphere.material.uniforms,
        // Everything solid near a point (on foot).
        nearbyObstacles: (p) => rockGrid.near(p, flora.nearbyObstacles(p, grid.near(p))),
        // Call every frame with the camera position (relative to the world's centre):
        // plants and rocks are filled in around you, and animals follow you about.
        update(camera, time) {
            flora.update(time, camera);
            if (updateRocks(camera) < 400) fauna.follow?.(camera); // not from orbit
        },
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
