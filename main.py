"""main.py — خدمة /verify التي تستدعيها الواجهة."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from hadith import check_hadith

TYPE = {"مطابق للنص المصحف": "quran", "حديث ثابت": "hadith", "ورد بلفظ مختلف": "wording",
        "ضعيف أو موضوع": "weak", "لم نعثر على المصدر": "notfound"}

app = FastAPI(title="Yaqeen API")
# للتجربة المحلية فقط. قيّد allow_origins قبل أي نشر.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Q(BaseModel):
    text: str


@app.get("/")
def health():
    return {"app": "yaqeen", "ok": True}


@app.post("/verify")
def verify(q: Q):
    text = q.text.strip()
    if len(text) < 4:
        return {"status": "needs_input", "note": "النص قصير جدًا."}
    try:
        r = check_hadith(text)
    except Exception:
        return {"status": "error"}
    if r.get("status") != "ok":
        return {"status": "needs_input", "note": r.get("note")}
    if not r.get("classification"):          # خلاف بين المحدثين
        return {"status": "disputed", "note": r.get("note"), "ruling": r["source"]["ruling_text"]}
    s = r.get("source", {})
    return {"status": "ok", "card": {
        "type": TYPE[r["classification"]], "detected": r["detected_text"],
        "source": s.get("reference"), "ruling": s.get("ruling_text"),
        "correct": r.get("correct_wording"), "note": r.get("note"),
        "confidence": r.get("confidence", "low")}}
