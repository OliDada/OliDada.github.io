# Peek photos by Commons category: files are filed by what they show, so they match the word.
# Order: quality images inside the category tree, then quality images directly in it, then any files directly in it.
import json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
UA = "olid.is-peek/1.0 (https://olid.is; daily game image sourcing)"
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? [\d.]+|cc by(-sa)?)", re.I)
def get(url):
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r: return r.read()
        except Exception as e: err = e; time.sleep(3 * (i + 1))
    raise err
def files(q, n=30):
    p = dict(action="query", generator="search", gsrsearch=q, gsrnamespace=6, gsrlimit=n, prop="imageinfo", iiprop="url|size|extmetadata|mime",
             iiurlwidth=960, iiextmetadatafilter="Artist|LicenseShortName|LicenseUrl", format="json", formatversion=2)
    d = json.loads(get(API + "?" + urllib.parse.urlencode(p))); out = []
    for pg in sorted(d.get("query", {}).get("pages", []), key=lambda x: x.get("index", 99)):
        ii = pg.get("imageinfo", [{}])[0]; m = ii.get("extmetadata", {}); lic = m.get("LicenseShortName", {}).get("value", "")
        w, h = ii.get("width", 0), ii.get("height", 0)
        if not OK.match(lic.strip()) or ii.get("mime") != "image/jpeg" or min(w, h) < 700 or max(w, h) / max(1, min(w, h)) > 1.8: continue
        out.append(dict(title=pg["title"], page=ii.get("descriptionurl"), thumb=ii["thumburl"].split("?")[0].replace("thumb.wikimedia.org", "upload.wikimedia.org"),
                        artist=re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:120], licence=lic, licence_url=m.get("LicenseUrl", {}).get("value", "")))
    return out
items = [[x.strip() for x in l.split("|")] for l in open(sys.argv[1]) if "|" in l]
os.makedirs("cand2", exist_ok=True); os.makedirs("meta2", exist_ok=True)
slugof = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
def work(it):
    name, alt, cat = it; slug = slugof(name)
    if os.path.exists(f"meta2/{slug}.json"): return
    c = []
    for q in (f'deepcat:"{cat}" incategory:Quality_images', f'incategory:"{cat}" incategory:Quality_images', f'incategory:"{cat}"'):
        try: c += files(q)
        except Exception: pass
        if len(c) >= 6: break
    seen = set(); c = [x for x in c if not (x["title"] in seen or seen.add(x["title"]))][:6]
    for k, x in enumerate(c):
        fn = f"cand2/{slug}_{k}.jpg"
        try:
            if not os.path.exists(fn): open(fn, "wb").write(get(x["thumb"]))
            x["file"] = fn
        except Exception: x["fail"] = 1
    json.dump(dict(item=dict(name=name, alt=[a.strip() for a in alt.split(",") if a.strip()], cat=cat), c=[x for x in c if not x.get("fail")]), open(f"meta2/{slug}.json", "w"))
    print(slug, len(c), flush=True)
with ThreadPoolExecutor(10) as ex: list(ex.map(work, items))
print("DONE", len(os.listdir("meta2")), "of", len(items))
