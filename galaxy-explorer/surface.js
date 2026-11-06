// A world's surface around you: atmosphere glow, rocks, plant and animal life
// (filled in wherever you go, not just at the landing site), and what you collide
// with on foot.
// Rebuilt whenever you arrive at a world; game.js owns where you are.
import * as THREE from "./vendor/three.module.js";
import { terrainFor } from "./terrain.mjs";
import { buildFlora } from "./flora-mesh.js";
import { buildFauna, suitUp } from "./fauna-mesh.js";
import { buildStructures } from "./structures-mesh.js";
import { civilizationOf } from "./civilizations.mjs";
import { stanceOf } from "./station-deck.js";
import { buildGeology, footprint as rockFootprint } from "./geology-mesh.js";
import { createGroundCover } from "./groundcover.js";
import { addSurfaceDetail } from "./planet-lod.js";
import { createScatter, obstacleGrid } from "./scatter.js";
import { PLANT_STYLE } from "./style.mjs";
import { softenNormals } from "./soften.js";

const Y = new THREE.Vector3(0, 1, 0);
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// body: the world; signalNormal/landingNormal: unit vectors of the site and pad;
// surfacePoint(n, offset): point on the ground. Returns the scene group and the
// animated parts game.js drives.
const isIn = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
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
        flatShading: PLANT_STYLE === "classic", // new style: softened facets (soften.js)
    });
    // Loose rocks thin out towards the edge of their reach, each at its own distance, and
    // shrink away smoothly, like plants, so none pop in (rockFade: from, to in metres).
    const rockCenter = { value: vec(1e9, 0, 0) }, rockFade = { value: new THREE.Vector2(1e9, 1e9 + 1) };
    rockMaterial.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, { uRockCenter: rockCenter, uRockFade: rockFade });
        shader.vertexShader = "uniform vec3 uRockCenter; uniform vec2 uRockFade;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 rockAt = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float rockT = 1.0 - smoothstep(uRockFade.x, uRockFade.y, distance(rockAt, uRockCenter));
          float rockR = fract(sin(dot(rockAt, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          transformed *= smoothstep(rockR * .8, rockR * .8 + .2, rockT);
        #endif`);
    };
    rockMaterial.customProgramCacheKey = () => "rock-fade";
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
        // A spaceborne civilization left its world: its towns stand empty (structures-mesh.js ruins).
        absent: civilizationOf(body)?.spaceborne ? new Set([civilizationOf(body).species.id]) : null,
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
        coarse,
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
    // A city world's city (urban.mjs) has no wild plants, but in its parks.
    const city = structures.urban && !structures.ruins ? structures.urban : null, inCity = (m) => city && city.mask(m) > .5 && !city.park(m);
    if ((clear.length || city) && !structures.ruins) flora.setBlocked((m) => cleared(m) || inCity(m)); // ruins are overgrown
    // Builders stay in their settlements; other animals follow you across the world.
    if (structures.civ?.species) fauna.pin?.(structures.civ.species.id);
    // ...and go about their lives among their buildings (fauna-mesh.js setTown): work at a
    // doorstep, talk in the squares, keep watch, and walk round the buildings in between.
    if (structures.civ?.species && structures.sites.length && !structures.ruins) {
        const townGrid = obstacleGrid(structures.obstacles);
        const town = (sp) => ({ spots: townSpots(structures, townGrid, sp, terrainInfo, RADIUS), near: (p) => townGrid.near(p), paths: structures.paths });
        const native = fauna.species.find((s) => s.id === structures.civ.species.id);
        const people = structures.civ.colony ? colonist : civilizationOf(body), stance = stanceOf(people);
        // What the town does together (fauna-mesh.js vignettes): its squares and heart, its fields.
        const centres = structures.sites.filter((v) => v.angleTo(signalNormal) * RADIUS < 320);
        const opts = { stance, path: people?.path, centres, fields: structures.fieldsAt || [], hearths: !!structures.civ.hearths, edge: structures.places?.[0]?.r ?? 30 };
        if (native && !structures.civ.colony) fauna.setTown?.(native.id, town(native), opts);
        if (fauna.colonists) for (const sp of fauna.colonists.species) fauna.colonists.setTown?.(sp.id, town(sp), opts);
        // Wild animals keep out of cities and big towns (villages and camps they wander through).
        const big = structures.civ.level >= 3 ? structures.places : structures.places.filter((p) => p.r >= 18);
        fauna.keepOut?.(big.map((p) => ({ n: p.n, r: p.r + 15 })), city ? (n) => city.mask(n) > .45 && !city.park(n) : null);
        // Builders from villages up keep animals: pens round the edge of the nearest town.
        if (structures.civ.level >= 2 && structures.places?.length && !structures.civ.underwater) {
            const home = structures.places[0], east = new THREE.Vector3(0, 1, 0).cross(home.n).normalize(), north = home.n.clone().cross(east), pens = [];
            for (let i = 0; i < 8 && pens.length < 4; i++) {
                const a = i / 8 * Math.PI * 2 + .3, dir = east.clone().multiplyScalar(Math.cos(a)).addScaledVector(north, Math.sin(a));
                const n = home.n.clone().addScaledVector(dir, (home.r + 6) / RADIUS).normalize();
                if (!terrainInfo.isLiquid(n) && n.angleTo(landingNormal) * RADIUS > 20) pens.push({ n, face: dir.clone().negate() });
            }
            structures.kept = fauna.keepAnimals?.(pens, { count: 5, builderSize: structures.civ.species.size }) ?? null;
        }
    }

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
        if (PLANT_STYLE !== "classic") softenNormals(THREE, g, 0.6);
        return g;
    };
    // New plant style: rocks are filled as far out as the trees (flora-mesh.js treeReach);
    // small ones are only drawn within SMALL_REACH, where you could see them.
    const NEW_REACH = PLANT_STYLE !== "classic";
    const BIG_ROCK = 2.5, rockCap = coarse ? (NEW_REACH ? 900 : 500) : (NEW_REACH ? 2200 : 900), rockReach = NEW_REACH ? (coarse ? 420 : 720) : coarse ? 200 : 300, ROCK_CELL = 16;
    const SMALL_REACH = coarse ? 200 : 300;
    rockFade.value.set(rockReach * .8, rockReach);
    const rocks = new THREE.InstancedMesh(rockShape(coarse ? 0 : 1, 0), rockMaterial, rockCap);
    const bigRocks = new THREE.InstancedMesh(rockShape(coarse ? 1 : 2, 1), rockMaterial, rockCap);
    for (const m of [rocks, bigRocks]) {
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(rockCap * 3), 3);
        m.count = 0; m.frustumCulled = false;
    }
    for (const m of [rocks, bigRocks]) { m.castShadow = true; m.receiveShadow = true; }
    group.add(rocks, bigRocks);
    const stony = { rocky: 1.6, volcanic: 1.6, ice: .8, toxic: 1, soft: .7, sand: .5 }[terrainInfo.ground] ?? (terrainInfo.airless ? 1.6 : 1);
    const dummy = new THREE.Object3D(), rn = vec(), side = vec(), tmpColor = new THREE.Color(), rockInfo = {};
    const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
                // New style: few loose rocks out on grass (they read as scattered debris from the
                // air), many on bare and steep ground; smaller, half sunk, in the ground's own colours.
                const rinfo = NEW_REACH ? (terrainInfo.color(rn, ht, { slope: Math.min(1, slope), hollow: 0 }, rockInfo), rockInfo) : null;
                const where = rinfo ? (.2 + 1.8 * rinfo.bare * (1 - .7 * rinfo.veg)) * (1 - smooth01(.35, .65, slope)) : 1; // (none on steep slopes: they looked stuck to the hillside)
                if (h(3) > .15 * stony * where * (NEW_REACH ? 1 : 1 + Math.min(1, slope * 2)) * cell.area(u, v)) continue;
                const size = NEW_REACH ? 0.4 + h(4) ** 4 * 4.5 : 0.5 + h(4) ** 3 * 6;
                if (rn.distanceTo(signalNormal) < (45 + size) / RADIUS || rn.distanceTo(landingNormal) < (14 + size) / RADIUS) continue;
                if (clear.length && cleared(rn, size * 1.3)) continue; // any part of it inside cleared ground
                dummy.position.copy(surfacePoint(rn, NEW_REACH ? -size * 0.12 : size * 0.25));
                dummy.quaternion.setFromUnitVectors(Y, rn);
                dummy.rotateY(h(5) * 6.28);
                dummy.scale.set(size * (0.6 + h(6)), size * (0.6 + h(7)), size);
                dummy.updateMatrix();
                const ground = terrainInfo.color(rn, terrainInfo.meshHeight(rn));
                tmpColor.setRGB(ground[0], ground[1], ground[2], THREE.SRGBColorSpace).lerp(rockTint, NEW_REACH ? 0.5 : 0.7).multiplyScalar((NEW_REACH ? 1 : 0.85) + h(8) * 0.25);
                items.push({
                    big: size > BIG_ROCK, size, m: Float32Array.from(dummy.matrix.elements), c: [tmpColor.r, tmpColor.g, tmpColor.b],
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
                if (!it.big && rec.d > SMALL_REACH && it.size < 1.6) continue; // pebble-sized rocks only nearby
                const mesh = it.big ? bigRocks : rocks, k = it.big ? big : small;
                if (k >= rockCap) continue;
                mesh.instanceMatrix.array.set(it.m, k * 16);
                mesh.instanceColor.array.set(it.c, k * 3);
                if (it.big) big++; else small++;
                if (rec.d < 120) obs.push(it.ob);
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
        rockCenter.value.copy(camera);
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
    // Buildings for the ship: a coarse grid by direction, so a tower is found from above
    // its base as well as beside it.
    const tallCell = 40 / RADIUS, tallGrid = new Map(), tallKey = (n, dx = 0, dy = 0, dz = 0) => `${Math.floor(n.x / tallCell) + dx},${Math.floor(n.y / tallCell) + dy},${Math.floor(n.z / tallCell) + dz}`;
    for (const o of structures.obstacles) { const k = tallKey(o.p.clone().normalize()); if (!tallGrid.has(k)) tallGrid.set(k, []); tallGrid.get(k).push(o); }

    // Grass tufts, flowers, pebbles and shards in a circle around the player (not inside settlements).
    const groundCover = createGroundCover(THREE, {
        body,
        radius: RADIUS,
        coarse,
        blocked: (p) => clear.some((c) => c.n.x * p.x + c.n.y * p.y + c.n.z * p.z > (c.cos ??= Math.cos(c.angle))) || inCity(p),
    });
    group.add(groundCover.group);

    // Rings are drawn once, by system-view.js, for every world (including this one).
    // One look for everything on the ground: plants, animals and buildings get the same
    // close-up grain and bump as rocks and the ground (planet-lod.js addSurfaceDetail).
    // Glass, glowing parts and shiny metal are left clean.
    // Shadows (atmosphere.js): everything on the ground receives them; rocks, formations and
    // buildings cast them (plants set their own, flora-mesh.js; animals don't yet, since
    // their shadows would not follow their legs).
    group.traverse((o) => {
        if (!o.isMesh) return;
        o.receiveShadow = true;
        if (o.parent !== groundCover.group && !o.parent?.userData?.fauna && !(o.material?.transparent)) o.castShadow = o.castShadow || (geology.group.children.includes(o) || (structures && isIn(o, structures.group)));
    });
    group.traverse((o) => {
        if (!o.isMesh || o.parent === groundCover.group) return; // tufts and pebbles are too small to need it
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m.isMeshStandardMaterial && !m.transparent && !m.map && m.metalness < 0.35)
                addSurfaceDetail(m, { ground: terrainInfo.ground, airless: terrainInfo.airless, lite: coarse, objects: true });
    });

    return {
        group, obstacles, flora, fauna, structures, geology, groundCover,
        halo: atmosphere.material.uniforms,
        // Everything solid near a point (on foot).
        nearbyObstacles: (p) => rockGrid.near(p, flora.nearbyObstacles(p, grid.near(p))),
        // Buildings near a point at any height (for the ship): [{ p: base, r, h }].
        buildingsNear(p, out = []) {
            const n = p.clone().normalize();
            for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) { const c = tallGrid.get(tallKey(n, x, y, z)); if (c) out.push(...c); }
            return out;
        },
        // Call every frame with the camera position (relative to the world's centre):
        // plants and rocks are filled in around you, and animals follow you about.
        update(camera, time) {
            flora.update(time, camera);
            if (updateRocks(camera) < 400) fauna.follow?.(camera); // not from orbit
        },
    };
}

// Frees every geometry, material and instance buffer in a surface group.
// Places in an intelligent species' settlements to go to: the doorstep of each building
// (facing it, to work there), places round each square (facing its centre, to talk), and
// a few by the tallest buildings to keep watch. Kept clear of every building.
function townSpots(structures, grid, sp, terrain, R) {
    const spots = [], size = sp.size || 1, room = size * .45 + .25;
    const tangentOf = (v, n) => v.clone().addScaledVector(n, -v.dot(n)).normalize();
    const freeAt = (n) => {
        if (terrain.isLiquid(n)) return false;
        const p = n.clone().multiplyScalar(R + terrain.surface(n));
        return grid.near(p).every((o) => { const d = p.clone().sub(o.p); d.addScaledVector(n, -d.dot(n)); return d.length() > o.r + room; });
    };
    const sites = structures.sites;
    // Planned towns (town-plan.mjs) say where their doors are: the townsfolk work and come and go there.
    for (const d of structures.doorsteps || []) { if (spots.length > 150) break; if (freeAt(d.n)) spots.push({ n: d.n, face: d.face.clone(), kind: 'work', taken: null, door: true }); }
    const nearestSite = (n) => sites.reduce((best, s) => (s.angleTo(n) < best.angleTo(n) ? s : best), sites[0]);
    for (const o of structures.obstacles) {
        if (o.h < 1.4 || o.r < .7 || spots.length > 160) continue;
        const on = o.p.clone().normalize(), site = nearestSite(on);
        if (site.angleTo(on) * R > 260) continue;
        let toward = tangentOf(site.clone().sub(on), on);
        if (!isFinite(toward.x) || site.angleTo(on) * R < 1) toward = tangentOf(new THREE.Vector3(1, 0, 0), on);
        for (let k = 0; k < 4; k++) { // the doorstep, or a little round the side if that is taken
            const dir = toward.clone().applyAxisAngle(on, (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .7);
            const n = on.clone().addScaledVector(dir, (o.r + size * .5 + .6) / R).normalize();
            if (!freeAt(n)) continue;
            spots.push({ n, face: tangentOf(on.clone().sub(n), n), kind: o.h > 9 && spots.length % 5 === 0 ? 'watch' : 'work', taken: null, door: k === 0 });
            break;
        }
    }
    for (const s of sites) { // the squares
        const a = tangentOf(Math.abs(s.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), s), b = s.clone().cross(a);
        for (let k = 0; k < 6; k++) {
            const ang = k / 6 * Math.PI * 2, d = (3 + size * 1.2) / R;
            const n = s.clone().addScaledVector(a, Math.cos(ang) * d).addScaledVector(b, Math.sin(ang) * d).normalize();
            if (freeAt(n)) spots.push({ n, face: tangentOf(s.clone().sub(n), n), kind: 'chat', taken: null });
        }
    }
    return spots;
}

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
