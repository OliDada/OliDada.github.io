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
    return group;
}

export function createKestrel() {
    const ship = makeShip();
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
    return { ship, shipShadow, dust, dustMaterial, gear: 0 };
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
        mode === "space" || mode === "transit" || mode === "deep"
            ? 0
            : liftPower * clamp(1 - agl / 18, 0, 1);
    dust.visible = dustPower > 0.025;
    if (dust.visible) {
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
