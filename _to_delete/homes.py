import sys
p = sys.argv[1]
s = open(p).read()

H = {}

H['coral'] = '''      home(add, k) { // a knobbly grown chamber, ribbed with bands, branching arms tipped with polyps
        const R0 = 1.35 * u * k, cy = .35 * u;
        add(sunk(cyl(R0 * .95, R0, SINK + .2 * u, 9)), L(), C.wall2);
        add(ball(R0, 1), L(0, cy + R0 * .45, 0, 0, r() * 6, 0, 1, .78, 1), C.wall);
        for (const [y, s] of [[.25, 1.02], [.7, .95], [1.05, .75]]) add(new THREE.TorusGeometry(R0 * s, .07 * u, 4, 14).rotateX(Math.PI / 2), L(0, cy + R0 * y * .78 + R0 * .1, 0), C.wall2);
        for (let i = 0; i < 9; i++) { const a = r() * 6.28, y = .2 + r() * .9; add(ball(.16 * u * k, 0), L(Math.cos(a) * R0 * .97 * Math.sqrt(1 - (y - .5) ** 2), cy + R0 * .45 + (y - .5) * R0 * 1.4, Math.sin(a) * R0 * .97 * Math.sqrt(1 - (y - .5) ** 2)), i % 2 ? C.accent2 : C.wall2); }
        const n = 4 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2 + r() * .4, lean = .25 + r() * .35, h = (1.4 + r() * 1.6) * u * k * tall, rad = (.16 + r() * .12) * u * k;
          const m = L(Math.cos(a) * R0 * .45, cy + R0 * .6, Math.sin(a) * R0 * .45, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
          add(cyl(rad * .65, rad, h, 6), m, i % 2 ? C.wall : C.accent);
          for (const f of [-1, 1]) { // a fork near the top
            const b = m.clone().multiply(L(0, h * .62, 0, 0, a, f * .6));
            add(cyl(rad * .35, rad * .6, h * .45, 5), b, i % 2 ? C.wall : C.accent);
            add(ball(rad * .75, 0), b.clone().multiply(L(0, h * .45, 0)), C.accent2, lights && f > 0 && i === 0);
          }
          add(ball(rad * 1.05, 0), m.clone().multiply(L(0, h, 0)), C.accent2);
        }
        add(new THREE.TorusGeometry(.6 * u * k, .12 * u, 5, 10, Math.PI), L(0, cy * .5, R0 * .9), C.wall2);
        add(dome(.55 * u * k, 8), L(0, cy * .5, R0 * .86, Math.PI / 2, 0, 0, 1, 1, .45), C.door);
        for (const x of [-1, 1]) add(dome(.2 * u * k, 6), L(x * R0 * .55, cy + R0 * .55, R0 * .78, Math.PI / 2, 0, 0, 1, 1, .4), lights ? C.window : C.door, lights);
      },
'''

H['shells'] = '''      home(add, k) { // a spiral shell, ridged and spined, with a flared lip round the door
        let y = 0, rad = 1.3 * u * k, tube = .55 * u * k;
        add(sunk(cyl(rad + tube, rad + tube * 1.1, SINK + .1 * u, 12)), L(), C.wall2);
        const turns = 4 + Math.round(Math.min(k, 2.6) * 1.5);
        for (let i = 0; i < turns; i++) {
          const off = i * .12 * u;
          add(ring(rad, tube, 12), L(off, y + tube * .7, 0, 0, i * .5), i % 2 ? C.wall : C.wall2);
          add(ring(rad + tube * .55, tube * .14, 14), L(off, y + tube * 1.25, 0, 0, i * .5), C.trim);
          for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2 + i; add(cone(tube * .2, tube * .8, 4), L(off + Math.cos(a) * (rad + tube * .85), y + tube * .7, Math.sin(a) * (rad + tube * .85), Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3), C.accent2); }
          y += tube * 1.15; rad *= .84; tube *= .9;
        }
        add(cone(rad + tube, 1.2 * u * k, 12), L(0, y + tube * .5, 0), C.accent);
        add(ball(.18 * u * k, 1), L(0, y + tube * .5 + 1.25 * u * k, 0), C.trim);
        // The lip: a flared half-ring round the doorway, a dark mouth, two round windows.
        add(new THREE.TorusGeometry(.75 * u * k, .2 * u * k, 6, 12, Math.PI), L(0, 0, 1.55 * u * k, 0, 0, 0, 1, 1.25, 1), C.trim);
        add(dome(.62 * u * k, 10), L(0, 0, 1.5 * u * k, Math.PI / 2, 0, 0, 1, 1.3, .5), C.door);
        for (const x of [-1, 1]) add(dome(.2 * u * k, 6), L(x * .9 * u * k, 1.1 * u * k, 1.25 * u * k, Math.PI / 2, x * .5, 0, 1, 1, .4), lights ? C.window : C.door, lights);
      },
'''

H['stiltpods'] = '''      home(add, k) { // a pod on three braced legs, a banded rim, a rope ladder and a finial
        const h = 2.8 * u * k * tall, rad = 1.3 * u * k;
        const foot = (i) => [Math.cos(i / 3 * Math.PI * 2) * rad * 1.25, Math.sin(i / 3 * Math.PI * 2) * rad * 1.25];
        for (let i = 0; i < 3; i++) { const [x, z] = foot(i); rod(add, [x, -SINK, z], [x * .32, h + .3 * u, z * .32], .12 * u, C.wood); add(cyl(.22 * u, .26 * u, .25 * u, 6), L(x, 0, z), C.stone2); }
        for (let i = 0; i < 3; i++) { const [x0, z0] = foot(i), [x1, z1] = foot(i + 1); rod(add, [x0 * .8, h * .3, z0 * .8], [x1 * .8, h * .3, z1 * .8], .05 * u, C.wood); }
        add(dome(rad, 12), L(0, h, 0, Math.PI, 0, 0, 1, .5, 1), C.wall2); add(dome(rad, 12), L(0, h, 0, 0, 0, 0, 1, .8, 1), C.wall);
        add(ring(rad * 1.02, .09 * u, 16), L(0, h, 0), C.trim);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.TorusGeometry(rad * 1.005, .035 * u, 3, 10, Math.PI / 2), L(0, h, 0, 0, a, 0, 1, .8, 1), C.wall2); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .4; add(dome(.17 * u, 6), L(Math.cos(a) * rad * .92, h + rad * .3, Math.sin(a) * rad * .92, 0, -a, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights); }
        add(cyl(.06 * u, .06 * u, .9 * u, 4), L(0, h + rad * .78, 0), C.wood); add(ball(.15 * u, 0), L(0, h + rad * .78 + .9 * u, 0), C.accent);
        add(cyl(.32 * u, .32 * u, .35 * u, 8), L(0, h - .9 * u, 0), C.door); add(ring(.34 * u, .05 * u, 8), L(0, h - .55 * u, 0), C.trim);
        for (const x of [-.18, .18]) rod(add, [x * u, h - .9 * u, .1 * u], [x * u, 0, .6 * u], .02 * u, C.line);
        for (let i = 1; i < 7; i++) { const t = i / 7; add(box(.4 * u, .04 * u, .05 * u), L(0, h - .9 * u - t * (h - .9 * u), .1 * u + t * .5 * u), C.wood); }
        if (r() < .5) { rod(add, [rad * .7, h - .3 * u, 0], [rad * .7, h - 1.2 * u, 0], .015 * u, C.line); add(ball(.25 * u, 0), L(rad * .7, h - 1.45 * u, 0, 0, 0, 0, 1, 1.3, 1), C.accent2); }
      },
'''

H['rings'] = '''      home(add, k) { // a low round wall under a conical canopy on a carved central pillar
        const R0 = 2.2 * u * k, wh = .9 * u * k, ph = 3 * u * k * tall;
        add(sunk(cyl(R0 * 1.08, R0 * 1.1, SINK + .1 * u, 16)), L(), C.wall2);
        add(ring(R0 * .9, .45 * u * k, 18), L(0, .35 * u * k, 0, 0, 0, 0, 1, 1.6, 1), C.wall);
        add(ring(R0 * .9, .12 * u, 18), L(0, wh + .15 * u, 0), C.trim);
        add(sunk(cyl(.32 * u, .45 * u, ph + SINK, 8)), L(), C.stone);
        for (let i = 1; i < 5; i++) add(cyl(.36 * u, .4 * u, .14 * u, 8), L(0, ph * i / 5, 0), i % 2 ? C.accent : C.stone2);
        add(cone(R0 * 1.15, ph * .45, 16).translate(0, 0, 0), L(0, ph * .62, 0), C.roof);
        add(new THREE.CylinderGeometry(R0 * 1.16, R0 * 1.16, .12 * u, 16, 1, true), L(0, ph * .62, 0), C.roof2);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; add(sunk(cyl(.07 * u, .07 * u, ph * .62 + SINK, 4)), L(Math.cos(a) * R0 * 1.02, 0, Math.sin(a) * R0 * 1.02), C.wood); }
        add(ball(.45 * u, 1), L(0, ph * 1.08, 0), C.accent, lights);
        for (const x of [-1, 1]) add(sunk(box(.25 * u, 1.5 * u + SINK, .25 * u)), L(x * .6 * u, 0, R0 * .9), C.stone2);
        add(box(1.45 * u, .2 * u, .3 * u), L(0, 1.5 * u, R0 * .9), C.stone2);
        add(cyl(.5 * u, .55 * u, .06 * u, 8), L(0, 0, R0 * .3), C.ember, level <= 3);
      },
'''

H['tethered'] = '''      home(add, k) { // a railed platform and gondola under a banded gas-bag, held by guy lines
        const H0 = (8 + r() * 6) * u * k * tall, P = 2 * u * k;
        add(sunk(cyl(.6 * u, .8 * u, .5 * u + SINK, 7)), L(), C.stone); add(ring(.5 * u, .08 * u, 8), L(0, .55 * u, 0), C.metal);
        rod(add, [0, .5 * u, 0], [0, H0, 0], .05 * u, C.line);
        for (let i = 0; i < 3; i++) { const a = i * 2.09 + .5; add(sunk(cyl(.25 * u, .3 * u, .3 * u + SINK, 6)), L(Math.cos(a) * 4 * u, 0, Math.sin(a) * 4 * u), C.stone2); rod(add, [Math.cos(a) * 4 * u, .3 * u, Math.sin(a) * 4 * u], [Math.cos(a) * P * .9, H0, Math.sin(a) * P * .9], .02 * u, C.line); }
        add(cyl(P, P * .7, .35 * u, 12), L(0, H0, 0), C.wall2);
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(cyl(.03 * u, .03 * u, .55 * u, 3), L(Math.cos(a) * P * .97, H0 + .35 * u, Math.sin(a) * P * .97), C.wood); }
        add(ring(P * .97, .03 * u, 16), L(0, H0 + .88 * u, 0), C.wood);
        add(cyl(1.1 * u * k, 1.2 * u * k, .9 * u * k, 10), L(0, H0 + .35 * u, 0), C.wall);
        add(dome(1.1 * u * k, 10), L(0, H0 + .35 * u + .9 * u * k, 0, 0, 0, 0, 1, .55, 1), C.roof);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(box(.3 * u, .3 * u, .05), L(Math.cos(a) * 1.13 * u * k, H0 + .35 * u + .35 * u * k, Math.sin(a) * 1.13 * u * k, 0, Math.PI / 2 - a, 0), lights ? C.window : C.door, lights); }
        const by = H0 + 3.4 * u * k;
        add(ball(2 * u * k, 1), L(0, by, 0, 0, 0, 0, 1.25, .75, 1.25), C.bag);
        for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(2.5 * u * k, .06 * u, 3, 16), L(0, by, 0, 0, i * Math.PI / 3, 0, 1, .6, 1), C.accent);
        add(ring(2.45 * u * k, .07 * u, 18), L(0, by, 0), C.accent);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; rod(add, [Math.cos(a) * P * .9, H0 + .3 * u, Math.sin(a) * P * .9], [Math.cos(a) * 2 * u * k, by - .9 * u * k, Math.sin(a) * 2 * u * k], .025 * u, C.line); }
        add(cone(.4 * u, .8 * u, 6).rotateX(Math.PI), L(0, by + 1.7 * u * k, 0), C.accent2);
        for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = P * (.6 + r() * .3), L0 = (1 + r() * 2) * u; rod(add, [Math.cos(a) * d, H0, Math.sin(a) * d], [Math.cos(a) * d, H0 - L0, Math.sin(a) * d], .02 * u, C.line); add(ball(.22 * u, 0), L(Math.cos(a) * d, H0 - L0 - .2 * u, Math.sin(a) * d, 0, 0, 0, 1, 1.4, 1), C.accent2); }
      },
'''

H['reef'] = '''      home(add, k) { // a ringed frond-stalk crowned with curling fronds, hung with lit bulb dwellings
        const H0 = (9 + r() * 5) * u * k * tall;
        add(sunk(cyl(.35 * u, .75 * u, H0 + SINK, 7)), L(), C.wall2);
        for (let y = 1.2 * u; y < H0 * .9; y += 1.3 * u) add(cyl(.42 * u * (1 - y / H0 * .45), .5 * u * (1 - y / H0 * .45), .18 * u, 7), L(0, y, 0), C.wall);
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; rod(add, [Math.cos(a) * 1.4 * u, -SINK, Math.sin(a) * 1.4 * u], [0, 1.6 * u, 0], .12 * u, C.wall2); }
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * Math.PI * 2, base = L(0, H0 * .95, 0, 0, a, 0);
          add(box(.08 * u, 2.4 * u * k, .55 * u), base.clone().multiply(L(0, 0, 0, 0, 0, .55)), i % 2 ? C.accent : C.accent2);
          add(box(.06 * u, 1.5 * u * k, .4 * u), base.clone().multiply(L(-Math.sin(.55) * 2.4 * u * k, Math.cos(.55) * 2.4 * u * k, 0, 0, 0, 1.4)), i % 2 ? C.accent : C.accent2);
        }
        add(ball(.5 * u, 1), L(0, H0 * .97, 0), C.trim);
        for (let i = 0; i < 3 + Math.round(k * 2); i++) {
          const a = r() * 6.28, y = H0 * (.3 + .45 * r()), bx = Math.cos(a) * 1.4 * u, bz = Math.sin(a) * 1.4 * u, br = .8 * u * k;
          rod(add, [0, y, 0], [bx, y - .6 * u, bz], .06 * u, C.wall2);
          add(ball(br, 1), L(bx, y - 1.4 * u, bz, 0, 0, 0, 1, 1.3, 1), C.wall);
          add(new THREE.TorusGeometry(br * .98, .05 * u, 3, 12).rotateX(Math.PI / 2), L(bx, y - 1.4 * u, bz), C.trim);
          add(dome(.22 * u, 6), L(bx + Math.cos(a) * br * .9, y - 1.3 * u, bz + Math.sin(a) * br * .9, 0, -a, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights);
          for (let j = 0; j < 3; j++) rod(add, [bx + (j - 1) * .25 * u, y - 1.4 * u - br * 1.2, bz], [bx + (j - 1) * .3 * u, y - 2.6 * u - br, bz], .025 * u, C.accent2);
        }
      },
'''

H['masts'] = '''      home(add, k) { // a rigged mast with spars, hung with banded pods
        const h = (6 + r() * 3) * u * tall * k;
        add(sunk(cyl(.12 * u, .24 * u, h + SINK, 6)), L(), C.wood);
        add(sunk(cyl(.5 * u, .6 * u, .3 * u + SINK, 7)), L(), C.stone2);
        for (let i = 0; i < 3; i++) { const a = i * 2.09 + .3, gx = Math.cos(a) * h * .45, gz = Math.sin(a) * h * .45; rod(add, [0, h * .95, 0], [gx, .1 * u, gz], .018 * u, C.line); add(sunk(box(.25 * u, .4 * u + SINK, .25 * u)), L(gx, 0, gz), C.wood); }
        for (const y of [.5, .78]) add(cyl(.035 * u, .035 * u, 2.4 * u, 4).rotateZ(Math.PI / 2).translate(0, 0, 0), L(0, h * y, 0, 0, r() * 3, 0), C.wood);
        add(cyl(.5 * u, .4 * u, .15 * u, 8), L(0, h, 0), C.wood); add(ring(.5 * u, .04 * u, 8), L(0, h + .35 * u, 0), C.wood);
        for (let i = 0; i < 4; i++) { const a = i * 1.57; add(cyl(.03 * u, .03 * u, .35 * u, 3), L(Math.cos(a) * .48 * u, h + .1 * u, Math.sin(a) * .48 * u), C.wood); }
        add(cone(.08 * u, .8 * u, 4), L(0, h + .15 * u, 0), C.wood); add(box(.6 * u, .35 * u, .02 * u).translate(.3 * u, 0, 0), L(0, h + .75 * u, 0, 0, r() * 6, 0), C.accent);
        const pods = 3 + Math.floor(r() * 3);
        for (let i = 0; i < pods; i++) {
          const a = i / pods * Math.PI * 2 + r(), y = h * (.4 + .45 * i / pods), arm = 1 * u, px = Math.cos(a) * arm, pz = Math.sin(a) * arm, pr = .55 * u * k;
          rod(add, [0, y, 0], [px, y, pz], .045 * u, C.wood); rod(add, [0, y - .6 * u, 0], [px * .8, y, pz * .8], .03 * u, C.wood);
          add(ball(pr, 1), L(px, y - .75 * u, pz, 0, 0, 0, 1, 1.35, 1), i % 2 ? C.wall : C.accent);
          for (const t of [-.35, .35]) add(new THREE.TorusGeometry(pr * .94, .035 * u, 3, 10).rotateX(Math.PI / 2), L(px, y - .75 * u + t * pr * 1.35, pz), C.trim);
          add(cyl(.12 * u, .12 * u, .08 * u, 6), L(px, y - .75 * u - pr * 1.4, pz), C.trim);
          add(dome(.16 * u, 6), L(px + Math.cos(a) * pr * .95, y - .75 * u, pz + Math.sin(a) * pr * .95, 0, -a, -Math.PI / 2, 1, .4, 1), lights && i === 0 ? C.window : C.door, lights && i === 0);
        }
      },
'''

H['hive'] = '''      home(add, k) { // a cluster of hexagonal cells: bevelled rims, wax caps, doors on the faces
        const cell = .6 * u * k, cells = k > 1.2 ? 7 : 4 + Math.floor(r() * 3), dirs = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3 + Math.PI / 6), Math.sin(i * Math.PI / 3 + Math.PI / 6)])];
        for (let i = 0; i < cells; i++) {
          const [dx, dz] = dirs[i], x = dx * cell * 1.75, z = dz * cell * 1.75, h = (1.2 + r() * 1.6) * u * k * tall * (i ? 1 : 1.4);
          add(sunk(cyl(cell, cell, h + SINK, 6)), L(x, 0, z, 0, Math.PI / 6), i % 2 ? C.wall : C.wall2);
          for (let y = .5 * u; y < h - .2 * u; y += .7 * u) add(cyl(cell * 1.03, cell * 1.03, .06 * u, 6), L(x, y, z, 0, Math.PI / 6), C.wall2);
          add(cyl(cell * 1.06, cell * 1.06, .14 * u, 6), L(x, h - .14 * u, z, 0, Math.PI / 6), C.trim);
          if (r() < .5) { add(cyl(cell * .92, cell * .92, .1 * u, 6), L(x, h, z, 0, Math.PI / 6), C.accent2); add(cone(cell * .9, cell * .45, 6), L(x, h + .1 * u, z, 0, Math.PI / 6), C.accent2); }
          else add(cyl(cell * .72, cell * .72, .05, 6), L(x, h + .01, z, 0, Math.PI / 6), C.door, false);
          if (lights && i % 3 === 0) add(cyl(cell * .5, cell * .5, .06, 6), L(x, h + .2 * u, z, 0, Math.PI / 6), C.window, true);
          if (i < 3) { const fa = Math.atan2(dx || .01, dz || 1); add(dome(.28 * u * k, 6), L(x + Math.sin(fa) * cell * .86, .05 * u, z + Math.cos(fa) * cell * .86, Math.PI / 2, fa, 0, 1, 1.3, .4), C.door); }
          if (r() < .4) add(cone(.06 * u, .35 * u, 4).rotateX(Math.PI), L(x + cell * .7, h - .1 * u, z), C.accent2);
        }
      },
'''

H['mounds'] = '''      home(add, k) {
        if (k > 1.2 || r() < .4) { // banded spire on a buttressed base, vents up its sides
          let y = 0, rad = 1.8 * u * Math.min(k, 1.4);
          footing(add, rad, C.wall); add(cyl(rad * 1.25, rad * 1.45, .9 * u, 7), L(), C.wall2);
          for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(sunk(cone(rad * .35, 2.2 * u * tall + SINK, 4)), L(Math.cos(a) * rad * 1.2, 0, Math.sin(a) * rad * 1.2, 0, -a, 0, .5, 1, 1), C.wall2); }
          for (let i = 0; i < 4; i++) {
            const h = (2.9 - i * .35) * u * tall * k;
            add(cyl(rad * .74, rad, h, 7), L(0, y, 0, 0, i * .4), i % 2 ? C.wall2 : C.wall);
            add(cyl(rad * .76, rad * .78, .18 * u, 7), L(0, y + h * .92, 0, 0, i * .4), C.accent);
            for (let j = 0; j < 3; j++) { const a = j * 2.1 + i, rr = rad * .86; add(dome(.22 * u, 6), L(Math.cos(a) * rr, y + h * .5, Math.sin(a) * rr, 0, -a, -Math.PI / 2, 1, .4, 1), lights && j === 0 ? C.window : C.door, lights && j === 0); }
            y += h; rad *= .74;
          }
          add(cone(rad, 1.2 * u * tall, 7), L(0, y, 0), C.accent);
          for (let i = 0; i < 3; i++) add(cyl(.1 * u, .16 * u, .9 * u, 5), L((i - 1) * rad * .5, y + .2 * u, 0, 0, 0, (i - 1) * .3), C.wall2);
        } else { // a ridged earth mound with chimneys and a framed mouth
          const h = 3.4 * u * tall * k, rad = 2 * u * k;
          add(sunk(cone(rad, h + SINK, 9)), L(0, 0, 0, 0, r() * 6), C.wall);
          for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .2; add(sunk(cone(rad * .28, h * .8 + SINK, 4)), L(Math.cos(a) * rad * .62, 0, Math.sin(a) * rad * .62, 0, -a, 0, .45, 1, 1), C.wall2); }
          for (let i = 0; i < 3; i++) { const a = r() * 6.28, s = .4 + r() * .35; add(sunk(cone(rad * s, h * s + SINK, 7)), L(Math.cos(a) * rad * .75, 0, Math.sin(a) * rad * .75), C.wall2); add(cyl(.12 * u, .16 * u, .5 * u, 5), L(Math.cos(a) * rad * .75, h * s * .95, Math.sin(a) * rad * .75), C.door); }
          add(new THREE.TorusGeometry(.62 * u * k, .14 * u, 5, 10, Math.PI), L(0, 0, rad * .74), C.accent);
          add(dome(.55 * u * k, 8), L(0, 0, rad * .72, Math.PI / 2, 0, 0, 1, 1, .5), C.door);
          add(cyl(rad * .32, rad * .36, .25 * u, 7), L(0, h * .55, 0), C.accent);
          for (let i = 0; i < 4; i++) { const a = i * 1.57 + .8; add(dome(.15 * u, 6), L(Math.cos(a) * rad * .45, h * .45, Math.sin(a) * rad * .45, 0, -a, -Math.PI / 2 + .5, 1, .4, 1), lights ? C.window : C.door, lights); }
        }
      },
'''

H['silk'] = '''      home(add, k) { // a two-layer silk cone on poles, spiral threads, a funnel mouth, egg-sacs
        const rad = 1.6 * u * k, h = 2.8 * u * k * tall;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rod(add, [Math.cos(a) * rad, -SINK, Math.sin(a) * rad], [Math.cos(a) * rad * .2, h * 1.25, Math.sin(a) * rad * .2], .05 * u, C.wood); }
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .1; rod(add, [Math.cos(a) * rad * .35, h * 1.05, Math.sin(a) * rad * .35], [Math.cos(a) * rad * 2.1, 0, Math.sin(a) * rad * 2.1], .012 * u, C.wall); add(cone(.06 * u, .2 * u, 3), L(Math.cos(a) * rad * 2.1, 0, Math.sin(a) * rad * 2.1), C.wood); }
        add(sunk(cyl(rad * .9, rad * .9, SINK, 10)), L(), C.wall2);
        add(cone(rad, h, 10), L(), C.wall, lights);
        add(cone(rad * .7, h * .62, 10), L(0, h * .45, 0), C.trim);
        for (let i = 1; i < 6; i++) { const f = i / 6; add(ring(rad * (1 - f) + .02, .015 * u, 12), L(0, h * f, 0), C.wall2); }
        add(cone(.55 * u, 1.1 * u, 8).rotateX(Math.PI / 2), L(0, .55 * u, rad * .75), C.wall);
        add(cyl(.4 * u, .4 * u, .05, 8).rotateX(Math.PI / 2), L(0, .55 * u, rad * .78), C.door);
        for (let i = 0; i < 3; i++) { const a = r() * 6.28; rod(add, [Math.cos(a) * rad * .5, h * .5, Math.sin(a) * rad * .5], [Math.cos(a) * rad * .75, h * .25, Math.sin(a) * rad * .75], .01 * u, C.wall); add(ball(.2 * u, 0), L(Math.cos(a) * rad * .75, h * .2, Math.sin(a) * rad * .75, 0, 0, 0, 1, 1.3, 1), C.bag); }
      },
'''

H['trapdoor'] = '''      home(add, k) { // a silk-rimmed burrow with a hinged lid, signal threads and a lookout
        const rad = 1.1 * u * k;
        add(sunk(cyl(rad * 1.6, rad * 1.8, .25 * u + SINK, 12)), L(), C.wall2); add(ring(rad * 1.3, .3 * u * k, 14), L(0, .25 * u, 0), C.wall);
        add(ring(rad * 1.05, .08 * u, 14), L(0, .3 * u, 0), C.trim);
        add(cyl(rad, rad, .04, 12), L(0, .27 * u, 0), C.door, false);
        const lid = L(0, .3 * u, -rad, -1.1, 0, 0).multiply(L(0, 0, rad));
        add(cyl(rad * 1.05, rad * 1.05, .12 * u, 12), lid, C.wall);
        for (let i = 0; i < 5; i++) add(ball((.12 + r() * .1) * u, 0), lid.clone().multiply(L((r() - .5) * rad, .1 * u, (r() - .5) * rad, 0, 0, 0, 1, .6, 1)), i % 2 ? C.stone : C.leaf);
        add(cyl(.1 * u, .1 * u, .3 * u, 4).rotateZ(Math.PI / 2), L(0, .3 * u, -rad), C.wood);
        for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3, l = (2.5 + r() * 2) * u; rod(add, [Math.cos(a) * rad * 1.5, .1 * u, Math.sin(a) * rad * 1.5], [Math.cos(a) * (rad * 1.5 + l), .03 * u, Math.sin(a) * (rad * 1.5 + l)], .012 * u, C.trim); }
        add(cone(.3 * u, 1.6 * u * k, 6), L(rad * 1.3, 0, -rad), C.wall2); add(ring(.22 * u, .05 * u, 6), L(rad * 1.3, 1 * u * k, -rad), C.trim);
        add(ball(.2 * u, 0), L(rad * 1.3, 1.6 * u * k, -rad), C.accent);
        if (lights) add(cyl(rad * .6, rad * .6, .06, 10), L(0, .29 * u, 0), C.window, true);
      },
'''

H['perches'] = '''      home(add, k) { // a ringed pole with leafy side branches and woven nests under a canopy
        const h = (4.5 + r() * 3) * u * tall * k, nests = k > 1.2 ? 3 : 1 + (r() < .5 ? 1 : 0);
        add(sunk(cyl(.16 * u * k, .3 * u * k, h + SINK, 6)), L(0, 0, 0, (r() - .5) * .08, 0, (r() - .5) * .08), C.wood);
        for (let i = 0; i < 3; i++) { const a = i * 2.09; rod(add, [Math.cos(a) * .7 * u, -SINK, Math.sin(a) * .7 * u], [0, .9 * u, 0], .1 * u, C.wood); }
        for (let y = .8 * u; y < h * .9; y += .9 * u) add(cyl(.2 * u * k, .22 * u * k, .08 * u, 6), L(0, y, 0), C.roof2);
        for (let i = 0; i < 2; i++) { const a = i * 3.1 + 1, y = h * (.45 + i * .15); rod(add, [0, y, 0], [Math.cos(a) * 1.3 * u, y + .6 * u, Math.sin(a) * 1.3 * u], .05 * u, C.wood); add(ball(.45 * u, 0), L(Math.cos(a) * 1.4 * u, y + .7 * u, Math.sin(a) * 1.4 * u, 0, r() * 6, 0, 1, .7, 1), C.leaf); }
        for (let i = 0; i < nests; i++) {
          const y = h * (1 - i * .28), a = i * 2.2, off = i ? 1.1 * u : 0, x = Math.cos(a) * off, z = Math.sin(a) * off;
          if (i) rod(add, [0, y - .5 * u, 0], [x, y, z], .06 * u, C.wood);
          add(cyl(.7 * u, .55 * u, .25 * u, 9), L(x, y - .2 * u, z), C.wood);
          add(ring(.75 * u, .22 * u, 10), L(x, y, z), C.roof);
          add(ring(.8 * u, .06 * u, 10), L(x, y + .12 * u, z, .15, 0, 0), C.roof2);
          add(cyl(.55 * u, .55 * u, .04, 9), L(x, y + .05 * u, z), C.accent2);
          for (let j = 0; j < 4; j++) { const b = j * 1.57 + .5; add(cone(.05 * u, .45 * u, 3), L(x + Math.cos(b) * .85 * u, y - .1 * u, z + Math.sin(b) * .85 * u, Math.sin(b) * .8, 0, -Math.cos(b) * .8), C.roof2); }
          if (lights) add(ball(.2 * u), L(x, y + .2 * u, z), C.window, true);
        }
        add(cone(1.1 * u, .8 * u, 7), L(0, h + .9 * u, 0), C.roof); for (let i = 0; i < 3; i++) rod(add, [Math.cos(i * 2.09) * .7 * u, h + .1 * u, Math.sin(i * 2.09) * .7 * u], [0, h + 1 * u, 0], .04 * u, C.wood);
        add(box(.08 * u, .6 * u, .02 * u), L(0, h + 1.6 * u, 0), C.accent); add(cyl(.02 * u, .02 * u, .9 * u, 3), L(0, h + 1.5 * u, 0), C.wood);
      },
'''

H['rookery'] = '''      home(add, k) { // a stone tower ringed with spiral ledges, framed holes and a capped roof
        const h = (5 + r() * 3) * u * tall * k, rad = 1.3 * u * k;
        add(sunk(cyl(rad * .7, rad, h + SINK, 8)), L(0, 0, 0, 0, r() * 6), C.wall);
        for (let y = .9 * u; y < h; y += 1.4 * u) add(cyl(rad * (1 - y / h * .3) * 1.02, rad * (1 - y / h * .3) * 1.04, .12 * u, 8), L(0, y, 0), C.wall2);
        let a = r() * 6.28;
        for (let y = 1.2 * u; y < h - .5 * u; y += .9 * u) {
          a += 1.1; const rr = rad * (1 - y / h * .3);
          add(box(1.2 * u, .12 * u, .65 * u), L(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, -a + Math.PI / 2), C.wall2);
          for (const s of [-1, 1]) add(box(.08 * u, .2 * u, .3 * u), L(Math.cos(a) * rr + Math.cos(a + s * .4) * .05, y - .2 * u, Math.sin(a) * rr, 0, -a + Math.PI / 2), C.wood);
          const ha = a + .5;
          add(dome(.32 * u, 6), L(Math.cos(ha) * rr * 1.0, y + .42 * u, Math.sin(ha) * rr * 1.0, 0, -ha, -Math.PI / 2, 1, .45, 1), C.trim);
          add(dome(.25 * u, 6), L(Math.cos(ha) * rr * 1.02, y + .42 * u, Math.sin(ha) * rr * 1.02, 0, -ha, -Math.PI / 2, 1, .4, 1), lights ? C.window : C.door, lights);
          add(box(.06 * u, .5 * u, .02 * u), L(Math.cos(a) * rr * 1.01, y - .5 * u, Math.sin(a) * rr * 1.01, 0, -a + Math.PI / 2), C.trim);
        }
        const tr = rad * .7;
        add(cyl(tr * 1.15, tr * 1.1, .2 * u, 8), L(0, h, 0), C.wall2);
        add(cone(tr * 1.2, 1.4 * u * k, 8), L(0, h + .2 * u, 0), C.roof);
        add(cyl(.04 * u, .04 * u, .8 * u, 3), L(0, h + .2 * u + 1.4 * u * k, 0), C.wood); add(ball(.12 * u, 0), L(0, h + 1.4 * u * k + 1 * u, 0), C.accent);
        add(dome(.5 * u * k, 8), L(0, 0, rad * .95, Math.PI / 2, 0, 0, 1, 1.2, .4), C.door);
      },
'''

H['hanging'] = '''      home(add, k) { // a braced frame with a thatched beam, woven pods hung on ropes
        const w = 2.4 * u * k, h = 4.5 * u * k * tall;
        for (const x of [-1, 1]) { add(sunk(cyl(.14 * u, .2 * u, h + SINK, 6)), L(x * w, 0, 0, 0, 0, x * .06), C.wood); for (const z of [-1, 1]) rod(add, [x * w, -SINK * .5, z * 1.1 * u], [x * w * .97, h * .55, 0], .06 * u, C.wood); }
        add(box(w * 2.3, .22 * u, .3 * u), L(0, h, 0), C.wood);
        rod(add, [-w, h * .6, 0], [-w * .4, h, 0], .05 * u, C.wood); rod(add, [w, h * .6, 0], [w * .4, h, 0], .05 * u, C.wood);
        add(new THREE.CylinderGeometry(.75 * u, .75 * u, w * 2.4, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), L(0, h + .55 * u, 0, 0, 0, 0, 1, .8, 1), C.roof);
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * w * .65, drop = (1.2 + r()) * u, py = h - drop - .8 * u * k, pr = .55 * u * k;
          rod(add, [x, h, 0], [x, h - drop, 0], .03 * u, C.line);
          add(cone(.2 * u, .3 * u, 6).rotateX(Math.PI), L(x, h - drop + .1 * u, 0), C.roof2);
          add(ball(pr, 1), L(x, py, 0, 0, 0, 0, 1, 1.5, 1), i % 2 ? C.roof : C.wall);
          for (const t of [-.5, 0, .5]) add(new THREE.TorusGeometry(pr * Math.sqrt(1 - t * t) * .99, .03 * u, 3, 10).rotateX(Math.PI / 2), L(x, py + t * pr * 1.5, 0), C.roof2);
          add(new THREE.TorusGeometry(.17 * u, .04 * u, 3, 8), L(x, py - .2 * u, pr * .9), C.trim);
          add(dome(.15 * u, 6), L(x, py - .2 * u, pr * .92, Math.PI / 2, 0, 0, 1, 1, .4), lights ? C.window : C.door, lights);
          add(cone(.12 * u, .35 * u, 5).rotateX(Math.PI), L(x, py - pr * 1.5 - .1 * u, 0), C.roof2);
        }
      },
'''

H['earthworks'] = '''      home(add, k) { // a turf barrow on a stone kerb, framed doorway, smoke hole, grass on top
        const len = 4 * u * k, rad = 1.4 * u * k;
        add(new THREE.CylinderGeometry(rad, rad, len, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), L(0, -.1 * u, 0, 0, 0, 0, 1, .85 * tall, 1), C.turf);
        add(sunk(box(rad * 2, SINK, len)), L(), C.turf);
        add(box(rad * 1.9, rad * .8 * tall, .15 * u), L(0, 0, -len / 2), C.wood);
        for (let i = 0; i < 14; i++) { const z = (i / 13 - .5) * len * .98; for (const x of [-1, 1]) add(ball(.2 * u, 0), L(x * rad * .98, .05 * u, z, 0, i, 0, 1, .7, 1.3), (i + x) % 2 ? C.stone : C.stone2); }
        for (let i = 0; i < 10; i++) { const z = (r() - .5) * len * .85, a = (r() - .5) * 2; add(cone(.1 * u, (.3 + r() * .3) * u, 3), L(Math.sin(a) * rad * .85 * .98, Math.cos(a) * rad * .85 * tall * .98 - .1 * u, z, 0, 0, -a * .6), C.leaf); }
        add(cyl(.25 * u, .3 * u, .5 * u, 6), L(0, rad * .85 * tall - .2 * u, -len * .2), C.stone2);
        add(box(1 * u, 1.3 * u * k, .3 * u), L(0, 0, len / 2), C.stone); add(box(.6 * u, .9 * u * k, .06), L(0, 0, len / 2 + .16 * u), C.door);
        add(box(1.5 * u, .25 * u, .45 * u), L(0, 1.3 * u * k, len / 2 + .05 * u), C.stone2);
        for (const x of [-1, 1]) { add(box(.4 * u, .8 * u, .4 * u), L(x * .75 * u, 0, len / 2 + .15 * u), C.stone2); add(box(.12 * u, .9 * u * k, .12 * u), L(x * .38 * u, 0, len / 2 + .2 * u), C.wood); }
        windows(add, u, .7 * u, len / 2 + .2 * u, 1);
        if (r() < .5) add(sunk(box(.4 * u, 1.6 * u * tall + SINK, .3 * u)), L(rad * 1.6, 0, len * .4, 0, .3, .05), C.stone);
      },
'''

H['living'] = '''      home(add, k) { // a shaped-tree dwelling: arching root-ribs woven with walls, a layered canopy, lanterns
        const rad = 1.6 * u * k, h = 2.6 * u * k * tall;
        for (let i = 1; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.PI / 2; rod(add, [Math.cos(a) * rad * 1.15, -SINK, Math.sin(a) * rad * 1.15], [Math.cos(a) * rad * .2, h, Math.sin(a) * rad * .2], .16 * u * k, C.wood); }
        add(cyl(rad * .78, rad * .95, h * .75, 7, 1), L(0, 0, 0), C.wall2);
        for (let y = .3; y < .75; y += .15) add(cyl(rad * (.95 - y * .2) * 1.02, rad * (.95 - y * .2) * 1.02, .05 * u, 7), L(0, h * y, 0), C.wood);
        add(box(.75 * u, 1.3 * u, .1 * u), L(0, 0, rad * .85), C.door);
        add(new THREE.TorusGeometry(.42 * u, .07 * u, 3, 8, Math.PI), L(0, 1.3 * u, rad * .87), C.wood);
        for (const x of [-1, 1]) add(dome(.18 * u, 6), L(x * rad * .55, h * .45, rad * .68, Math.PI / 2, x * .6, 0, 1, 1, .4), lights ? C.window : C.door, lights);
        for (let i = 0; i < 6; i++) add(ball((.9 + r() * .5) * u * k, 1), L((r() - .5) * rad * 1.1, h + (r() - .2) * .7 * u, (r() - .5) * rad * 1.1, 0, r() * 6, 0, 1, .75, 1), i % 2 ? C.leaf : C.roof);
        for (let i = 0; i < 3; i++) add(ball((.6 + r() * .3) * u * k, 1), L((r() - .5) * rad * .6, h + 1 * u * k + r() * .4 * u, (r() - .5) * rad * .6, 0, r() * 6, 0, 1, .8, 1), C.leaf);
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + .7; rod(add, [Math.cos(a) * rad, h * .9, Math.sin(a) * rad], [Math.cos(a) * rad, h * .6, Math.sin(a) * rad], .015 * u, C.line); add(ball(.15 * u, 0), L(Math.cos(a) * rad, h * .57, Math.sin(a) * rad, 0, 0, 0, 1, 1.4, 1), lights ? C.window : C.accent, lights); }
      },
'''

H['tracks'] = '''      home(add, k) { // a wheel-shaped house: treaded rim, spokes, a hub with door and window, a cradle
        const rad = 1.7 * u * k, cy = rad + .3 * u;
        add(sunk(box(rad * 1.4, .4 * u + SINK, 1.4 * u * k)), L(), C.wall2);
        for (const s of [-1, 1]) add(box(.18 * u, rad * .7, 1.3 * u * k), L(s * rad * .55, .4 * u, 0, 0, 0, s * .45), C.wall2);
        add(new THREE.TorusGeometry(rad, .5 * u * k, 7, 20), L(0, cy, 0), C.wall);
        for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; add(box(.18 * u, .14 * u, 1.06 * u * k), L(Math.cos(a) * (rad + .48 * u * k), cy + Math.sin(a) * (rad + .48 * u * k), 0, 0, 0, a), C.wall2); }
        for (const z of [-1, 1]) add(new THREE.TorusGeometry(rad - .35 * u * k, .06 * u, 3, 18), L(0, cy, z * .32 * u * k), C.trim);
        add(cyl(.65 * u * k, .65 * u * k, 1.2 * u * k, 12).rotateX(Math.PI / 2).translate(0, 0, -.6 * u * k), L(0, cy, 0), C.wall2);
        add(cyl(.5 * u * k, .5 * u * k, .05, 10).rotateX(Math.PI / 2), L(0, cy, .62 * u * k), lights ? C.window : C.door, lights);
        add(ring(.62 * u * k, .06 * u, 12).rotateX(Math.PI / 2), L(0, cy, .6 * u * k), C.trim);
        for (let i = 0; i < 8; i++) rod(add, [0, cy, 0], [Math.cos(i * .785) * rad, cy + Math.sin(i * .785) * rad, 0], .08 * u, C.wall2);
        add(box(.6 * u, .9 * u, .08), L(0, .4 * u, .6 * u * k + .04), C.door);
        for (let i = 1; i < 4; i++) add(box(.7 * u, .08 * u, .3 * u), L(0, i * .14 * u, .7 * u * k + (4 - i) * .25 * u), C.stone2);
      },
'''

for name, home in H.items():
    i = s.index('    ' + name + ': {')
    hstart = s.index('      home(add, k) {', i)
    g = s.index('      great(', i)
    assert hstart < g
    s = s[:hstart] + home + s[g:]
    # strip a trailing comment after the culture header line is kept
open(p, 'w').write(s)
print('ok', len(H))
