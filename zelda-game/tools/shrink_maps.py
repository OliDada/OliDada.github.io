#!/usr/bin/env python3
"""Make the RPG's Tiled maps smaller to download.

    python3 tools/shrink_maps.py assets/maps/*.json

- Writes the JSON without indentation (the files were pretty-printed).
- Trims empty columns/rows from the right and bottom of a map. Nothing moves:
  only space past the last tile or object is removed. (beach.json was a
  1000x1000 map with tiles only in the top-left corner: 35 MB -> well under 1 MB.)
"""
import json, sys, math, os

for path in sys.argv[1:]:
    before = os.path.getsize(path)
    d = json.load(open(path, encoding='utf-8'))
    W, H = d['width'], d['height']
    tw, th = d['tilewidth'], d['tileheight']
    mx = my = 0
    simple = not d.get('infinite')
    for l in d['layers']:
        if l['type'] == 'tilelayer':
            if 'data' not in l or l.get('width') != W or l.get('x', 0) or l.get('y', 0) or l.get('encoding'):
                simple = False
                continue
            for i, v in enumerate(l['data']):
                if v:
                    mx = max(mx, i % W); my = max(my, i // W)
        elif l['type'] == 'objectgroup':
            for o in l.get('objects', []):
                mx = max(mx, math.ceil((o['x'] + o.get('width', 0)) / tw))
                my = max(my, math.ceil((o['y'] + o.get('height', 0)) / th))
    nw, nh = min(W, mx + 8), min(H, my + 8)   # keep a small margin
    if simple and (nw < W or nh < H):
        for l in d['layers']:
            if l['type'] == 'tilelayer':
                data = l['data']
                l['data'] = [data[y * W + x] for y in range(nh) for x in range(nw)]
                l['width'], l['height'] = nw, nh
        d['width'], d['height'] = nw, nh
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, separators=(',', ':'), ensure_ascii=False)
    print(f'{path}: {W}x{H} -> {d["width"]}x{d["height"]}, {before // 1024} KB -> {os.path.getsize(path) // 1024} KB')
