"""Fills in missing addresses and names from OSM address points and addressed building outlines.
Run by world/build_world.py (not on its own).
"""

import json as _j, math as _m, re as _re

_pts = _j.load(open(paths.data('addr.json'))) + _j.load(open(paths.data('baddr.json')))
_G = {}
_GS = 40
for la, lo, st, hn, nm, am in _pts:
    x, y = ll(la, lo)
    _G.setdefault((int(x // _GS), int(y // _GS)), []).append((x, y, st, hn, nm, am))


def _pip(p, x, y):
    ins = False
    n = len(p)
    j = n - 1
    for i in range(n):
        xi, yi = p[i]
        xj, yj = p[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            ins = not ins
        j = i
    return ins


def _numkey(h):
    m = _re.match(r'(\d+)', h)
    return (int(m.group(1)) if m else 9999, h)


def _merge(st, nums):
    nums = sorted(set(nums), key=_numkey)
    if len(nums) == 1:
        return st + ' ' + nums[0]
    if all(_re.fullmatch(r'\d+', n) for n in nums):
        return st + ' ' + nums[0] + '–' + nums[-1]
    return st + ' ' + nums[0] + '–' + nums[-1]


# roads for "near X"
_R = {}
for src in (cap, ice):
    for e in src['h']:
        nm = e[2]
        if not nm or _re.fullmatch(r'[0-9A-Z]+', nm):
            continue
        for x, y in pts(e[0]):
            _R.setdefault((int(x // 60), int(y // 60)), []).append((x, y, nm))
fa = fn = fr = 0
for b in bl:
    if b['sp']:
        continue
    p = b['p']
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    x0, x1, y0, y1 = min(xs) - 3, max(xs) + 3, min(ys) - 3, max(ys) + 3
    hits = []
    for gx in range(int(x0 // _GS), int(x1 // _GS) + 1):
        for gy in range(int(y0 // _GS), int(y1 // _GS) + 1):
            for q in _G.get((gx, gy), ()):
                if x0 <= q[0] <= x1 and y0 <= q[1] <= y1 and _pip(p, q[0], q[1]):
                    hits.append(q)
    if not hits:
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        bd = 9.0
        for gx in range(int((cx - 3) // _GS), int((cx + 3) // _GS) + 1):
            for gy in range(int((cy - 3) // _GS), int((cy + 3) // _GS) + 1):
                for q in _G.get((gx, gy), ()):
                    d = _m.hypot(q[0] - cx, q[1] - cy)
                    if d < bd and q[3]:
                        bd = d
                        hits = [q]
    if not b['addr']:
        by = {}
        for q in hits:
            if q[2] and q[3]:
                by.setdefault(q[2], []).append(q[3])
        if by:
            st = max(by, key=lambda k: len(by[k]))
            b['addr'] = _merge(st, by[st])
            fa += 1
    if not b['name']:
        nms = [q[4] for q in hits if q[4] and not q[5]]
        poi = [q[4] for q in hits if q[4] and q[5]]
        if nms:
            b['name'] = nms[0]
            fn += 1
        elif poi and b['kind'] in (4, 6, 8):
            b['name'] = poi[0]
            fn += 1
    if not b['addr'] and b['kind'] in (0, 1, 2, 4, 5, 6, 7):
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        bd = 70.0
        best = ''
        for gx in range(int((cx - 70) // 60), int((cx + 70) // 60) + 1):
            for gy in range(int((cy - 70) // 60), int((cy + 70) // 60) + 1):
                for rx, ry, nm in _R.get((gx, gy), ()):
                    d = _m.hypot(rx - cx, ry - cy)
                    if d < bd:
                        bd = d
                        best = nm
        if best:
            b['addr'] = 'við ' + best
            fr += 1
print(
    'addresses filled', fa, 'names', fn, 'near-street', fr, 'still empty', sum(1 for b in bl if not b['addr'])
)
