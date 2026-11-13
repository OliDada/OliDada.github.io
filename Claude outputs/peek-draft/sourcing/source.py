import json, os, re, sys, time, urllib.parse, urllib.request
UA = "olid.is-peek/1.0 (https://olid.is; daily game image sourcing)"
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? [\d.]+|cc by(-sa)?)", re.I)
def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r: return r.read()
        except Exception as e:
            time.sleep(5 * (i + 1)); err = e
    raise err
def search(q, n=10):
    p = dict(action="query", generator="search", gsrsearch=q, gsrnamespace=6, gsrlimit=n,
             prop="imageinfo", iiprop="url|size|extmetadata|mime", iiurlwidth=960,
             iiextmetadatafilter="Artist|LicenseShortName|LicenseUrl|ImageDescription", format="json", formatversion=2)
    d = json.loads(get(API + "?" + urllib.parse.urlencode(p)))
    pages = sorted(d.get("query", {}).get("pages", []), key=lambda x: x.get("index", 99))
    out = []
    for pg in pages:
        ii = pg.get("imageinfo", [{}])[0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "")
        if not OK.match(lic.strip()): continue
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"): continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if min(w, h) < 700 or max(w, h) / max(1, min(w, h)) > 2.2: continue
        artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()
        thumb = ii["thumburl"].split("?")[0].replace("thumb.wikimedia.org", "upload.wikimedia.org")
        out.append(dict(title=pg["title"], page=ii.get("descriptionurl"), thumb=thumb, w=w, h=h,
                        artist=artist[:120], licence=lic, licence_url=m.get("LicenseUrl", {}).get("value", "")))
    return out

from concurrent.futures import ThreadPoolExecutor
items = []
for line in open(sys.argv[1]):
    if line.startswith("#") or "|" not in line: continue
    name, al, q = [x.strip() for x in line.split("|")]
    items.append(dict(name=name, alt=[a.strip() for a in al.split(",") if a.strip()], q=q or name))
os.makedirs("cand", exist_ok=True); os.makedirs("meta", exist_ok=True)
old = json.load(open("cands.json")) if os.path.exists("cands.json") else {}
def slugof(it): return re.sub(r"[^a-z0-9]+", "-", it["name"].lower()).strip("-")
for k, v in old.items():
    if not os.path.exists(f"meta/{k}.json") and v["c"]: json.dump(v, open(f"meta/{k}.json", "w"))
def work(it):
    slug = slugof(it)
    if os.path.exists(f"meta/{slug}.json"): return
    c = search(f'{it["q"]} incategory:Quality_images filetype:bitmap')
    if len(c) < 3: c += search(f'{it["q"]} filetype:bitmap')
    seen = set(); c = [x for x in c if not (x["title"] in seen or seen.add(x["title"]))][:4]
    for k, x in enumerate(c):
        fn = f"cand/{slug}_{k}.jpg"
        if not os.path.exists(fn):
            try: open(fn, "wb").write(get(x["thumb"]))
            except Exception as e: x["fail"] = 1
        x["file"] = fn
    json.dump(dict(item=it, c=[x for x in c if not x.get("fail")]), open(f"meta/{slug}.json", "w"))
    print(slug, len(c), flush=True)
with ThreadPoolExecutor(int(sys.argv[2]) if len(sys.argv) > 2 else 5) as ex: list(ex.map(work, items))
print("DONE", len(os.listdir("meta")), "of", len(items))
