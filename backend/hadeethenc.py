"""hadeethenc.py — مطابقة النص مع موسوعة الأحاديث النبوية (HadeethEnc) على الخادم نفسه.

- الأحاديث في data/hadeethenc.json، والتمثيلات في data/hadith_embeddings.npy مع ترتيبها في
  data/hadith_embeddings_ids.json. ينشئ الثلاثة: python build_hadith.py
- الموسوعة تنشر الأحاديث الثابتة فقط، فالنتيجة "حديث ثابت" إذا نُقل الحديث بحروفه، و"ورد بلفظ مختلف"
  مع اللفظ الصحيح إذا اختلفت كلمة. يُعرض الحكم والتخريج كما نشرتهما الموسوعة.
- منطق المطابقة نفسه في الإضافة (extension/src/core/hadithIndex.ts و checker.ts).
"""
import json
import os
import re
from collections import Counter
from pathlib import Path

from rapidfuzz import fuzz

import quran
from quran import skeleton

DATA = Path(__file__).parent / "data"
HADITH_JSON = DATA / "hadeethenc.json"
EMBEDDINGS = DATA / "hadith_embeddings.npy"
EMBEDDING_IDS = DATA / "hadith_embeddings_ids.json"
SEMANTIC_STATUS = "off"

EXACT = 0.99    # الحديث يُعدّ ثابتًا باللفظ المنقول فقط إذا نُقل بحروفه
CLOSE = 0.72
SEMANTIC_FLOOR = 0.55
SEMANTIC_MIN = float(os.environ.get("YAQEEN_SEMANTIC_MIN", "0.88"))
MIN_LETTERS = 12
GRAM = 4

# عبارات تسبق الحديث أو تليه في المنشورات، تُحذف حتى يُطابق المتن وحده (كما في extension/src/core/detect.ts).
_LEAD_INS = [r"^.*?(قال|يقول) (رسول الله|النبي)( صلى الله عليه وسلم)?",
             r"^.*?عن (رسول الله|النبي)( صلى الله عليه وسلم)?( انه)?( قال)?"]
_TAILS = [r"(رواه .*|متفق عليه.*|اخرجه .*)$"]


def strip_framing(text):
    t = re.sub("[إأآ]", "ا", text.replace("ﷺ", " صلى الله عليه وسلم "))
    t = re.sub(r"\s+", " ", t).strip()
    for p in _LEAD_INS + _TAILS:
        t = re.sub(p, "", t)
    return t.strip(" :،.\"«»“”")


class HadithIndex:
    def __init__(self, items, embeddings=None, ids=None, embed=None):
        """items: قائمة {"id","text","grade","attribution"}. ids: معرّفات صفوف embeddings بترتيبها."""
        self.items = items
        self.sk = [skeleton(h["text"]) for h in items]
        self.grams = {}
        for i, s in enumerate(self.sk):
            for g in {s[k:k + GRAM] for k in range(len(s) - GRAM + 1)}:
                self.grams.setdefault(g, []).append(i)
        self.embeddings = embeddings
        self.embed = embed
        # صف التمثيل → موضع الحديث في items (قد تختلف النسخة المنزّلة عن نسخة التمثيلات).
        pos = {str(h["id"]): i for i, h in enumerate(items)}
        self.row_pos = [pos.get(str(i), -1) for i in ids] if ids is not None else []
        if embeddings is not None and len(embeddings) != len(self.row_pos):
            raise ValueError(f"عدد التمثيلات {len(embeddings)} لا يساوي عدد المعرّفات {len(self.row_pos)}")

    def _semantic(self, text, k=10):
        """أقرب الأحاديث معنى: {موضع الحديث: تشابه}."""
        if self.embeddings is None or self.embed is None:
            return {}
        scores = self.embeddings @ self.embed(text)
        out = {}
        for r in scores.argsort()[::-1]:
            if self.row_pos[r] >= 0:
                out[self.row_pos[r]] = float(scores[r])
                if len(out) == k:
                    break
        return out

    def _score(self, q, i):
        return fuzz.partial_ratio(q, self.sk[i]) / 100

    def search(self, text):
        """(التشابه، الحديث) أو None."""
        matn = strip_framing(text)
        q = skeleton(matn)
        if len(q) < MIN_LETTERS:
            return None
        hits = Counter()
        for g in {q[i:i + GRAM] for i in range(len(q) - GRAM + 1)}:
            hits.update(self.grams.get(g, ()))
        best = max(((self._score(q, i), i) for i, n in hits.most_common(10) if n >= 3), default=None)
        if best is None or best[0] < CLOSE:
            # المعنى وحده لا يكفي: يُشترط معه تشابه حرفي أدنى، والنتيجة "ورد بلفظ مختلف" دائمًا.
            for i, cos in self._semantic(matn).items():
                if cos >= SEMANTIC_MIN and self._score(q, i) >= SEMANTIC_FLOOR:
                    best = (CLOSE, i)
                    break
        if best is None or best[0] < CLOSE:
            return None
        return best[0], self.items[best[1]]


def check_hadeethenc(text, index):
    """نتيجة بصيغة check_hadith نفسها، أو None إذا لم يوجد الحديث في الموسوعة."""
    r = index.search(text)
    if not r:
        return None
    sim, h = r
    ruling = " · ".join(x for x in (h.get("grade", ""), h.get("attribution", "")) if x)
    out = {"status": "ok", "detected_text": text,
           "source": {"reference": f"موسوعة الأحاديث النبوية · {h.get('attribution', '')}", "ruling_text": ruling,
                      "url": f"https://hadeethenc.com/ar/browse/hadith/{h['id']}"},
           "confidence": "high" if sim >= 0.9 else "medium",
           "note": "الحكم والتخريج كما نشرتهما موسوعة الأحاديث النبوية."}
    if sim >= EXACT:
        return {**out, "classification": "حديث ثابت"}
    return {**out, "classification": "ورد بلفظ مختلف", "correct_wording": h["text"]}


_index = None


def load_index():
    """يحمّل الأحاديث والتمثيلات مرة واحدة. يرجع None إذا لم يُنزّل ملف الموسوعة بعد."""
    global _index, SEMANTIC_STATUS
    if _index is not None or not HADITH_JSON.exists():
        return _index
    items = json.loads(HADITH_JSON.read_text(encoding="utf-8"))
    embeddings = ids = embed = None
    if not (EMBEDDINGS.exists() and EMBEDDING_IDS.exists()):
        SEMANTIC_STATUS = "data/hadith_embeddings.npy غير موجود"
    else:
        model = quran.semantic_model()
        SEMANTIC_STATUS = quran.SEMANTIC_STATUS
        if model is not None:
            import numpy as np
            embeddings = np.load(EMBEDDINGS).astype("float32")
            embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
            ids = json.loads(EMBEDDING_IDS.read_text(encoding="utf-8"))
            embed = lambda t: model.encode(quran.EMBED_QUERY_PREFIX + t, normalize_embeddings=True)
    _index = HadithIndex(items, embeddings, ids, embed)
    return _index
