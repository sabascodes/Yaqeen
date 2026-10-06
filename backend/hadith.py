"""hadith.py — يبحث في الدرر السنية ويصنّف النتيجة
(حديث ثابت / ضعيف أو موضوع / ورد بلفظ مختلف / اختلف العلماء / لم نعثر).
قائمة ألفاظ الأحكام مطابقة لملف extension/src/core/grades.ts (اعتمدتها صبا)، وأي تعديل يكون في الموضعين."""
import re
from urllib.parse import quote
import requests
from difflib import SequenceMatcher
from bs4 import BeautifulSoup

API = "https://dorar.net/dorar_api.json"
SEARCH_PAGE = "https://dorar.net/hadith/search?q="
FIELDS = ["الراوي", "المحدث", "المصدر", "الصفحة أو الرقم", "خلاصة حكم المحدث"]
# تُفحص بالترتيب: ألفاظ النفي أولًا حتى لا يُقرأ «لا يصح» أو «ليس بصحيح» على أنه «صحيح».
WEAK = ["موضوع", "مكذوب", "كذب", "باطل", "لا اصل له", "لا اصل لها", "ليس له اصل", "لا يصح", "لا يثبت",
        "ليس بصحيح", "غير صحيح", "ليس بثابت", "ضعيف", "منكر", "شاذ", "واه", "معلول", "مضطرب", "مرسل",
        "منقطع", "معضل", "ضعفه", "ضعيفه", "اسناده ضعيف"]
STRONG = ["صحيح", "حسن", "متفق عليه", "ثابت", "اسناده صحيح", "اسناده حسن", "رجاله ثقات", "اورده في صحيحه",
          "جيد", "قوي"]


def normalize(t):
    t = re.sub(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', t)
    t = re.sub('[إأآٱ]', 'ا', t).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', t).strip()


def _has(text, phrase):
    return re.search(rf'(^|\s){phrase}(\s|$)', text) is not None


def grade(ruling):
    t = re.sub(r'[^\u0621-\u064A\s]', ' ', normalize(ruling))
    t = re.sub(r'\s+', ' ', t).strip()
    if any(_has(t, normalize(w)) for w in WEAK):
        return 'weak'
    if any(_has(t, normalize(w)) for w in STRONG) or re.search(r'(^|\s)(صحيح|حسن)\S*', t):
        return 'sahih'
    return 'other'


def letters(t):
    """النص بحروفه فقط، دون تشكيل أو علامات ترقيم."""
    return re.sub(r'\s+', ' ', re.sub(r'[^\u0621-\u064A\s]', ' ', normalize(t))).strip()


def score(q, matn):
    """تشابه النص المكتشف مع متن الحديث (يقارن بأقرب مقطع من المتن بطول النص).
    1.0 تعني أن النص منقول بحروفه، وأي اختلاف في كلمة يجعلها أقل من 1."""
    q, m = letters(q), letters(matn)
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
    rel = [i for s, i in scored if s >= 0.6 and SequenceMatcher(None, letters(i["matn"]), letters(top["matn"])).ratio() >= 0.7]
    # الأحكام التي لم تُفهم ألفاظها تُعرض كما هي، ولا تدخل في تحديد التصنيف.
    known = {grade(i.get("خلاصة حكم المحدث", "")) for i in rel} - {"other"}
    ref = f'{top.get("المصدر", "")} · {top.get("الصفحة أو الرقم", "")}'
    rulings = " | ".join(f'{i.get("المحدث", "")}: {i.get("خلاصة حكم المحدث", "")}' for i in rel)
    base = {"status": "ok", "detected_text": text,
            "source": {"reference": ref, "graded_by": [i.get("المحدث", "") for i in rel], "ruling_text": rulings,
                       "url": SEARCH_PAGE + quote(text)},
            "confidence": "high" if best >= 0.95 else "medium"}
    verbatim = best >= 0.999
    if known == {"sahih", "weak"}:   # خلاف بين المحدثين: نعرض الأقوال كلها دون ترجيح
        return {**base, "classification": "اختلف العلماء في الحكم عليه",
                "note": "اختلف العلماء في الحكم عليه، وهذه أقوالهم كما وردت."}
    if known == {"weak"}:
        return {**base, "classification": "ضعيف أو موضوع", "note": "الحكم منقول من الدرر السنية."}
    if known == {"sahih"}:
        if verbatim:
            return {**base, "classification": "حديث ثابت", "note": "الحكم منقول من الدرر السنية."}
        return {**base, "classification": "ورد بلفظ مختلف", "correct_wording": top["matn"],
                "note": "اللفظ المتداول يختلف عن لفظ المصدر."}
    return {**base, "classification": "أحكام العلماء كما وردت في المصدر",
            "note": "لم نتمكن من تصنيف لفظ الحكم تلقائيًا، فنعرضه كما ورد."}
