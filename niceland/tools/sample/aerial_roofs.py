"""One-off: samples the Reykjavík aerial photo bundles (smaey-aerial-*.bin, saved from the city's map service in a
browser) under every OSM building in data/rvk/bl_isn93.json (written by world/build_world.py).
Out: data/rvk/osm_roof.json   Usage: python3 sample/aerial_roofs.py 'path/to/smaey-aerial-*.bin'
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, glob, struct, io, sys, numpy as np
from PIL import Image
from matplotlib.path import Path

T, M, S, RES = 500, 30, 560, 0.5
PX = int(S / RES)
P = json.load(open(paths.data('rvk/bl_isn93.json')))
tiles = {}
for i, r in enumerate(P):
    xs = np.array(r[1::2])
    ys = np.array(r[2::2])
    tiles.setdefault((int(xs.mean() // T), int(ys.mean() // T)), []).append(i)


def obb(xs, ys):
    cx, cy = xs.mean(), ys.mean()
    n = len(xs)
    best = None
    for j in range(n):
        q = (j + 1) % n
        ux, uy = xs[q] - xs[j], ys[q] - ys[j]
        L = np.hypot(ux, uy)
        if L < 0.5:
            continue
        ux /= L
        uy /= L
        dx, dy = xs - cx, ys - cy
        u = dx * ux + dy * uy
        v = -dx * uy + dy * ux
        a = (u.max() - u.min()) * (v.max() - v.min())
        if best is None or a < best[0]:
            best = (a, ux, uy, u.min(), u.max(), v.min(), v.max())
    if best is None:
        return None
    a, ux, uy, u0, u1, v0, v1 = best
    if v1 - v0 > u1 - u0:
        ux, uy, u0, u1, v0, v1 = -uy, ux, v0, v1, -u1, -u0
    return a, ux, uy, u0, u1, v0, v1, cx, cy


out = []
if len(sys.argv) < 2:
    sys.exit(__doc__)
files = sorted(glob.glob(sys.argv[1]))
for fn in files:
    buf = open(fn, 'rb').read()
    p = 0
    while p < len(buf):
        ti, tj, ln = struct.unpack_from('<iii', buf, p)
        p += 12
        img = np.asarray(Image.open(io.BytesIO(buf[p : p + ln])).convert('RGB')).astype(np.float32)
        p += ln
        x0, y0 = ti * T - M, tj * T - M
        lumI = img[..., 0] * 0.3 + img[..., 1] * 0.59 + img[..., 2] * 0.11
        for i in tiles.get((ti, tj), []):
            r = P[i]
            xs = np.array(r[1::2], float)
            ys = np.array(r[2::2], float)
            o = obb(xs, ys)
            if not o:
                continue
            a, ux, uy, u0, u1, v0, v1, cx, cy = o
            st = max(RES * 0.8, np.sqrt(a) / 45)
            A, Bv = np.meshgrid(np.arange(u0 + st / 2, u1, st), np.arange(v0 + st / 2, v1, st))
            A = A.ravel()
            Bv = Bv.ravel()
            X = cx + A * ux - Bv * uy
            Y = cy + A * uy + Bv * ux
            ins = Path(np.c_[xs, ys]).contains_points(np.c_[X, Y])
            ix = np.floor((X - x0) / RES).astype(int)
            iy = np.floor((y0 + S - Y) / RES).astype(int)
            ok = ins & (ix >= 0) & (iy >= 0) & (ix < PX) & (iy < PX)
            n = int(ok.sum())
            if n < 6:
                continue
            ix, iy, A, Bv = ix[ok], iy[ok], A[ok], Bv[ok]
            R, G, B = img[iy, ix, 0], img[iy, ix, 1], img[iy, ix, 2]
            lum = lumI[iy, ix]
            o_ = np.argsort(lum)
            sel = o_[int(n * 0.3) : int(np.ceil(n * 0.9))]
            hw = (v1 - v0) / 2
            L = u1 - u0
            U = (A - (u0 + u1) / 2) / (L / 2)
            V = (Bv - (v0 + v1) / 2) / hw
            end = np.abs(U) > 1 - min(0.9, hw / (L / 2))
            mid = (np.abs(V) > 0.12) & (np.abs(V) < 0.85) & ~end
            pos = mid & (V > 0)
            neg = mid & (V < 0)
            ez = end & (np.abs(V) < 0.6)
            cz = ~end & (np.abs(V) < 0.85)
            f = lambda m: int(round(lum[m].mean())) if m.any() else -1

            def prof(W, Wo):
                k = np.clip(((W + 1) / 2 * 10).astype(int), 0, 9)
                m = np.abs(Wo) < 0.8
                return [
                    int(round(lum[m & (k == q)].mean())) if (m & (k == q)).any() else -1 for q in range(10)
                ]

            out.append(
                [
                    r[0],
                    int(R[sel].mean()),
                    int(G[sel].mean()),
                    int(B[sel].mean()),
                    int(round(lum.std())),
                    int(round(lum.mean())),
                    round(float(hw * 2), 1),
                    round(float(L), 1),
                    n,
                    prof(V, U),
                    prof(U, V),
                    f(ez),
                    f(cz),
                    round(float(np.arctan2(uy, ux)), 3),
                ]
            )
    print(fn, len(out), flush=True)
json.dump(out, open(paths.data('rvk/osm_roof.json'), 'w'), separators=(',', ':'))
print('total', len(out))
