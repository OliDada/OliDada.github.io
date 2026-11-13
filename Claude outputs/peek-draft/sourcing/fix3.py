# Re-download candidate photos that were cut off mid-download.
import json, os, sys, time, urllib.request
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
UA = "olid.is-peek/1.0 (https://olid.is; daily game image sourcing)"
def ok(fn):
    try: Image.open(fn).load(); return True
    except Exception: return False
todo = []
for m in os.listdir("meta3"):
    for c in json.load(open("meta3/" + m))["c"]:
        if c.get("file") and (not os.path.exists(c["file"]) or os.path.getsize(c["file"]) == 0): todo.append(c)
def fetch(c):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(c["thumb"], headers={"User-Agent": UA}), timeout=20) as r: data = r.read()
            open(c["file"] + ".tmp", "wb").write(data); os.replace(c["file"] + ".tmp", c["file"]); return
        except Exception: time.sleep(1.5 * (i + 1))
print(len(todo), "broken")
with ThreadPoolExecutor(8) as ex: list(ex.map(fetch, todo))
print(sum(os.path.getsize(c["file"]) == 0 for c in todo), "still broken")
