"""Training lines: one line of Quran/hadith (or English translation) per image, in the training fonts,
with the colours, effects and damage of social media pictures. Writes png + box + gt.txt.

usage: make_lines.py ar|en COUNT OUTDIR [SEED]
"""
import os, sys, random
from multiprocessing import Pool
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from common import *

lang, count, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
os.makedirs(out, exist_ok=True)
ar, en = corpus()
items = [x for i, x in enumerate(ar if lang == "ar" else en) if i % 10 != 3]  # test texts left out
held = HELDOUT_AR if lang == "ar" else HELDOUT_EN
FONTS = [p for p in fonts(lang) if family(p) not in held]
rtl = lang == "ar"


LABEL_FIX = str.maketrans({"،": ",", "\u200c": None, "{": None, "}": None, "﴿": None, "﴾": None, "–": "-"})


def line_text(rng):
    src, sid, t = rng.choice(items)
    w = t.split()
    n = rng.randint(2, 9)
    s = rng.randrange(0, max(1, len(w) - n + 1))
    t = " ".join(w[s:s + n])
    if lang == "ar":
        shown = t if (src == "quran" and rng.random() < 0.35) else plain_arabic(t)
        # The model learns to give the letters without harakat. The base model has no Arabic comma,
        # so it is labelled ","; a few other marks it lacks are dropped.
        gt = " ".join(plain_arabic(t).translate(LABEL_FIX).split())
        return shown, gt
    return t, t


def render(i):
    rng = random.Random(seed * 1_000_003 + i)
    for _ in range(30):
        fp = rng.choice(FONTS)
        shown, gt = line_text(rng)
        if covers(fp, shown) and gt.strip():
            break
    else:
        return
    size = rng.randint(22, 72)
    font = ImageFont.truetype(fp, size, layout_engine=ImageFont.Layout.RAQM)
    direction = "rtl" if rtl else "ltr"
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    l, t, r, b = probe.textbbox((0, 0), shown, font=font, direction=direction)
    pad = rng.randint(4, 24)
    W, H = r - l + 2 * pad, b - t + 2 * pad
    kind = rng.choice(["plain", "card", "card", "photo"])
    bg, fg = background(W, H, rng, kind)
    if kind == "card" and rng.random() < 0.3:  # coloured text on a light card
        fg = rng.choice(["#0f5132", "#842029", "#1d3557", "#6a040f", "#3c096c", "#b8860b"])
    d = ImageDraw.Draw(bg)
    eff = rng.choice(["none", "none", "none", "shadow", "stroke"])
    x, y = pad - l, pad - t
    if eff == "shadow":
        o = max(1, size // 20)
        d.text((x + o, y + o), shown, font=font, fill="#000000" if fg != "#111111" else "#999999", direction=direction)
    kw = dict(stroke_width=max(1, size // 30), stroke_fill="#000000" if fg != "#111111" else "#ffffff") if eff == "stroke" else {}
    d.text((x, y), shown, font=font, fill=fg, direction=direction, **kw)
    img = bg
    if rng.random() < 0.5:  # shared online: shrunk then compressed
        s = rng.uniform(0.4, 0.9)
        img = img.resize((max(8, int(W * s)), max(8, int(H * s))), Image.LANCZOS)
    if rng.random() < 0.2:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.0)))
    if rng.random() < 0.15:
        img = img.rotate(rng.uniform(-1.5, 1.5), expand=True, fillcolor=bg.getpixel((0, 0)))
    a = np.asarray(img.convert("RGB"))
    ok, enc = cv2.imencode(".jpg", a[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, rng.randint(40, 95)])
    a = cv2.imdecode(enc, cv2.IMREAD_COLOR)
    # Same preparation the app applies: grey, stretched, dark text on light.
    y = (0.299 * a[..., 2] + 0.587 * a[..., 1] + 0.114 * a[..., 0])
    lo, hi = np.percentile(y, 1), np.percentile(y, 99)
    g = np.clip((y - lo) * 255 / max(1, hi - lo), 0, 255).astype(np.uint8)
    border = np.concatenate([g[:2].ravel(), g[-2:].ravel(), g[:, :2].ravel(), g[:, -2:].ravel()])
    if np.median(border) < 128:
        g = 255 - g
    name = f"{out}/{lang}_{seed}_{i:06d}"
    cv2.imwrite(name + ".png", g)
    h, w = g.shape
    open(name + ".gt.txt", "w").write(gt + "\n")
    # Box labels are in the order the line is drawn, left to right: Arabic is reversed here (the
    # .gt.txt keeps reading order). Labels in reading order made Arabic fine-tuning collapse.
    label = gt[::-1] if rtl else gt
    open(name + ".box", "w").write(f"WordStr 0 0 {w} {h} 0 #{label}\n\t 0 0 {w} {h} 0\n")


with Pool(4) as p:
    p.map(render, range(count), chunksize=64)
print("done", count)
