"""main.py — خدمة /verify التي تستدعيها الواجهة."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from hadith import check_hadith
import hadeethenc
import quran

# أسماء التصنيفات نفسها المستخدمة في web/cards.js وفي الإضافة (extension/src/shared/i18n.ts).
TYPE = {"مطابق لنص المصحف": "quran", "حديث ثابت": "hadith", "ورد بلفظ مختلف": "wording",
        "ضعيف أو موضوع": "weak", "اختلف العلماء في الحكم عليه": "differed",
        "أحكام العلماء كما وردت في المصدر": "verbatim", "لم نعثر على المصدر": "notfound"}

app = FastAPI(title="Yaqeen API")
# للتجربة المحلية فقط. قيّد allow_origins قبل أي نشر.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Q(BaseModel):
    text: str


@app.get("/")
def health():
    index = quran.load_index()
    enc = hadeethenc.load_index()
    return {"app": "yaqeen", "ok": True,
            "quran_ayat": len(index.ayat) if index else 0,
            "hadeethenc_hadith": len(enc.items) if enc else 0,
            "semantic": bool(index and index.embed), "semantic_model": quran.SEMANTIC_STATUS,
            "hadith_semantic": bool(enc and enc.embed), "hadith_semantic_model": hadeethenc.SEMANTIC_STATUS}


@app.post("/verify")
def verify(q: Q):
    text = q.text.strip()
    if len(text) < 4:
        return {"status": "needs_input", "note": "النص قصير جدًا."}
    # القرآن أولًا، ثم موسوعة الأحاديث النبوية (كلاهما على الخادم نفسه)، ثم الدرر السنية.
    index = quran.load_index()
    r = quran.check_quran(text, index) if index else None
    if r is None:
        enc = hadeethenc.load_index()
        r = hadeethenc.check_hadeethenc(text, enc) if enc else None
    if r is None:
        try:
            r = check_hadith(text)
        except Exception:
            return {"status": "error"}
    s = r.get("source", {})
    return {"status": "ok", "card": {
        "type": TYPE[r["classification"]], "detected": r["detected_text"],
        "source": s.get("reference"), "ruling": s.get("ruling_text"),
        "correct": r.get("correct_wording"), "note": r.get("note"),
        "confidence": r.get("confidence", "low"), "url": s.get("url")}}
