"""Roads from OSM with node ids: nodes and ways for world.txt, plus roadx.txt (decks, tunnels, lanes, surfaces, signals…).
Run by world/build_world.py (not on its own).
"""

import heapq

RC = {
    'motorway': 1,
    'trunk': 1,
    'motorway_link': 2,
    'trunk_link': 2,
    'primary': 2,
    'primary_link': 3,
    'secondary': 3,
    'secondary_link': 4,
    'tertiary': 4,
    'tertiary_link': 4,
    'unclassified': 5,
    'residential': 5,
    'living_street': 5,
    'service': 6,
    'track': 6,
    'pedestrian': 7,
    'footway': 8,
    'path': 8,
    'steps': 9,
    'cycleway': 8,
    'bridleway': 8,
}
R3 = json.load(open(D + 'roads3.json'))
FX0, FY0, FX1, FY1 = OX, OY, OX + W * CS, OY + H * CS


def inFb(x, y, m=0):
    return FX0 - m < x < FX1 + m and FY0 - m < y < FY1 + m


# --- terrain at a world point (water surface where wet) ---
def terr(x, y):
    i, j = (x - OX) / CS - 0.5, (y - OY) / CS - 0.5
    if 0 <= i < W - 1 and 0 <= j < H - 1:
        i0, j0 = int(i), int(j)
        u, v = i - i0, j - j0
        hh = hgt[j0 : j0 + 2, i0 : i0 + 2].astype(float)
        if FSEA[j0 : j0 + 2, i0 : i0 + 2].any():
            return 0.0
        return float(
            hh[0, 0] * (1 - u) * (1 - v) + hh[0, 1] * u * (1 - v) + hh[1, 0] * (1 - u) * v + hh[1, 1] * u * v
        )
    i, j = (x - COX) / CCS - 0.5, (y - COY) / CCS - 0.5
    if 0 <= i < CW - 1 and 0 <= j < CH - 1:
        i0, j0 = int(i), int(j)
        u, v = i - i0, j - j0
        hh = np.maximum(0, ch[j0 : j0 + 2, i0 : i0 + 2].astype(float))
        return float(
            hh[0, 0] * (1 - u) * (1 - v) + hh[0, 1] * u * (1 - v) + hh[1, 0] * (1 - u) * v + hh[1, 1] * u * v
        )
    return 0.0


def wet(x, y):
    i, j = int((x - OX) / CS), int((y - OY) / CS)
    if 0 <= i < W and 0 <= j < H:
        return bool(FSEA[j, i]) or g[j, i] in (SEA, LAKE, RIVER)
    i, j = int((x - COX) / CCS), int((y - COY) / CCS)
    return 0 <= i < CW and 0 <= j < CH and cg[j, i] in (SEA, LAKE)


# --- ways ---
RW = []
for w in R3['ways']:
    cl = RC.get(w['h'])
    if cl is None or len(w['n']) < 2:
        continue
    pts_ = [ll(la, lo) for lo, la in w['c']]
    RW.append((w, cl, pts_))
idx_use = collections.Counter()
for w, cl, p in RW:
    for k, nid in enumerate(w['n']):
        idx_use[nid] += 1 if 0 < k < len(w['n']) - 1 else 2
PTN = set(q[4] for q in R3['pts']) | set(R3.get('fords', []))
nodes = {}
nlist = []
ways = []
WX = []
LX = []  # WX: per way (tunnel, layer, oneway, roundabout)
for w, cl, p in RW:
    far = not any(inFb(x, y, 2000) for x, y in p[:: max(1, len(p) // 6)] + [p[-1]])
    ids = w['n']
    keep = list(range(len(ids)))
    if far and len(ids) > 2:  # simplify long country roads between junctions
        keep = [0]
        seg = [0]
        for k in range(1, len(ids)):
            seg.append(k)
            if idx_use[ids[k]] > 1 or k == len(ids) - 1 or ids[k] in PTN:
                s = dp([p[q] for q in seg], 3.0 if cl <= 5 else 6.0)
                ss = set((round(a, 2), round(b, 2)) for a, b in s)
                keep += [q for q in seg[1:] if (round(p[q][0], 2), round(p[q][1], 2)) in ss or q == seg[-1]]
                seg = [k]
    seq = []
    for k in keep:
        nid = ids[k]
        if nid not in nodes:
            nodes[nid] = len(nlist)
            nlist.append((int(round(p[k][0] * 2)), int(round(p[k][1] * 2))))
        j = nodes[nid]
        if not seq or seq[-1] != j:
            seq.append(j)
    if len(seq) < 2:
        continue
    ow = w['ow']
    if ow == -1:
        seq = seq[::-1]
        ow = 1
    try:
        ly = int(float(str(w['ly']).split(';')[0]))
    except Exception:
        ly = 0
    ways.append((seq, cl, S(w['nm']), w['br']))
    WX.append((w['tu'] if w['tu'] == 1 else 0, max(-5, min(5, ly)), ow, w['rb']))

    def _num(v):
        try:
            return int(float(str(v).split(';')[0].split()[0]))
        except Exception:
            return 0

    _sf = w.get('sf', '')
    _ref = w.get('ref', '') or ''
    _GR = (
        'gravel',
        'fine_gravel',
        'compacted',
        'unpaved',
        'dirt',
        'ground',
        'earth',
        'pebblestone',
        'sand',
        'rock',
        'mud',
        'grass',
        'gravel;asphalt',
        'stone',
    )
    _PV = (
        'asphalt',
        'paved',
        'concrete',
        'concrete:plates',
        'paving_stones',
        'sett',
        'chipseal',
        'cobblestone',
        'concrete:lanes',
        'metal',
        'wood',
    )
    _sc = 2 if _sf in _GR else 1 if _sf in _PV else (2 if w['h'] == 'track' or _ref.startswith('F') else 0)
    _fl = (
        1
        if (
            _ref.startswith('F')
            or w.get('se', '') in ('yes', 'summer')
            or 'winter' in (w.get('ac', '') or '').lower()
        )
        else 0
    ) | (2 if w.get('fd') else 0)
    LX.append((max(0, min(8, _num(w.get('ln', '')))), max(0, min(130, _num(w.get('ms', '')))), _sc, _fl))
NR = len(ways)
# rivers as non-walkable lines (class 10)
for c, nm in ice['river']:
    p = dp(pts(c), 25.0)
    if len(p) < 2:
        continue
    seq = []
    for x, y in p:
        k = ('r', int(round(x * 2)), int(round(y * 2)))
        if k not in nodes:
            nodes[k] = len(nlist)
            nlist.append((k[1], k[2]))
        j = nodes[k]
        if not seq or seq[-1] != j:
            seq.append(j)
    if len(seq) >= 2:
        ways.append((seq, 10, S(nm), 0))
        WX.append((0, 0, 0, 0))
        LX.append((0, 0, 0, 0))
print('road nodes', len(nlist), 'ways', len(ways))
# --- deck heights: bridges lift, underpasses sink, ramps blend over ~100 m ---
NP = np.array(nlist, float) / 2.0
NN = len(nlist)
base = np.array([terr(x, y) for x, y in NP])
wetn = np.array([wet(x, y) for x, y in NP])
ebr = np.zeros(NN, bool)
etu = np.zeros(NN, bool)
onroad = np.zeros(NN, bool)
for wi in range(NR):
    seq, cl, nm, br = ways[wi]
    tu = WX[wi][0]
    for j in seq:
        if br:
            ebr[j] = True
        if tu:
            etu[j] = True
        if not br and not tu:
            onroad[j] = True
port = etu & onroad  # tunnel portals
SEGC = 40.0
grid = collections.defaultdict(list)
for wi, (seq, cl, nm, br) in enumerate(ways):
    for k in range(len(seq) - 1):
        a, b = seq[k], seq[k + 1]
        x0, y0 = NP[a]
        x1, y1 = NP[b]
        for gx in range(int(min(x0, x1) // SEGC), int(max(x0, x1) // SEGC) + 1):
            for gy in range(int(min(y0, y1) // SEGC), int(max(y0, y1) // SEGC) + 1):
                grid[(gx, gy)].append((wi, k))


def xing(a, b, c, d):
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = NP[a], NP[b], NP[c], NP[d]
    den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
    if abs(den) < 1e-9:
        return None
    t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den
    u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den
    return (t, u) if 0 <= t <= 1 and 0 <= u <= 1 else None


E = base.copy()
# tunnels: interior below the terrain, at least clearance below whatever crosses over
for wi in range(NR):
    seq, cl, nm, br = ways[wi]
    if not WX[wi][0]:
        continue
    # interpolate between the two ends of the tunnel way, never above ground
    L = [0.0]
    for k in range(1, len(seq)):
        L.append(L[-1] + float(np.hypot(*(NP[seq[k]] - NP[seq[k - 1]]))))
    za, zb = base[seq[0]], base[seq[-1]]
    for k, j in enumerate(seq):
        f = L[k] / max(1e-6, L[-1])
        E[j] = min(E[j], za + (zb - za) * f, base[j] - (0 if (k == 0 or k == len(seq) - 1) else 4.5))


def crossings(wi):
    seq, cl, nm, br = ways[wi]
    out = []
    for k in range(len(seq) - 1):
        a, b = seq[k], seq[k + 1]
        x0, y0 = NP[a]
        x1, y1 = NP[b]
        seen = set()
        for gx in range(int(min(x0, x1) // SEGC), int(max(x0, x1) // SEGC) + 1):
            for gy in range(int(min(y0, y1) // SEGC), int(max(y0, y1) // SEGC) + 1):
                for wj, kk in grid[(gx, gy)]:
                    if wj == wi or (wj, kk) in seen:
                        continue
                    seen.add((wj, kk))
                    c, d = ways[wj][0][kk], ways[wj][0][kk + 1]
                    if len({a, b, c, d}) < 4:
                        continue
                    r = xing(a, b, c, d)
                    if r:
                        out.append((k, r[0], wj, kk, r[1]))
    return out


for wi in range(NR):  # roads passing over a tunnel: tunnel goes deeper
    if not WX[wi][0]:
        continue
    seq = ways[wi][0]
    for k, t, wj, kk, u in crossings(wi):
        if WX[wj][0] or ways[wj][1] == 10:
            continue
        c, d = ways[wj][0][kk], ways[wj][0][kk + 1]
        px, py = NP[c] + (NP[d] - NP[c]) * u
        zo = terr(px, py) + ((E[c] - base[c]) + ((E[d] - base[d]) - (E[c] - base[c])) * u)
        need = zo - (5.0 if ways[wi][1] <= 6 else 3.2)
        for j in (seq[k], seq[k + 1]):
            E[j] = min(E[j], need)
req = np.full(NN, -1e9)
UNDERW = set()
roadn = np.zeros(NN, bool)
for wi in range(NR):
    if ways[wi][1] <= 6:
        for j in ways[wi][0]:
            roadn[j] = True


def bridge_pass():
    req[:] = -1e9
    for wi in range(NR):
        seq, cl, nm, br = ways[wi]
        if not br:
            continue
        for j in seq:
            req[j] = max(req[j], base[j] + (4.0 if wetn[j] else 0.8) + (3 if wetn[j] and cl <= 3 else 0))
        for k, t, wj, kk, u in crossings(wi):
            sj, clj = ways[wj][0], ways[wj][1]
            if ways[wj][3] and WX[wj][1] >= WX[wi][1]:
                continue  # the other one is the higher bridge
            if clj != 10:
                UNDERW.add(wj)
            c, d = sj[kk], sj[kk + 1]
            px, py = NP[c] + (NP[d] - NP[c]) * u
            zu = terr(px, py) + ((E[c] - base[c]) + ((E[d] - base[d]) - (E[c] - base[c])) * u)
            need = zu + (2.5 if clj == 10 else 3.4 if clj >= 7 else 5.6)
            a, b = seq[k], seq[k + 1]
            Lab = float(np.hypot(*(NP[b] - NP[a])))
            req[a] = max(req[a], need - 0.015 * t * Lab)
            req[b] = max(req[b], need - 0.015 * (1 - t) * Lab)


for it in range(2):
    bridge_pass()
    E2 = np.maximum(base, np.where(req > -1e8, req, base))
    E2 = np.where(etu & ~port, np.minimum(E2, E), E2)
    undern = np.zeros(NN, bool)
    for wj in UNDERW:
        for j in ways[wj][0]:
            undern[j] = True
    undern &= ~ebr  # roads that pass under a bridge stay on the ground; ramps start where they meet them
    # ramps: spread lifts along the network at a 5 % grade (paths 9 %), at most ~160 m
    adj = collections.defaultdict(list)
    for wi in range(NR):
        seq, cl, nm, br = ways[wi]
        gr = 0.05 if cl <= 6 else 0.09
        for k in range(len(seq) - 1):
            a, b = seq[k], seq[k + 1]
            Lab = float(np.hypot(*(NP[b] - NP[a])))
            adj[a].append((b, Lab, gr, cl >= 7))
            adj[b].append((a, Lab, gr, cl >= 7))
    hq = [(-(E2[j] - base[j]), j) for j in range(NN) if E2[j] - base[j] > 0.3]
    heapq.heapify(hq)
    while hq:
        nl, a = heapq.heappop(hq)
        lift = -nl
        if E2[a] - base[a] < lift - 1e-6:
            continue
        for b, Lab, gr, foot in adj[a]:
            nz = E2[a] - gr * Lab
            if undern[b] or (foot and roadn[b] and not ebr[b]):
                continue  # footbridge ramps never lift a street
            if nz > E2[b] + 1e-3 and nz > base[b] + 0.05 and not (etu[b] and not port[b]):
                E2[b] = nz
                heapq.heappush(hq, (-(nz - base[b]), b))
    E = np.where(etu & ~port, np.minimum(E, E2), E2)
DZ = np.clip(np.round((E - base) * 10), -400, 250).astype(np.int16)
_bad = []
for wi in range(NR):
    if not ways[wi][3] or ways[wi][1] > 4:
        continue
    for k, t, wj, kk, u in crossings(wi):
        if ways[wj][1] > 6 or (ways[wj][3] and WX[wj][1] >= WX[wi][1]):
            continue
        a_, b_ = ways[wi][0][k], ways[wi][0][k + 1]
        c_, d_ = ways[wj][0][kk], ways[wj][0][kk + 1]
        zo = (E[a_] - base[a_]) * (1 - t) + (E[b_] - base[b_]) * t
        zu = (E[c_] - base[c_]) * (1 - u) + (E[d_] - base[d_]) * u
        if zo - zu < 4 and inFb(*NP[a_]):
            _bad.append((round(float(zo - zu), 1), ways[wi][1], ways[wj][1]))
print('bridge clearances under 4 m in the capital:', len(_bad), _bad[:12])
print(
    'elevated nodes',
    int((DZ > 5).sum()),
    'lowered',
    int((DZ < -5).sum()),
    'max deck',
    round(float(DZ.max()) / 10, 1),
)
_cap = np.array([inFb(x, y) for x, y in NP])
print(
    'capital deck heights',
    np.percentile(DZ[_cap & (DZ > 5)] / 10, [50, 90, 99, 100]).round(1) if (_cap & (DZ > 5)).any() else '-',
)
# --- point features (signals, crossings, signs) snapped to their node, with the road's direction ---
nodeway = collections.defaultdict(list)
for wi in range(NR):
    seq = ways[wi][0]
    for k, j in enumerate(seq):
        nodeway[j].append((wi, k))
PT = []
TY = {
    'traffic_signals': 1,
    'crossing': 2,
    'stop': 3,
    'give_way': 4,
    'mini_roundabout': 5,
    'speed_camera': 6,
    'level_crossing': 7,
}
for lo, la, h, cr, nid in R3['pts']:
    j = nodes.get(nid)
    if j is None:
        continue
    best = None
    for wi, k in nodeway[j]:
        if ways[wi][1] > 7:
            continue
        if best is None or ways[wi][1] < ways[best[0]][1]:
            best = (wi, k)
    if best is None:
        if h != 'crossing':
            continue
        best = nodeway[j][0] if nodeway[j] else None
        if best is None:
            continue
    wi, k = best
    seq = ways[wi][0]
    a, b = seq[max(0, k - 1)], seq[min(len(seq) - 1, k + 1)]
    ang = float(np.arctan2(NP[b][1] - NP[a][1], NP[b][0] - NP[a][0]))
    zeb = (
        1
        if cr in ('zebra', 'marked', 'uncontrolled', 'traffic_signals') or (cr == '' and h == 'crossing')
        else 0
    )
    if h == 'crossing' and ways[wi][1] > 5:
        continue  # crossings over footpaths are not painted
    PT.append((j, TY[h], int(round(ang * 1000)), wi, zeb))
# --- barriers near roads (guard rails, fences, walls) ---
BAR = []
for kind, cc in R3['bar']:
    p = [ll(la, lo) for lo, la in cc]
    if not any(inFb(x, y) for x, y in p):
        continue
    p = dp(p, 0.6)
    BAR.append(
        (
            {
                'guard_rail': 1,
                'jersey_barrier': 1,
                'fence': 2,
                'wall': 3,
                'kerb': 4,
                'handrail': 2,
                'hedge': 5,
            }[kind],
            p,
        )
    )
rx = bytearray(b'SMRX')
rx += struct.pack('<III', len(ways), NN, len(PT))
rx += np.asarray([w[0] for w in WX], '<u1').tobytes() + np.asarray([w[1] for w in WX], '<i1').tobytes()
rx += np.asarray([w[2] for w in WX], '<u1').tobytes() + np.asarray([w[3] for w in WX], '<u1').tobytes()
rx += DZ.astype('<i2').tobytes() + np.asarray(etu & ~port, '<u1').tobytes()
rx += (
    np.asarray([q[0] for q in PT], '<u4').tobytes()
    + np.asarray([q[1] for q in PT], '<u1').tobytes()
    + np.asarray([q[2] for q in PT], '<i2').tobytes()
)
rx += np.asarray([q[3] for q in PT], '<u4').tobytes() + np.asarray([q[4] for q in PT], '<u1').tobytes()
rx += struct.pack('<I', len(BAR))
for k, p in BAR:
    rx += (
        struct.pack('<BH', k, len(p)) + np.asarray([int(round(v * 2)) for q in p for v in q], '<i4').tobytes()
    )
rx += (
    b'LNMS'
    + np.asarray([q[0] for q in LX], '<u1').tobytes()
    + np.asarray([q[1] for q in LX], '<u1').tobytes()
)
rx += (
    b'SFFL'
    + np.asarray([q[2] for q in LX], '<u1').tobytes()
    + np.asarray([q[3] for q in LX], '<u1').tobytes()
)
_FN = sorted(set(nodes[f] for f in R3.get('fords', []) if f in nodes))
rx += b'FORD' + struct.pack('<I', len(_FN)) + np.asarray(_FN, '<u4').tobytes()
print(
    'surface gravel ways',
    sum(1 for q in LX if q[2] == 2),
    'seasonal',
    sum(1 for q in LX if q[3] & 1),
    'ford nodes',
    len(_FN),
)
open(paths.out('roadx.txt'), 'w').write(base64.b64encode(gzip.compress(bytes(rx), 9)).decode())
print(
    'roadx points',
    len(PT),
    'barriers',
    len(BAR),
    'tunnel ways',
    sum(1 for w in WX if w[0]),
    'oneway',
    sum(1 for w in WX if w[2]),
)
