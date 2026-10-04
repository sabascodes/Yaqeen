"""اختبارات خدمة التحقق دون اتصال بالإنترنت: ردود الدرر هنا نماذج بصيغة الـ API،
وأسماء العلماء والكتب فيها أمثلة وليست مراجع حقيقية.
التشغيل: pip install -r requirements-dev.txt ثم pytest"""
from fastapi.testclient import TestClient

import hadith
import main


def dorar_html(rows):
    return "".join(
        f'<div class="hadith">{i + 1} - {r["text"]}</div>'
        f'<div class="hadith-info"><span class="info-subtitle">الراوي:</span> راوٍ '
        f'<span class="info-subtitle">المحدث:</span> {r["scholar"]} - '
        f'<span class="info-subtitle">المصدر:</span> {r["book"]} - '
        f'<span class="info-subtitle">الصفحة أو الرقم:</span> {r["num"]}<br> '
        f'<span class="info-subtitle">خلاصة حكم المحدث:</span> <span>{r["ruling"]}</span></div>'
        for i, r in enumerate(rows)
    )


TEXT = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى"


def row(ruling, scholar="العالم أ", text=TEXT):
    return {"text": text, "scholar": scholar, "book": "كتاب أ", "num": "1", "ruling": ruling}


def test_grade_terms():
    assert hadith.grade("[صحيح]") == "sahih"
    assert hadith.grade("إسناده حسن") == "sahih"
    assert hadith.grade("ليس بصحيح") == "weak"
    assert hadith.grade("لا يصح") == "weak"
    assert hadith.grade("[موضوع]") == "weak"
    assert hadith.grade("أخرجه في سننه وسكت عنه") == "other"


def test_parse():
    [item] = hadith.parse(dorar_html([row("[صحيح]")]))
    assert item["matn"] == TEXT
    assert item["المحدث"] == "العالم أ"
    assert item["خلاصة حكم المحدث"] == "[صحيح]"


def test_authentic():
    r = hadith.check_hadith(TEXT, dorar_html([row("[صحيح]")]))
    assert r["classification"] == "حديث ثابت"


def test_different_wording():
    r = hadith.check_hadith("إنما الأعمال بالنية وإنما لكل امرئ ما نوى", dorar_html([row("[صحيح]")]))
    assert r["classification"] == "ورد بلفظ مختلف"
    assert r["correct_wording"] == TEXT


def test_weak_with_unclassified_ruling():
    r = hadith.check_hadith(TEXT, dorar_html([row("ضعيف"), row("سكت عنه", "العالم ب")]))
    assert r["classification"] == "ضعيف أو موضوع"


def test_scholars_differed():
    r = hadith.check_hadith(TEXT, dorar_html([row("صحيح"), row("إسناده ضعيف", "العالم ب")]))
    assert r["classification"] == "اختلف العلماء في الحكم عليه"
    assert "العالم أ" in r["source"]["ruling_text"] and "العالم ب" in r["source"]["ruling_text"]


def test_not_found():
    r = hadith.check_hadith(TEXT, "")
    assert r["classification"] == "لم نعثر على المصدر"


def test_verify_endpoint(monkeypatch):
    monkeypatch.setattr(hadith, "fetch", lambda text: dorar_html([row("صحيح"), row("ضعيف", "العالم ب")]))
    client = TestClient(main.app)
    card = client.post("/verify", json={"text": TEXT}).json()["card"]
    assert card["type"] == "differed"
    assert card["url"].startswith("https://dorar.net/hadith/search?q=")
    for label in main.TYPE:  # كل تصنيف يرجعه hadith.py معرّف في TYPE
        assert main.TYPE[label]


def test_verify_short_text():
    assert TestClient(main.app).post("/verify", json={"text": "ab"}).json()["status"] == "needs_input"
