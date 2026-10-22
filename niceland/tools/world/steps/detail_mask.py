"""10 m class masks (sea, lake, glacier) for every coarse cell that a coastline, lake shore or glacier edge crosses.
Writes detail.txt and corrects the coarse grid to match.
Run by world/build_world.py (not on its own).
"""

import time as _time

_t0 = _time.time()
coast = json.load(open(D + 'coast.json'))
SUB = 30
TILE = 100  # 30x30 fine cells per coarse cell, 100x100 coarse cells per processing tile


def bbox_of(flat):
    xs = flat[0::2]
    ys = flat[1::2]
    return (min(xs) / 2, min(ys) / 2, max(xs) / 2, max(ys) / 2)


coast_bb = [(bbox_of(c), c) for c in coast]
lake_bb = [(bbox_of(c), c) for c, nm in ice['water'] if len(c) >= 6 and not _swallows(pts(c))]
glac_bb = [(bbox_of(c), c) for c, nm in ice['glacier'] if len(c) >= 6]
FX0, FY0, FX1, FY1 = OX, OY, OX + W * CS, OY + H * CS
mixed_idx = []
mixed_blk = []
cls_coarse = np.zeros((CH, CW), np.uint8)
cls_coarse[cg == SEA] = 1
cls_coarse[cg == LAKE] = 2
cls_coarse[cg == GLACIER] = 3
newcls = cls_coarse.copy()
for tj in range(0, CH, TILE):
    for ti in range(0, CW, TILE):
        tw = min(TILE, CW - ti)
        th = min(TILE, CH - tj)
        x0 = COX + ti * CCS
        y0 = COY + tj * CCS
        x1 = x0 + tw * CCS
        y1 = y0 + th * CCS
        sub = cls_coarse[tj : tj + th, ti : ti + tw]

        def hits(bb):
            return [c for (a, c) in bb if not (a[2] < x0 or a[0] > x1 or a[3] < y0 or a[1] > y1)]

        cl = hits(coast_bb)
        lk = hits(lake_bb)
        gl = hits(glac_bb)
        if not cl and not lk and not gl:
            continue
        PW = tw * SUB
        PH = th * SUB
        tofx = lambda X: (X - x0) / 10.0
        tofy = lambda Y: (Y - y0) / 10.0

        def pl(c):
            return [(c[i] / 2.0 - x0) / 10.0 for i in range(0, len(c), 2)], [
                (c[i + 1] / 2.0 - y0) / 10.0 for i in range(0, len(c), 2)
            ]

        cls = np.zeros((PH, PW), np.uint8)
        # land / sea from coastline walls + vote of the coarse elevation mask
        coarse_sea = np.kron((sub == 1).astype(np.uint8), np.ones((SUB, SUB), np.uint8)).astype(bool)
        if cl:
            im = Image.new('1', (PW, PH), 0)
            d = ImageDraw.Draw(im)
            for c in cl:
                xs, ys = pl(c)
                d.line(list(zip(xs, ys)), fill=1, width=1)
            wall = np.array(im, dtype=bool)
            lab, nl = ndimage.label(~wall)
            if nl:
                tot = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, nl + 1))
                seav = ndimage.sum(coarse_sea, lab, index=np.arange(1, nl + 1))
                is_sea = np.concatenate([[False], (seav / np.maximum(tot, 1)) > 0.5])
                sea = is_sea[lab]
                # walls take the class of the majority of their neighbours
                nb = ndimage.uniform_filter(sea.astype(np.float32), 3)
                sea = np.where(wall, nb > 0.5, sea)
            else:
                sea = coarse_sea
        else:
            sea = coarse_sea
        cls[sea] = 1
        if gl:
            im = Image.new('L', (PW, PH), 0)
            d = ImageDraw.Draw(im)
            for c in gl:
                xs, ys = pl(c)
                if len(xs) >= 3:
                    d.polygon(list(zip(xs, ys)), fill=3)
            g3 = np.array(im) == 3
            cls[g3 & ~sea] = 3
        if lk:
            im = Image.new('L', (PW, PH), 0)
            d = ImageDraw.Draw(im)
            for c in lk:
                xs, ys = pl(c)
                if len(xs) >= 3:
                    d.polygon(list(zip(xs, ys)), fill=2)
            l2 = np.array(im) == 2
            cls[l2 & ~sea] = 2
        blocks = cls.reshape(th, SUB, tw, SUB).transpose(0, 2, 1, 3)
        for j in range(th):
            for i in range(tw):
                b = blocks[j, i]
                gi, gj = ti + i, tj + j
                cx = COX + (gi + 0.5) * CCS
                cy = COY + (gj + 0.5) * CCS
                if (
                    FX0 <= cx - CCS / 2
                    and cx + CCS / 2 <= FX1
                    and FY0 <= cy - CCS / 2
                    and cy + CCS / 2 <= FY1
                ):
                    continue  # only cells wholly inside the 10 m capital grid are skipped
                mn = b.min()
                mx = b.max()
                if mn == mx:
                    newcls[gj, gi] = mn
                    continue
                counts = np.bincount(b.ravel(), minlength=4)
                newcls[gj, gi] = counts.argmax()
                f = b.ravel().astype(np.uint8)
                packed = (f[0::4] | (f[1::4] << 2) | (f[2::4] << 4) | (f[3::4] << 6)).astype(np.uint8)
                mixed_idx.append(gi + gj * CW)
                mixed_blk.append(packed.tobytes())
# bring the coarse grid in line with the fine masks
chg = newcls != cls_coarse
for c, t in ((1, SEA), (2, LAKE), (3, GLACIER)):
    cg[chg & (newcls == c)] = t
back = chg & (newcls == 0)
cg[back] = GRASS
ch = np.where(chg & (newcls == 1), np.minimum(ch, -1), ch)
ch = np.where(back, np.maximum(ch, 2), ch)
order = np.argsort(mixed_idx)
mi = np.array(mixed_idx, dtype='<u4')[order]
mb = b''.join(mixed_blk[k] for k in order)
dbuf = b'SMD1' + struct.pack('<II', len(mi), SUB) + mi.tobytes() + mb
dgz = gzip.compress(dbuf, 9)
open(paths.out('detail.txt'), 'w').write(base64.b64encode(dgz).decode())
print('detail masks', len(mi), 'cells, raw', len(dbuf), 'gz', len(dgz), 'time', round(_time.time() - _t0, 1))
