import { clearOfPier } from "./clearance.mjs";
import { seed as routeSeed } from "./motion.mjs";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

// Coastal scenery and weather are separate from the route and jump simulation.
export function createStorm(
    scene,
    { box, cylinder, line, materials, rng, route },
) {
    const stone = new THREE.MeshLambertMaterial({
        color: 0x606060,
        flatShading: true,
    });
    stone.defines = { HATCH: 2 };
    const leaf = new THREE.MeshLambertMaterial({
        color: 0x656565,
        side: THREE.DoubleSide,
    });
    const brightLeaf = new THREE.MeshLambertMaterial({
        color: 0x999999,
        side: THREE.DoubleSide,
    });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x171b19 });
    const shutters = [];
    const shrubs = [];
    const looseRopes = [];
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const dummy = new THREE.Object3D();
    const rocks = new THREE.InstancedMesh(rockGeometry, stone, 180);
    const cliffs = new THREE.InstancedMesh(rockGeometry, materials.dark, 28);
    scene.add(rocks, cliffs);
    // Rocks and the cliff horizon are re-laid around the current stretch of
    // the (per-run) route, always pushed clear of the boardwalk.
    let laidFor = "";
    function relayout(index) {
        const key = `${index}:${route.length}:${route[0].turn}:${route[index]?.x}`;
        if (key === laidFor) return;
        laidFor = key;
        for (let i = 0; i < 180; i++) {
            const s = route[0];
            const side = i % 2 ? 1 : -1, t = rng(i + 30 + index * 3) * s.length;
            const off = side * (8 + rng(i + 70) * 24);
            const x = s.x + s.dx * t - s.dz * off, z = s.z + s.dz * t + s.dx * off;
            dummy.scale.set(1 + rng(i) * 3, 1 + rng(i + 1) * 3, 1 + rng(i + 2) * 4);
            const clear = clearOfPier(x, z, Math.max(dummy.scale.x, dummy.scale.y, dummy.scale.z));
            dummy.position.set(clear.x, -1 + rng(i + 20) * 2.4, clear.z);
            dummy.rotation.set(rng(i), rng(i + 2) * 6, rng(i + 6));
            dummy.updateMatrix();
            rocks.setMatrixAt(i, dummy.matrix);
        }
        rocks.instanceMatrix.needsUpdate = true;
        const here = route[index], hx = here.x + here.dx * here.length, hz = here.z + here.dz * here.length;
        for (let i = 0; i < 28; i++) {
            dummy.position.set(hx - 70 + i * 5, 4 + rng(i + 50) * 8, hz - 70 - rng(i + 4) * 22);
            dummy.scale.set(5 + rng(i) * 7, 7 + rng(i + 2) * 13, 6 + rng(i + 3) * 7);
            const cliffClear = clearOfPier(dummy.position.x, dummy.position.z, Math.hypot(dummy.scale.x, dummy.scale.z) + dummy.scale.y * 0.3);
            dummy.position.x = cliffClear.x; dummy.position.z = cliffClear.z;
            dummy.rotation.set(0, rng(i) * 6, rng(i + 7) * 0.3);
            dummy.updateMatrix();
            cliffs.setMatrixAt(i, dummy.matrix);
        }
        cliffs.instanceMatrix.needsUpdate = true;
    }
    relayout(0);
    let laidSeed = routeSeed;
    rocks.frustumCulled = cliffs.frustumCulled = false;

    function detailedHouse(x, z, w, d, h) {
        const sideX = x + w / 2 + 0.08;
        for(let scar=0;scar<25;scar++) {
            const py=.5+rng(scar+x)* (h-2),pz=z+(rng(scar*3+x)-.5)*d;
            const crack=box(sideX+.16,py,pz,.08,.8+rng(scar)*1.2,.07+rng(scar+4)*.22,materials.black);
            crack.rotation.x=(rng(scar+3)-.5)*.5;
        }
        for(let board=0;board<3;board++) {
            const plank=box(x,3.4+board*.5,z+d/2+.3,w*.7,.22,.12,materials.wood);
            plank.rotation.z=(board-1)*.14;
        }
        // Lap siding, structural timber, gutters, and layered courses of roof shingles.
        for (let y = 0.35; y < h - 0.8; y += 0.38) {
            box(x, y, z + d / 2 + 0.07, w, 0.055, 0.1, materials.pale);
            box(sideX, y, z, 0.1, 0.055, d, materials.pale);
        }
        for (const a of [-1, 0, 1]) {
            box(
                x + a * (w / 2 - 0.18),
                h / 2 - 1,
                z + d / 2 + 0.15,
                0.18,
                h,
                0.18,
                materials.dark,
            );
            box(
                sideX + 0.05,
                h / 2 - 1,
                z + a * (d / 2 - 0.18),
                0.18,
                h,
                0.18,
                materials.dark,
            );
        }
        for (const direction of [-1, 1]) {
            const angle = Math.atan(0.68) * direction;
            for (let r = 0; r < 7; r++) {
                const u = (r + 0.5) / 7;
                const px = x + direction * (w / 2 + 0.5) * u;
                const py = h - 1 + w * 0.34 * (1 - u);
                for (let col = 0; col < Math.ceil(d / 0.85); col++) {
                    if(rng(col+r*23+x)<.28) continue;
                    const tile = box(
                        px,
                        py + 0.05,
                        z - d / 2 + col * 0.85 + (r % 2) * 0.25,
                        w / 14 + 0.16,
                        0.09,
                        0.8,
                        rng(col + r * 23) > 0.5
                            ? materials.roof
                            : materials.wood,
                    );
                    tile.rotation.z = -angle;
                }
            }
            box(
                x + direction * (w / 2 + 0.55),
                h - 1.05,
                z,
                0.18,
                0.22,
                d + 1,
                materials.dark,
            );
        }
        // Casement windows on both the pier-facing side and end facade.
        for (let row = 0; row < 2; row++)
            for (let j = 0; j < 3; j++) {
                const y = 2 + row * 3,
                    zWindow = z - d * 0.32 + j * d * 0.32;
                box(sideX + 0.08, y, zWindow, 0.12, 1.6, 1.15, windowMaterial);
                for(let board=0;board<3;board++) {
                    const plank=box(sideX+.24,y-.55+board*.5,zWindow,.13,.17,1.5,materials.wood);
                    plank.rotation.x=(rng(j+board*9)-.5)*.5;
                }
                for (const edge of [-1, 0, 1])
                    box(
                        sideX + 0.17,
                        y,
                        zWindow + edge * 0.6,
                        0.09,
                        1.85,
                        0.08,
                        materials.dark,
                    );
                for (const edge of [-1, 0, 1])
                    box(
                        sideX + 0.17,
                        y + edge * 0.85,
                        zWindow,
                        0.09,
                        0.08,
                        1.3,
                        materials.dark,
                    );
                box(
                    sideX + 0.3,
                    y - 0.95,
                    zWindow,
                    0.6,
                    0.13,
                    1.5,
                    materials.pale,
                );
                const hinge = new THREE.Group();
                hinge.position.set(sideX + 0.2, y, zWindow + 0.73);
                scene.add(hinge);
                box(0, 0, 0.36, 0.13, 1.8, 0.68, materials.wood, hinge);
                for (let slat = 0; slat < 6; slat++)
                    box(
                        0.08,
                        -0.7 + slat * 0.28,
                        0.36,
                        0.05,
                        0.05,
                        0.65,
                        materials.dark,
                        hinge,
                    );
                shutters.push({ hinge, phase: j + row * 5 + x });
            }
        for (let j = 0; j < 2; j++) {
            const wx = x + (j ? 1 : -1) * w * 0.28;
            box(wx, 4, z + d / 2 + 0.2, 1.4, 1.9, 0.09, windowMaterial);
            for (const v of [-1, 0, 1])
                box(
                    wx + v * 0.72,
                    4,
                    z + d / 2 + 0.28,
                    0.08,
                    2,
                    0.07,
                    materials.dark,
                );
            for (const v of [-1, 0, 1])
                box(
                    wx,
                    4 + v * 0.95,
                    z + d / 2 + 0.28,
                    1.5,
                    0.08,
                    0.07,
                    materials.dark,
                );
        }
        box(x - 2, h + w * 0.34, z - 2, 1.1, 4, 1.3, stone);
        for (let y = h + w * 0.34 - 1.7; y < h + w * 0.34 + 2; y += 0.35)
            box(x - 2, y, z - 1.32, 1.15, 0.05, 0.04, materials.dark);
        box(x - 2, h + w * 0.34 + 2.05, z - 2, 1.45, 0.22, 1.6, materials.pale);
        // Slanted braces under the upper floor and a crooked projecting sign.
        for (let a = -w / 2 + 1; a < w / 2; a += 2) {
            const brace = box(
                x + a,
                0.6,
                z + d / 2 + 0.4,
                0.13,
                2.4,
                0.13,
                materials.dark,
            );
            brace.rotation.x = -0.6;
        }
        box(sideX + 0.8, 5.9, z + d * 0.25, 1.7, 0.13, 0.13, materials.dark);
        line(
            [
                [sideX + 1.4, 5.9, z + d * 0.25],
                [sideX + 1.4, 5.3, z + d * 0.25],
            ],
            0.02,
        );
        const sign = box(
            sideX + 1.4,
            4.85,
            z + d * 0.25,
            0.14,
            0.8,
            1.6,
            materials.wood,
        );
        sign.rotation.x = 0.12;
        for (let i = 0; i < 3; i++)
            box(
                sideX + 1.49,
                4.65 + i * 0.18,
                z + d * 0.25,
                0.03,
                0.035,
                0.9 - i * 0.15,
                materials.pale,
            );
    }
    detailedHouse(-10, -11, 11, 12, 8);
    detailedHouse(10, -15, 7, 8, 7);

    // Leafy branches, reeds and climbing vines, all moved by a shared gust field.
    const leafGeometry = new THREE.PlaneGeometry(0.45, 0.85);
    function shrub(x, y, z, height, seed) {
        const clear = clearOfPier(x, z, 0.8 + height * 0.45);
        const group = new THREE.Group();
        group.position.set(clear.x, y, clear.z);
        scene.add(group);
        const count = 35;
        const foliage = new THREE.InstancedMesh(
            leafGeometry,
            seed % 2 ? leaf : brightLeaf,
            count,
        );
        for (let i = 0; i < count; i++) {
            const angle = rng(seed + i * 3) * Math.PI * 2;
            const lift = rng(seed + i + 11) * height;
            const spread = (0.3 + lift * 0.25) * rng(i + seed + 19);
            dummy.position.set(
                Math.cos(angle) * spread,
                lift,
                Math.sin(angle) * spread,
            );
            dummy.rotation.set(rng(i) * 1.2, angle, rng(seed + i) * 1.4 - 0.7);
            dummy.scale.setScalar(0.65 + rng(i + seed) * 1.1);
            dummy.updateMatrix();
            foliage.setMatrixAt(i, dummy.matrix);
        }
        group.add(foliage);
        for (let branch = 0; branch < 3; branch++)
            line(
                [
                    [0, 0, 0],
                    [0.15, height * 0.45, 0],
                    [0.35 + branch * 0.14, height * 0.9, (branch - 1) * 0.3],
                ],
                0.025,
                materials.rope,
                group,
            );
        shrubs.push({ group, seed, height });
    }
    for (let i = 0; i < 70; i++) {
        const side = i % 2 ? 1 : -1,
            z = 10 - rng(i + 230) * 28;
        shrub(
            side * (5 + rng(i + 430) * 7),
            -0.4,
            z,
            1.3 + rng(i + 60) * 3,
            i + 20,
        );
    }
    for (let i = 0; i < 13; i++)
        shrub(-3.3, 0.2 + rng(i + 30) * 5, -11 - i * 0.65, 1.2, i + 500);
    // Tall wind-bent trees break up the building silhouettes.
    for (let i = 0; i < 4; i++) {
        const x = -19 - rng(i + 94) * 14,
            z = 4 - i * 7;
        cylinder(x, 4, z, 0.25, 9, materials.dark);
        for (let j = 0; j < 4; j++)
            shrub(
                x + (rng(i + j * 5) - 0.5) * 3,
                4 + j * 1.1,
                z + (rng(i + j + 35) - 0.5) * 3,
                3,
                i * 20 + j + 900,
            );
    }
    for (let i = 0; i < 6; i++) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
            Array.from({ length: 20 }, () => new THREE.Vector3()),
        );
        const rope = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: 0x888888 }),
        );
        scene.add(rope);
        looseRopes.push({
            rope,
            x: -5.6,
            z: -9 - i * 1.8,
            top: 6 + rng(i) * 2,
        });
    }

    // Wave geometry and connected foam now live in ocean.js; no spray particle curtain.
    const rainCount = 350;
    const rainArray = new Float32Array(rainCount * 6);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(rainArray, 3),
    );
    const rain = new THREE.LineSegments(
        rainGeometry,
        new THREE.LineBasicMaterial({
            color: 0x707070,
            transparent: true,
            opacity: 0.38,
        }),
    );
    rain.frustumCulled = false;
    scene.add(rain);

    // Rolling low cloud bands keep the sky dark but visibly alive.
    const cloudMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { time: { value: 0 }, strange: { value: 0 } },
        vertexShader:
            "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: `uniform float time;uniform float strange;varying vec3 p;
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 q){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(q);q=q*2.03+17.;a*=.5;}return v;}
void main(){vec3 direction=normalize(p);vec2 q=direction.xz/(abs(direction.y)+.3)*3.;float low=fbm(q+vec2(time*.026,-time*.015));float high=fbm(q*2.5+vec2(-time*.04,time*.02));float shape=low*.72+high*.28;float cloud=smoothstep(.5,.63,shape);float rim=smoothstep(.44,.5,shape)-cloud;
// Pale, heavy clouds with ragged dithered edges against a black sky, and a big cratered moon.
vec3 moonDir=normalize(vec3(-.35,.42,-.85));float moon=dot(direction,moonDir);
float size=mix(.9952,.985,strange*strange);float disc=smoothstep(size,size+.0006,moon);
// Deeper in, a second, smaller moon hangs where it shouldn't.
float moon2=dot(direction,normalize(vec3(.55,.3,-.75)));disc=max(disc,step(.5,strange)*smoothstep(.9982,.9986,moon2));vec3 side=normalize(cross(moonDir,vec3(0.,1.,0.)));vec3 up=cross(side,moonDir);
vec2 mq=vec2(dot(direction,side),dot(direction,up))*90.;
float crater=step(.66,noise(mq*1.3))*.55+step(.72,noise(mq*2.7+5.))*.35;
float v=.03+cloud*.32*smoothstep(-.05,.25,direction.y+.1)+rim*.1;
v=mix(v,.9-crater*.5,disc*(1.-cloud*.8));gl_FragColor=vec4(vec3(v),1.);}`,
    });
    const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(175, 24, 12),
        cloudMaterial,
    );
    clouds.position.set(10, 0, -25);
    scene.add(clouds);
    return {
        setStrange(v) { cloudMaterial.uniforms.strange.value = v; },
        update(time, player, index = 0) {
            if (laidSeed !== routeSeed) { laidSeed = routeSeed; laidFor = ""; relayout(0); }
            const gust =
                0.6 +
                Math.sin(time * 0.73) * 0.22 +
                Math.sin(time * 1.9) * 0.18;
            shutters.forEach(({ hinge, phase }) => {
                hinge.rotation.y =
                    0.4 + Math.sin(time * 2.3 + phase) * (0.35 + gust * 0.3);
            });
            shrubs.forEach(({ group, seed, height }) => {
                group.rotation.z =
                    Math.sin(time * 2 + seed) * 0.05 + gust * 0.08;
                group.rotation.x = Math.cos(time * 1.6 + seed) * 0.06;
            });
            looseRopes.forEach(({ rope, x, z, top }, j) => {
                const a = rope.geometry.attributes.position;
                for (let i = 0; i < 20; i++) {
                    const t = i / 19;
                    a.setXYZ(
                        i,
                        x + Math.sin(time * 2.8 - t * 3 + j) * t * 0.5,
                        top - t * 4,
                        z + Math.cos(time * 1.7 + j + t) * t * 0.45,
                    );
                }
                a.needsUpdate = true;
            });
            for (let i = 0; i < rainCount; i++) {
                const y =
                    ((((rng(i + 42) * 20 - time * 12) % 20) + 20) % 20) - 2;
                const x = player.x + (rng(i + 71) - 0.5) * 32 + y * 0.35;
                const z = player.z + (rng(i + 125) - 0.5) * 40;
                rainArray.set([x, y, z, x + 0.18, y - 0.65, z + 0.1], i * 6);
            }
            rainGeometry.attributes.position.needsUpdate = true;
            cloudMaterial.uniforms.time.value = time;
            clouds.position.set(player.x, 0, player.z);
        },
    };
}
