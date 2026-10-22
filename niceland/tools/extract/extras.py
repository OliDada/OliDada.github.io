"""Lighthouses and sea lights, greenhouses, EV chargers, fire hydrants, viewpoints, masts, cliffs, streams and
opening hours.
In: iceland.osm.pbf   Out: data/extra.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, math, collections

C = math.cos(math.radians(64.124))


def LL(la, lo):
    return ((lo + 21.89) * 111320 * C, (64.124 - la) * 110574)


def num(v):
    try:
        return float(str(v).split(';')[0].split()[0].replace(',', '.').rstrip('m'))
    except Exception:
        return 0


def dp(p, eps):
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    md, mi = -1, 0
    for i in range(1, len(p) - 1):
        d = abs(dy * (p[i][0] - a[0]) - dx * (p[i][1] - a[1])) / L
        if d > md:
            md, mi = d, i
    if md < eps:
        return [a, b]
    return dp(p[: mi + 1], eps)[:-1] + dp(p[mi:], eps)


def Q(v):
    return int(round(v * 2))


def light(t):
    g = lambda k: t.get('seamark:light:' + k) or t.get('seamark:light:1:' + k) or ''
    return [g('colour'), g('character'), num(g('period')), g('group'), num(g('range')), num(g('height'))]


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.o = collections.defaultdict(list)
        s.st = collections.Counter()

    def pt(s, t, x, y, way):
        o = s.o
        if t.get('man_made') == 'lighthouse':
            o['lh'].append([Q(x), Q(y), num(t.get('height')), t.get('name', ''), *light(t)])
            s.st['lh'] += 1
            return
        sm = t.get('seamark:type', '')
        if (
            not way
            and sm.startswith('light')
            or (not way and sm.startswith('beacon') and t.get('seamark:light:colour'))
        ):
            o['sl'].append([Q(x), Q(y), *light(t)])
            s.st['sl'] += 1
        if t.get('amenity') == 'charging_station':
            o['ev'].append(
                [Q(x), Q(y), int(num(t.get('capacity')) or 2), t.get('operator') or t.get('name') or '']
            )
            s.st['ev'] += 1
        if t.get('emergency') == 'fire_hydrant':
            o['hy'].append([Q(x), Q(y)])
            s.st['hy'] += 1
        if t.get('tourism') == 'viewpoint':
            o['vp'].append([Q(x), Q(y), t.get('name', '')])
            s.st['vp'] += 1
        mm = t.get('man_made')
        if (
            mm == 'mast'
            or (mm == 'tower' and t.get('tower:type') in ('communication', 'radar', 'monitoring'))
            or (mm == 'tower' and num(t.get('height')) >= 30)
        ):
            o['ms'].append(
                [
                    Q(x),
                    Q(y),
                    num(t.get('height')),
                    0 if mm == 'mast' else 1,
                    t.get('name', ''),
                    t.get('tower:type', ''),
                ]
            )
            s.st['ms'] += 1
        oh = t.get('opening_hours')
        if (
            oh
            and t.get('name')
            and (t.get('shop') or t.get('amenity') or t.get('tourism') or t.get('leisure'))
        ):
            o['oh'].append([Q(x), Q(y), t.get('name'), oh])
            s.st['oh'] += 1

    def node(s, n):
        if len(n.tags):
            s.pt(n.tags, *LL(n.location.lat, n.location.lon), False)

    def way(s, w):
        t = w.tags
        if not len(t):
            return
        try:
            c = [LL(n.lat, n.lon) for n in w.nodes]
        except Exception:
            return
        if len(c) < 2:
            return
        cx = sum(p[0] for p in c) / len(c)
        cy = sum(p[1] for p in c) / len(c)
        s.pt(t, cx, cy, True)
        if t.get('building') == 'greenhouse' or t.get('landuse') == 'greenhouse_horticulture':
            s.o['gh'].append(
                [1 if t.get('landuse') else 0, [Q(v) for p in (c[:-1] if c[0] == c[-1] else c) for v in p]]
            )
            s.st['gh'] += 1
        if t.get('natural') == 'cliff':
            s.o['cf'].append([Q(v) for p in dp(c, 2) for v in p])
            s.st['cf'] += 1
        if (
            t.get('waterway') in ('stream',)
            and t.get('tunnel') in (None, 'no')
            and t.get('location') != 'underground'
        ):
            p = dp(c, 6)
            s.o['wt'].append([Q(v) for q in p for v in q])
            s.st['wt'] += 1


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(h.o, open(paths.data('extra.json'), 'w'), separators=(',', ':'))
print(h.st, sum(len(w) for w in h.o['wt']) // 2, 'stream points')
