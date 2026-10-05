"""اختبارات مطابقة موسوعة الأحاديث النبوية دون إنترنت ودون نموذج. النصوص هنا أمثلة للاختبار فقط."""
import numpy as np

import hadeethenc

ITEMS = [
    {"id": "1", "text": "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى", "grade": "صحيح", "attribution": "متفق عليه"},
    {"id": "2", "text": "الدين النصيحة قلنا لمن قال لله ولكتابه ولرسوله ولأئمة المسلمين وعامتهم",
     "grade": "صحيح", "attribution": "رواه مسلم"},
]
INDEX = hadeethenc.HadithIndex(ITEMS)


def test_verbatim_is_authentic():
    r = hadeethenc.check_hadeethenc("قال رسول الله ﷺ: إنما الأعمال بالنيات وإنما لكل امرئ ما نوى", INDEX)
    assert r["classification"] == "حديث ثابت"
    assert r["source"]["ruling_text"] == "صحيح · متفق عليه"
    assert r["source"]["url"].endswith("/1")


def test_one_word_changed_gives_correct_wording():
    r = hadeethenc.check_hadeethenc("إنما الأعمال بالنية وإنما لكل امرئ ما نوى", INDEX)
    assert r["classification"] == "ورد بلفظ مختلف"
    assert r["correct_wording"] == ITEMS[0]["text"]


def test_unrelated_text_is_not_matched():
    assert hadeethenc.check_hadeethenc("الصبر مفتاح الفرج وكل شيء بقضاء وقدر", INDEX) is None


def _semantic_index(cos_row):
    """تمثيلات وهمية: الصف cos_row يشبه أي نص بحث بدرجة 0.95، والباقي 0."""
    emb = np.zeros((2, 2), dtype="float32")
    emb[cos_row] = [0.95, np.sqrt(1 - 0.95 ** 2)]
    emb[1 - cos_row] = [0, 1]
    return hadeethenc.HadithIndex(ITEMS, emb, ["1", "2"], embed=lambda t: np.array([1, 0], dtype="float32"))


def test_semantic_needs_some_wording_in_common():
    paraphrase = "الدين هو النصح لله ولكتابه ولرسوله ولحكام المسلمين وعامة الناس"
    r = hadeethenc.check_hadeethenc(paraphrase, _semantic_index(1))
    assert r["classification"] == "ورد بلفظ مختلف"
    assert r["correct_wording"] == ITEMS[1]["text"]
    # المعنى وحده (دون تشابه حرفي كافٍ) لا يكفي
    assert hadeethenc.check_hadeethenc("كن ناصحا للجميع في كل وقت وحين", _semantic_index(1)) is None


def test_embeddings_follow_ids_not_file_order():
    # الحديث 3 في التمثيلات غير موجود في النسخة المنزّلة فيُتجاهل
    emb = np.array([[0, 1], [0.95, 0.31], [0, 1]], dtype="float32")
    idx = hadeethenc.HadithIndex(ITEMS, emb, ["1", "2", "3"], embed=lambda t: np.array([1, 0], dtype="float32"))
    assert idx._semantic("x", k=1) == {1: np.float32(0.95).item()}
