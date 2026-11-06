// Kestrel, the player's ship: model, ground shadow, landing dust and the
// effects that follow the flight state (gear, lift jets, engine glow).
import * as THREE from "./vendor/three.module.js";
import { damp, smoothstep } from "./flight-math.mjs";

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

// The Petrel: a sea and storm ship, after the seabird. A long, slim white hull with a
// keel and a teal waterline, a bubble canopy, gull wings (up from the hull, then down
// to floats at the bend, so it rides the water level), twin canted tail fins and a
// single big stern engine with two small ones. Under water the wings fold back along
// the hull and the same lamps and propeller as the Kestrel come out.
function makePetrel() {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, metalness: 0.2, roughness: 0.45, flatShading: true });
    const teal = new THREE.MeshStandardMaterial({ color: 0x1f8a8f, metalness: 0.3, roughness: 0.5, flatShading: true });
    const grey = new THREE.MeshStandardMaterial({ color: 0xc9ced0, metalness: 0.35, roughness: 0.55, flatShading: true, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2c33, metalness: 0.6, roughness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b4f5c, metalness: 0.8, roughness: 0.08, emissive: 0x0d2a30, emissiveIntensity: 0.6 });
    // Hull: a lathe along z, pointed at the nose (-z), tapering to the stern.
    const prof = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.max(0.02, 0.95 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (t > 0.8 ? 1 - (t - 0.8) * 1.6 : 1)), -4.6 + t * 9)); }
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 10), white);
    hull.rotation.x = -Math.PI / 2; hull.scale.set(1, 1, 0.82);
    group.add(hull);
    const stripe = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 1.02, v.y)), 10, Math.PI * 0.62, Math.PI * 0.76), teal);
    stripe.rotation.x = -Math.PI / 2; stripe.scale.set(1, 1, 0.82); stripe.position.y = -0.05;
    group.add(stripe);
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 5.2), teal);
    keel.position.set(0, -0.85, 0.2);
    group.add(keel);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), glass);
    canopy.scale.set(1, 0.7, 1.9); canopy.position.set(0, 0.55, -1.7);
    group.add(canopy);
    group.userData.wings = [];
    group.userData.engines = [];
    group.userData.gear = [];
    group.userData.liftJets = [];
    for (const side of [-1, 1]) {
        // A gull wing on a pivot at the hull: an inner panel rising outward, an outer panel
        // falling to a float at the bend, a teal leading edge.
        const wing = new THREE.Group();
        wing.position.set(side * 0.55, 0.15, -0.2);
        const inner = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.7), grey);
        inner.position.set(1.1, 0.38, 0.15); inner.rotation.z = 0.33; inner.rotation.y = -0.12;
        const outer = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.07, 1.2), grey);
        outer.position.set(3.35, 0.5, 0.75); outer.rotation.z = -0.22; outer.rotation.y = -0.3;
        const edge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.14), teal);
        edge.position.set(3.25, 0.56, 0.17); edge.rotation.z = -0.22; edge.rotation.y = -0.3;
        const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.1, 4, 8), white);
        float.rotation.x = Math.PI / 2; float.position.set(2.3, 0.35, 0.4);
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.3), grey);
        strut.position.set(2.3, 0.6, 0.4);
        wing.add(inner, outer, edge, float, strut);
        wing.scale.x = side;
        group.add(wing);
        group.userData.wings.push({ wing, side });
        // Two small engines beside the stern.
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.2, 14), dark);
        nozzle.rotation.x = Math.PI / 2; nozzle.position.set(side * 0.75, 0.05, 3.3);
        group.add(nozzle);
        const engine = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.6, 14), new THREE.MeshBasicMaterial({ color: 0x9ef6e1, transparent: true, opacity: 0.8 }));
        engine.rotation.x = Math.PI / 2; engine.position.set(side * 0.75, 0.05, 4.4);
        group.add(engine);
        group.userData.engines.push(engine);
        // Twin tail fins, canted outward.
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 1.2), teal);
        fin.position.set(side * 0.45, 0.85, 3.4); fin.rotation.set(-0.35, 0, -side * 0.35);
        group.add(fin);
        // Landing feet and lift jets.
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1, 0.5), dark);
        foot.position.set(side * 0.7, -1.1, 0.8);
        group.add(foot);
        group.userData.gear.push(foot);
        for (const z of [-1.6, 1.8]) {
            const jet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 14), new THREE.MeshBasicMaterial({ color: 0xa5f7e1, transparent: true, opacity: 0.65, depthWrite: false }));
            jet.rotation.z = Math.PI; jet.position.set(side * 0.6, -2, z);
            group.add(jet);
            group.userData.liftJets.push(jet);
        }
    }
    // The big stern engine.
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.8, 16), dark);
    main.rotation.x = Math.PI / 2; main.position.set(0, 0, 4.35);
    group.add(main);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.2, 16), new THREE.MeshBasicMaterial({ color: 0x9ef6e1, transparent: true, opacity: 0.8 }));
    flame.rotation.x = Math.PI / 2; flame.position.set(0, 0, 5.8);
    group.add(flame);
    group.userData.engines.push(flame);
    subFittings(group, dark, -3.9, 4.9);
    return group;
}
// Switch the model: "kestrel" or "petrel" (the Petrel upgrade). Effects follow the shown model.
export function setShipDesign(kestrel, design) {
    const model = kestrel.models[design] || kestrel.models.kestrel;
    for (const m of Object.values(kestrel.models)) m.visible = m === model;
    kestrel.ship.userData = model.userData;
    kestrel.design = design;
}

export function createKestrel() {
    const models = { kestrel: makeShip(), petrel: makePetrel() };
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
