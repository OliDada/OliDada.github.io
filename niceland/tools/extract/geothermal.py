"""Geysers, hot springs, fumaroles, geothermal power plants and waterfalls.
In: iceland.osm.pbf   Out: data/geo.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, collections


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.o = []

    def add(s, t, lo, la, kind, extra=None):
        d = dict(
            k=kind,
            lo=round(lo, 6),
            la=round(la, 6),
            n=t.get('name', ''),
            h=t.get('height', ''),
            ele=t.get('ele', ''),
        )
        if extra:
            d.update(extra)
        s.o.append(d)

    def node(s, n):
        t = n.tags
        if not t:
            return
        nat = t.get('natural')
        ww = t.get('waterway')
        if nat == 'geyser':
            s.add(t, n.location.lon, n.location.lat, 'geyser')
        elif nat in ('hot_spring',):
            s.add(t, n.location.lon, n.location.lat, 'hot')
        elif nat == 'fumarole' or t.get('geological') == 'fumarole':
            s.add(t, n.location.lon, n.location.lat, 'fum')
        elif ww == 'waterfall':
            s.add(t, n.location.lon, n.location.lat, 'fall')
        elif t.get('power') == 'plant' and 'geothermal' in t.get('plant:source', ''):
            s.add(t, n.location.lon, n.location.lat, 'plant')

    def area(s, a):
        t = a.tags
        if (
            not (t.get('power') == 'plant' and 'geothermal' in t.get('plant:source', ''))
            and t.get('natural') != 'geyser'
        ):
            return
        try:
            r = next(iter(a.outer_rings()))
            pts = [(n.lon, n.lat) for n in r]
        except Exception:
            return
        lo = sum(p[0] for p in pts) / len(pts)
        la = sum(p[1] for p in pts) / len(pts)
        s.add(t, lo, la, 'plant' if t.get('power') else 'geyser')


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(h.o, open(paths.data('geo.json'), 'w'), ensure_ascii=False)
c = collections.Counter(x['k'] for x in h.o)
print(c)
for x in h.o:
    if x['k'] in ('geyser', 'plant'):
        print(x)
print([(x['n'], x['h']) for x in h.o if x['k'] == 'fall' and x['n']][:80])


# flow direction and river size at each waterfall
class F1(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.ids = {}

    def node(s, n):
        if n.tags.get('waterway') == 'waterfall':
            s.ids[n.id] = (n.location.lon, n.location.lat)


f1 = F1()
f1.apply_file(paths.PBF)


class F2(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.d = {}

    def way(s, w):
        ww = w.tags.get('waterway')
        if ww not in ('river', 'stream', 'canal', 'brook'):
            return
        try:
            nds = [(n.ref, n.lon, n.lat) for n in w.nodes]
        except Exception:
            return
        for i, (r, lo, la) in enumerate(nds):
            if r in f1.ids:
                a = nds[max(0, i - 1)]
                b = nds[min(len(nds) - 1, i + 1)]
                cur = s.d.get(r)
                if cur and cur['ww'] == 'river':
                    continue
                s.d[r] = dict(ww=ww, up=(a[1], a[2]), dn=(b[1], b[2]), w=w.tags.get('width', ''))


f2 = F2()
f2.apply_file(paths.PBF, locations=True)
pos = {(round(v[0], 6), round(v[1], 6)): k for k, v in f1.ids.items()}
n = 0
for x in h.o:
    if x['k'] != 'fall':
        continue
    r = pos.get((x['lo'], x['la']))
    if r is not None and r in f2.d:
        x.update(f2.d[r])
        n += 1
json.dump(h.o, open(paths.data('geo.json'), 'w'), ensure_ascii=False)
print('falls with flow', n)
