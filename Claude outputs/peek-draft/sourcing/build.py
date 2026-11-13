# Build Peek's photo pool: square-crop each picked photo to 600px, write img/, pool.js and credits.html.
import json, os, re, html
from PIL import Image, ImageOps
OUT = "../peek"
slug = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
names = {}
for l in open("items.txt"):
    if "|" in l and not l.startswith("#"):
        n, a, _ = [x.strip() for x in l.split("|")]
        names[slug(n)] = [n.replace(" (animal)", "")] + [x.strip().lower() for x in a.split(",") if x.strip()]
picks = []
for f, meta, cand in (("picks.txt", "meta", "cand"), ("picks3.txt", "meta3", "cand3")):
    for l in open(f):
        p = l.split()
        if not p: continue
        item, src, k = (p[0], p[0], int(p[1])) if len(p) == 2 else (p[0], p[1], int(p[2]))
        m = json.load(open(f"{meta}/{src}.json")); fn = f"{cand}/{src}_{k}.jpg"
        c = next(x for x in m["c"] if x.get("file") == fn)
        picks.append((item, fn, c))
os.makedirs(f"{OUT}/img", exist_ok=True)
pool, credits, seen = [], [], set()
for item, fn, c in picks:
    if item in seen: continue
    seen.add(item)
    im = ImageOps.fit(Image.open(fn).convert("RGB"), (600, 600), Image.LANCZOS)
    im.save(f"{OUT}/img/{item}.jpg", quality=82, optimize=True, progressive=True)
    pool.append([item, names[item], len(credits)])
    credits.append(dict(name=names[item][0], title=c["title"][5:], page=c["page"], artist=c["artist"] or "Unknown", licence=c["licence"], url=c["licence_url"]))
open(f"{OUT}/pool.js", "w").write("// Picture pool for Peek: [photo file in img/, accepted names (first is shown), credit index]. Photos from Wikimedia Commons, see credits.html.\n"
    "window.PEEK_POOL = " + json.dumps(pool, separators=(",", ":")) + ";\n")
rows = "\n".join(f'<li><b>{html.escape(c["name"])}</b>: <a href="{html.escape(c["page"])}">{html.escape(c["title"])}</a> by {html.escape(c["artist"])}, '
                 + (f'<a href="{html.escape(c["url"])}">{html.escape(c["licence"])}</a>' if c["url"] else html.escape(c["licence"])) + "</li>" for c in sorted(credits, key=lambda c: c["name"]))
open(f"{OUT}/credits.html", "w").write(f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Peek: photo credits</title><link rel="icon" href="/images/logo-favicon.png?v=3" type="image/png">
<style>body{{font:15px/1.5 system-ui,sans-serif;color:#1E1B24;background:#F4EFE6;max-width:760px;margin:0 auto;padding:24px}}h1{{font-size:26px}}li{{margin:4px 0}}a{{color:#3D6BFF}}</style>
</head><body><p><a href="index.html">Back to Peek</a></p><h1>Photo credits</h1>
<p>Every photo in Peek comes from Wikimedia Commons under a free licence. Photos are cropped to a square and resized.</p>
<ul>
{rows}
</ul></body></html>
''')
print(len(pool), "pictures")
