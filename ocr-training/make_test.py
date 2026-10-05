"""Test set: post-style pictures of Quran/hadith (Arabic) and Quran translation (English)."""
import json, os, random, sys
from common import *

rng = random.Random(7)
ar, en = corpus()
os.makedirs(f"{ROOT}/test", exist_ok=True)
rows = []
# Test texts are taken from a fixed slice that training never sees.
test_ar = [x for i, x in enumerate(ar) if i % 10 == 3]
test_en = [x for i, x in enumerate(en) if i % 10 == 3]
json.dump({"ar": [x[1] for x in test_ar], "en": [x[1] for x in test_en]}, open(f"{ROOT}/test_ids.json", "w"))


def make(lang, items, fl, n_per_font):
    for fp in fl:
        fam = family(fp)
        for k in range(n_per_font):
            for _ in range(20):
                src, sid, t = rng.choice(items)
                t = clip_words(t, 25, 160, rng)
                vowelled = lang == "ar" and src == "quran" and rng.random() < 0.4
                shown = t if vowelled else (plain_arabic(t) if lang == "ar" else t)
                if covers(fp, shown):
                    break
            else:
                continue
            img, tags = render_post(shown, fp, rng, lang == "ar")
            name = f"{lang}_{fam}_{os.path.basename(fp)[:12]}_{k}".replace("[", "").replace("]", "")
            path = f"{ROOT}/test/{name}.jpg"
            img.save(path, quality=rng.randint(60, 90))
            rows.append(dict(path=path, lang=lang, font=os.path.basename(fp), family=fam, source=src, id=sid,
                             vowelled=vowelled, text=shown,
                             decorative=fam in (DECOR_AR if lang == "ar" else DECOR_EN),
                             heldout=fam in (HELDOUT_AR if lang == "ar" else HELDOUT_EN), **tags))


# One weight per family is enough for the test (regular, or the first file).
def one_per_family(fl):
    seen = {}
    for p in fl:
        f = family(p)
        if f not in seen or "Regular" in p:
            seen[f] = p
    return list(seen.values())


make("ar", test_ar, one_per_family(fonts("ar")), 6)
make("en", test_en, one_per_family(fonts("en")), 4)
json.dump(rows, open(f"{ROOT}/test.json", "w"), ensure_ascii=False, indent=0)
print(len(rows), sum(r["lang"] == "ar" for r in rows))
