import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import {
    route,
    newRoute, groundAt, ensureRoute, multiplier, strangeness,
    createRun,
    position,
    step,
    gapFor,
    areaFor, isFork, hazardsFor,
} from "./motion.mjs";
import { createStorm } from "./storm.js";
import { createOcean } from "./ocean.js";
import { dreamTime, dreamUniforms } from "./dream.js";
import { railIsClear } from "./clearance.mjs";
import { createDistricts } from "./procedural.js";
import { createUI } from "./ui.js";
import { createCrumble } from "./crumble.js";
const ui = createUI();
const touchDevice = matchMedia("(any-pointer: coarse)").matches;
const world = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
world.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.07, 0.07, 0.07);
scene.fog = new THREE.FogExp2(new THREE.Color(0.09, 0.09, 0.09), 0.018);
const camera = new THREE.PerspectiveCamera(65, 1, 0.08, 190);
const hemisphere = new THREE.HemisphereLight(0xbbbbbb, 0x333333, 1.25);
scene.add(hemisphere);
const ambientFill = new THREE.AmbientLight(0xffffff, 0.035);
scene.add(ambientFill);
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(-30, 22, -20);
scene.add(sun, sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 30,
    bottom: -30,
    near: 1,
    far: 100,
});
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.035;
const hatched = (color, style) => { const m = new THREE.MeshLambertMaterial({ color }); m.defines = { HATCH: style }; return m; };
const materials = {
    wood: hatched(0x777777, 1),
    dark: hatched(0x303030, 4),
    pale: hatched(0xaaaaaa, 3),
    roof: hatched(0x444444, 2),
    rope: new THREE.MeshLambertMaterial({ color: 0x909090 }),
    black: new THREE.MeshBasicMaterial({ color: 0x111111 }),
};
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const staticBoxes = [];
function box(x, y, z, w, h, d, material = materials.wood, parent = scene) {
    const m = new THREE.Mesh(boxGeometry, material);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    parent.add(m);
    if (parent === scene) staticBoxes.push(m);
    return m;
}
function cylinder(x, y, z, r, h, material = materials.dark, parent = scene) {
    const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.08, h, 7),
        material,
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}
function line(points, r = 0.035, material = materials.rope, parent = scene) {
    const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
    );
    const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, r, 4, false),
        material,
    );
    parent.add(mesh);
    return mesh;
}
function rng(n) {
    const v = Math.sin(n * 127.1 + 14.9) * 43758.5453;
    return v - Math.floor(v);
}
// Every run is generated afresh; ?seed=123 replays a particular one.
const params = new URLSearchParams(location.search);
if (params.has("seed")) newRoute(Number(params.get("seed")));
const ocean = createOcean(scene);
const crumble = createCrumble(scene, { value: 300 });

function warehouse(x, z, w = 12, d = 15, h = 9) {
    box(x, h / 2 - 1, z, w, h, d, materials.wood);
    for (let a = -w / 2 + 0.5; a < w / 2; a += 0.65)
        box(
            x + a,
            h / 2 - 1,
            z + d / 2 + 0.025,
            0.035,
            h,
            0.06,
            materials.dark,
        );
    for (let a = -d / 2 + 0.5; a < d / 2; a += 0.65)
        box(
            x + w / 2 + 0.025,
            h / 2 - 1,
            z + a,
            0.06,
            h,
            0.035,
            materials.dark,
        );
    box(x, h - 1, z, w + 0.8, 0.25, d + 1, materials.dark);
    const rise = w * 0.34,
        half = w / 2 + 0.5;
    for (const side of [-1, 1]) {
        // Exposed rafters replace the intact roof underneath the missing shingles.
        for(let r=0;r<6;r++) {
            const roof=box(x+side*half*.5,h-1+rise*.5,z-d/2+r*d/5,Math.hypot(half,rise),.14,.13,materials.dark);
            roof.rotation.z=-side*Math.atan2(rise,half);
        }
    }
    const gableGeometry = new THREE.BufferGeometry();
    gableGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [-w / 2, 0, 0, w / 2, 0, 0, 0, rise, 0],
            3,
        ),
    );
    gableGeometry.computeVertexNormals();
    for (const side of [-1, 1]) {
        const gable = new THREE.Mesh(
            gableGeometry,
            new THREE.MeshLambertMaterial({
                color: 0x666666,
                side: THREE.DoubleSide,
            }),
        );
        gable.position.set(x, h - 1, z + (side * d) / 2);
        scene.add(gable);
    }
    for (const side of [-1, 1]) {
        box(
            x + side * w * 0.27,
            4,
            z + d / 2 + 0.08,
            1.5,
            2,
            0.08,
            materials.black,
        );
        box(
            x + side * w * 0.27,
            4,
            z + d / 2 + 0.14,
            0.07,
            2,
            0.07,
            materials.pale,
        );
        box(
            x + side * w * 0.27,
            4,
            z + d / 2 + 0.14,
            1.5,
            0.07,
            0.07,
            materials.pale,
        );
    }
    box(x, 1, z + d / 2 + 0.1, 2.5, 4, 0.13, materials.dark);
    for (let i = 0; i < 4; i++)
        cylinder(
            x + (i % 2 ? 1 : -1) * (w / 2 - 1),
            -1.8,
            z + (i < 2 ? 1 : -1) * (d / 2 - 1),
            0.35,
            3.5,
        );
}
// The opening quay is fixed; everything past its first corner is generated.
warehouse(-10, -11, 11, 12, 8);
warehouse(10, -15, 7, 8, 7);
// Lighthouse and a seawall, softened by distance.
box(-112, -0.2, -60, 55, 2, 10, materials.dark);
cylinder(-98, 9, -60, 3, 21, materials.pale);
cylinder(-98, 20, -60, 3.5, 1.2);
cylinder(-98, 22, -60, 2.3, 3, materials.dark);
cylinder(-98, 24, -60, 3, 0.5, materials.pale);
for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cylinder(
        -98 + Math.cos(a) * 2.6,
        22,
        -60 + Math.sin(a) * 2.6,
        0.1,
        3,
        materials.pale,
    );
}
const lighthouseTop = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 3, 8),
    materials.dark,
);
lighthouseTop.position.set(-98, 25.5, -60);
scene.add(lighthouseTop);

const boats = [];
function boat(x, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, -0.65, z);
    g.scale.setScalar(scale);
    scene.add(g);
    const shape = new THREE.Shape();
    shape.moveTo(0, -4);
    shape.lineTo(1.25, -2.5);
    shape.lineTo(1.4, 2.5);
    shape.lineTo(0, 4);
    shape.lineTo(-1.4, 2.5);
    shape.lineTo(-1.25, -2.5);
    shape.closePath();
    const hull = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
            depth: 0.8,
            bevelEnabled: true,
            bevelSize: 0.18,
            bevelThickness: 0.2,
            bevelSegments: 1,
            steps: 1,
        }),
        materials.dark,
    );
    hull.rotation.x = Math.PI / 2;
    g.add(hull);
    for (let j = -2; j <= 2; j++)
        box(0, 0.1, j, 2.3, 0.12, 0.32, materials.wood, g);
    cylinder(0, 3.7, 0, 0.09, 8, materials.pale, g);
    line(
        [
            [0, 7.5, 0],
            [-1.2, 0.1, 2.5],
        ],
        0.025,
        materials.rope,
        g,
    );
    line(
        [
            [0, 7.5, 0],
            [1.2, 0.1, -2.5],
        ],
        0.025,
        materials.rope,
        g,
    );
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [0.1, 7, 0, 0.1, 1.7, 0, 2.8, 1.7, 0.2],
            3,
        ),
    );
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(
        sailGeo,
        new THREE.MeshLambertMaterial({
            color: 0xaaaaaa,
            side: THREE.DoubleSide,
        }),
    );
    g.add(sail);
    boats.push({ g, baseY: -0.65, phase: x });
    return g;
}
boat(7, -12, 0.9);
boat(-7, 4, 0.7);
boat(-14, -2, 1.3);
// Cargo, barrel hoops, and a hanging lantern lend scale to the walkways.
function crate(x, z, size = 0.6) {
    box(x, size / 2 + 0.12, z, size, size, size);
    box(
        x,
        size / 2 + 0.12,
        z + size / 2 + 0.01,
        0.07,
        size,
        0.05,
        materials.dark,
    );
    for (const y of [0.2, size])
        box(x, y, z + size / 2 + 0.02, size, 0.06, 0.05, materials.dark);
    const brace = box(
        x,
        size / 2 + 0.12,
        z + size / 2 + 0.03,
        0.06,
        size * 1.2,
        0.04,
        materials.dark,
    );
    brace.rotation.z = 0.7;
}
crate(-1.5, 3);
crate(1.5, -17);
crate(1.5, -18, 0.6);
function barrel(x, z) {
    cylinder(x, 0.65, z, 0.4, 1.1, materials.wood);
    for (const y of [0.22, 1.05]) {
        const hoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.41, 0.035, 4, 12),
            materials.dark,
        );
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(x, y, z);
        scene.add(hoop);
    }
}
barrel(-1.6, -19);
const lanterns = [];
for (const [x, z] of [
    [-1.7, 7],
    [1.7, -3],
    [-1.7, -17],
]) {
    cylinder(x, 2.3, z, 0.09, 4.5);
    box(x + 0.4, 4.5, z, 0.9, 0.08, 0.08, materials.dark);
    const lamp = new THREE.Group();
    lamp.position.set(x + 0.8, 3.7, z);
    box(0, 0, 0, 0.37, 0.55, 0.37, materials.pale, lamp);
    for (const sign of [-1, 1])
        box(sign * 0.2, 0, 0.2, 0.04, 0.65, 0.04, materials.dark, lamp);
    box(0, 0.36, 0, 0.55, 0.1, 0.55, materials.dark, lamp);
    box(0, -0.36, 0, 0.5, 0.1, 0.5, materials.dark, lamp);
    scene.add(lamp);
    lanterns.push(lamp);
    const light = new THREE.PointLight(0xffffff, 25, 11, 2);
    light.position.set(x + 0.8, 2.7, z);
    scene.add(light);
}
// Distant cloth and birds give the still world gentle movement.
const flags = [];
for (const [x, z] of [
    [-6, -15],
]) {
    cylinder(x, 8, z, 0.09, 12);
    const geometry = new THREE.PlaneGeometry(2.4, 1, 8, 2);
    const flag = new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({
            color: 0x999999,
            side: THREE.DoubleSide,
        }),
    );
    flag.position.set(x + 1.2, 13, z);
    scene.add(flag);
    flags.push(flag);
}
const birds = [];
for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const wing = box(-0.25, 0, 0, 0.5, 0.035, 0.16, materials.dark, g);
    const other = box(0.25, 0, 0, 0.5, 0.035, 0.16, materials.dark, g);
    scene.add(g);
    birds.push({ g, wing, other, phase: i * 1.6 });
}
const ball = new THREE.Group();
const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0x666666 }),
);
ball.add(ballMesh);
const seam = new THREE.Mesh(
    new THREE.TorusGeometry(0.384, 0.012, 4, 32),
    materials.pale,
);
ball.add(seam);
scene.add(ball);
const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 20),
    new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
    }),
);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

const beacon = new THREE.SpotLight(0xffffff, 85, 115, 0.16, 0.65, 1.4);
beacon.position.set(-98, 22, -60);
scene.add(beacon, beacon.target);
const storm = createStorm(scene, {
    box,
    cylinder,
    line,
    materials,
    rng,
    route,
});
const districts = createDistricts(scene, materials);
// Batch static architecture to keep dense detail affordable on phones.
const batches = new Map();
for (const mesh of staticBoxes) {
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh);
}
for (const [material, meshes] of batches) {
    const batch = new THREE.InstancedMesh(boxGeometry, material, meshes.length);
    meshes.forEach((mesh, i) => {
        mesh.updateMatrix();
        batch.setMatrixAt(i, mesh.matrix);
        scene.remove(mesh);
    });
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.frustumCulled = false;
    scene.add(batch);
}

// Render actual 3D into a small framebuffer, then two-color ordered dithering.
const target = new THREE.WebGLRenderTarget(320, 240, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
});

const postScene = new THREE.Scene(),
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postMaterial = new THREE.ShaderMaterial({
    uniforms: {
        image: { value: target.texture },

        time: { value: 0 },
        flash: { value: 0 },
        dream: { value: 0.3 },
        negative: { value: 0 },
        skyFlip: { value: 0 },
        horizon: { value: 100 },
        resolution: { value: new THREE.Vector2(320, 240) },
    },
    vertexShader:
        "varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D image;uniform float time;uniform float flash;uniform float dream;uniform float negative;uniform float skyFlip;uniform float horizon;uniform vec2 resolution;varying vec2 uvOut;
float threshold(vec2 p){int x=int(mod(p.x,4.));int y=int(mod(p.y,4.));int n=x+y*4;float v=0.;if(n==0)v=0.;if(n==1)v=8.;if(n==2)v=2.;if(n==3)v=10.;if(n==4)v=12.;if(n==5)v=4.;if(n==6)v=14.;if(n==7)v=6.;if(n==8)v=3.;if(n==9)v=11.;if(n==10)v=1.;if(n==11)v=9.;if(n==12)v=15.;if(n==13)v=7.;if(n==14)v=13.;if(n==15)v=5.;return(v+.5)/16.;}
float h1(float n){return fract(sin(n*91.345)*47453.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec4 at(vec2 p){return texture2D(image,(clamp(p,vec2(0.),resolution-1.)+.5)/resolution);}
vec3 hex(float r,float g,float b){return vec3(r,g,b)/255.;}
void main(){
  vec2 px=floor(uvOut*resolution);
  // The frame flows in whole-pixel shears: barely at rest, restless during dream events.
  float edge=smoothstep(.08,.55,length((uvOut-.5)*vec2(1.,.85)));
  float breathe=(.55+.45*sin(time*.21))*(.25+dream*1.1);
  vec2 flow=vec2(sin(px.y*.045+time*.5)+sin(px.y*.13-time*.37+px.x*.02)*.5,sin(px.x*.05-time*.41)*.6);
  vec2 base=px+floor(flow*mix(edge,1.,dream*.5)*breathe*2.4+.5);
  // Water: per-scanline horizontal offsets, like an old raster-interrupt ripple.
  float water=1.-at(base).a;
  float row=base.y;
  float wob=(sin(row*.42+time*2.3)*1.1+sin(row*.09-time*.8)*1.4)*(1.2-uvOut.y*.6);
  base.x+=floor(wob+.5)*step(.75,water);
  // Crumbling: thin columns of the land occasionally slip down a few pixels and snap back.
  float col=floor(base.x/2.);
  float phase=time*.55+h1(col)*7.;
  float slip=max(0.,h2(vec2(col,floor(phase)))-(.985-dream*.05))/.05;
  vec2 sp=base+vec2(0.,floor(slip*fract(phase)*7.));
  if(1.-at(sp).a>.25||water>.25)sp=base;
  vec4 c=at(sp);
  float l=dot(c.rgb,vec3(.299,.587,.114));
  // Sky flip: in the dark above the horizon, an upside-down copy of the world
  // dissolves in pixel by pixel: the sea overhead, the boardwalk hanging from it.
  if(skyFlip>0.&&px.y>horizon){
    vec2 mp=vec2(px.x+floor(sin(px.y*.05+time*.4)*2.),2.*horizon-px.y+2.);
    vec4 m=at(mp);float ml=dot(m.rgb,vec3(.299,.587,.114));
    if(l<.12&&mp.y>0.&&threshold(px+vec2(3.,1.))<skyFlip*smoothstep(0.,14.,px.y-horizon)){c=m;l=ml*.8;}
  }
  float wet=step(.25,1.-c.a);
  l=pow(clamp((l-.02)*1.7,0.,1.),.75);
  // The water's dither crawls diagonally, a palette-cycling shimmer.
  vec2 tp=px+wet*floor(vec2(time*6.,time*2.5));
  // Four shades in the reference's colours (ink, deep teal, sage, mint), like a
  // Game Boy screen: readable mid-tones, with dither only between neighbours.
  vec3 pal[4];pal[0]=hex(11.,26.,29.);pal[1]=hex(42.,72.,62.);pal[2]=hex(112.,150.,120.);pal[3]=hex(204.,232.,200.);
  float v=pow(clamp(l*1.15,0.,1.),.85);
  float levels=v*3.;
  int shade=int(clamp(floor(levels)+step(threshold(tp),fract(levels)),0.,3.));
  vec3 color=pal[0];
  for(int k=1;k<4;k++)if(k==shade)color=pal[k];
  // Water keeps the hand-drawn feel: pale horizontal strokes drift over it where light catches the swell.
  if(wet>.5){
    float rs=h1(px.y*1.37+7.);
    float len=2.+floor(rs*6.);
    float x=px.x+rs*97.+floor(time*(1.5+rs*2.5))*(rs>.5?1.:-1.);
    float dash=step(fract(x/(len*3.)),smoothstep(.35,.9,v)*.8)*step(.5,mod(px.y+floor(rs*2.),2.));
    if(dash>.5)color=pal[3];
  }
  if(negative>.5)color=pal[3]+pal[0]-color;
  gl_FragColor=vec4(color,1.);
}`,
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));
function resize() {
    const w = innerWidth,
        h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = Number(params.get("fov")) || (w / h < 0.8 ? 90 : 65);
    camera.updateProjectionMatrix();
    const scale = Math.max(w / 288, h / 180);
    const rw = Math.max(112, Math.round(w / scale));
    const rh = Math.round((rw * h) / w);
    target.setSize(rw, rh);
    postMaterial.uniforms.resolution.value.set(rw, rh);
    ui.resize(rw, rh);
    ocean.setPixelScale(rh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    crumble.material.uniforms.pixelScale.value = rh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
addEventListener("resize", resize);
resize();
let run = createRun(),
    mode = "first",
    active = false,
    paused = false,
    clock = 0,
    jumpInput = false,
    turnInput = 0,
    duckInput = false,
    fallTime = 0;
// ?area=swamp|village|exposed|fork|narrow|house|arches|ramp jumps to the first such stretch.
function jumpTo(test, offset = 3) {
    ensureRoute(60);
    const index = route.findIndex((s, i) => i > 0 && test(s));
    if (index < 0) return;
    run.segment = index;
    run.progress = typeof offset === "function" ? offset(route[index]) : offset;
    run.heading = Math.atan2(route[index].dx, -route[index].dz);
    run.distance = route.slice(0, index).reduce((sum, s) => sum + s.length, 0) + run.progress;
}
const area = params.get("area");
if (["swamp", "village", "exposed", "forest", "canal", "cliffs", "marsh", "wrecks", "breakers", "shallows", "sunken", "lighthouse"].includes(area)) jumpTo((s) => s.area === area);
if (area === "fork") jumpTo((s) => s.fork, (s) => s.length - 10);
if (area === "narrow") jumpTo((s) => s.narrow, 1);
if (["house", "arches", "ribs", "roots", "overhang", "bridge"].includes(area)) jumpTo((s) => s.cover?.type === area, (s) => Math.max(0, s.cover.start - 6));
if (area === "ramp") jumpTo((s) => s.ramp, (s) => Math.max(0, s.ramp.start - 4));
// ?at=metres places you that far along the chosen stretch (negative counts back from its end).
if (params.has("seg")) jumpTo((s) => route.indexOf(s) === Number(params.get("seg")), 1);
if (params.has("at") && (area || params.has("seg"))) { const s = route[run.segment], v = Number(params.get("at")); run.progress = v < 0 ? s.length + v : v; }

const overlay = document.getElementById("intro"),
    message = document.getElementById("message"),
    chapter = document.getElementById("chapter");
if (area === "forest") {
    overlay.querySelector("h1").innerHTML = "The deep<br>dark<br><i>woods.</i>";
    overlay.querySelector("p").textContent = "Trunks close in. Something drifts between them.";
}
if (area === "swamp") {
    overlay.querySelector("h1").innerHTML =
        "Where the<br>woods<br><i>drown.</i>";
    overlay.querySelector("p").textContent =
        "Moss, dark pools, and a boardwalk through the trees.";
}
const cameraAim = new THREE.Vector3(),
    cameraWanted = new THREE.Vector3(),
    lookWanted = new THREE.Vector3();
let cameraInitialized = false;
let stride = 0, landDip = 0, roll = 0, wasAirborne = false, respawnHold = 0;
// ?t=seconds freezes the clock (visual inspection only).
const debugClock = new URLSearchParams(location.search).has("t") ? Number(new URLSearchParams(location.search).get("t")) : null;
// ?look=yaw,pitch pins the first-person gaze (handy for inspecting the water).
const debugLook = new URLSearchParams(location.search).get("look")?.split(",").map(Number);
// Let the player inspect the rolling water without changing the route direction.
let lookYaw = 0,
    lookPitch = 0,
    lookPointer = null,
    lookX = 0,
    lookY = 0;
// Touch: swipe like a classic runner. Swipe left / right to dodge or turn,
// up to jump, down to duck (held while your finger stays down). A tap jumps.
const swipes = new Map();
let touchDuck = null, duckUntil = 0;
renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    if (!active) { begin(); return; }
    swipes.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), done: false });
});
renderer.domElement.addEventListener("pointermove", (e) => {
    const sw = swipes.get(e.pointerId);
    if (!sw || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y, reach = Math.min(innerWidth, innerHeight) * 0.06;
    if (Math.hypot(dx, dy) < reach) return;
    sw.done = true;
    if (Math.abs(dx) > Math.abs(dy)) requestTurn(Math.sign(dx));
    else if (dy < 0) requestJump();
    else { duckInput = true; touchDuck = e.pointerId; duckUntil = performance.now() + 550; }
});
for (const type of ["pointerup", "pointercancel"])
    renderer.domElement.addEventListener(type, (e) => {
        const sw = swipes.get(e.pointerId);
        swipes.delete(e.pointerId);
        if (sw && !sw.done && performance.now() - sw.t < 300) requestJump();
        if (e.pointerId === touchDuck) {
            touchDuck = null;
            // A quick flick still ducks long enough to clear a beam.
            const left = duckUntil - performance.now();
            if (left > 0) setTimeout(() => { if (touchDuck === null) duckInput = false; }, left);
            else duckInput = false;
        }
    });
renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    if (lookPointer !== null) return;
    lookPointer = e.pointerId;
    lookX = e.clientX;
    lookY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookPointer) return;
    // Mouse look follows the mouse: drag right to look right, drag up to look up.
    lookYaw = THREE.MathUtils.clamp(
        lookYaw + (e.clientX - lookX) * 0.006,
        -1.3,
        1.3,
    );
    lookPitch = THREE.MathUtils.clamp(
        lookPitch - (e.clientY - lookY) * 0.006,
        -0.65,
        0.55,
    );
    lookX = e.clientX;
    lookY = e.clientY;
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    renderer.domElement.addEventListener(type, (e) => {
        if (e.pointerId === lookPointer) lookPointer = null;
    });

function switchView() {
    lookYaw = lookPitch = 0;
    mode = mode === "first" ? "ball" : "first";
    document.getElementById("view").innerHTML =
        `VIEW: ${mode === "first" ? "FIRST PERSON" : "FOLLOW BALL"} <span>V</span>`;
    cameraInitialized = false;
}
document.getElementById("view")?.remove();
// Score, combo multiplier and lives.
const hud = document.createElement("div");
hud.id = "hud";
hud.innerHTML = '<div><span id="score">0</span><small>SCORE</small></div><div><span id="mult">×1</span><small id="combo">COMBO 0</small></div><div><span id="lives"></span><small>BEST <b id="best">0</b></small></div>';
document.querySelector("header").appendChild(hud);
let lives = 3, best = 0, hudScore = 0, lastMult = 1;
try { best = Number(localStorage.getItem("stillwater-best") || 0); } catch {}
function updateHud() {
    document.getElementById("score").textContent = Math.floor(run.score).toLocaleString();
    document.getElementById("mult").textContent = `×${multiplier(run)}`;
    document.getElementById("combo").textContent = `COMBO ${run.combo}`;
    document.getElementById("lives").textContent = "◆".repeat(Math.max(0, lives)) + "◇".repeat(Math.max(0, 3 - lives));
    document.getElementById("best").textContent = Math.floor(Math.max(best, run.score)).toLocaleString();
}
let lastFinal = 0, lastRecord = false;
function gameOver() {
    active = false;
    const final = Math.floor(run.score), record = final > best;
    if (record) { best = final; try { localStorage.setItem("stillwater-best", String(best)); } catch {} }
    overlay.querySelector(".eyebrow").textContent = record ? "A NEW BEST" : "THE WATER TOOK YOU";
    overlay.querySelector("h1").innerHTML = `${final.toLocaleString()}<br><i>points</i>`;
    overlay.querySelector("p").innerHTML = `${Math.floor(run.distance)} m · best ${best.toLocaleString()}<br>The next route will be different.`;
    document.getElementById("start").innerHTML = "Run again <span>→</span>";
    overlay.hidden = false;
    over = true;
    lastFinal = final; lastRecord = record;
}
let over = false;
function freshRun() {
    newRoute();
    run = createRun();
    lives = 3;
    fallTime = 0;
    dreamEvent = null;
    nextEventAt = clock + 24 + Math.random() * 14;
    over = false;
}
function begin() {
    if (over) freshRun();
    lookYaw = lookPitch = 0;
    updateHud();
    active = true;
    paused = false;
    overlay.hidden = true;
    jumpInput = false;
    turnInput = 0;
    cameraInitialized = false;
}
document.getElementById("start").onclick = begin;
function pause() {
    if (!active) return;
    paused = !paused;
    jumpInput = false;
    turnInput = 0;
    document.getElementById("pause").textContent = paused ? "▶" : "Ⅱ";
}
document.getElementById("pause").onclick = pause;
function requestJump() {
    if (active && !paused && run.state === "running") jumpInput = true;
}
function requestTurn(dir) {
    if (active && !paused) turnInput = dir;
}
document.getElementById("jump").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    requestJump();
});
document.getElementById("left").onclick = () => requestTurn(-1);
document.getElementById("right").onclick = () => requestTurn(1);
const duckButton = document.getElementById('duck');
duckButton.onpointerdown = e => { e.preventDefault(); duckInput = true; duckButton.setPointerCapture(e.pointerId); };
duckButton.onpointerup = duckButton.onpointercancel = () => duckInput = false;
addEventListener('keyup', e => { if (['ArrowDown','KeyS'].includes(e.code)) duckInput = false; });
addEventListener("keydown", (e) => {
    if (['ArrowDown','KeyS'].includes(e.code)) { e.preventDefault(); duckInput = true; }
    if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.code))
        e.preventDefault();
    if (e.repeat) return;
    if ((e.code === "Space" || e.code === "Enter") && !active) { begin(); return; }
    if (e.code === "Space" || e.code === "ArrowUp") requestJump();
    if (e.code === "ArrowLeft" || e.code === "KeyA") requestTurn(-1);
    if (e.code === "ArrowRight" || e.code === "KeyD") requestTurn(1);
    if (e.code === "KeyP" || e.code === "Escape") pause();
    if (e.code === "KeyR") {
        freshRun();
        begin();
    }
    if (e.code === "Enter" && !active) begin();
});
addEventListener("blur", () => {
    duckInput = false;
    if (active && !paused) pause();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden && active && !paused) pause();
});
// Respawn a few metres back, on boards clear of gaps and hazards.
function safeRespawn(segment, at) {
    const s = route[segment], hole = gapFor(segment);
    for (let p = Math.min(at - 9, s.length - 12); p > 0; p -= 0.5) {
        const clear = (!hole || p + 6 < hole.start || p > hole.end + 0.5) &&
            hazardsFor(segment).every((h) => p + 6 < h.at || p > h.at + 1);
        if (clear) return p;
    }
    return 0;
}
// Place names drift as the dream deepens: letters doubled, dropped or swapped, stable per stretch.
function misremember(name) {
    return name;
}
function misrememberOld(name, index) {
    const d = strangeness(index);
    let out = "";
    for (let i = 0; i < name.length; i++) {
        const r = Math.abs(Math.sin((index + 1) * 91.7 + i * 13.1)) % 1;
        const c = name[i];
        if (c !== " " && r < d * 0.07) continue;
        out += c;
        if (c !== " " && r > 1 - d * 0.07) out += c;
    }
    if (d > 0.8 && index % 3 === 0) out = out.split(" ").reverse().join(" ");
    return out;
}
function update(dt) {
    if (run.state === "fell") {
        fallTime += dt;
        if (fallTime > 0.55) {
            const segment = run.segment,
                distance = run.distance, failAt = run.failAt, old = run;
            lives--;
            updateHud();
            if (lives <= 0) { gameOver(); return; }
            run = createRun();
            run.score = old.score;
            run.segment = segment;
            run.heading = Math.atan2(route[segment].dx, -route[segment].dz);
            run.progress = safeRespawn(segment, failAt ?? 0);
            // Whatever was pressed while falling is forgotten: you land standing.
            jumpInput = false;
            turnInput = 0;
            respawnHold = 0.35;
            wasAirborne = false;
            landDip = 0;
            run.distance = distance;
            fallTime = 0;
            cameraInitialized = false;
        }
        return;
    }
    if (params.has("still")) return; // inspection: keep the camera parked
    if (respawnHold > 0) { respawnHold -= dt; jumpInput = false; }
    step(run, dt, { jump: jumpInput, turn: turnInput, duck: duckInput });
    jumpInput = false;
    turnInput = 0;
    run.events.length = 0;
    if (multiplier(run) > lastMult) { banner(`x${multiplier(run)}`); }
    lastMult = multiplier(run);
}
// ?maxdt=0.3 lets slow (software) renderers advance time faster for inspection.
const maxStep = Number(params.get("maxdt") || 0.05);
// Dream events: long calm stretches, then a moment where reality gives way.
// They are visual; the boards under you stay where they are.
const EVENT_TYPES = ["wave", "skyflip", "searise", "crumble"];
let dreamEvent = null, nextEventAt = params.has("event") ? 3 : 24 + Math.random() * 14, lastEventType = "";
const eventLength = { wave: 14, skyflip: 13, searise: 12, crumble: 12 };
function startEvent(type) {
    const p = position(run), s = route[run.segment];
    dreamEvent = { type, start: clock, end: clock + eventLength[type] };
    lastEventType = type;
    if (type === "wave") {
        dreamUniforms.waveFrame.value.set(p.x + s.dx * 4, p.z + s.dz * 4, s.dx, s.dz);
        dreamUniforms.waveParam.value.set(clock, p.y, 1, 0);
    }
}
function updateDream(dt) {
    if (active && !paused && !dreamEvent && clock > nextEventAt) {
        // The world above is hidden by the canopy in the woods, so it never happens there.
        const pool = params.has("event") && !lastEventType ? [params.get("event")] : EVENT_TYPES.filter((t) => t !== lastEventType && !(t === "skyflip" && areaFor(run.segment) === "forest"));
        startEvent(pool[Math.floor(Math.random() * pool.length)]);
    }
    // The run sinks deeper: the baseline strangeness and event frequency grow with distance.
    const deep = strangeness(run.segment);
    let level = 0.15 + deep * 0.5, flip = 0, rise = 0;
    storm.setStrange(deep);
    // Far in, the palette sometimes turns negative for an instant.
    const negative = deep > 0.55 && Math.sin(clock * 0.9) * Math.sin(clock * 0.31) > 0.985 - (deep - 0.55) * 0.02 ? 1 : 0;
    postMaterial.uniforms.negative.value = negative;
    if (dreamEvent) {
        const t = clock - dreamEvent.start, len = dreamEvent.end - dreamEvent.start;
        const env = Math.min(1, t / 2.5) * Math.min(1, Math.max(0, (len - t) / 3.5));
        level = Math.max(level, 0.3 + 0.7 * env);
        if (dreamEvent.type === "skyflip") flip = env;
        districts.setMirror(dreamEvent.type === "skyflip" ? Math.pow(env, 0.6) : 0);
        if (dreamEvent.type === "searise") rise = env * env;
        if (clock > dreamEvent.end) { dreamEvent = null; nextEventAt = clock + (28 + Math.random() * 30) * (1 - deep * 0.6); }
    }
    const u = dreamUniforms;
    u.dreamLevel.value += (level - u.dreamLevel.value) * (1 - Math.exp(-dt * 2));
    u.seaRise.value += (rise - u.seaRise.value) * (1 - Math.exp(-dt * 1.5));
    postMaterial.uniforms.dream.value = u.dreamLevel.value;
    // The old screen-space sky copy is retired; the world above is real geometry now.
    postMaterial.uniforms.skyFlip.value = 0;
    if (!dreamEvent) districts.setMirror(0);
    // Where the horizon sits on screen, for the sky flip.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize().multiplyScalar(400).add(camera.position).project(camera);
    postMaterial.uniforms.horizon.value = Math.floor((forward.y * 0.5 + 0.5) * postMaterial.uniforms.resolution.value.y);
}
let previous = performance.now(), flash = 0, bannerUntil = 0;
function banner(text) { bannerText = text; bannerUntil = clock + 1.6; }
let bannerText = "";
function frame(now) {
    const dt = Math.min(maxStep, (now - previous) / 1000);
    previous = now;
    if (!paused) clock += dt;
    if (debugClock !== null) clock = debugClock;
    if (active && !paused) {
        let remaining = dt;
        while (remaining > 0) {
            const sub = Math.min(remaining, 1 / 120);
            update(sub);
            remaining -= sub;
        }
    }
    ocean.update(clock, run.segment, position(run));
    ocean.setRocks(districts.seaRocks(), position(run));
    // The sixteen nearest lanterns light the world around them.
    {
        const lit = districts.lanterns().map((l) => [l, l.p.distanceToSquared(camera.position)]).sort((a, b) => a[1] - b[1]).slice(0, 16);
        dreamUniforms.lanterns.value.forEach((v, i) => lit[i] ? v.set(lit[i][0].p.x, lit[i][0].p.y, lit[i][0].p.z, lit[i][0].strength) : v.set(0, -100, 0, 0));
    }
    districts.update(run.segment, clock, run, dreamEvent?.type === "crumble");
    boats.forEach(({ g, baseY, phase }) => {
        g.position.y =
            baseY +
            Math.sin(clock * 1.4 + phase) * 0.6 +
            Math.sin(clock * 1.72 + phase * 0.7) * 0.25;
        g.rotation.z = Math.sin(clock * 1.4 + phase) * 0.17;
        g.rotation.x = Math.cos(clock * 1.72 + phase) * 0.12;
    });
    lanterns.forEach((g, i) => {
        g.rotation.z =
            Math.sin(clock * 2.1 + i) * 0.2 + Math.sin(clock * 3.5 + i) * 0.04;
    });
    flags.forEach((flag, j) => {
        const p = flag.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            p.setZ(
                i,
                Math.sin(x * 5 - clock * 6 + j) * (x + 1.2) * 0.24 +
                    Math.sin(clock * 2 + x) * (x + 1.2) * 0.12,
            );
        }
        p.needsUpdate = true;
        flag.geometry.computeVertexNormals();
    });
    birds.forEach(({ g, wing, other, phase }) => {
        g.position.set(
            Math.sin(clock * 0.08 + phase) * 27,
            15 + Math.sin(clock * 0.2 + phase) * 2,
            -35 + Math.cos(clock * 0.08 + phase) * 20,
        );
        g.rotation.y = -clock * 0.08 - phase;
        wing.rotation.z = Math.sin(clock * 3 + phase) * 0.4;
        other.rotation.z = -wing.rotation.z;
    });
    const p = position(run);
    storm.update(clock, p, run.segment);
    // Each district has its own air; the deep woods are close, black and still.
    const here = areaFor(run.segment), ease = 1 - Math.exp(-dt * 0.9);
    const air = {
        swamp: [0.03, 0.3, 1.3, 0.06], forest: [0.055, 0.05, 0.75, 0.03],
        canal: [0.032, 0.09, 1.2, 0.05], cliffs: [0.01, 0.08, 1.7, 0.08],
        marsh: [0.05, 0.3, 1.5, 0.14], wrecks: [0.024, 0.05, 1.25, 0.05], breakers: [0.014, 0.07, 1.6, 0.08],
        shallows: [0.02, 0.22, 1.6, 0.12], sunken: [0.03, 0.07, 1.2, 0.06], lighthouse: [0.012, 0.07, 1.55, 0.07],
        village: [0.02, 0.07, 1.4, 0.06], exposed: [0.012, 0.05, 1.55, 0.06],
    }[here] || [0.016, 0.06, 1.45, 0.05];
    scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, air[0], ease);
    ambientFill.intensity = THREE.MathUtils.lerp(ambientFill.intensity, air[1], ease);
    hemisphere.intensity = THREE.MathUtils.lerp(hemisphere.intensity, air[2], ease);
    districts.setDarkness(THREE.MathUtils.clamp((1.45 - hemisphere.intensity) / 0.7, 0, 1));
    const shade = THREE.MathUtils.lerp(scene.fog.color.r, air[3], ease);
    scene.fog.color.setScalar(shade);
    scene.background.setScalar(shade * 0.8);
    flash *= Math.exp(-dt * 6);
    postMaterial.uniforms.flash.value = flash;
    if (active) updateHud();
    sun.position.set(p.x - 30, 22, p.z - 20);
    sun.target.position.set(p.x, 0, p.z - 12);
    beacon.target.position.set(
        -98 + Math.sin(clock * 0.18) * 80,
        0,
        -60 + Math.cos(clock * 0.18) * 80,
    );
    const turnProgress = 1 - run.turnTime / 0.28;
    const smooth = turnProgress * turnProgress * (3 - 2 * turnProgress);
    const heading =
        run.turnTime > 0
            ? THREE.MathUtils.lerp(run.turnFrom, run.heading, smooth)
            : run.heading;
    const dx = Math.sin(heading),
        dz = -Math.cos(heading);
    // Gaps and missed turns drop you into the water; hitting an obstacle is a
    // stumble on the boards (a jolt and a crouch), never a fall through them.
    const intoWater = run.failure === "gap" || run.failure === "turn";
    const lift = run.state === "fell" ? (intoWater ? -fallTime * 3 : -Math.min(fallTime * 4, 0.9) + Math.sin(fallTime * 40) * 0.04 * Math.max(0, 1 - fallTime * 3)) : run.jumpHeight;
    const y = p.y + lift;
    // Look along the slope rather than into it.
    const aheadY = groundAt(run.segment, Math.min(run.progress + 6, route[run.segment].length)) + lift;
    ball.visible = mode === "ball";
    ball.position.set(p.x, (run.duck ? .26 : .48) + y, p.z);
    ball.scale.y = run.duck ? .5 : 1;
    if (active && !paused && run.turnTime === 0 && run.state === "running")
        ball.rotateOnWorldAxis(
            new THREE.Vector3(dz, 0, -dx),
            (run.speed * dt) / 0.38,
        );
    shadow.visible = mode === "ball" && run.state !== "fell";
    shadow.position.set(p.x, p.y + 0.12, p.z);
    shadow.material.opacity = 0.5 / (1 + lift);
    if (debugLook) [lookYaw, lookPitch = 0] = debugLook;
    // First-person body: stride bob and sway, a dip on landing, lean into dodges and corners.
    const running = active && !paused && run.state === "running";
    const grounded = run.jumpHeight === 0;
    if (running && grounded) stride += dt * run.speed * 1.15;
    if (wasAirborne && grounded && running) landDip = 0.16;
    wasAirborne = !grounded;
    landDip *= Math.exp(-dt * 9);
    const bobAmount = running && grounded ? 0.045 + run.speed * 0.003 : 0;
    const bob = Math.abs(Math.sin(stride)) * bobAmount - landDip;
    const sway = Math.sin(stride * 0.5) * bobAmount * 0.6;
    const turnRate = run.turnTime > 0 ? (run.heading - run.turnFrom) : 0;
    const wantRoll = -(run.laneTarget - run.lane) * 0.11 - turnRate * 0.05 * Math.sin(Math.PI * smooth) + sway * 0.25;
    roll += (wantRoll - roll) * (1 - Math.exp(-dt * 10));
    const fovWanted = (Number(params.get("fov")) || (innerWidth / innerHeight < 0.8 ? 90 : 65)) + (running ? (run.speed - 8.5) * 1.3 + (grounded ? 0 : 2) : 0);
    if (Math.abs(camera.fov - fovWanted) > 0.01) {
        camera.fov += (fovWanted - camera.fov) * (1 - Math.exp(-dt * 4));
        camera.updateProjectionMatrix();
    }
    if (mode === "first") {
        const sx = -dz * sway, sz = dx * sway;
        cameraWanted.set(p.x + sx, (run.duck ? .65 : 1.65) + y + bob, p.z + sz);
        lookWanted.set(
            p.x + Math.sin(heading + lookYaw) * 7,
            (run.duck ? .55 : 1.35) + aheadY + lookPitch * 7 + bob * 0.5,
            p.z - Math.cos(heading + lookYaw) * 7,
        );
    } else {
        cameraWanted.set(p.x - dx * 5, 3.5 + p.y + lift * 0.4, p.z - dz * 5);
        lookWanted.set(p.x + dx * 3, 0.7 + aheadY - lift * 0.5, p.z + dz * 3);
    }
    if (!active && run.state === "running") {
        cameraWanted.set(p.x - dx * 3 + dz * 3, 3.2 + p.y, p.z - dz * 3 - dx * 3);
        lookWanted.set(p.x + dx * 12, 0.2 + p.y, p.z + dz * 12);
    }
    if (!cameraInitialized) {
        camera.position.copy(cameraWanted);
        cameraAim.copy(lookWanted);
        cameraInitialized = true;
    } else {
        camera.position.lerp(cameraWanted, 1 - Math.exp(-14 * dt));
        cameraAim.lerp(lookWanted, 1 - Math.exp(-16 * dt));
    }
    camera.lookAt(cameraAim);
    if (active) camera.rotateZ(roll + Math.sin(clock * 0.35) * 0.16 * dreamUniforms.seaRise.value);
    updateDream(dt);
    if (Math.floor(clock) !== Math.floor(clock - dt)) scene.traverse((o) => { if (o.isMesh || o.isPoints) o.frustumCulled = false; });
    // Minimal pixel HUD: one word of advice, only when it matters.
    {
        const s = route[run.segment], hole = gapFor(run.segment), ahead = (at) => at - run.progress;
        const hazard = hazardsFor(run.segment).find((h) => ahead(h.at) > 0 && ahead(h.at) < 7);
        let hint = "", urgent = false;
        if (run.state === "fell") hint = "";
        else if (clock < bannerUntil) hint = bannerText.replace("×", "x").replace(" MULTIPLIER", "");
        else if (hazard) { hint = { beam: "DUCK", cargo: "DODGE", log: "JUMP", wall: "DODGE", swing: "DUCK" }[hazard.type]; urgent = ahead(hazard.at) < 4; }
        else if (hole && ahead(hole.start) > 0 && ahead(hole.start) < 7) { hint = "JUMP"; urgent = ahead(hole.start) < 4; }
        else if (s.turn && run.progress > s.length - 11 && !run.queued) { hint = isFork(run.segment) ? "< FORK >" : s.turn === 1 ? "TURN >" : "< TURN"; urgent = run.progress > s.length - 5; }
        const names = { harbor: "STILLWATER QUAY", swamp: "THE DROWNED WOODS", village: "THE STILT VILLAGE", exposed: "THE OUTER REACH", forest: "THE DEEP WOODS", canal: "THE NARROW CANALS", cliffs: "THE CLIFF ROAD", marsh: "THE REED SEA", wrecks: "THE SHIP GRAVEYARD", breakers: "THE BREAKERS", shallows: "THE MIRROR SHALLOWS", sunken: "THE SUNKEN TOWN", lighthouse: "THE LIGHTHOUSE ISLE" };
        ui.draw({
            screen: active ? "play" : over ? "over" : "title", clock, touch: touchDevice,
            score: over ? lastFinal : Math.floor(run.score), mult: multiplier(run), lives, paused,
            best: Math.floor(best), record: lastRecord, distance: Math.floor(run.distance),
            area: misremember(names[areaFor(run.segment)], run.segment), hint, urgent,
        });
    }
    if (paused) message.textContent = "Paused · P or  ▶  to continue.";
    else if (clock < bannerUntil) message.textContent = bannerText;
    else if (run.state === "fell")
        message.textContent = "Lost your footing · returning to the approach.";
    else if (hazardsFor(run.segment).some(h => h.at > run.progress && h.at-run.progress < 7))
        message.textContent = hazardsFor(run.segment).find(h => h.at > run.progress && h.at-run.progress < 7).type === 'beam' ? 'Fallen beam · HOLD ↓ / DUCK' : 'Loose cargo · ← → to dodge, or JUMP';
    else if (
        gapFor(run.segment) &&
        run.progress > gapFor(run.segment).start - 7 &&
        run.progress < gapFor(run.segment).end
    )
        message.textContent = "Broken planks ahead · SPACE / JUMP";
    else if (
        route[run.segment].turn &&
        run.progress > route[run.segment].length - 11
    )
        message.textContent = run.queued
            ? "Turn ready. Keep your footing."
            : isFork(run.segment) ? "Fork ahead · choose LEFT ← or RIGHT →"
            : route[run.segment].turn === 1
              ? "At the lantern: turn RIGHT →"
              : "At the lantern: turn LEFT ←";
    else if (route[run.segment].narrow)
        message.textContent = "A single beam · no room to sidestep";
    else if (route[run.segment].cover?.type === "house" && run.progress > route[run.segment].cover.start - 6 && run.progress < route[run.segment].cover.end)
        message.textContent = "Through the house · mind the ceiling";
    else
        message.textContent =
            mode === "first"
                ? "← → dodge / turn · ↓ duck · SPACE jump"
                : "← → dodge / turn · ↓ duck · SPACE jump";
    chapter.textContent = `${Math.floor(run.distance)} M · ${misremember({ harbor: "STILLWATER QUAY", swamp: "THE DROWNED WOODS", village: "THE STILT VILLAGE", exposed: "THE OUTER REACH", forest: "THE DEEP WOODS", canal: "THE NARROW CANALS", cliffs: "THE CLIFF ROAD", marsh: "THE REED SEA", wrecks: "THE SHIP GRAVEYARD", breakers: "THE BREAKERS", shallows: "THE MIRROR SHALLOWS", sunken: "THE SUNKEN TOWN", lighthouse: "THE LIGHTHOUSE ISLE" }[areaFor(run.segment)], run.segment)} · ${Math.round(run.speed * 3.6)} KM/H`;
    postMaterial.uniforms.time.value = clock;
    dreamTime.value = clock;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
