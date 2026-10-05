"""quran.py — مطابقة النص مع القرآن الكريم (مطابق لنص المصحف / ورد بلفظ مختلف).

- نص المصحف من موسوعة القرآن الكريم QuranEnc (من ملف المراجع المعتمد)، يُنزّل مرة بـ fetch_quran.py
  إلى data/quran.json.
- التمثيلات الدلالية للآيات في data/quran_embeddings.npy (6236 × 768، بترتيب المصحف)، أنشأها
  النموذج intfloat/multilingual-e5-base، فيُحوَّل نص المنشور بالنموذج نفسه مع البادئة "query: ".
  تعمل إذا ثُبّتت مكتبات requirements-semantic.txt؛ وإلا تعمل المطابقة الحرفية وحدها.
- منطق المطابقة نفسه في الإضافة (extension/src/core/normalize.ts و quranIndex.ts).
"""
import json
import os
import re
from collections import Counter
from pathlib import Path

from rapidfuzz import fuzz

DATA = Path(__file__).parent / "data"
QURAN_JSON = DATA / "quran.json"
EMBEDDINGS = DATA / "quran_embeddings.npy"
# النموذج الذي أنشأ data/quran_embeddings.npy (حسب صبا). ضعي YAQEEN_EMBED_MODEL=off لإيقاف المطابقة الدلالية.
EMBED_MODEL = os.environ.get("YAQEEN_EMBED_MODEL", "intfloat/multilingual-e5-base").strip()
# نماذج e5 تتطلب هذه البادئة قبل نص البحث.
EMBED_QUERY_PREFIX = os.environ.get("YAQEEN_EMBED_QUERY_PREFIX", "query: ")
SEMANTIC_STATUS = "off"

EXACT = 0.98    # أقل من هذا يعني اختلاف كلمة على الأقل
CLOSE = 0.80    # أقل من هذا لا نعدّه نقلًا للآية
# تشابهات e5 متقاربة (الآيات غير المرتبطة نفسها حول 0.8)، فهذا الحد مبدئي ويُعاير على أمثلة حقيقية.
# ولا يكفي وحده: يُشترط معه تشابه حرفي لا يقل عن 0.55.
SEMANTIC_MIN = float(os.environ.get("YAQEEN_SEMANTIC_MIN", "0.88"))
MIN_LETTERS = 12
GRAM = 4

SURAS = ["الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
         "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
         "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
         "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
         "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
         "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
         "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
         "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
         "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
         "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
         "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
         "المسد", "الإخلاص", "الفلق", "الناس"]


def normalize(t):
    """تطبيع للمطابقة فقط؛ ما يُعرض للمستخدم هو نص المصدر كما هو."""
    t = t.replace("ﷺ", " صلى الله عليه وسلم ")
    t = t.replace("وٰ", "ا")      # الصلوٰة → الصلاة (واو ساكنة عليها ألف صغيرة)
    t = t.replace("ۧ", "ي")            # إبرٰهـۧم → إبراهيم
    t = re.sub(r"[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]", "", t)
    t = re.sub("[آأإٱٲٳٵ]", "ا", t)
    t = t.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي").replace("ء", "")
    t = re.sub(r"[^ء-ي\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def skeleton(t):
    """هيكل الحروف دون ألفات ومسافات، حتى يتطابق الرسم العثماني مع الإملائي."""
    return re.sub(r"[ا\s]", "", normalize(t))


def sura_label(sura, first, last):
    ayat = str(first) if first == last else f"{first}-{last}"
    return f"سورة {SURAS[sura - 1]} · الآية {ayat}"


class QuranIndex:
    def __init__(self, ayat, embeddings=None, embed=None):
        """ayat: قائمة {"sura","aya","text"} بترتيب المصحف. embed: دالة تحوّل نصًا إلى متجه."""
        self.ayat = ayat
        self.sk = [skeleton(a["text"]) for a in ayat]
        self.grams = {}
        for i, s in enumerate(self.sk):
            for g in {s[k:k + GRAM] for k in range(len(s) - GRAM + 1)}:
                self.grams.setdefault(g, []).append(i)
        self.embeddings = embeddings
        self.embed = embed
        if embeddings is not None and len(embeddings) != len(ayat):
            raise ValueError(f"عدد التمثيلات {len(embeddings)} لا يساوي عدد الآيات {len(ayat)}")

    def _lexical_candidates(self, q, k=15):
        hits = Counter()
        for g in {q[i:i + GRAM] for i in range(len(q) - GRAM + 1)}:
            hits.update(self.grams.get(g, ()))
        return [i for i, n in hits.most_common(k) if n >= 2]

    def _semantic(self, text, k=10):
        if self.embeddings is None or self.embed is None:
            return []
        v = self.embed(text)
        scores = self.embeddings @ v
        top = scores.argsort()[::-1][:k]
        return [(int(i), float(scores[i])) for i in top]

    def _score(self, q, c):
        """أفضل مطابقة للمقطع حول الآية c (قد تمتد لآيات متتالية من السورة نفسها)."""
        sura = self.ayat[c]["sura"]
        lo, hi = c, c
        while lo > 0 and c - lo < 2 and self.ayat[lo - 1]["sura"] == sura:
            lo -= 1
        while hi + 1 < len(self.ayat) and hi - c < 3 and self.ayat[hi + 1]["sura"] == sura:
            hi += 1
        window = "".join(self.sk[lo:hi + 1])
        al = fuzz.partial_ratio_alignment(q, window)
        if len(q) <= len(window):
            start, end = al.dest_start, al.dest_end
        else:   # المقطع أطول من النافذة: الآيات كلها داخل المنشور
            start, end = 0, len(window)
        first = last = None
        pos = 0
        for i in range(lo, hi + 1):
            a0, a1 = pos, pos + len(self.sk[i])
            overlap = min(end, a1) - max(start, a0)
            if overlap >= min(5, (a1 - a0 + 1) // 2):
                first = i if first is None else first
                last = i
            pos = a1
        if first is None:
            return None
        # أعد الحساب على الآيات المغطّاة فقط حتى لا تُحسب حروف آيات مجاورة لم تُنقل.
        covered = "".join(self.sk[first:last + 1])
        return fuzz.partial_ratio(q, covered) / 100, first, last

    def search(self, text):
        q = skeleton(text)
        if len(q) < MIN_LETTERS:
            return None
        semantic = dict(self._semantic(text))
        best = None
        for c in dict.fromkeys(self._lexical_candidates(q) + list(semantic)):
            r = self._score(q, c)
            if r and (best is None or r[0] > best[0] or (r[0] == best[0] and r[1] < best[1])):
                best = r
        if not best:
            return None
        sim, first, last = best
        if sim < CLOSE and semantic:
            # المطابقة الدلالية للنص المنقول بمعناه: لا تكفي وحدها، بل مع حد أدنى من التشابه الحرفي.
            cos = max(semantic.get(i, 0) for i in range(first, last + 1))
            if cos >= SEMANTIC_MIN and sim >= 0.55:
                sim = CLOSE
        if sim < CLOSE:
            return None
        ayat = self.ayat[first:last + 1]
        return {
            "classification": "مطابق لنص المصحف" if sim >= EXACT else "ورد بلفظ مختلف",
            "similarity": sim,
            "sura": ayat[0]["sura"],
            "first": ayat[0]["aya"],
            "last": ayat[-1]["aya"],
            "text": " ".join(a["text"] for a in ayat),
        }


def check_quran(text, index):
    """نتيجة بصيغة check_hadith نفسها، أو None إذا لم يكن النص آية."""
    r = index.search(text)
    if not r:
        return None
    exact = r["classification"] == "مطابق لنص المصحف"
    out = {
        "status": "ok", "detected_text": text, "classification": r["classification"],
        "source": {"reference": sura_label(r["sura"], r["first"], r["last"]),
                   "url": f"https://quranenc.com/ar/browse/english_saheeh/{r['sura']}#{r['first']}"},
        "confidence": "high" if r["similarity"] >= 0.9 else "medium",
        "note": "النص من موسوعة القرآن الكريم (QuranEnc).",
    }
    if not exact:
        out["correct_wording"] = r["text"]
    else:
        out["quran_text"] = r["text"]
    return out


_index = None
_model = None


def semantic_model():
    """النموذج نفسه للقرآن والحديث، يُحمَّل مرة واحدة. None إذا كان موقوفًا أو لم تُثبَّت مكتباته."""
    global _model, SEMANTIC_STATUS
    if _model is None and EMBED_MODEL.lower() not in ("", "off"):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            SEMANTIC_STATUS = "ثبّتي requirements-semantic.txt لتفعيلها"
        else:
            _model = SentenceTransformer(EMBED_MODEL)
            SEMANTIC_STATUS = EMBED_MODEL
    return _model


def load_index():
    """يحمّل النص والتمثيلات مرة واحدة. يرجع None إذا لم يُنزّل نص المصحف بعد."""
    global _index, SEMANTIC_STATUS
    if _index is not None or not QURAN_JSON.exists():
        return _index
    ayat = json.loads(QURAN_JSON.read_text(encoding="utf-8"))
    embeddings = embed = None
    if not EMBEDDINGS.exists():
        SEMANTIC_STATUS = "data/quran_embeddings.npy غير موجود"
    else:
        model = semantic_model()
        if model is not None:
            import numpy as np
            embeddings = np.load(EMBEDDINGS).astype("float32")
            embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
            embed = lambda t: model.encode(EMBED_QUERY_PREFIX + t, normalize_embeddings=True)
    _index = QuranIndex(ayat, embeddings, embed)
    return _index
