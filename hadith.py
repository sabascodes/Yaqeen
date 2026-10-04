"""hadith.py — يبحث في الدرر السنية ويصنّف النتيجة (حديث ثابت / ضعيف / لفظ مختلف / لم نعثر)."""
import re
import requests
from difflib import SequenceMatcher
from bs4 import BeautifulSoup

API = "https://dorar.net/dorar_api.json"
FIELDS = ["الراوي", "المحدث", "المصدر", "الصفحة أو الرقم", "خلاصة حكم المحدث"]
WEAK = ["ليس بصحيح", "غير صحيح", "لا يصح", "لا أصل", "ضعيف", "موضوع", "منكر", "باطل", "واه"]
STRONG = ["صحيح", "حسن"]


def normalize(t):
    t = re.sub(r'[\u064B-\u065F\u0670\u0640]', '', t)
    t = re.sub('[إأآٱ]', 'ا', t).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', t).strip()


def grade(ruling):
    if any(w in ruling for w in WEAK):
        return 'weak'
    if any(w in ruling for w in STRONG):
        return 'sahih'
    return 'other'


def score(q, matn):
    """تشابه النص المكتشف مع متن الحديث (يقارن بأقرب مقطع من المتن بطول النص)."""
    q, m = normalize(q), normalize(matn)
    if q in m:
        return 1.0
    qw, mw = q.split(), m.split()
    best = SequenceMatcher(None, q, m).ratio() if len(mw) <= len(qw) + 1 else 0.0
    for n in {max(1, len(qw) - 1), len(qw), len(qw) + 1}:
        for i in range(0, max(1, len(mw) - n + 1)):
            best = max(best, SequenceMatcher(None, q, " ".join(mw[i:i + n])).ratio())
    return best


def fetch(text):
    r = requests.get(API, params={"skey": text}, timeout=15)
    r.raise_for_status()
    ah = r.json()["ahadith"]
    if isinstance(ah, dict):
        return ah["result"]                                   # HTML كنص
    return "".join(i.get("th", "") for i in ah)               # قائمة عناصر


def parse(html):
    soup, items = BeautifulSoup(html, "html.parser"), []
    for h in soup.select("div.hadith"):
        info = h.find_next_sibling("div", class_="hadith-info")
        if not info:
            continue
        txt = info.get_text(" ", strip=True)
        pat = "|".join(FIELDS)
        d = {k: v.strip(" -|") for k, v in re.findall(rf"({pat})\s*:\s*(.*?)(?=(?:{pat})\s*:|$)", txt)}
        d["matn"] = re.sub(r'^[\s\d\-–]+', '', h.get_text(" ", strip=True))
        items.append(d)
    return items


def check_hadith(text, html=None):
    items = parse(html if html is not None else fetch(text))
    scored = sorted(((score(text, i["matn"]), i) for i in items), key=lambda x: -x[0])
    if not scored or scored[0][0] < 0.6:
        return {"status": "ok", "detected_text": text, "classification": "لم نعثر على المصدر",
                "confidence": "low", "note": "لا يوجد تطابق كافٍ في الدرر السنية."}
    best = scored[0][0]
    top = scored[0][1]
    # نفس الحديث بروايات/محدثين مختلفين: متنه قريب من متن الأعلى تشابهًا
    rel = [i for s, i in scored if s >= 0.6 and SequenceMatcher(None, normalize(i["matn"]), normalize(top["matn"])).ratio() >= 0.7]
    grades = {grade(i.get("خلاصة حكم المحدث", "")) for i in rel}
    ref = f'{top.get("المصدر", "")} · {top.get("الصفحة أو الرقم", "")}'
    rulings = " | ".join(f'{i.get("المحدث", "")}: {i.get("خلاصة حكم المحدث", "")}' for i in rel)
    base = {"status": "ok", "detected_text": text,
            "source": {"reference": ref, "graded_by": [i.get("المحدث", "") for i in rel], "ruling_text": rulings},
            "confidence": "high" if best >= 0.95 else "medium"}
    if "sahih" in grades and "weak" in grades:   # خلاف بين المحدثين: نعرض الأقوال كلها
        return {**base, "classification": None, "disputed": True,
                "note": "اختلف المحدثون في الحكم، وهذه أقوالهم كما وردت."}
    if grades == {"weak"}:
        return {**base, "classification": "ضعيف أو موضوع", "note": "الحكم منقول من الدرر السنية."}
    if "sahih" in grades:
        if best >= 0.95:
            return {**base, "classification": "حديث ثابت", "note": "الحكم منقول من الدرر السنية."}
        return {**base, "classification": "ورد بلفظ مختلف", "correct_wording": top["matn"],
                "note": "اللفظ المتداول يختلف عن لفظ المصدر."}
    return {"status": "needs_input", "detected_text": text, "note": "تعذّر فهم حكم المحدث تلقائيًا."}
