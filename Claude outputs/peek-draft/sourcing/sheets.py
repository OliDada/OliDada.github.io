# Contact sheets: one row per item, its candidates centre-cropped square (as they'd appear), labelled slug:k
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps
C, ROWS = 180, 8
metas = sorted(os.listdir("meta"))
order = [l.split("|")[0].strip() for l in open("items.txt") if "|" in l and not l.startswith("#")]
import re
slug = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
order = [slug(n) for n in order if os.path.exists(f"meta/{slug(n)}.json")]
start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
os.makedirs("sheets", exist_ok=True)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
except Exception: font = ImageFont.load_default()
for s in range(start, len(order), ROWS):
    chunk = order[s:s + ROWS]
    sheet = Image.new("RGB", (4 * C + 130, len(chunk) * (C + 6)), "white"); d = ImageDraw.Draw(sheet)
    for r, sl in enumerate(chunk):
        m = json.load(open(f"meta/{sl}.json")); y = r * (C + 6)
        d.text((4, y + C // 2 - 8), sl[:16], fill="black", font=font)
        for k, c in enumerate(m["c"]):
            try: im = ImageOps.fit(Image.open(c["file"]).convert("RGB"), (C, C))
            except Exception: continue
            sheet.paste(im, (130 + k * C, y)); d.text((134 + k * C, y + 2), str(k), fill="yellow", font=font, stroke_width=2, stroke_fill="black")
    sheet.save(f"sheets/s{s // ROWS:03d}.jpg", quality=80)
print(len(order), "items,", (len(order) + ROWS - 1) // ROWS, "sheets")
