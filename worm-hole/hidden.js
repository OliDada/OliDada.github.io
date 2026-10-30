// Pip's story (see bit.js on olid.is): Oli split his admin password into three pieces
// and hid them in his games, in places you're not meant to go. In Neon Rush the
// tunnel splits in two. The normal tunnel carries on to the right; on the left a
// second tunnel opens that isn't part of the game. Its walls come apart into an
// empty space full of floating shapes, and somewhere in there is the first piece.
import * as THREE from 'three';

const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const tell = ev => { try { if (window.parent !== window) window.parent.postMessage({ type: 'pip-tunnel', ev }, '*'); } catch (e) {} };
const isOn = () => new URLSearchParams(location.search).has('piptunnel') || (() => { try { return localStorage.getItem('pip-tunnel') === '1'; } catch (e) { return false; } })();

const R = 0.65; // same radius as the normal tunnel
const F0 = 0.97; // where the split starts (a stretch with lots of empty space to the left)
const ZONE = 6; // units over which the two tunnels pull apart

// screen-left of the camera at path parameter f (the game moves left with A)
function frameAt(spline, f) {
    const h = new THREE.Object3D();
    h.position.copy(spline.getPointAt(f % 1)); h.lookAt(spline.getPointAt((f + 0.002) % 1));
    return { T: spline.getTangentAt(f % 1).normalize(), S: new THREE.Vector3(1, 0, 0).applyQuaternion(h.quaternion).normalize(), U: new THREE.Vector3(0, 1, 0).applyQuaternion(h.quaternion).normalize() };
}

// The shape of the split. Called before the normal tunnel is built so a gap can be cut in its wall.
export function setupFork(spline) {
    if (!isOn()) return null;
    const L = spline.getLength(), dz = ZONE / L;
    const pts = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8, f = F0 + dz * u, { S } = frameAt(spline, f); pts.push(spline.getPointAt(f % 1).addScaledVector(S, 2.3 * R * u * u * (3 - 2 * u))); }
    const { T, S, U } = frameAt(spline, F0 + dz);
    const dir = T.clone().addScaledVector(S, 0.9).addScaledVector(U, -0.4).normalize();
    const side = new THREE.Vector3().crossVectors(dir, U).normalize();
    let last = pts[pts.length - 1].clone();
    for (let k = 1; k <= 30; k++) { last = last.clone().addScaledVector(dir, 4); pts.push(last.clone().addScaledVector(side, Math.sin(k * 0.8) * 0.9).addScaledVector(U, Math.sin(k * 0.37) * 1.2)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const zoneEnd = curve.getUtoTmapping ? (() => { // fraction of the secret tunnel's length taken by the split
        let len = 0; for (let k = 1; k <= 8; k++) len += pts[k].distanceTo(pts[k - 1]); return len / curve.getLength();
    })() : 0.1;
    const mainNear = []; for (let i = 0; i <= 300; i++) mainNear.push(spline.getPointAt((F0 - 0.02 + (dz + 0.05) * i / 300 + 1) % 1));
    const secretNear = []; for (let i = 0; i <= 300; i++) secretNear.push(curve.getPointAt(Math.min(1, (zoneEnd + 0.06) * i / 300)));
    const nearest = (list, p) => { let b = Infinity; for (const q of list) { const d = q.distanceToSquared(p); if (d < b) b = d; } return Math.sqrt(b); };
    // drop every triangle of a tube that lies inside the other tube
    const carve = (geometry, other, limit = R * 0.97) => {
        const pos = geometry.attributes.position, idx = geometry.index.array, keep = [];
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < idx.length; i += 3) {
            a.fromBufferAttribute(pos, idx[i]); b.fromBufferAttribute(pos, idx[i + 1]); c.fromBufferAttribute(pos, idx[i + 2]);
            const m = a.clone().add(b).add(c).divideScalar(3);
            if (nearest(other, m) < limit) continue;
            keep.push(idx[i], idx[i + 1], idx[i + 2]);
        }
        geometry.setIndex(keep);
    };
    // the outside shell of the normal tunnel is left off where the two tunnels meet
    const skipJoin = (g, radial, tubular) => {
        const idx = g.index.array, keep = [];
        for (let i = 0; i < idx.length; i += 3) {
            const f = Math.floor(idx[i] / (radial + 1)) / tubular, d = (f - (F0 - 0.015) + 1) % 1;
            if (d < dz + 0.03) continue;
            keep.push(idx[i], idx[i + 1], idx[i + 2]);
        }
        g.setIndex(keep);
    };
    return { L, dz, curve, zoneEnd, cutMain: g => carve(g, secretNear), carve: g => carve(g, mainNear), nearMain: p => nearest(mainNear, p), skipJoin };
}

export function createHiddenTunnel({ fork, scene, camera, spline, bloomPass, onExit, speedNow }) {
    const api = { enabled: !!fork, active: false, startAt: null, ghost: () => false, check: () => false, drive() {}, avoid: () => false };
    if (!fork) return api;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { curve, zoneEnd, dz } = fork;
    api.startAt = (F0 - 0.1 + 1) % 1; // start ten seconds or so before the split
    const inZone = p => ((p - F0 + 1) % 1) < dz; // between the split and where the tunnels are fully apart
    api.avoid = p => { const d = (p - (F0 - 0.03) + 1) % 1; return d < dz + 0.07; }; // no boxes near the split

    // ---- Pip's lines, typed out letter by letter
    const cap = document.createElement('div');
    cap.style.cssText = "position:fixed;left:50%;bottom:11%;transform:translateX(-50%);z-index:50;pointer-events:none;color:#ede3ff;font:700 clamp(16px,3.2vw,26px)/1.3 var(--hud-font,'ConthraxSemi','Segoe UI',sans-serif);letter-spacing:1px;text-align:center;text-shadow:0 0 12px rgba(181,140,255,.9);white-space:pre-wrap;max-width:90vw;opacity:0;transition:opacity .4s";
    document.body.appendChild(cap);
    let typeTimer = 0, hideTimer = 0;
    const say = (text, hold = 2200) => {
        clearInterval(typeTimer); clearTimeout(hideTimer);
        cap.style.opacity = '1'; cap.textContent = '';
        let i = 0;
        typeTimer = setInterval(() => {
            i++; cap.textContent = text.slice(0, i) + (i < text.length ? '▍' : '');
            if (i >= text.length) { clearInterval(typeTimer); hideTimer = setTimeout(() => { cap.style.opacity = '0'; }, hold); }
        }, text[i] === ' ' ? 30 : 48);
    };
    const said = new Set();
    const sayOnce = (k, text, hold) => { if (said.has(k)) return; said.add(k); say(text, hold); };
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:49;pointer-events:none;background:#fff;opacity:0;transition:opacity .6s';
    document.body.appendChild(flash);

    // ---- the secret tunnel: starts out solid like the normal one, then its walls come apart
    const LILAC = 0xe9dcff;
    const SEG = 420;
    const geo = new THREE.TubeGeometry(curve, SEG, R, 12, false);
    fork.carve(geo);
    // past the split, more and more of the wall is simply missing
    {
        const idx = geo.index.array, keep = [], seg = SEG;
        for (let i = 0; i < idx.length; i += 3) {
            const tri = Math.floor(idx[i] / 13), t = tri / seg; // which ring of the tube this triangle belongs to
            const gone = THREE.MathUtils.smoothstep(t, zoneEnd + 0.04, 0.22);
            if (Math.random() < gone * 0.92) continue;
            keep.push(idx[i], idx[i + 1], idx[i + 2]);
        }
        geo.setIndex(keep);
    }
    const wall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const edgeMat = new THREE.LineBasicMaterial({ color: LILAC, transparent: true, opacity: 0.9 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 0.2), edgeMat);
    const ptsGeo = new THREE.BufferGeometry(); ptsGeo.setAttribute('position', edges.geometry.attributes.position.clone());
    const dots = new THREE.Points(ptsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
    [wall, edges, dots].forEach(o => { o.frustumCulled = false; scene.add(o); });

    // ---- the space outside it: big, slow, floating shapes
    const shapes = new THREE.Group(); shapes.visible = false; scene.add(shapes);
    const palette = [0xb58cff, 0xff6fb1, 0x66f5ff, 0xffffff, 0xffe14d, 0x7ed957];
    const makers = [
        s => new THREE.IcosahedronGeometry(s, 0), s => new THREE.OctahedronGeometry(s, 0), s => new THREE.TetrahedronGeometry(s, 0),
        s => new THREE.TorusKnotGeometry(s * 0.7, s * 0.18, 80, 8), s => new THREE.TorusGeometry(s, s * 0.04, 6, 48), s => new THREE.BoxGeometry(s, s, s),
        s => new THREE.DodecahedronGeometry(s, 0)
    ];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) {
        const t = zoneEnd + 0.08 + rnd() * (1 - zoneEnd - 0.08), c = curve.getPointAt(t), tan = curve.getTangentAt(t);
        const away = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().projectOnPlane(tan).normalize();
        const size = 0.5 + rnd() * rnd() * 5, dist = 3 + size + rnd() * 16;
        const m = new THREE.Mesh(makers[Math.floor(rnd() * makers.length)](size), new THREE.MeshBasicMaterial({ color: palette[Math.floor(rnd() * palette.length)], wireframe: true, transparent: true, opacity: 0.45 + rnd() * 0.45 }));
        m.position.copy(c).addScaledVector(away, dist);
        if (fork.nearMain(m.position) < size + 2) continue; // keep clear of the normal tunnel
        m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
        m.userData = { spin: new THREE.Vector3((rnd() - .5) * 0.4, (rnd() - .5) * 0.4, (rnd() - .5) * 0.4), bob: rnd() * 6, base: m.position.clone() };
        shapes.add(m);
    }
    // one enormous one, far off
    const giant = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 1), new THREE.MeshBasicMaterial({ color: 0x6d3fd6, wireframe: true, transparent: true, opacity: 0.35 }));
    giant.position.copy(curve.getPointAt(0.45)).add(new THREE.Vector3(0, 9, 0)).addScaledVector(curve.getTangentAt(0.45), 30);
    giant.userData = { spin: new THREE.Vector3(0.02, 0.05, 0), bob: 0, base: giant.position.clone() };
    shapes.add(giant);

    // ---- the piece: a little golden key, spinning in the middle of the tunnel
    const KEY_AT = 1;
    const key = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xff9d00 });
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 28), gold); bow.position.x = -0.12;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), gold); shaft.position.x = 0.03;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.03), gold); t1.position.set(0.1, -0.035, 0);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.03), gold); t2.position.set(0.055, -0.03, 0);
    key.add(bow, shaft, t1, t2);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.8 }));
    key.add(glow); key.scale.setScalar(1.8);
    const keyHome = curve.getPointAt(KEY_AT); key.position.copy(keyHome); scene.add(key); key.visible = false;
    const have = () => store.get('pip-keys', []).includes('pass');

    // ---- going in and coming out
    let s = 0, off = new THREE.Vector3(), saved = null, got = false, phaseT = 0, leaving = false, speed = 1, v0 = 1, stoppedFor = 0;
    // speed along the secret tunnel: starts at the normal tunnel's speed, builds and builds, then a hard stop at the key
    const VMAX = 46, LEN = curve.getLength(), BRAKE = LEN - 14, STOP = LEN - 1.3;
    const speedAt = x => {
        if (x < BRAKE) return v0 + (VMAX - v0) * Math.pow(x / BRAKE, 2.4);
        const a = VMAX * VMAX / (2 * (STOP - BRAKE)); return Math.sqrt(Math.max(0, VMAX * VMAX - 2 * a * (x - BRAKE)));
    };
    const baseFov = camera.fov;
    const fog = { color: scene.fog.color.getHex(), density: scene.fog.density };
    const enterAt = (sNow, camPos) => {
        api.active = true; s = sNow; got = false; leaving = false; phaseT = 0; lapSeen = false;
        off.copy(camPos).sub(curve.getPointAt(s));
        saved = { color: scene.fog.color.getHex(), density: scene.fog.density, bloom: bloomPass ? bloomPass.strength : 0 };
        v0 = Math.max(0.8, speedNow ? speedNow() : 1); stoppedFor = 0;
        shapes.visible = true; key.visible = !have(); key.position.copy(keyHome);
        tell('in'); say("...WE'RE IN.", 1600);
    };
    const finish = () => {
        leaving = true;
        flash.style.transition = 'opacity .5s'; flash.style.opacity = '1';
        setTimeout(() => {
            api.active = false; shapes.visible = false; key.visible = false;
            camera.fov = baseFov; camera.updateProjectionMatrix();
            scene.fog.color.setHex(saved.color); scene.fog.density = saved.density; if (bloomPass) bloomPass.strength = saved.bloom;
            onExit((F0 + dz + 0.012) % 1);
            flash.style.transition = 'opacity 1s'; flash.style.opacity = '0';
            tell('out');
            say(got ? 'TWO MORE TO GO.' : 'BACK IN THE NORMAL TUNNEL.', 2400);
        }, 520);
    };

    let lapSeen = false, lapNo = 0, skipped = 0;
    const pickOne = a => a[Math.floor(Math.random() * a.length)];
    // every frame in the normal tunnel: talk on the way to the split, and switch tunnels if you went left
    api.check = (p, offsetWorld, maxR) => {
        if (api.active) return false;
        edgeMat.opacity = still ? 0.9 : 0.75 + Math.random() * 0.25;
        const before = ((F0 - p) + 1) % 1;
        if (before < 0.07 && before > 0.05 && !lapSeen && !have()) {
            lapSeen = true; lapNo++; tell('seen');
            say(lapNo === 1 ? 'WAIT. THE TUNNEL SPLITS UP AHEAD.' : "IT'S COMING ROUND AGAIN.", 2000);
        }
        if (before < 0.025 && before > 0.015 && !have()) sayOnce('left' + lapNo, 'GO LEFT!', 1400);
        const past = ((p - F0 - dz) + 1) % 1;
        if (past > 0.004 && past < 0.02 && lapSeen === 'zone' && !have()) {
            lapSeen = false; skipped++; tell('skipped');
            say(skipped === 1 ? 'NO! LEFT! THE OTHER LEFT!' : skipped === 2 ? 'YOU WENT RIGHT. AGAIN.' : pickOne(["IT'S FINE. IT COMES ROUND EVERY LAP.", 'I SAID LEFT.', "I'LL WAIT. I'M GOOD AT WAITING."]), 2400);
        }
        if (inZone(p)) {
            lapSeen = 'zone';
            const u = ((p - F0 + 1) % 1) / dz;
            const { S } = frameAt(spline, p);
            const toward = offsetWorld.dot(S) / Math.max(1e-6, maxR);
            if (u > 0.3 && toward > 0.15) {
                // carry on from the nearest point of the secret tunnel, so the camera doesn't jump
                const camPos = spline.getPointAt(p).add(offsetWorld);
                let sNow = 0, best = Infinity;
                for (let i = 0; i <= 80; i++) { const t = (zoneEnd + 0.04) * i / 80, d = curve.getPointAt(t).distanceToSquared(camPos); if (d < best) { best = d; sNow = t; } }
                enterAt(sNow, camPos); return true;
            }
        }
        return false;
    };

    // every frame inside the secret tunnel
    api.drive = (dt, want) => {
        phaseT += dt;
        shapes.children.forEach(o => { const u = o.userData; o.rotation.x += u.spin.x * dt; o.rotation.y += u.spin.y * dt; o.rotation.z += u.spin.z * dt; if (!still) o.position.y = u.base.y + Math.sin(phaseT * 0.4 + u.bob) * 0.3; });
        const x = s * LEN;
        speed = x >= STOP ? 0 : Math.max(0.6, speedAt(x));
        s = Math.min(STOP / LEN, s + (speed * dt) / LEN);
        if (s * LEN >= STOP - 0.01) stoppedFor += dt;
        // the faster you go, the wider the view
        const fov = baseFov + 32 * Math.min(1, speed / VMAX);
        camera.fov = THREE.MathUtils.lerp(camera.fov, fov, Math.min(1, dt * (speed > 1 ? 3 : 12))); camera.updateProjectionMatrix();
        // fog thins out as the walls come apart, so you can see the shapes
        const open = THREE.MathUtils.smoothstep(s, zoneEnd + 0.03, 0.2);
        scene.fog.density = THREE.MathUtils.lerp(saved.density, 0.03, open);
        scene.fog.color.setHex(0x000000);
        if (bloomPass) bloomPass.strength = THREE.MathUtils.lerp(saved.bloom, 0.9, open);
        if (s > zoneEnd + 0.02) sayOnce('a', "THIS PART ISN'T IN THE GAME.", 1800);
        if (s > 0.15) sayOnce('b', 'LOOK OUTSIDE.', 1600);
        if (s > 0.3) sayOnce('c', "OLI HID IT IN HERE. I CAN FEEL IT.", 1800);
        if (s > 0.5) sayOnce('c2', "WE'RE SPEEDING UP.", 1200);
        if (s > 0.68) sayOnce('c3', 'FASTER!', 900);
        if (s > 0.8) sayOnce('c4', 'HOLD ON!!', 900);
        if (stoppedFor > 0.25) sayOnce('d', have() ? '...NOTHING HERE ANY MORE.' : '...THERE.', 1600);
        // steering, inside the tunnel's radius; the offset you came in with settles back to the middle
        const tan = curve.getTangentAt(s), up0 = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(tan, up0).normalize(), up = new THREE.Vector3().crossVectors(right, tan).normalize();
        off.addScaledVector(right, -want.x * 0.5 * dt).addScaledVector(up, want.y * 0.5 * dt);
        off.projectOnPlane(tan).multiplyScalar(Math.exp(-dt * (want.lengthSq() ? 0.2 : 0.9)));
        if (off.length() > R * 0.55) off.setLength(R * 0.55);
        const pos = curve.getPointAt(s).add(off);
        camera.position.copy(pos);
        camera.lookAt(curve.getPointAt(Math.min(1, s + 0.01)).add(off));
        // the key comes to you, whatever line you take
        if (key.visible && !got) {
            key.rotation.y += dt * 2.2;
            const d = key.position.distanceTo(pos);
            if (stoppedFor > 1.4) key.position.lerp(pos.clone().addScaledVector(tan, 0.2), Math.min(1, dt * 3));
            if (stoppedFor > 1.4 && (d < 0.3 || stoppedFor > 3.2)) {
                got = true; key.visible = false;
                const found = store.get('pip-keys', []); if (!found.includes('pass')) store.set('pip-keys', [...found, 'pass']);
                flash.style.transition = 'none'; flash.style.background = '#ffe9a8'; flash.style.opacity = '0.6';
                requestAnimationFrame(() => { flash.style.transition = 'opacity .9s'; flash.style.opacity = '0'; flash.style.background = '#fff'; });
                tell('piece'); say('PIECE 1 OF 3: "PASS"', 2600);
            }
        }
        if (!leaving && (got ? stoppedFor > 4.6 : (have() && stoppedFor > 2.4))) finish();
    };
    return api;
}
