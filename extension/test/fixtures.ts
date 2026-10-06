/**
 * Test-only fixtures in the format the approved sources return.
 * The shipped extension never uses these; it downloads the real data from the sources.
 */
import type { Ayah, EncHadith } from "../src/core/types";

export const AYAT: Ayah[] = [
  { sura: 1, aya: 1, text: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ" },
  { sura: 1, aya: 2, text: "ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ" },
  { sura: 1, aya: 3, text: "ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ" },
  { sura: 1, aya: 4, text: "مَٰلِكِ يَوۡمِ ٱلدِّينِ" },
  { sura: 1, aya: 5, text: "إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ" },
  { sura: 1, aya: 6, text: "ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ" },
  { sura: 1, aya: 7, text: "صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ" },
  {
    sura: 2,
    aya: 153,
    text: "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُواْ ٱسۡتَعِينُواْ بِٱلصَّبۡرِ وَٱلصَّلَوٰةِۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ",
    translation: "O you who have believed, seek help through patience and prayer.",
  },
  { sura: 55, aya: 13, text: "فَبِأَيِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ" },
  { sura: 55, aya: 14, text: "خَلَقَ ٱلۡإِنسَٰنَ مِن صَلۡصَٰلٖ كَٱلۡفَخَّارِ" },
  { sura: 55, aya: 15, text: "وَخَلَقَ ٱلۡجَآنَّ مِن مَّارِجٖ مِّن نَّارٖ" },
  { sura: 55, aya: 16, text: "فَبِأَيِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ" },
  { sura: 103, aya: 1, text: "وَٱلۡعَصۡرِ" },
  { sura: 103, aya: 2, text: "إِنَّ ٱلۡإِنسَٰنَ لَفِي خُسۡرٍ" },
  {
    sura: 103,
    aya: 3,
    text: "إِلَّا ٱلَّذِينَ ءَامَنُواْ وَعَمِلُواْ ٱلصَّٰلِحَٰتِ وَتَوَاصَوۡاْ بِٱلۡحَقِّ وَتَوَاصَوۡاْ بِٱلصَّبۡرِ",
  },
  { sura: 112, aya: 1, text: "قُلۡ هُوَ ٱللَّهُ أَحَدٌ" },
  { sura: 112, aya: 2, text: "ٱللَّهُ ٱلصَّمَدُ" },
  { sura: 112, aya: 3, text: "لَمۡ يَلِدۡ وَلَمۡ يُولَدۡ" },
  { sura: 112, aya: 4, text: "وَلَمۡ يَكُن لَّهُۥ كُفُوًا أَحَدُۢ" },
];

export const ENC: EncHadith[] = [
  {
    id: "2962",
    text: "عن عمر بن الخطاب رضي الله عنه قال: سمعت رسول الله صلى الله عليه وسلم يقول: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى، فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله، ومن كانت هجرته لدنيا يصيبها أو امرأة ينكحها فهجرته إلى ما هاجر إليه».",
    grade: "صحيح",
    attribution: "متفق عليه",
  },
  {
    id: "3048",
    text: "عن أبي هريرة رضي الله عنه أن رسول الله صلى الله عليه وسلم قال: «من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليصمت».",
    grade: "صحيح",
    attribution: "متفق عليه",
  },
];

/** Dorar API `ahadith.result` HTML, in the shape the parser expects. */
export function dorarHtml(rows: { text: string; scholar: string; book: string; num: string; ruling: string }[]): string {
  return rows
    .map(
      (r, i) =>
        `<div class="hadith" style="text-align:justify;">${i + 1} - ${r.text}</div>` +
        `<div class="hadith-info"><span class="info-subtitle">الراوي:</span> أبو هريرة ` +
        `<span class="info-subtitle">المحدث:</span> ${r.scholar} - ` +
        `<span class="info-subtitle">المصدر:</span> ${r.book} - ` +
        `<span class="info-subtitle">الصفحة أو الرقم:</span> ${r.num}<br> ` +
        `<span class="info-subtitle">خلاصة حكم المحدث:</span> <span>${r.ruling}</span></div>`,
    )
    .join("");
}
