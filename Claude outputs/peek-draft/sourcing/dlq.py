# Download the top N review photos per item, politely, until the time budget runs out.
import json, os, sys, time, urllib.request
UA = "olid.is-peek/1.0 (https://olid.is; daily game image sourcing)"
N, BUDGET = int(sys.argv[1]), float(sys.argv[2]); t0 = time.time(); got = left = 0
d = json.load(open("all3.json"))
for slug, m in sorted(d.items()):
    for k, c in enumerate(m["c"][:N]):
        fn = f"cand3/{slug}_{k}.jpg"
        if os.path.exists(fn) and os.path.getsize(fn) > 0: continue
        if time.time() - t0 > BUDGET: left += 1; continue
        try:
            with urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": UA}), timeout=10) as r: data = r.read()
            open(fn, "wb").write(data); got += 1; time.sleep(0.3)
        except Exception: time.sleep(2); left += 1
print("got", got, "left", left)
