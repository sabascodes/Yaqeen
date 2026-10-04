import type { VerdictKind } from "../core/types";

export type Lang = "ar" | "en";

const STRINGS = {
  ar: {
    kinds: {
      quran_exact: "مطابق لنص المصحف",
      hadith_authentic: "حديث ثابت",
      different_wording: "ورد بلفظ مختلف",
      weak_or_fabricated: "ضعيف أو موضوع",
      scholars_differed: "اختلف العلماء في الحكم عليه",
      not_found: "لم نعثر على المصدر",
      rulings_verbatim: "أحكام العلماء كما وردت في المصدر",
    } satisfies Record<VerdictKind, string>,
    notFoundBody: "لم نعثر على هذا النص في مصادرنا المعتمدة. هذا لا يعني الحكم عليه، وإنما أنه غير موجود فيما لدينا.",
    checked: "النص المفحوص",
    correctWording: "اللفظ الصحيح من المصدر",
    sourceText: "النص في المصدر",
    copy: "نسخ اللفظ الصحيح",
    copied: "تم النسخ",
    rulings: "حكم العلماء",
    scholar: "المحدث",
    book: "المصدر",
    number: "الصفحة أو الرقم",
    references: "المرجع",
    alsoAt: "وردت أيضًا في",
    wordingNote: "لفظ المنشور يختلف عن لفظ المصدر.",
    disclaimer:
      "نتيجة آلية من أداة يقين المدعومة بالذكاء الاصطناعي، مبنية على المصادر المعتمدة فقط، وليست فتوى ولا حكمًا من الأداة.",
    checkImage: "فحص النص في الصورة",
    checking: "جارٍ الفحص…",
    ocrResult: "النص المستخرج من الصورة",
    error: "تعذر الفحص الآن",
    noData: "لم تُنزّل بيانات المصادر بعد. افتح إعدادات يقين.",
    yaqeen: "يقين",
  },
  en: {
    kinds: {
      quran_exact: "Matches the Quran text",
      hadith_authentic: "Authentic hadith",
      different_wording: "Reported with different wording",
      weak_or_fabricated: "Weak or fabricated",
      scholars_differed: "Scholars differed in grading it",
      not_found: "Source not found",
      rulings_verbatim: "Scholars' rulings as stated in the source",
    } satisfies Record<VerdictKind, string>,
    notFoundBody:
      "We could not find this text in our approved sources. This is not a judgment on it; it is only absent from what we have.",
    checked: "Checked text",
    correctWording: "Correct wording from the source",
    sourceText: "Text in the source",
    copy: "Copy correct wording",
    copied: "Copied",
    rulings: "Scholars' rulings",
    scholar: "Scholar",
    book: "Book",
    number: "Page or number",
    references: "Reference",
    alsoAt: "Also in",
    wordingNote: "The post's wording differs from the source.",
    disclaimer:
      "Automated result from Yaqeen, an AI-assisted tool, based only on approved sources. It is not a fatwa or a ruling by the tool.",
    checkImage: "Check text in image",
    checking: "Checking…",
    ocrResult: "Text extracted from the image",
    error: "Could not check right now",
    noData: "Source data is not downloaded yet. Open Yaqeen settings.",
    yaqeen: "Yaqeen",
  },
};

export type Strings = (typeof STRINGS)["ar"];

export function t(lang: Lang): Strings {
  return STRINGS[lang];
}
