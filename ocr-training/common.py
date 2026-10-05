"""Shared helpers: text sources, normalisation, fonts, social-post style rendering."""
import json, random, re, glob, os, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

ROOT = os.environ.get("OCR_WORK", "/tmp/ocr")
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "data")

# Families never used in training: results on them show how the model copes with fonts it has not seen.
HELDOUT_AR = {"Tajawal", "IBMPlexSansArabic", "Rubik", "MarkaziText", "Rakkas", "Mirza", "Katibeh",
              "Marhey", "ElMessiri", "ScheherazadeNew", "BlakaInk", "ReemKufiInk"}
HELDOUT_EN = {"Lato", "Merriweather", "Pacifico", "Cinzel", "Caveat", "Righteous", "Courgette"}
DECOR_AR = {"ArefRuqaa", "ArefRuqaaInk", "ReemKufiFun", "ReemKufiInk", "Jomhuria", "Lalezar", "Rakkas",
            "Blaka", "BlakaHollow", "BlakaInk", "Qahiri", "Marhey", "Kufam", "Katibeh", "Vibes", "Mirza",
            "Gulzar", "NotoNastaliqUrdu", "Alkalami", "BadeenDisplay", "Handjet", "Ruwudu", "AmiriQuran",
            "Amiri", "ScheherazadeNew", "Lateef", "ElMessiri", "Beiruti", "CairoPlay", "Harmattan",
            "ReemKufi", "Fustat", "Lemonada"}
DECOR_EN = {"Lobster", "Pacifico", "DancingScript", "GreatVibes", "PlayfairDisplay", "BebasNeue",
            "AbrilFatface", "Satisfy", "Cinzel", "AmaticSC", "Caveat", "PermanentMarker", "Righteous",
            "CormorantGaramond", "Sacramento", "KaushanScript", "Courgette", "AlfaSlabOne", "Bangers",
            "SpecialElite", "Comfortaa", "IndieFlower"}

HARAKAT = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def family(path):
    return re.split(r"[-\[.]", os.path.basename(path))[0]


def plain_arabic(t):
    """Uthmani Quran / vowelled text as most posts write it: no harakat, ordinary alef."""
    t = t.replace("ٱ", "ا")  # alef wasla
    t = re.sub(r"[۟-ۭ]", "", t)
    return HARAKAT.sub("", t)


def norm(t):
    """What matching compares: letters only, common spelling variants unified."""
    t = plain_arabic(t)
    t = re.sub("[إأآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    t = t.lower()
    t = re.sub(r"[^\w\s]|_|\d", " ", t)
    return re.sub(r"\s+", " ", t).strip()


@functools.lru_cache(None)
def cmap(path):
    return set(TTFont(path, fontNumber=0)["cmap"].getBestCmap().keys())


def covers(path, text):
    cm = cmap(path)
    return all(ord(c) in cm for c in text if not c.isspace())


def fonts(lang):
    out = []
    for p in sorted(glob.glob(f"{ROOT}/fonts/{lang}/*")):
        if not p.endswith((".ttf", ".otf")):
            continue
        out.append(p)
    return out


def corpus():
    q = json.load(open(f"{DATA}/quran.json"))
    h = json.load(open(f"{DATA}/hadeethenc.json"))
    ar = [("quran", f"{a['sura']}:{a['aya']}", a["text"]) for a in q]
    # Hadith: the Prophet's words (inside «») when present, else the first sentence or two.
    for x in h:
        m = re.findall(r"«([^»]{15,})»", x["text"])
        t = m[0] if m else x["text"]
        ar.append(("hadith", x["id"], t))
    en = [("quran-en", f"{a['sura']}:{a['aya']}", re.sub(r"\[\d+\]", "", a["translation"]).strip()) for a in q]
    return ar, en


def clip_words(text, lo, hi, rng):
    w = text.split()
    if len(text) <= hi:
        return text
    start = rng.randrange(0, max(1, len(w) // 3))
    out = []
    for x in w[start:]:
        if len(" ".join(out + [x])) > hi:
            break
        out.append(x)
    s = " ".join(out)
    return s if len(s) >= lo else text[:hi]


# ---------- backgrounds ----------
PALETTES = [  # (background colours, text colour)
    (["#ffffff"], "#111111"), (["#f7f3e8"], "#3b2f1e"), (["#0f3d2e", "#1c5c45"], "#f5e6b8"),
    (["#1d2a44", "#3a4f7a"], "#ffffff"), (["#000000"], "#ffffff"), (["#6b1d3a", "#a4345c"], "#fff4e0"),
    (["#e8d5b0", "#c9a66b"], "#2a1a08"), (["#d9f0e9", "#a8d8c8"], "#0b3d2c"), (["#2b2b2b", "#555555"], "#ffd166"),
    (["#ffe5ec", "#ffc2d1"], "#5a0b2b"), (["#004e64", "#00a5cf"], "#ffffff"), (["#3d1f00", "#7a4100"], "#ffd27a"),
]


def background(w, h, rng, kind):
    pal, fg = rng.choice(PALETTES)
    if kind == "plain":
        return Image.new("RGB", (w, h), "#ffffff"), "#111111"
    if kind == "photo":
        # Soft colourful blobs, like a blurred photo behind the words.
        arr = np.zeros((h // 8 + 1, w // 8 + 1, 3), np.float32)
        base = np.array([rng.randrange(256) for _ in range(3)], np.float32)
        arr[:] = base
        for _ in range(8):
            cy, cx, r = rng.randrange(arr.shape[0]), rng.randrange(arr.shape[1]), rng.randrange(5, 40)
            col = np.array([rng.randrange(256) for _ in range(3)], np.float32)
            yy, xx = np.ogrid[: arr.shape[0], : arr.shape[1]]
            m = np.exp(-((yy - cy) ** 2 + (xx - cx) ** 2) / (2 * r * r))[..., None]
            arr = arr * (1 - m) + col * m
        img = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        lum = np.asarray(img.convert("L")).mean()
        return img, ("#111111" if lum > 140 else "#ffffff")
    img = Image.new("RGB", (w, h), pal[0])
    if len(pal) > 1:  # vertical gradient
        a, b = np.array(Image.new("RGB", (1, 1), pal[0]))[0, 0], np.array(Image.new("RGB", (1, 1), pal[1]))[0, 0]
        t = np.linspace(0, 1, h)[:, None, None]
        img = Image.fromarray((a * (1 - t) + b * t).repeat(w, 1).astype(np.uint8))
    return img, fg


def wrap(draw, text, font, maxw, direction):
    lines, cur = [], ""
    for w in text.split():
        cand = (cur + " " + w).strip()
        if draw.textlength(cand, font=font, direction=direction) <= maxw or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def render_post(text, font_path, rng, rtl, kind=None):
    """A social-media style picture of `text`. Returns (PIL image, style tags)."""
    kind = kind or rng.choice(["plain", "card", "card", "photo"])
    W = rng.choice([1080, 1200, 900, 1080])
    H = rng.choice([1080, 675, 1350, 900])
    img, fg = background(W, H, rng, kind)
    d = ImageDraw.Draw(img)
    direction = "rtl" if rtl else "ltr"
    size = rng.randint(44, 84)
    for _ in range(12):
        font = ImageFont.truetype(font_path, size, layout_engine=ImageFont.Layout.RAQM)
        lines = wrap(d, text, font, W * 0.82, direction)
        lh = int(size * 1.7)
        if lh * len(lines) < H * 0.8:
            break
        size = int(size * 0.85)
    y = (H - lh * len(lines)) // 2
    effect = rng.choice(["none", "none", "shadow", "stroke"]) if kind != "plain" else "none"
    for ln in lines:
        tw = d.textlength(ln, font=font, direction=direction)
        x = (W - tw) / 2
        if effect == "shadow":
            d.text((x + 3, y + 3), ln, font=font, fill="#00000088" if fg != "#111111" else "#88888888", direction=direction)
        kw = dict(stroke_width=2, stroke_fill="#000000" if fg != "#111111" else "#ffffff") if effect == "stroke" else {}
        d.text((x, y), ln, font=font, fill=fg, direction=direction, **kw)
        y += lh
    if kind != "plain" and rng.random() < 0.5:  # decorative frame
        m = rng.randint(20, 50)
        d.rectangle([m, m, W - m, H - m], outline=fg, width=rng.randint(2, 6))
    # As shared online: smaller and JPEG-compressed.
    scale = rng.uniform(0.5, 1.0)
    img = img.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    return img, {"kind": kind, "effect": effect, "size": size, "scale": round(scale, 2)}
