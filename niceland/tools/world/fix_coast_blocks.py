#!/usr/bin/env python3
"""Repair coastline blocks that the world build filled on the wrong side of the shore.

Note: since October 2026 the world build itself decides land and sea by coastline direction (build_world.py and
steps/detail_mask.py), so a fresh build no longer has these faults and this tool finds nothing to fix; it is kept for
map files made by older builds.

The 300 m grid was filled sea/land in blocks of 100 x 100 cells, and in some blocks the fill went the wrong way:
land turned to sea (the hole west of Landeyjahöfn) or a fjord filled in as land. Such a block shows a dead straight
coast along the block line with no 10 m shore mask on either side. The heights tell which side is wrong: the build
stores sea as min(depth, -1) and land as max(height, 2), so cells put on the wrong side carry the clamp values
-1 or 2 instead of real depths and heights. For each such edge the side with the most clamp values is wrong; its
clamp cells that connect to the edge inside that block are flipped, new land takes the land type nearest to it,
and the new shoreline gets generated 10 m masks so it is not blocky up close.

    python3 tools/world/fix_coast_blocks.py world.txt detail.txt [--dry] [--only r0:r1:c0:c1 ...]

Without --only it lists every suspect edge it finds (always run with --dry first and look at them: real fjord water
also sits at the -1 clamp, so a fjord that crosses a block line can look like a hole). With --only it fixes just the
suspects that fall inside the given boxes of 300 m cells (rows r0..r1, columns c0..c1).

Already applied to the map files in the repo (October 2026), each suspect checked by hand:
  fixed, sea -> land: 1095:1125:675:705 (Landeyjar, west of Landeyjahöfn), 970:1005:515:580 (Ölfus, west of Selfoss).
    Both held road nodes and buildings inside the "sea"; the remaining sea -> land suspects hold none, and most have
    mapped shores along their sides (Hvalfjörður is one), so they are real water and were left alone.
  fixed, land -> sea: 360:400:296:345 (fjords off Barðaströnd), 100:135:296:335 (Ísafjarðardjúp),
    498:509:560:570 (head of Hrútafjörður), 598:604:236:252 (Snæfellsnes, north shore): fjord-shaped channels of flat
    2 m "land" with no roads, cut off on a block line.
  left: 200:242:265:299 and 848:870:1492:1499 (roads inside, so land), 308:324:700:701 (a one-cell strip on a straight
    coast; flipping it only moves the straight edge).

Rewrites both files in place (only the coarse land-type and height arrays in world.txt, and new masks appended to
detail.txt); everything else is kept byte for byte.
"""
import base64, gzip, json, struct, sys
import numpy as np
from scipy import ndimage

SEA, LAKE, GRASS, URBAN, GLACIER = 0, 1, 2, 20, 18
BLOCK = 100


def read_b64(path):
    raw = base64.b64decode(open(path).read().strip())
    gz = raw[:2] == b'\x1f\x8b'
    return (gzip.decompress(raw) if gz else raw), gz


def write_b64(path, data, gz):
    if gz:
        data = gzip.compress(data, 9, mtime=0)
    open(path, 'w').write(base64.b64encode(data).decode() + '\n')


def world_arrays(buf):
    """offsets of the arrays in world.txt, in file order"""
    jl = struct.unpack_from('<I', buf, 4)[0]
    meta = json.loads(buf[8:8 + jl])
    off, out = 8 + jl, []
    for _ in range(6):  # fine GT, HT, NM, coarse GT, HT, NM
        off = (off + 3) & ~3
        n = struct.unpack_from('<I', buf, off)[0]
        out.append((off + 4, n))
        off += 4 + n
    return meta, out


def find_fixes(gt, ht, has, boxes=None):
    H, W = gt.shape
    sea = gt == SEA
    clampS = sea & (ht == -1) & ~has
    clampL = ~sea & (gt != LAKE) & (gt != GLACIER) & (ht <= 2) & ~has
    flip = np.zeros_like(sea)
    report = []
    # block-line edges: between column c and c+1 where (c+1) % BLOCK == 0, and the same for rows
    for axis in (0, 1):
        lines = range(BLOCK - 1, (H if axis == 0 else W) - 1, BLOCK)
        for a in lines:
            if axis == 0:
                s0, s1 = sea[a, :], sea[a + 1, :]
                m0, m1 = has[a, :], has[a + 1, :]
            else:
                s0, s1 = sea[:, a], sea[:, a + 1]
                m0, m1 = has[:, a], has[:, a + 1]
            bad = (s0 != s1) & ~m0 & ~m1
            lab, n = ndimage.label(ndimage.binary_dilation(bad, iterations=2))
            for r in range(1, n + 1):
                idx = np.where((lab == r) & bad)[0]
                if len(idx) < 4:
                    continue
                # cells on each side of the edge: which side is sea, which land
                cells = []
                for k in idx:
                    p = (a, k) if axis == 0 else (k, a)
                    q = (a + 1, k) if axis == 0 else (k, a + 1)
                    sp, lp = (p, q) if sea[p] else (q, p)
                    cells.append((sp, lp))
                fs = np.mean([clampS[s] for s, _ in cells])
                fl = np.mean([clampL[l] for _, l in cells])
                if max(fs, fl) < 0.5:
                    continue
                wrong_sea = fs >= fl
                seeds = [s if wrong_sea else l for s, l in cells]
                cand = clampS if wrong_sea else clampL
                # grow through clamp cells, only inside the block of the wrong side
                by, bx = seeds[0][0] // BLOCK, seeds[0][1] // BLOCK
                box = np.zeros_like(sea)
                box[by * BLOCK:(by + 1) * BLOCK, bx * BLOCK:(bx + 1) * BLOCK] = True
                reg_l, _ = ndimage.label(cand & box)
                ids = {reg_l[s] for s in seeds if reg_l[s]}
                reg = np.isin(reg_l, list(ids))
                ys, xs = np.where(reg)
                if not len(ys):
                    continue
                if boxes is not None and not any(
                    r0 <= ys.min() and ys.max() <= r1 and c0 <= xs.min() and xs.max() <= c1
                    for r0, r1, c0, c1 in boxes
                ):
                    continue
                flip |= reg
                report.append(('sea->land' if wrong_sea else 'land->sea', int(reg.sum()),
                               (int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())),
                               round(float(fs), 2), round(float(fl), 2)))
    return flip, report


def main():
    wpath, dpath = sys.argv[1], sys.argv[2]
    dry = '--dry' in sys.argv
    boxes = None
    if '--only' in sys.argv:
        boxes = [tuple(int(v) for v in a.split(':')) for a in sys.argv[sys.argv.index('--only') + 1:] if ':' in a]
    wbuf, wgz = read_b64(wpath)
    wbuf = bytearray(wbuf)
    meta, arrs = world_arrays(wbuf)
    W, H = meta['coarse']['W'], meta['coarse']['H']
    (go, gn), (ho, hn) = arrs[3], arrs[4]
    gt = np.frombuffer(bytes(wbuf[go:go + gn]), np.uint8).reshape(H, W).copy()
    ht = np.frombuffer(bytes(wbuf[ho:ho + hn]), np.int16).reshape(H, W).copy()

    dbuf, dgz = read_b64(dpath)
    n = struct.unpack_from('<I', dbuf, 4)[0]
    side = struct.unpack_from('<I', dbuf, 8)[0]
    MI = np.frombuffer(dbuf[12:12 + 4 * n], np.uint32).copy()
    MB = np.frombuffer(dbuf[12 + 4 * n:], np.uint8).copy()
    per = side * side // 4
    has = np.zeros(H * W, bool)
    has[MI.astype(np.int64)] = True
    has = has.reshape(H, W)

    flip, report = find_fixes(gt, ht, has, boxes)
    for r in report:
        print(*r)
    print('cells to flip', int(flip.sum()))
    if dry or not flip.any():
        return

    sea0 = gt == SEA
    to_land = flip & sea0
    to_sea = flip & ~sea0
    # new land: the type of the nearest land cell (towns become plain grass); height at the land clamp
    landmask = ~sea0 & ~flip
    _, (iy, ix) = ndimage.distance_transform_edt(~landmask, return_indices=True)
    near = gt[iy, ix]
    near[(near == URBAN) | (near == LAKE) | (near == GLACIER)] = GRASS
    gt[to_land] = near[to_land]
    ht[to_land] = 2
    # new sea: shallow, deepening a little away from the shore
    gt[to_sea] = SEA
    dsh = ndimage.distance_transform_edt(~(~sea0 & ~flip))
    ht[to_sea] = -np.clip(np.round(1 + dsh[to_sea] * 1.5), 1, 30).astype(np.int16)

    # 10 m masks for the new shoreline: cells touched by the flip that now border the other class
    sea1 = gt == SEA
    shore = np.zeros_like(sea1)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        shore |= sea1 != np.roll(np.roll(sea1, dy, 0), dx, 1)
    zone = ndimage.binary_dilation(flip, iterations=1)
    newm = shore & zone & ~has
    # shore masks drawn along the false coast would leave slivers of water: make them again from the new coast
    redo = has & ndimage.binary_dilation(flip, iterations=2)
    land_near = ndimage.binary_dilation(~(gt == SEA), iterations=1)
    for cj, ci in zip(*np.where(redo)):
        if gt[cj, ci] == SEA and land_near[cj, ci] and to_land[max(0, cj - 2):cj + 3, max(0, ci - 2):ci + 3].any():
            gt[cj, ci] = near[cj, ci]
            ht[cj, ci] = 2
    sea1 = gt == SEA
    newm |= redo
    land1 = (~sea1).astype(float)
    smooth = ndimage.gaussian_filter(land1, 0.6)
    keys, blobs, redone = [], [], 0
    rng = np.random.default_rng(7)
    for cj, ci in zip(*np.where(newm)):
        cls = np.zeros((side, side), np.uint8)
        for b in range(side):
            for a in range(side):
                fx = ci + (a + 0.5) / side - 0.5
                fy = cj + (b + 0.5) / side - 0.5
                i0, j0 = int(np.floor(fx)), int(np.floor(fy))
                u, v = fx - i0, fy - j0
                g = lambda i, j: smooth[min(H - 1, max(0, j)), min(W - 1, max(0, i))]
                val = (g(i0, j0) * (1 - u) * (1 - v) + g(i0 + 1, j0) * u * (1 - v) +
                       g(i0, j0 + 1) * (1 - u) * v + g(i0 + 1, j0 + 1) * u * v)
                cls[b, a] = 0 if val > 0.5 else 1
        flat = cls.ravel()
        key = ci + cj * W
        if has[cj, ci]:
            # keep the old mask's lakes and glaciers; only its sea pixels are decided again
            old = MB.reshape(-1, per)[np.searchsorted(MI, key)]
            oc = np.array([(old[p >> 2] >> ((p & 3) * 2)) & 3 for p in range(side * side)], np.uint8)
            flat = np.where(oc == 1, flat, oc)
        elif gt[cj, ci] == LAKE:
            continue
        byt = np.zeros(per, np.uint8)
        for p in range(side * side):
            byt[p >> 2] |= flat[p] << ((p & 3) * 2)
        if has[cj, ci]:
            MB.reshape(-1, per)[np.searchsorted(MI, key)] = byt
            redone += 1
        else:
            keys.append(key)
            blobs.append(byt)
    print('new 10 m shore masks', len(keys), 'remade', redone)
    allk = np.concatenate([MI, np.array(keys, np.uint32)])
    allb = np.concatenate([MB.reshape(-1, per), np.array(blobs, np.uint8).reshape(-1, per)])
    order = np.argsort(allk, kind='stable')
    allk, allb = allk[order], allb[order]
    assert len(np.unique(allk)) == len(allk)
    out = bytearray(dbuf[:12])
    struct.pack_into('<I', out, 4, len(allk))
    out += allk.astype('<u4').tobytes() + allb.tobytes()
    write_b64(dpath, bytes(out), dgz)

    wbuf[go:go + gn] = gt.tobytes()
    wbuf[ho:ho + hn] = ht.astype('<i2').tobytes()
    write_b64(wpath, bytes(wbuf), wgz)
    print('wrote', wpath, dpath)


if __name__ == '__main__':
    main()
