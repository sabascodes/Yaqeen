"""اختبارات ربط القرآن دون إنترنت ودون نموذج: آيات قليلة بالرسم العثماني كما يرجعها المصدر."""
import numpy as np
from fastapi.testclient import TestClient

import main
import quran

AYAT = [
    {"sura": 1, "aya": 5, "text": "إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ"},
    {"sura": 1, "aya": 6, "text": "ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ"},
    {"sura": 2, "aya": 153, "text": "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُواْ ٱسۡتَعِينُواْ بِٱلصَّبۡرِ وَٱلصَّلَوٰةِۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ"},
    {"sura": 103, "aya": 1, "text": "وَٱلۡعَصۡرِ"},
    {"sura": 103, "aya": 2, "text": "إِنَّ ٱلۡإِنسَٰنَ لَفِي خُسۡرٍ"},
    {"sura": 103, "aya": 3, "text": "إِلَّا ٱلَّذِينَ ءَامَنُواْ وَعَمِلُواْ ٱلصَّٰلِحَٰتِ وَتَوَاصَوۡاْ بِٱلۡحَقِّ وَتَوَاصَوۡاْ بِٱلصَّبۡرِ"},
    {"sura": 112, "aya": 1, "text": "قُلۡ هُوَ ٱللَّهُ أَحَدٌ"},
    {"sura": 112, "aya": 2, "text": "ٱللَّهُ ٱلصَّمَدُ"},
    {"sura": 112, "aya": 3, "text": "لَمۡ يَلِدۡ وَلَمۡ يُولَدۡ"},
]
INDEX = quran.QuranIndex(AYAT)


def test_uthmani_matches_everyday_spelling():
    assert quran.skeleton("بِٱلصَّبۡرِ وَٱلصَّلَوٰةِ") == quran.skeleton("بالصبر والصلاة")
    assert quran.skeleton("إِبۡرَٰهِـۧمَ") == quran.skeleton("إبراهيم")


def test_exact_ayah():
    r = quran.check_quran("يا أيها الذين آمنوا استعينوا بالصبر والصلاة إن الله مع الصابرين", INDEX)
    assert r["classification"] == "مطابق لنص المصحف"
    assert r["source"]["reference"] == "سورة البقرة · الآية 153"


def test_one_word_changed():
    r = quran.check_quran("يا أيها الذين آمنوا استعينوا بالصبر والدعاء إن الله مع الصابرين", INDEX)
    assert r["classification"] == "ورد بلفظ مختلف"
    assert r["correct_wording"] == AYAT[2]["text"]


def test_consecutive_ayat_inside_post():
    r = quran.check_quran("تذكير لكل من ضاق صدره: قل هو الله أحد الله الصمد لم يلد ولم يولد. شاركوها", INDEX)
    assert r["classification"] == "مطابق لنص المصحف"
    assert r["source"]["reference"] == "سورة الإخلاص · الآية 1-3"


def test_not_quran():
    assert quran.check_quran("صباح الخير يا أصدقاء، الجو اليوم جميل جدا ونتمنى لكم يوما سعيدا", INDEX) is None


def test_semantic_fallback_needs_some_lexical_overlap():
    rng = np.random.default_rng(0)
    emb = rng.normal(size=(len(AYAT), 8)).astype("float32")
    emb /= np.linalg.norm(emb, axis=1, keepdims=True)
    index = quran.QuranIndex(AYAT, emb, embed=lambda t: emb[2])  # "النموذج" يرى النص قريبًا من البقرة 153
    paraphrase = "يا أيها المؤمنون اطلبوا العون بالصبر وبالصلاة فالله مع الصابرين"
    assert quran.check_quran(paraphrase, INDEX) is None            # حرفيًا وحده: لا يكفي
    r = quran.check_quran(paraphrase, index)
    assert r["classification"] == "ورد بلفظ مختلف"
    assert "153" in r["source"]["reference"]
    assert quran.check_quran("كلام عادي لا علاقة له بأي آية على الإطلاق", index) is None


def test_embeddings_must_match_ayat():
    try:
        quran.QuranIndex(AYAT, np.zeros((3, 8), dtype="float32"))
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_uploaded_embeddings_file_shape():
    emb = np.load(quran.EMBEDDINGS)
    assert emb.shape == (6236, 768)


def test_verify_checks_quran_before_hadith(monkeypatch):
    monkeypatch.setattr(quran, "load_index", lambda: INDEX)
    monkeypatch.setattr(main, "check_hadith", lambda t: (_ for _ in ()).throw(AssertionError("hadith called")))
    card = TestClient(main.app).post("/verify", json={"text": "إياك نعبد وإياك نستعين"}).json()["card"]
    assert card["type"] == "quran"
    assert card["source"] == "سورة الفاتحة · الآية 5"
