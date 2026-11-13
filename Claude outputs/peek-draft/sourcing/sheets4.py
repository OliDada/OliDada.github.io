# Review sheets: 3 items per row, 2 photos each (centre-cropped square), for items with photos.
import json, os
from PIL import Image, ImageDraw, ImageFont, ImageOps
C = 200; d = json.load(open("all3.json"))
done = set(l.split()[0] for l in open("done.txt")) if os.path.exists("done.txt") else set()
slugs = [s for s in sorted(d) if d[s]["c"] and s not in done]
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 17)
os.makedirs("sheets4", exist_ok=True); PER = 18
for p in range(0, len(slugs), PER):
    ch = slugs[p:p + PER]; rows = (len(ch) + 2) // 3
    sh = Image.new("RGB", (3 * (2 * C + 20), rows * (C + 30)), "white"); g = ImageDraw.Draw(sh)
    for i, s in enumerate(ch):
        x0, y0 = (i % 3) * (2 * C + 20), (i // 3) * (C + 30)
        g.text((x0 + 4, y0 + 4), s, fill="black", font=font)
        for k in range(2):
            fn = f"cand3/{s}_{k}.jpg"
            try: im = ImageOps.fit(Image.open(fn).convert("RGB"), (C, C))
            except Exception: continue
            sh.paste(im, (x0 + k * C, y0 + 26)); g.text((x0 + k * C + 4, y0 + 30), str(k), fill="yellow", font=font, stroke_width=2, stroke_fill="black")
    sh.save(f"sheets4/p{p // PER:02d}.jpg", quality=78)
print(len(slugs), "items", (len(slugs) + PER - 1) // PER, "sheets")
