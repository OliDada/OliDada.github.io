// Kestrel, the player's ship: model, ground shadow, landing dust and the
// effects that follow the flight state (gear, lift jets, engine glow).
import * as THREE from "./vendor/three.module.js";
import { damp, smoothstep } from "./flight-math.mjs";
import { softenNormals } from "./soften.js";
import { PLANT_STYLE } from "./style.mjs";

const Y = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

function makeShip() {
    const group = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({
        color: 0xe4dfcc,
        metalness: 0.25,
        roughness: 0.65,
        flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x233a43,
        metalness: 0.55,
        roughness: 0.4,
    });
    const orange = new THREE.MeshStandardMaterial({
        color: 0xd99059,
        metalness: 0.15,
        roughness: 0.7,
    });
    const glass = new THREE.MeshStandardMaterial({
        color: 0x214550,
        metalness: 0.75,
        roughness: 0.12,
        emissive: 0x10292c,
        emissiveIntensity: 0.5,
    });
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.35, 5.5, 6),
        hull,
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 6), hull);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -3.65;
    group.add(nose);
    const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.65, 1.8),
        glass,
    );
    canopy.position.set(0, 0.85, -1.1);
    canopy.rotation.x = -0.14;
    group.add(canopy);
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [
                0, 0, -1, 4.4, -0.25, 2, 0, 0, 1.8, 0, -0.2, -1, 0, -0.2, 1.8,
                4.4, -0.45, 2, 0, 0, -1, 0, -0.2, -1, 4.4, -0.45, 2, 0, 0, -1,
                4.4, -0.45, 2, 4.4, -0.25, 2,
            ],
            3,
        ),
    );
    wingGeo.computeVertexNormals();
    group.userData.wings = [];
    for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(
            wingGeo,
            new THREE.MeshStandardMaterial({
                color: 0xd7d5bd,
                side: THREE.DoubleSide,
                roughness: 0.7,
            }),
        );
        wing.scale.x = side;
        group.add(wing);
        group.userData.wings.push({ wing, side });
        const pod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.48, 0.6, 3.1, 20),
            orange,
        );
        pod.rotation.x = Math.PI / 2;
        pod.position.set(side * 2.2, 0, 1.35);
        group.add(pod);
        const nozzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.48, 0.6, 20),
            dark,
        );
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(side * 2.2, 0, 3);
        group.add(nozzle);
        const engine = new THREE.Mesh(
            new THREE.ConeGeometry(0.38, 2, 20),
            new THREE.MeshBasicMaterial({
                color: 0x9ef6e1,
                transparent: true,
                opacity: 0.8,
            }),
        );
        engine.rotation.x = Math.PI / 2;
        engine.position.set(side * 2.2, 0, 4);
        group.add(engine);
        group.userData.engines ??= [];
        group.userData.engines.push(engine);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.6), dark);
        foot.position.set(side * 1, -1.1, 1);
        group.add(foot);
        group.userData.gear ??= [];
        group.userData.gear.push(foot);
        for (const z of [-1.2, 1.6]) {
            const jet = new THREE.Mesh(
                new THREE.ConeGeometry(0.24, 1.8, 16),
                new THREE.MeshBasicMaterial({
                    color: 0xa5f7e1,
                    transparent: true,
                    opacity: 0.65,
                    depthWrite: false,
                }),
            );
            jet.rotation.z = Math.PI;
            jet.position.set(side * 0.85, -2, z);
            group.add(jet);
            group.userData.liftJets ??= [];
            group.userData.liftJets.push(jet);
        }
    }
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.5, 1.5), orange);
    fin.position.set(0, 1.3, 1.6);
    fin.rotation.x = -0.3;
    group.add(fin);
    subFittings(group, dark, -3.9, 3.3);
    return group;
}
// Submarine fittings: headlamps and a lamp that lights the water ahead, and a ducted
// propeller that spins at the stern. Hidden in the air (updateShipEffects).
function subFittings(group, dark, noseZ, sternZ) {
    const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    const lamps = new THREE.Group();
    for (const side of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampGlow); l.position.set(side * 0.55, -0.25, noseZ); lamps.add(l); }
    const prop = new THREE.Group();
    prop.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 20), dark));
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.22), dark); b.rotation.z = (i * Math.PI) / 4; b.rotation.x = 0.4; prop.add(b); }
    prop.position.set(0, 0, sternZ);
    lamps.visible = prop.visible = false;
    group.add(lamps, prop);
    // A point light that is always there (switching lights on and off would recompile
    // every material); game.js sets its intensity, 0 out of the water.
    const lamp = new THREE.PointLight(0xfff0d0, 0, 40, 1.4);
    lamp.position.set(0, 0, noseZ - 2);
    group.add(lamp);
    Object.assign(group.userData, { lamps, prop, lamp });
}

// The Petrel: a sea and storm ship, after the storm petrel. A flying-boat hull, slate
// above and pale below with the bird's white band before the tail, a drooped beak with a
// sensor tube on it, a long glass canopy, and long cranked wings: up from the hull to an
// engine on each shoulder (clear of the spray), then out and down to a lit tip. A forked
// tail and one big stern engine. Under water the wings fold back along the hull and the
// same lamps and propeller as the Kestrel come out.
function makePetrel() {
    const group = new THREE.Group();
    const slate = new THREE.MeshStandardMaterial({ color: 0x62757f, metalness: 0.3, roughness: 0.5, flatShading: true });
    const pale = new THREE.MeshStandardMaterial({ color: 0xe6e2d4, metalness: 0.2, roughness: 0.5, flatShading: true });
    const teal = new THREE.MeshStandardMaterial({ color: 0x2a9d96, metalness: 0.3, roughness: 0.5, flatShading: true });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x8496a0, metalness: 0.3, roughness: 0.55, flatShading: true, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a2429, metalness: 0.6, roughness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b4f5c, metalness: 0.8, roughness: 0.08, emissive: 0x0d2a30, emissiveIntensity: 0.6 });
    const light = new THREE.MeshBasicMaterial({ color: 0x9ef6e1 });
    const flameMat = () => new THREE.MeshBasicMaterial({ color: 0x9ef6e1, transparent: true, opacity: 0.8 });
    // A flat plate cut to a planform: points are (x, z), z aft.
    const plate = (pts, t) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2).rotateX(Math.PI / 2);
    // Hull: turned on a lathe along its length (nose at -z), wider than it is tall.
    const girth = new THREE.SplineCurve([[0, 0.03], [0.07, 0.42], [0.2, 0.84], [0.36, 1.0], [0.52, 0.97], [0.7, 0.72], [0.86, 0.42], [1, 0.1]].map(([s, r]) => new THREE.Vector2(s, r))).getPoints(22);
    const prof = (k = 1, a = 0, b = 1) => girth.filter((p) => p.x >= a - 1e-6 && p.x <= b + 1e-6).map((p) => new THREE.Vector2(Math.max(0.02, p.y * k), 5 - p.x * 9.6)).reverse();
    const lathe = (pts, mat, phi0 = 0, phi = Math.PI * 2) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 18, phi0, phi), mat); m.rotation.x = -Math.PI / 2; m.scale.set(1.28, 1, 0.92); group.add(m); return m; };
    lathe(prof(), slate);
    lathe(prof(1.02), pale, Math.PI * 0.5, Math.PI);            // the pale belly, up to the waterline
    lathe(prof(1.03, 0.72, 0.82), pale);                         // the white band before the tail
    lathe(prof(1.035), teal, Math.PI * 0.46, Math.PI * 0.05);    // a thin waterline stripe each side
    lathe(prof(1.035), teal, Math.PI * 1.49, Math.PI * 0.05);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 5.4), pale);
    keel.position.set(0, -0.85, -0.2);
    group.add(keel);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 8), dark);
    beak.rotation.x = -Math.PI / 2 - 0.16; beak.position.set(0, -0.12, -5.2); beak.scale.set(1.2, 1, 0.75);
    group.add(beak);
    const tubeNose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 6), dark);
    tubeNose.rotation.x = Math.PI / 2; tubeNose.position.set(0, 0.2, -4.55);
    group.add(tubeNose);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), glass);
    canopy.scale.set(1.05, 0.66, 2.4); canopy.position.set(0, 0.68, -2.2);
    group.add(canopy);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 3.6), slate);
    spine.position.set(0, 0.84, 1.2); spine.rotation.x = 0.07;
    group.add(spine);
    group.userData.wings = [];
    group.userData.engines = [];
    group.userData.gear = [];
    group.userData.liftJets = [];
    for (const side of [-1, 1]) {
        // A cranked wing on a pivot at the hull: the inner panel rises to the shoulder
        // engine, the long outer panel sweeps back and falls to a lit tip.
        const wing = new THREE.Group();
        wing.position.set(side * 0.7, 0.25, -0.5);
        const inner = new THREE.Mesh(plate([[0, -0.95], [2.3, -0.35], [2.3, 0.95], [0, 1.05]], 0.12), plateMat);
        inner.rotation.z = 0.3;
        const outer = new THREE.Mesh(plate([[0, -0.35], [2.8, 1.3], [2.85, 1.7], [0, 0.95]], 0.1), plateMat);
        outer.position.set(2.18, 0.67, 0); outer.rotation.z = -0.22;
        const edge = new THREE.Mesh(plate([[0, -0.37], [2.8, 1.28], [2.8, 1.42], [0, -0.15]], 0.12), teal);
        edge.position.copy(outer.position); edge.rotation.z = -0.22;
        const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.7, 4, 8), slate);
        tip.rotation.x = Math.PI / 2; tip.position.set(4.93, 0.05, 1.55);
        const tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), light);
        tipLight.position.set(4.93, 0.05, 1.08);
        // The shoulder engine, on top of the crank.
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 2.1, 12), slate);
        pod.rotation.x = Math.PI / 2; pod.position.set(2.1, 0.98, 0.35);
        const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.27, 0.3, 12), dark);
        intake.rotation.x = Math.PI / 2; intake.position.set(2.1, 0.98, -0.8);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.4, 12), dark);
        nozzle.rotation.x = Math.PI / 2; nozzle.position.set(2.1, 0.98, 1.55);
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 1.1), slate);
        pylon.position.set(2.1, 0.72, 0.3);
        const engine = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.5, 12), flameMat());
        engine.rotation.x = Math.PI / 2; engine.position.set(2.1, 0.98, 2.5);
        wing.add(inner, outer, edge, tip, tipLight, pod, intake, nozzle, pylon, engine);
        wing.scale.x = side;
        group.add(wing);
        group.userData.wings.push({ wing, side });
        group.userData.engines.push(engine);
        // The forked tail: two long blades, up and out.
        const fork = new THREE.Mesh(plate([[0, 0], [2.0, 1.35], [2.0, 1.75], [0, 1.15]], 0.09), plateMat);
        fork.position.set(side * 0.25, 0.36, 2.9); fork.rotation.z = 0.95; fork.scale.x = side;
        if (side < 0) fork.rotation.z = -0.95;
        group.add(fork);
        // Landing feet and lift jets.
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1, 0.5), dark);
        foot.position.set(side * 0.75, -1.1, 0.6);
        group.add(foot);
        group.userData.gear.push(foot);
        for (const z of [-1.9, 1.9]) {
            const jet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 14), new THREE.MeshBasicMaterial({ color: 0xa5f7e1, transparent: true, opacity: 0.65, depthWrite: false }));
            jet.rotation.z = Math.PI; jet.position.set(side * 0.6, -2, z);
            group.add(jet);
            group.userData.liftJets.push(jet);
        }
    }
    // The big stern engine.
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.9, 16), dark);
    main.rotation.x = Math.PI / 2; main.position.set(0, 0, 4.55);
    group.add(main);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2, 16), flameMat());
    flame.rotation.x = Math.PI / 2; flame.position.set(0, 0, 6.05);
    group.add(flame);
    group.userData.engines.push(flame);
    subFittings(group, dark, -4.6, 5.1);
    return group;
}
// Switch the model: "kestrel" or "petrel" (the Petrel upgrade). Effects follow the shown model.
export function setShipDesign(kestrel, design) {
    const model = kestrel.models[design] || kestrel.models.kestrel;
    for (const m of Object.values(kestrel.models)) m.visible = m === model;
    kestrel.ship.userData = model.userData;
    kestrel.design = design;
}

// New look (style.mjs): the ships in the world's surface style. Facets softened like rocks
// and trunks (soften.js), and on the painted hull panels: fine panel seams, a little
// streaky weathering and wear, drawn in the shader from each part's own coordinates.
const PANELS = new WeakSet();
export function hullDetail(material) {
    if (PANELS.has(material)) return;
    PANELS.add(material);
    const glossy = material.roughness < 0.3;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = "varying vec3 vShipP;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vShipP = position;");
        shader.fragmentShader = `varying vec3 vShipP;
float sHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sHash(i), sHash(i + vec3(1, 0, 0)), f.x), mix(sHash(i + vec3(0, 1, 0)), sHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sHash(i + vec3(0, 0, 1)), sHash(i + vec3(1, 0, 1)), f.x), mix(sHash(i + vec3(0, 1, 1)), sHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
` + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      {
        vec3 q = fract(vShipP * vec3(0.9, 0.75, 0.6) + 0.37);
        vec3 e = min(q, 1.0 - q);
        vec3 w = fwidth(vShipP * vec3(0.9, 0.75, 0.6)) * 1.1 + 0.004;
        vec3 l = 1.0 - smoothstep(vec3(0.0), w, e);
        float seam = max(max(l.x, l.y), l.z);
        float streak = sNoise(vec3(vShipP.x * 7.0, vShipP.y * 7.0, vShipP.z * 0.9)) * 0.6 + sNoise(vShipP * 3.0) * 0.4;
        float wear = smoothstep(0.62, 0.8, sNoise(vShipP * 11.0));
        diffuseColor.rgb *= (1.0 - 0.18 * seam) * (0.9 + 0.12 * streak);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.82 + 0.04, wear * 0.35);
      }`).replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (sNoise(vShipP * 5.0) - 0.5) * ${glossy ? "0.05" : "0.2"}, 0.05, 1.0);`);
    };
    material.customProgramCacheKey = () => "ship-hull";
}
function stylise(model) {
    if (PLANT_STYLE === "classic") return;
    const done = new Map();
    model.traverse((o) => {
        if (!o.isMesh || !o.material?.isMeshStandardMaterial) return;
        const m = o.material;
        m.flatShading = false; m.needsUpdate = true;
        if (!done.has(o.geometry)) { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry); softenNormals(THREE, g, 0.6); done.set(o.geometry, g); }
        o.geometry = done.get(o.geometry);
        if (m.metalness < 0.7) hullDetail(m); // painted parts; glass and bare metal stay plain
    });
}
export function createKestrel() {
    const models = { kestrel: makeShip(), petrel: makePetrel() };
    stylise(models.kestrel); stylise(models.petrel);
    const ship = new THREE.Group();
    ship.add(models.kestrel, models.petrel);
    models.petrel.visible = false;
    ship.userData = models.kestrel.userData;
    const shipShadow = new THREE.Mesh(
        new THREE.CircleGeometry(4.2, 32),
        new THREE.MeshBasicMaterial({
            color: 0x172323,
            transparent: true,
            opacity: 0.23,
            depthWrite: false,
        }),
    );
    const dustMaterial = new THREE.MeshBasicMaterial({
        color: 0xb9bba2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
    });
    const dust = new THREE.Group();
    for (let i = 0; i < 28; i++) {
        const puff = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1, 0),
            dustMaterial,
        );
        dust.add(puff);
    }
    return { ship, shipShadow, dust, dustMaterial, gear: 0, sub: 0, models, design: "kestrel" };
}

// Landing gear, lift jets, engine glow and ground dust, from the flight state.
// s: { mode, speed, verticalSpeed, altitude, maneuverTime, animationTime, shipPosition, surfacePoint }
export function updateShipEffects(kestrel, s, dt) {
    const { ship, dust, dustMaterial } = kestrel;
    const { mode, speed, verticalSpeed, animationTime, shipPosition, surfacePoint } = s;
    const maneuvering = mode === "landing" || mode === "takeoff";
    const gearTarget =
        mode === "landed" || mode === "walk" || mode === "landing" ? 1 : 0;
    kestrel.gear = damp(
        kestrel.gear,
        gearTarget,
        mode === "takeoff" ? 1.2 : 3,
        dt,
    );
    for (const foot of ship.userData.gear) {
        foot.scale.y = 0.15 + 0.85 * kestrel.gear;
        foot.position.y = -0.5 - 0.6 * kestrel.gear;
    }
    // Diving: the wings fold back and up along the hull, the lamps and propeller come out.
    kestrel.sub = damp(kestrel.sub, mode === "dive" ? 1 : 0, 2.5, dt);
    for (const { wing, side } of ship.userData.wings) {
        wing.scale.set(side * (1 - 0.6 * kestrel.sub), 1, 1 - 0.25 * kestrel.sub);
        wing.rotation.z = side * 0.55 * kestrel.sub;
    }
    ship.userData.lamps.visible = ship.userData.prop.visible = kestrel.sub > 0.3;
    if (kestrel.sub > 0.3) ship.userData.prop.rotation.z += dt * (2 + Math.abs(speed) * 1.5);
    const agl = Math.max(0, s.altitude);
    let liftPower =
        mode === "flight" ? 0.2 + Math.abs(verticalSpeed) * 0.025 : 0;
    if (mode === "landing")
        liftPower = 0.4 + 0.45 * (1 - clamp(agl / 28, 0, 1));
    if (mode === "takeoff")
        liftPower = 0.25 + 0.8 * smoothstep(s.maneuverTime / 0.8);
    for (const jet of ship.userData.liftJets) {
        jet.visible = liftPower > 0.05;
        jet.scale.y = liftPower * (0.9 + 0.1 * Math.sin(animationTime * 45));
        jet.position.y = -1.25 - jet.scale.y * 0.9;
    }
    for (const engine of ship.userData.engines) {
        engine.visible =
            mode === "flight" ||
            mode === "space" ||
            mode === "transit" ||
            mode === "deep" ||
            maneuvering;
        engine.scale.y =
            0.12 +
            Math.min(Math.abs(speed), 130) * 0.026 +
            Math.sin(animationTime * 40) * 0.025;
    }
    const dustPower =
        mode === "space" || mode === "transit" || mode === "deep" || mode === "dive"
            ? 0
            : liftPower * clamp(1 - agl / 18, 0, 1);
    dust.visible = dustPower > 0.025 || mode === "dive";
    if (mode === "dive") {
        // Bubbles streaming back from the propeller, rising as they go.
        dust.position.copy(ship.position);
        dust.quaternion.copy(ship.quaternion);
        dustMaterial.opacity = 0.35;
        dustMaterial.color.set(0xd8f0ff);
        for (let i = 0; i < dust.children.length; i++) {
            const phase = (animationTime * (0.4 + Math.min(Math.abs(speed), 14) * 0.05) + i / 28) % 1, a = i * 2.399, puff = dust.children[i];
            puff.position.set(Math.cos(a) * (0.3 + phase * 0.8), phase * 1.6 + Math.sin(a) * 0.3, 3.4 + phase * (2 + Math.abs(speed) * 0.5));
            puff.scale.setScalar(0.05 + 0.06 * (1 - phase));
        }
    } else if (dust.visible) {
        dustMaterial.color.set(0xb9bba2);
        const n = shipPosition.clone().normalize();
        dust.position.copy(surfacePoint(n, 0.2));
        dust.quaternion.setFromUnitVectors(Y, n);
        dustMaterial.opacity = dustPower * 0.12;
        for (let i = 0; i < dust.children.length; i++) {
            const phase = (animationTime * 0.55 + i / 28) % 1;
            const angle = i * 2.399;
            const radius = 2 + phase * 10;
            const puff = dust.children[i];
            puff.position.set(
                Math.cos(angle) * radius,
                0.15 + phase * 0.8,
                Math.sin(angle) * radius,
            );
            puff.scale.set(1 + phase * 2, 0.2 + phase * 0.45, 1 + phase * 2);
        }
    }
}
