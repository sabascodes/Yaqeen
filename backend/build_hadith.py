"""build_hadith.py — ينزّل أحاديث موسوعة الأحاديث النبوية (HadeethEnc) وينشئ تمثيلاتها الدلالية.

    python build_hadith.py            # تنزيل (إذا لم يُنزّل بعد) ثم التمثيلات
    python build_hadith.py --refresh  # إعادة التنزيل من الموسوعة

الناتج في data/:
- hadeethenc.json             الأحاديث بالعربية {id, text, grade, attribution}
- hadith_embeddings.npy       تمثيل لكل حديث بالنموذج intfloat/multilingual-e5-base (مثل ملف القرآن)
- hadith_embeddings_ids.json  معرّف الحديث لكل صف من الملف السابق

تستخدم الخدمة هذه الملفات، وتضمّن الإضافة التمثيلات عند البناء (npm run build).
التمثيلات تحتاج مكتبات requirements-semantic.txt.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

from hadeethenc import EMBEDDING_IDS, EMBEDDINGS, HADITH_JSON
from quran import EMBED_MODEL

API = "https://hadeethenc.com/api/v1"
# بادئة نصوص المصدر في نماذج e5 (ونص البحث يأخذ "query: ").
PASSAGE_PREFIX = "passage: "


def get(path):
    r = requests.get(f"{API}/{path}", timeout=30)
    r.raise_for_status()
    return r.json()


def list_ids():
    ids = set()
    for cat in get("categories/list/?language=ar"):
        page, last = 1, 1
        while page <= last:
            p = get(f"hadeeths/list/?language=ar&category_id={cat['id']}&page={page}&per_page=100")
            ids.update(str(h["id"]) for h in p["data"])
            last = int(p["meta"]["last_page"])
            page += 1
    return sorted(ids, key=int)


def one(hid):
    h = get(f"hadeeths/one/?language=ar&id={hid}")
    return {"id": str(h["id"]), "text": h["hadeeth"], "grade": h.get("grade", ""),
            "attribution": h.get("attribution", "")}


def download():
    ids = list_ids()
    print(f"عدد الأحاديث: {len(ids)}")
    items = []
    with ThreadPoolExecutor(4) as pool:
        for h in pool.map(one, ids):
            items.append(h)
            print(f"\r{len(items)}/{len(ids)}", end="", flush=True)
    HADITH_JSON.parent.mkdir(exist_ok=True)
    HADITH_JSON.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    print(f"\nحُفظت في {HADITH_JSON}")
    return items


def embed(items):
    try:
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise SystemExit("ثبّتي المكتبات أولًا: pip install -r requirements-semantic.txt")
    model = SentenceTransformer(EMBED_MODEL)
    vectors = model.encode([PASSAGE_PREFIX + h["text"] for h in items], batch_size=32,
                           normalize_embeddings=True, show_progress_bar=True)
    np.save(EMBEDDINGS, vectors.astype("float32"))
    EMBEDDING_IDS.write_text(json.dumps([h["id"] for h in items]), encoding="utf-8")
    print(f"حُفظت التمثيلات {vectors.shape} في {EMBEDDINGS}")


def main():
    if "--refresh" in sys.argv or not HADITH_JSON.exists():
        items = download()
    else:
        items = json.loads(HADITH_JSON.read_text(encoding="utf-8"))
    embed(items)


if __name__ == "__main__":
    main()
