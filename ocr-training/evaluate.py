"""Run an OCR setup over the test set and score it.

usage: evaluate.py NAME ara_model eng_model [prep]
  prep: js   = the extension's current preparation (grey, contrast stretch, enlarge small)
        v2   = improved preparation (see prep_v2)
"""
import json, subprocess, sys, os, collections, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np, cv2
from rapidfuzz import fuzz, process
from rapidfuzz.distance import Levenshtein
from common import *

name, ara_model, eng_model = sys.argv[1:4]
prep = sys.argv[4] if len(sys.argv) > 4 else "js"
psm = os.environ.get("PSM", "3")
rows = json.load(open(f"{ROOT}/test.json"))
if os.environ.get("ONLY"):
    rows = [r for r in rows if r["lang"] == os.environ["ONLY"]]
tdir = f"{ROOT}/run/{name}"
shutil.rmtree(tdir, ignore_errors=True)
os.makedirs(f"{tdir}/tessdata", exist_ok=True)
if os.path.exists(ara_model): shutil.copy(ara_model, f"{tdir}/tessdata/ara.traineddata")
if os.path.exists(eng_model): shutil.copy(eng_model, f"{tdir}/tessdata/eng.traineddata")


def prep_js(img):
    """Same steps as src/shared/ocrImage.ts today."""
    h, w = img.shape[:2]
    s = min(3, 1800 / w) if w < 1000 else 1
    img = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_CUBIC)
    y = (0.299 * img[..., 2] + 0.587 * img[..., 1] + 0.114 * img[..., 0]).round()
    lo, hi = np.percentile(y, 1), np.percentile(y, 99)
    return np.clip((y - lo) * 255 / max(1, hi - lo), 0, 255).astype(np.uint8)


def prep_v2(img):
    """Grey + stretch, then make the text dark on light: Tesseract reads dark letters best."""
    g = prep_js(img)
    # The background is the most common tone along the border and in general; if it is dark, invert.
    if np.median(g) < 128:
        g = 255 - g
    return g


def line_height(b):
    """Median height of text lines in a binary image (text = 1), from the row profile."""
    rows = b.mean(1) > 0.004
    runs, start = [], None
    for i, on in enumerate(list(rows) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= 4:
                runs.append(i - start)
            start = None
    return float(np.median(runs)) if runs else 0.0


def glyph_height(b):
    """Height of the tall letters (alef, lam, l, k...): 90th percentile of letter-sized blobs."""
    n, _, st, _ = cv2.connectedComponentsWithStats(b, connectivity=8)
    H, W = b.shape
    hs = [st[i, 3] for i in range(1, n) if st[i, 4] >= 15 and st[i, 3] < 0.4 * H and st[i, 2] < 0.5 * W]
    return float(np.percentile(hs, 90)) if len(hs) >= 5 else 0.0


def prep_v3(img):
    """Grey + stretch, dark text on light, then scaled so text lines are a size Tesseract reads well."""
    y = (0.299 * img[..., 2] + 0.587 * img[..., 1] + 0.114 * img[..., 0])
    lo, hi = np.percentile(y, 1), np.percentile(y, 99)
    g = np.clip((y - lo) * 255 / max(1, hi - lo), 0, 255).astype(np.uint8)
    border = np.concatenate([g[:4].ravel(), g[-4:].ravel(), g[:, :4].ravel(), g[:, -4:].ravel()])
    if np.median(border) < 128:
        g = 255 - g
    t, _ = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    lh = glyph_height((g < t).astype(np.uint8))
    s = TARGET / lh if lh else 1.0
    s = min(4.0, max(0.25, s))
    h, w = g.shape
    g = cv2.resize(g, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA)
    return cv2.copyMakeBorder(g, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=255)


TARGET = float(os.environ.get("TARGET", "60"))
PREP = {"js": prep_js, "v2": prep_v2, "v3": prep_v3}[prep]


def ocr(r):
    img = cv2.imread(r["path"])
    p = f"{tdir}/{os.path.basename(r['path'])}.png"
    cv2.imwrite(p, PREP(img))
    lang = "ara" if r["lang"] == "ar" else "eng"
    out = subprocess.run(["tesseract", p, "stdout", "--tessdata-dir", f"{tdir}/tessdata", "-l", lang, "--psm", psm],
                         capture_output=True, text=True, env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
    os.remove(p)
    return " ".join(out.split())


if os.environ.get("OUTS"):  # readings made elsewhere (web/run.mjs, in the browser)
    outs = [" ".join((o or {}).get("text", "").split()) for o in json.load(open(os.environ["OUTS"]))]
else:
    with ThreadPoolExecutor(4) as ex:
        outs = list(ex.map(ocr, rows))

ar, en = corpus()
keys = {"ar": [(x[0], x[1]) for x in ar], "en": [(x[0], x[1]) for x in en]}
norms = {"ar": [norm(x[2]) for x in ar], "en": [norm(x[2]) for x in en]}
res = []
for r, o in zip(rows, outs):
    gt, got = norm(r["text"]), norm(o)
    cer = Levenshtein.distance(gt, got) / max(1, len(gt))
    found = False
    if len(got) >= 8:
        # Found = the true source scores best among sources at least as long as the text read
        # (a short ayah such as "الم" would otherwise fit inside anything).
        ti = keys[r["lang"]].index((r["source"], r["id"]))
        true = fuzz.partial_ratio(got, norms[r["lang"]][ti])
        hits = process.extract(got, norms[r["lang"]], scorer=fuzz.partial_ratio, limit=5)
        rival = max([sc for _, sc, i in hits if i != ti and len(norms[r["lang"]][i]) >= 0.8 * len(got)] + [0])
        found = true >= 80 and true >= rival
    res.append({**r, "ocr": o, "cer": cer, "found": found})
json.dump(res, open(f"{ROOT}/run/{name}.json", "w"), ensure_ascii=False, indent=0)


def line(label, sub):
    if not sub:
        return
    cer = np.mean([min(1, x["cer"]) for x in sub])
    good = np.mean([x["cer"] <= 0.10 for x in sub])
    print(f"{label:38s} n={len(sub):3d}  char-accuracy={100*(1-cer):5.1f}%  near-perfect={100*good:5.1f}%  source-found={100*np.mean([x['found'] for x in sub]):5.1f}%")


print(f"== {name} (prep={prep}, psm={psm})")
for lang in ("ar", "en"):
    L = [x for x in res if x["lang"] == lang]
    line(f"{lang} all", L)
    line(f"{lang} plain fonts", [x for x in L if not x["decorative"]])
    line(f"{lang} decorative fonts", [x for x in L if x["decorative"]])
    line(f"{lang} fonts held out of training", [x for x in L if x["heldout"]])
    line(f"{lang} white background", [x for x in L if x["kind"] == "plain"])
    line(f"{lang} coloured / photo background", [x for x in L if x["kind"] != "plain"])
    if lang == "ar":
        line("ar vowelled (tashkeel)", [x for x in L if x["vowelled"]])
